import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_refusal_message, get_score_explanation
from llm_client import call_architect_llm, stream_architect_llm, stream_multi_agent_masterplan
from api.routes.sessions import _serialize

router = APIRouter(prefix="/sessions", tags=["architect"])


class MessageRequest(BaseModel):
    content: str


async def _process_message(session, req_content: str, db: AsyncSession):
    """Shared logic: appends message, calls LLM, updates DB. Returns (serialized, message_text, refusal)."""
    history = list(session.conversation_history or [])
    history.append({"role": "user", "content": req_content})

    current_scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }

    llm_response = await call_architect_llm(history, current_scores, session.turn_number)
    history.append({"role": "assistant", "content": llm_response["message"]})

    updated_scores = apply_delta(current_scores, llm_response.get("eval_delta", {}))
    total = compute_total_score(updated_scores)
    new_phase = get_phase(total)

    masterplan = session.masterplan
    agent_reports = list(session.agent_reports or [])
    if new_phase == "masterplan" and not masterplan:
        masterplan = await _generate_masterplan_sync(history)

    session.conversation_history = history
    session.problem_clarity = updated_scores["problem_clarity"]
    session.scale_constraints = updated_scores["scale_constraints"]
    session.tech_context = updated_scores["tech_context"]
    session.success_definition = updated_scores["success_definition"]
    session.risk_awareness = updated_scores["risk_awareness"]
    session.phase = new_phase
    session.turn_number = session.turn_number + 1
    session.assumptions = list(session.assumptions or []) + llm_response.get("new_assumptions", [])
    session.masterplan = masterplan
    session.agent_reports = agent_reports

    await db.commit()
    await db.refresh(session)

    return _serialize(session), llm_response["message"], get_refusal_message(total), llm_response.get("choices", [])


async def _generate_masterplan_sync(conversation_history: list) -> str:
    """Fallback for the non-streaming route: collect all agent reports then synthesize."""
    from llm_client import run_specialist_agent, SPECIALIST_AGENTS, _build_synthesis_prompt, _call_real_llm
    import asyncio
    tasks = [run_specialist_agent(a, conversation_history) for a in SPECIALIST_AGENTS]
    reports = await asyncio.gather(*tasks)
    system = _build_synthesis_prompt(list(reports))
    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    return await _call_real_llm(system, msgs, max_tokens=3000)


@router.post("/{session_id}/message")
async def send_message(
    session_id: str, req: MessageRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    serialized, message_text, refusal, _choices = await _process_message(session, req.content, db)
    return {**serialized, "latest_response": message_text, "refusal": refusal}


@router.post("/{session_id}/message/stream")
async def send_message_stream(
    session_id: str, req: MessageRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Capture all session state before entering the async generator
    initial_idea = session.initial_idea
    turn_number = session.turn_number
    original_assumptions = list(session.assumptions or [])
    original_masterplan = session.masterplan
    original_agent_reports = list(session.agent_reports or [])

    history = list(session.conversation_history or [])
    history.append({"role": "user", "content": req.content})
    current_scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }

    async def event_stream():
        message_text = ""

        async for event in stream_architect_llm(history, current_scores, turn_number):
            if event["type"] == "token":
                message_text += event["delta"]
                yield f"data: {json.dumps({'type': 'token', 'delta': event['delta']})}\n\n"

            elif event["type"] == "result":
                llm_response = event["data"]
                full_history = history + [{"role": "assistant", "content": message_text}]
                updated_scores = apply_delta(current_scores, llm_response.get("eval_delta", {}))
                total = compute_total_score(updated_scores)
                new_phase = get_phase(total)
                # Server-side override: if model said analysis is ready or turn limit hit, force masterplan
                if "activating specialist analysis" in message_text.lower() or (turn_number + 1) >= 9:
                    new_phase = "masterplan"
                new_assumptions = original_assumptions + llm_response.get("new_assumptions", [])
                new_turn_number = turn_number + 1

                masterplan = original_masterplan
                new_agent_reports = list(original_agent_reports)

                if new_phase == "masterplan" and not masterplan:
                    # Multi-agent pipeline: stream each specialist report as it arrives,
                    # then stream the synthesis tokens
                    async for ma_event in stream_multi_agent_masterplan(full_history):
                        if ma_event["type"] == "agent_report":
                            new_agent_reports.append(ma_event["report"])
                            yield f"data: {json.dumps({'type': 'agent_report', 'report': ma_event['report']})}\n\n"
                        elif ma_event["type"] == "synthesis_token":
                            yield f"data: {json.dumps({'type': 'synthesis_token', 'delta': ma_event['delta']})}\n\n"
                        elif ma_event["type"] == "synthesis_done":
                            masterplan = ma_event["text"]

                await db.execute(
                    update(Session)
                    .where(Session.id == session_id)
                    .values(
                        conversation_history=full_history,
                        problem_clarity=updated_scores["problem_clarity"],
                        scale_constraints=updated_scores["scale_constraints"],
                        tech_context=updated_scores["tech_context"],
                        success_definition=updated_scores["success_definition"],
                        risk_awareness=updated_scores["risk_awareness"],
                        phase=new_phase,
                        turn_number=new_turn_number,
                        assumptions=new_assumptions,
                        masterplan=masterplan,
                        agent_reports=new_agent_reports,
                    )
                )
                await db.commit()

                # Only show choices when not in masterplan phase (server-computed, not model-reported)
                choices = llm_response.get("choices", []) if new_phase != "masterplan" else []
                refusal = get_refusal_message(total)
                serialized = {
                    "id": session_id,
                    "initial_idea": initial_idea,
                    "scores": updated_scores,
                    "total_score": total,
                    "phase": new_phase,
                    "turn_number": new_turn_number,
                    "conversation_history": full_history,
                    "assumptions": new_assumptions,
                    "masterplan": masterplan,
                    "agent_reports": new_agent_reports,
                    "explanations": get_score_explanation(updated_scores),
                }

                if choices:
                    yield f"data: {json.dumps({'type': 'choices', 'choices': choices})}\n\n"
                done_payload = {**serialized, "refusal": refusal}
                yield f"data: {json.dumps({'type': 'done', 'session': done_payload})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
