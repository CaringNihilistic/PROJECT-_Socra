import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_refusal_message, get_score_explanation
from llm_client import call_architect_llm, stream_architect_llm, stream_multi_agent_masterplan, stream_followup_llm, generate_pitch_deck
from api.routes.sessions import _serialize, _check_session_access
from core.auth import is_admin
from llm_client import generate_founder_answer
from observability import set_session_id

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
        masterplan, agent_reports = await _generate_masterplan_sync(history)

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


async def _generate_masterplan_sync(conversation_history: list) -> tuple[str, list]:
    """Non-streaming council run (used by /message and admin seeding): agents, synthesis,
    then devil's advocate. Returns (masterplan, agent_reports) — callers must save the
    reports too, or the Council tab shows "0 of 5 advisors"."""
    from llm_client import run_all_agents_combined, run_specialist_agent, run_devils_advocate, SPECIALIST_AGENTS, _build_synthesis_prompt, _call_real_llm, _build_agent_msgs, SYNTHESIS_MAX_TOKENS, GROQ_SYNTHESIS_MAX_TOKENS
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
    masterplan = await _call_real_llm(system, msgs, max_tokens=SYNTHESIS_MAX_TOKENS, groq_max_tokens=GROQ_SYNTHESIS_MAX_TOKENS)
    if masterplan:
        reports.append(await run_devils_advocate(masterplan, conversation_history))
    return masterplan, reports


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
    return _stream_turn(session_id, session, db, req.content)


@router.post("/{session_id}/start/stream")
async def start_session_stream(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """Stream the opening question of a session created with POST /sessions/?stream=true."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)
    # Only a fresh session gets an opening: a double click or a retry after success must not
    # add a second first question
    if session.masterplan or any(m.get("role") == "assistant" for m in (session.conversation_history or [])):
        raise HTTPException(409, "Session already started")
    return _stream_turn(session_id, session, db, None)


def _stream_turn(session_id: str, session: Session, db: AsyncSession, user_content: Optional[str]) -> StreamingResponse:
    """One streamed chat turn: Socra's reply to user_content, or (None) the opening question."""
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
    if user_content is not None:
        history.append({"role": "user", "content": user_content})
    current_scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }

    async def event_stream():
        set_session_id(session_id)
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
    set_session_id(session_id)

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
    use_langgraph: bool = Query(False, description="Admin-only: use LangGraph pipeline"),
    force: bool = Query(False, description="Admin-only: regenerate even if a masterplan exists"),
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """Generate masterplan for a session that has been paid for."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await _check_session_access(session, authorization)
    # Idempotent for everyone; an admin can force a regeneration ([ADMIN] Re-run).
    # Without this, Re-run got the plain-JSON early return and silently did nothing.
    if session.masterplan and not (force and await is_admin(authorization)):
        return _serialize(session)

    # Resolve pipeline: LangGraph when requested and feature flag is on
    from core.config import settings as _settings
    use_lg = use_langgraph and _settings.langgraph_enabled

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
        set_session_id(session_id)
        new_agent_reports: list = []
        masterplan = None
        pipeline_label = "langgraph" if use_lg else "legacy"

        # Select pipeline — identical event vocabulary, no changes to SSE mapping
        if use_lg:
            from llm_graph.council_graph import stream_council_graph
            event_gen = stream_council_graph(session_id, history)
        else:
            event_gen = stream_multi_agent_masterplan(history)

        async for ma_event in event_gen:
            if ma_event["type"] == "web_research":
                yield f"data: {json.dumps({'type': 'web_research', 'queries': ma_event.get('queries', [])})}\n\n"
            elif ma_event["type"] == "agent_report":
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
        yield f"data: {json.dumps({'type': 'done', 'session': serialized, 'pipeline': pipeline_label})}\n\n"

    return StreamingResponse(
        unlock_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{session_id}/admin-seed-conversation")
async def admin_seed_conversation(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """Admin testing only: auto-play a realistic founder conversation, generate the
    masterplan, and mark the session paid — one call to test masterplan QUALITY
    without typing every turn. Requires the caller to be on the ADMIN_EMAILS allowlist."""
    if not await is_admin(authorization):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.mode == "tribunal":
        raise HTTPException(400, "Seeding is only for standard (masterplan) sessions")

    idea = session.initial_idea
    # Auto-play up to 5 founder turns or until the masterplan phase is reached
    for _ in range(5):
        if session.masterplan or session.phase == "masterplan":
            break
        answer = await generate_founder_answer(idea, list(session.conversation_history or []))
        await _process_message(session, answer, db)

    # Ensure a masterplan exists even if the eval didn't quite cross the threshold
    if not session.masterplan:
        masterplan, reports = await _generate_masterplan_sync(list(session.conversation_history or []))
        session.masterplan = masterplan
        session.agent_reports = reports
        session.phase = "masterplan"

    session.paid = True
    await db.commit()
    await db.refresh(session)
    return _serialize(session)
