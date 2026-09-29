import hmac
import hashlib
from urllib.parse import urlparse
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


def _allowed_callback_hosts() -> set[str]:
    """Razorpay may only redirect back to the configured frontend (or local dev)."""
    hosts = {"localhost", "127.0.0.1"}
    frontend_host = urlparse(settings.frontend_origin).hostname
    if frontend_host:
        hosts.add(frontend_host)
    return hosts


def _validate_callback_url(url: str) -> None:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
    except Exception:
        raise HTTPException(400, "Invalid success_url")
    if host not in _allowed_callback_hosts():
        raise HTTPException(400, "Invalid success_url domain")


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    _validate_callback_url(req.success_url)
    result = await db.execute(select(Session).where(Session.id == req.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    if session.paid:
        return {"already_paid": True}

    client = _razorpay_client()
    idea_preview = session.initial_idea[:60] + ("…" if len(session.initial_idea) > 60 else "")

    link = client.payment_link.create({
        "amount": settings.razorpay_price_amount,
        "currency": "INR",
        "description": "Socra — Full Startup Analysis",
        "accept_partial": False,
        "callback_url": req.success_url,
        "callback_method": "get",
        "notes": {
            "socra_session_id": req.session_id,
            "idea": idea_preview,
        },
    })

    return {"checkout_url": link["short_url"], "payment_link_id": link["id"]}


def _verify_signature(payload: bytes, received_sig: str, secret: str) -> bool:
    """Verify a Razorpay webhook HMAC-SHA256 signature using constant-time comparison."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received_sig, expected)


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Razorpay webhook — payment_link.paid marks the session paid."""
    if not settings.razorpay_webhook_secret:
        raise HTTPException(503, "Webhook not configured")

    payload = await request.body()
    received_sig = request.headers.get("x-razorpay-signature", "")

    if not _verify_signature(payload, received_sig, settings.razorpay_webhook_secret):
        raise HTTPException(400, "Invalid signature")

    import json
    event = json.loads(payload)

    if event.get("event") == "payment_link.paid":
        payment_link = event.get("payload", {}).get("payment_link", {}).get("entity", {})
        if payment_link.get("status") == "paid":
            notes = payment_link.get("notes", {})
            sid = notes.get("socra_session_id")
            if sid:
                await db.execute(update(Session).where(Session.id == sid).values(paid=True))
                await db.commit()

    return {"ok": True}


class VerifyRequest(BaseModel):
    payment_link_id: str
    session_id: str


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

    if sid != req.session_id:
        raise HTTPException(400, "Session mismatch")

    await db.execute(update(Session).where(Session.id == sid).values(paid=True))
    await db.commit()

    return {"ok": True, "session_id": sid}
