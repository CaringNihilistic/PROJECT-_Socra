import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_refusal_message, get_score_explanation
from llm_client import call_architect_llm, stream_architect_llm, stream_multi_agent_masterplan, stream_followup_llm, generate_pitch_deck, stream_tribunal_turn, generate_tribunal_verdicts
from api.routes.sessions import _serialize, _check_session_access

router = APIRouter(prefix="/sessions", tags=["architect"])


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


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
    from llm_client import run_all_agents_combined, run_specialist_agent, SPECIALIST_AGENTS, _build_synthesis_prompt, _call_real_llm, _build_agent_msgs
    from core.config import settings
    if settings.anthropic_api_key or settings.google_api_key:
        import asyncio
        shared_msgs = _build_agent_msgs(conversation_history)
        tasks = [run_specialist_agent(a, shared_msgs) for a in SPECIALIST_AGENTS]
        reports = list(await asyncio.gather(*tasks))
    else:
        reports = await run_all_agents_combined(conversation_history)
    system = _build_synthesis_prompt(reports)
    msgs = _build_agent_msgs(conversation_history)  # clean single-message format
    return await _call_real_llm(system, msgs, max_tokens=3000)


@router.post("/{session_id}/message")
async def send_message(
    session_id: str,
    req: MessageRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)

    serialized, message_text, refusal, _choices = await _process_message(session, req.content, db)
    return {**serialized, "latest_response": message_text, "refusal": refusal}


@router.post("/{session_id}/message/stream")
async def send_message_stream(
    session_id: str,
    req: MessageRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)

    # Capture all session state before entering the async generator
    initial_idea = session.initial_idea
    turn_number = session.turn_number
    is_paid = bool(getattr(session, "paid", False))
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
                    _clean = message_text.strip().replace("*", "").replace("#", "").replace("-", "").strip()
                    full_history = history + ([{"role": "assistant", "content": message_text}] if len(_clean) > 15 else [])
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
                # Only save if response is substantive — guards against truncated streams (e.g. "**")
                _clean = message_text.strip().replace("*", "").replace("#", "").replace("-", "").strip()
                full_history = history + ([{"role": "assistant", "content": message_text}] if len(_clean) > 15 else [])
                updated_scores = apply_delta(current_scores, llm_response.get("eval_delta", {}))
                total = compute_total_score(updated_scores)
                new_phase = get_phase(total)
                # Server-side override: if model said analysis is ready or turn limit hit, force masterplan.
                # Phrase check requires turn_number >= 2 to prevent a 1-turn LLM echo bypass.
                phrase_trigger = "activating specialist analysis" in message_text.lower() and turn_number >= 2
                if phrase_trigger or (turn_number + 1) >= 9:
                    new_phase = "masterplan"
                new_assumptions = original_assumptions + [
                    {"text": a, "status": "unknown"} if isinstance(a, str) else a
                    for a in llm_response.get("new_assumptions", [])
                ]
                new_turn_number = turn_number + 1

                masterplan = original_masterplan
                new_agent_reports: list = []  # always start fresh on each masterplan generation

                if new_phase == "masterplan" and not masterplan:
                    if not is_paid:
                        # Gate: save progress, emit payment_required, stop.
                        # Always fires — /unlock or /dev-paid handles the next step.
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
                                phase="masterplan",
                                turn_number=new_turn_number,
                                assumptions=new_assumptions,
                            )
                        )
                        await db.commit()
                        yield f"data: {json.dumps({'type': 'payment_required', 'session_id': session_id})}\n\n"
                        return

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
async def create_pitch_deck(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)
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


