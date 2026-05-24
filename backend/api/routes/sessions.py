import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from db.database import get_db
from db.models import Session
from eval_bar import apply_delta, compute_total_score, get_phase, get_score_explanation
from llm_client import call_architect_llm
from core.auth import get_user_id

try:
    from openai import RateLimitError as _OpenAIRateLimitError
except ImportError:
    _OpenAIRateLimitError = None

router = APIRouter(prefix="/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    idea: str


def _serialize(session: Session) -> dict:
    scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }
    return {
        "id": session.id,
        "initial_idea": session.initial_idea,
        "scores": scores,
        "total_score": compute_total_score(scores),
        "phase": session.phase,
        "turn_number": session.turn_number,
        "conversation_history": session.conversation_history or [],
        "assumptions": session.assumptions or [],
        "masterplan": session.masterplan,
        "explanations": get_score_explanation(scores),
    }


def _serialize_summary(session: Session) -> dict:
    scores = {
        "problem_clarity": session.problem_clarity,
        "scale_constraints": session.scale_constraints,
        "tech_context": session.tech_context,
        "success_definition": session.success_definition,
        "risk_awareness": session.risk_awareness,
    }
    return {
        "id": session.id,
        "initial_idea": session.initial_idea,
        "phase": session.phase,
        "total_score": compute_total_score(scores),
        "has_masterplan": session.masterplan is not None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = await get_user_id(authorization)
    if not user_id:
        raise HTTPException(401, "Authentication required to list sessions")
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(desc(Session.created_at))
        .limit(20)
    )
    return [_serialize_summary(s) for s in result.scalars().all()]


@router.post("/")
async def create_session(
    req: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = await get_user_id(authorization)

    initial_history = [{"role": "user", "content": req.idea}]
    initial_scores = {k: 0.0 for k in ("problem_clarity", "scale_constraints", "tech_context", "success_definition", "risk_awareness")}

    try:
        llm_response = await call_architect_llm(initial_history, initial_scores, 0)
    except Exception as e:
        if _OpenAIRateLimitError and isinstance(e, _OpenAIRateLimitError):
            raise HTTPException(status_code=429, detail="AI rate limit reached. Please wait a few minutes and try again.")
        raise HTTPException(status_code=503, detail="AI service unavailable. Please try again shortly.")
    initial_history.append({"role": "assistant", "content": llm_response["message"]})

    updated_scores = apply_delta(initial_scores, llm_response.get("eval_delta", {}))

    session = Session(
        id=str(uuid.uuid4()),
        user_id=user_id,
        initial_idea=req.idea,
        conversation_history=initial_history,
        assumptions=llm_response.get("new_assumptions", []),
        problem_clarity=updated_scores["problem_clarity"],
        scale_constraints=updated_scores["scale_constraints"],
        tech_context=updated_scores["tech_context"],
        success_definition=updated_scores["success_definition"],
        risk_awareness=updated_scores["risk_awareness"],
        phase=get_phase(compute_total_score(updated_scores)),
        turn_number=1,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {**_serialize(session), "choices": llm_response.get("choices", [])}


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    return _serialize(session)
