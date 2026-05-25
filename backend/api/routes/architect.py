import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_refusal_message, get_score_explanation
from llm_client import call_architect_llm, stream_architect_llm, stream_multi_agent_masterplan, stream_followup_llm, generate_pitch_deck, generate_pitch_deck_html, generate_debate
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
    normalized = [{"text": a, "status": "unknown"} if isinstance(a, str) else a for a in (session.assumptions or [])]
    new_raw = [{"text": a, "status": "unknown"} if isinstance(a, str) else a for a in llm_response.get("new_assumptions", [])]
    session.assumptions = normalized + new_raw
    session.masterplan = masterplan
    session.agent_reports = agent_reports

    await db.commit()
    await db.refresh(session)

    return _serialize(session), llm_response["message"], get_refusal_message(total), llm_response.get("choices", [])


async def _generate_masterplan_sync(conversation_history: list) -> str:
    """Fallback for the non-streaming route: collect all agent reports then synthesize."""
    from llm_client import run_all_agents_combined, run_specialist_agent, SPECIALIST_AGENTS, _build_synthesis_prompt, _call_real_llm
    from core.config import settings
    if settings.anthropic_api_key or settings.google_api_key:
        import asyncio
        tasks = [run_specialist_agent(a, conversation_history) for a in SPECIALIST_AGENTS]
        reports = list(await asyncio.gather(*tasks))
    else:
        reports = await run_all_agents_combined(conversation_history)
    system = _build_synthesis_prompt(reports)
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
    original_assumptions = [
        {"text": a, "status": "unknown"} if isinstance(a, str) else a
        for a in (session.assumptions or [])
    ]
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

        # Follow-up mode: masterplan already exists — use advisory prompt, no scoring
        if original_masterplan:
            async for event in stream_followup_llm(history, original_masterplan):
                if event["type"] == "token":
                    message_text += event["delta"]
                    yield f"data: {json.dumps({'type': 'token', 'delta': event['delta']})}\n\n"
                elif event["type"] == "result":
                    full_history = history + [{"role": "assistant", "content": message_text}]
                    await db.execute(
                        update(Session)
                        .where(Session.id == session_id)
                        .values(conversation_history=full_history, turn_number=turn_number + 1)
                    )
                    await db.commit()
                    followup_serialized = {
                        "id": session_id,
                        "initial_idea": initial_idea,
                        "scores": current_scores,
                        "total_score": compute_total_score(current_scores),
                        "phase": "masterplan",
                        "turn_number": turn_number + 1,
                        "conversation_history": full_history,
                        "assumptions": original_assumptions,
                        "masterplan": original_masterplan,
                        "agent_reports": original_agent_reports,
                        "explanations": get_score_explanation(current_scores),
                    }
                    yield f"data: {json.dumps({'type': 'done', 'session': followup_serialized})}\n\n"
            return

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
                new_assumptions = original_assumptions + [
                    {"text": a, "status": "unknown"} if isinstance(a, str) else a
                    for a in llm_response.get("new_assumptions", [])
                ]
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


@router.post("/{session_id}/pitch-deck")
async def create_pitch_deck(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.masterplan:
        raise HTTPException(400, "Masterplan must be generated before creating a pitch deck")

    # Return cached deck if already generated
    if session.pitch_deck:
        return session.pitch_deck

    deck = await generate_pitch_deck(
        conversation_history=list(session.conversation_history or []),
        agent_reports=list(session.agent_reports or []),
        masterplan=session.masterplan,
    )

    await db.execute(
        update(Session).where(Session.id == session_id).values(pitch_deck=deck)
    )
    await db.commit()
    return deck


@router.post("/{session_id}/pitch-deck/html", response_class=HTMLResponse)
async def export_pitch_deck_html(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.pitch_deck:
        raise HTTPException(400, "Generate the pitch deck first")

    # Find devil's advocate content from agent reports
    agent_reports = list(session.agent_reports or [])
    devil = next((r for r in agent_reports if r.get("key") == "devils_advocate"), None)
    devil_content = devil.get("content", "") if devil else ""

    html = await generate_pitch_deck_html(
        deck=session.pitch_deck,
        devil_content=devil_content,
        idea=session.initial_idea,
    )

    if not html:
        raise HTTPException(503, "HTML generation failed — try again")

    return HTMLResponse(content=html, headers={
        "Content-Disposition": f'attachment; filename="pitch-deck.html"'
    })


@router.post("/{session_id}/debate")
async def create_debate(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.masterplan:
        raise HTTPException(400, "Masterplan must be generated before running a debate")

    if session.debate:
        return session.debate

    debate = await generate_debate(
        conversation_history=list(session.conversation_history or []),
        agent_reports=list(session.agent_reports or []),
        masterplan=session.masterplan,
    )

    await db.execute(
        update(Session).where(Session.id == session_id).values(debate=debate)
    )
    await db.commit()
    return debate