@router.post("/{session_id}/unlock")
async def unlock_masterplan(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """Generate masterplan for a session that has been paid for."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)
    if not session.paid:
        raise HTTPException(402, "Payment required to unlock masterplan")
    if session.masterplan:
        return _serialize(session)  # Already generated — idempotent

    history = list(session.conversation_history or [])
    original_agent_reports = list(session.agent_reports or [])
    initial_idea = session.initial_idea
    current_scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }
    assumptions = [
        {"text": a, "status": "unknown"} if isinstance(a, str) else a
        for a in (session.assumptions or [])
    ]
    turn_number = session.turn_number

    async def unlock_stream():
        new_agent_reports: list = []  # always start fresh — don't carry over failed previous attempts
        masterplan = None

        async for ma_event in stream_multi_agent_masterplan(history):
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
            .values(masterplan=masterplan, agent_reports=new_agent_reports, phase="masterplan")
        )
        await db.commit()

        from eval_bar import compute_total_score, get_score_explanation
        serialized = {
            "id": session_id,
            "initial_idea": initial_idea,
            "scores": current_scores,
            "total_score": compute_total_score(current_scores),
            "phase": "masterplan",
            "turn_number": turn_number,
            "conversation_history": history,
            "assumptions": assumptions,
            "masterplan": masterplan,
            "agent_reports": new_agent_reports,
            "explanations": get_score_explanation(current_scores),
        }
        yield f"data: {json.dumps({'type': 'done', 'session': serialized})}\n\n"

    return StreamingResponse(
        unlock_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{session_id}/tribunal/message")
async def send_tribunal_message(
    session_id: str,
    req: MessageRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)

    tribunal_history = list(session.tribunal_history or [])
    round_number = len(tribunal_history) // 4 + 1

    if round_number > 4:
        raise HTTPException(400, "Tribunal complete — use /tribunal/unlock to generate verdicts")

    is_tribunal_paid = bool(getattr(session, "tribunal_paid", False))
    initial_idea = session.initial_idea

    async def event_stream():
        updated_history = tribunal_history + [{"role": "user", "content": req.content}]

        async for event in stream_tribunal_turn(tribunal_history, req.content, round_number):
            if event["type"] == "persona_token":
                yield f"data: {json.dumps({'type': 'persona_token', 'persona': event['persona'], 'delta': event['delta']})}\n\n"
            elif event["type"] == "persona_done":
                updated_history.append({
                    "role": "assistant",
                    "persona": event["persona"],
                    "content": event["content"],
                })
                yield f"data: {json.dumps({'type': 'persona_done', 'persona': event['persona'], 'content': event['content']})}\n\n"
            elif event["type"] == "round_done":
                await db.execute(
                    update(Session)
                    .where(Session.id == session_id)
                    .values(tribunal_history=updated_history, mode="tribunal")
                )
                await db.commit()

                # Always emit round_complete so frontend has the full history
                yield f"data: {json.dumps({'type': 'round_complete', 'round': round_number, 'tribunal_history': updated_history})}\n\n"

                if round_number >= 4:
                    if not is_tribunal_paid:
                        # Always gate — /tribunal/unlock or /dev-paid handles the next step.
                        yield f"data: {json.dumps({'type': 'payment_required', 'session_id': session_id})}\n\n"
                        return

                    verdicts = await generate_tribunal_verdicts(updated_history, initial_idea)
                    await db.execute(
                        update(Session)
                        .where(Session.id == session_id)
                        .values(tribunal_verdicts=verdicts)
                    )
                    await db.commit()
                    yield f"data: {json.dumps({'type': 'tribunal_verdict', 'verdicts': verdicts})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{session_id}/tribunal/unlock")
async def unlock_tribunal_verdicts(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """Generate verdicts for a tribunal_paid session (idempotent)."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)
    if not session.tribunal_paid:
        raise HTTPException(402, "Payment required to unlock tribunal verdicts")

    if session.tribunal_verdicts:
        return {"verdicts": session.tribunal_verdicts}

    verdicts = await generate_tribunal_verdicts(
        list(session.tribunal_history or []), session.initial_idea
    )
    await db.execute(
        update(Session).where(Session.id == session_id).values(tribunal_verdicts=verdicts)
    )
    await db.commit()
    return {"verdicts": verdicts}
