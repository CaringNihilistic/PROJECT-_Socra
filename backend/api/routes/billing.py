import hmac
import hashlib
import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from db.database import get_db
from db.models import Session
from core.config import settings

router = APIRouter(prefix="/billing", tags=["billing"])


def _razorpay_client():
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(503, "Billing not configured")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


class CheckoutRequest(BaseModel):
    session_id: str
    success_url: str
    mode: str = "standard"  # "standard" | "tribunal"


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == req.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    is_tribunal = req.mode == "tribunal"
    if is_tribunal and session.tribunal_paid:
        return {"already_paid": True}
    if not is_tribunal and session.paid:
        return {"already_paid": True}

    client = _razorpay_client()
    idea_preview = session.initial_idea[:60] + ("…" if len(session.initial_idea) > 60 else "")
    amount = settings.razorpay_tribunal_amount if is_tribunal else settings.razorpay_price_amount
    description = "Socra — Startup Tribunal Verdict" if is_tribunal else "Socra — Full Startup Analysis"

    link = client.payment_link.create({
        "amount": amount,
        "currency": "INR",
        "description": description,
        "accept_partial": False,
        "callback_url": req.success_url,
        "callback_method": "get",
        "notes": {
            "socra_session_id": req.session_id,
            "socra_mode": req.mode,
            "idea": idea_preview,
        },
    })

    return {"checkout_url": link["short_url"], "payment_link_id": link["id"]}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Razorpay webhook — payment_link.paid marks session paid (standard or tribunal)."""
    if not settings.razorpay_webhook_secret:
        raise HTTPException(503, "Webhook not configured")

    payload = await request.body()
    received_sig = request.headers.get("x-razorpay-signature", "")

    expected = hmac.new(
        settings.razorpay_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received_sig, expected):
        raise HTTPException(400, "Invalid signature")

    import json
    event = json.loads(payload)

    if event.get("event") == "payment_link.paid":
        payment_link = event.get("payload", {}).get("payment_link", {}).get("entity", {})
        if payment_link.get("status") == "paid":
            notes = payment_link.get("notes", {})
            sid = notes.get("socra_session_id")
            mode = notes.get("socra_mode", "standard")
            if sid:
                if mode == "tribunal":
                    await db.execute(update(Session).where(Session.id == sid).values(tribunal_paid=True))
                else:
                    await db.execute(update(Session).where(Session.id == sid).values(paid=True))
                await db.commit()

    return {"ok": True}


class VerifyRequest(BaseModel):
    payment_link_id: str
    session_id: str
    mode: str = "standard"


@router.post("/verify")
async def verify_payment(req: VerifyRequest, db: AsyncSession = Depends(get_db)):
    """Fallback: fetch payment link from Razorpay and mark session paid."""
    client = _razorpay_client()

    try:
        link = client.payment_link.fetch(req.payment_link_id)
    except Exception:
        raise HTTPException(400, "Could not retrieve payment link")

    if link.get("status") != "paid":
        raise HTTPException(402, "Payment not completed")

    notes = link.get("notes", {})
    sid = notes.get("socra_session_id")
    mode = notes.get("socra_mode", req.mode)

    if sid != req.session_id:
        raise HTTPException(400, "Session mismatch")

    if mode == "tribunal":
        await db.execute(update(Session).where(Session.id == sid).values(tribunal_paid=True))
    else:
        await db.execute(update(Session).where(Session.id == sid).values(paid=True))
    await db.commit()

    return {"ok": True, "session_id": sid, "mode": mode}
