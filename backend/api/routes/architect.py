import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_refusal_message
from llm_client import call_architect_llm, generate_masterplan
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
    if new_phase == "masterplan" and not masterplan:
        masterplan = await generate_masterplan(history)

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

    await db.commit()
    await db.refresh(session)

    return _serialize(session), llm_response["message"], get_refusal_message(total), llm_response.get("choices", [])


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

    # Process synchronously first (LLM call + DB update), then stream the text
    serialized, message_text, refusal, choices = await _process_message(session, req.content, db)

    async def event_stream():
        words = message_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'token', 'delta': chunk})}\n\n"
            await asyncio.sleep(0.04)
        if choices:
            yield f"data: {json.dumps({'type': 'choices', 'choices': choices})}\n\n"
        done_payload = {**serialized, "refusal": refusal}
        yield f"data: {json.dumps({'type': 'done', 'session': done_payload})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
