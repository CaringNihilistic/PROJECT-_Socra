from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta, timezone
import httpx

from db.database import get_db
from db.models import Session as DBSession
from core.config import settings

router = APIRouter(tags=["followup"])


class FollowUpEmailRequest(BaseModel):
    email: str


@router.post("/sessions/{session_id}/follow-up")
async def save_follow_up_email(
    session_id: str,
    req: FollowUpEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DBSession).where(DBSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.follow_up_email = req.email
    await db.commit()
    return {"ok": True}


@router.post("/admin/send-follow-ups")
async def send_follow_up_emails(
    x_admin_secret: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != settings.secret_key:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not settings.resend_api_key:
        raise HTTPException(status_code=503, detail="Resend API key not configured")

    cutoff_start = datetime.now(timezone.utc) - timedelta(days=91)
    cutoff_end = datetime.now(timezone.utc) - timedelta(days=89)

    result = await db.execute(
        select(DBSession).where(
            and_(
                DBSession.follow_up_email.is_not(None),
                DBSession.follow_up_sent == False,  # noqa: E712
                DBSession.created_at >= cutoff_start,
                DBSession.created_at <= cutoff_end,
            )
        )
    )
    sessions = result.scalars().all()

    sent = 0
    failed = 0
    async with httpx.AsyncClient() as client:
        for sess in sessions:
            grade = None
            if sess.tribunal_verdicts and isinstance(sess.tribunal_verdicts, dict):
                grade = sess.tribunal_verdicts.get("composite_grade")

            scores = [sess.problem_clarity, sess.scale_constraints, sess.tech_context,
                      sess.success_definition, sess.risk_awareness]
            if all(s is not None for s in scores):
                avg = sum(scores) / 5
                score_line = f"Your idea scored <strong style='color:#f5f0e8;'>{avg:.1f}/10</strong> overall."
            else:
                score_line = ""

            idea_short = (sess.initial_idea or "your idea")[:80]
            if len(sess.initial_idea or "") > 80:
                idea_short += "…"

            html = _build_email_html(idea_short, grade, score_line, sess.created_at)

            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Socra <noreply@socra.app>",
                    "to": [sess.follow_up_email],
                    "subject": "90 days later — what happened to your idea?",
                    "html": html,
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                sess.follow_up_sent = True
                sent += 1
            else:
                failed += 1

    await db.commit()
    return {"sent": sent, "failed": failed, "total": len(sessions)}


def _build_email_html(idea: str, grade: str | None, score_line: str, created_at) -> str:
    grade_color = {
        "GREENLIT": "#34d399",
        "STRONG": "#f59e0b",
        "CHALLENGED": "#e85d26",
        "REJECTED": "#dc2626",
    }.get(grade or "", "#8a8578")

    grade_badge = (
        f'<span style="color:{grade_color};font-weight:700;">{grade}</span>. '
        if grade else ""
    )

    run_date = ""
    if created_at:
        try:
            run_date = created_at.strftime("%B %d, %Y")
        except Exception:
            pass

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;min-height:100vh;">
  <tr><td align="center" style="padding:48px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#141312;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;max-width:100%;">

      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#4a4640;font-family:monospace;">SOCRA</p>
        <h1 style="margin:0;font-size:26px;font-weight:700;color:#f5f0e8;line-height:1.3;">
          90 days later — what happened?
        </h1>
      </td></tr>

      <tr><td style="padding:20px 36px 0;">
        <p style="margin:0;font-size:14px;color:#8a8578;line-height:1.75;">
          {f'On {run_date}, you' if run_date else 'You'} ran <strong style="color:#f5f0e8;">"{idea}"</strong> through Socra's interrogation.
          {grade_badge}{score_line}
        </p>
        <p style="margin:16px 0 0;font-size:14px;color:#8a8578;line-height:1.75;">
          90 days is enough time to have shipped, pivoted, or moved on entirely.
          We'd love to know what actually happened — founders who close the loop help make Socra better for everyone.
        </p>
      </td></tr>

      <tr><td style="padding:28px 36px 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 12px 0 0;">
              <a href="https://socra.app" style="display:inline-block;padding:13px 24px;background:linear-gradient(135deg,#f59e0b,#e85d26);color:#0d0c0b;font-size:13px;font-weight:700;letter-spacing:0.05em;text-decoration:none;border-radius:10px;">
                I built it →
              </a>
            </td>
            <td style="padding:0 12px 0 0;">
              <a href="https://socra.app" style="display:inline-block;padding:13px 24px;background:rgba(255,255,255,0.05);color:#a09a94;font-size:13px;font-weight:600;letter-spacing:0.05em;text-decoration:none;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                I pivoted
              </a>
            </td>
            <td>
              <a href="https://socra.app" style="display:inline-block;padding:13px 24px;background:rgba(255,255,255,0.05);color:#a09a94;font-size:13px;font-weight:600;letter-spacing:0.05em;text-decoration:none;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                I moved on
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:32px 36px;">
        <p style="margin:0;font-size:12px;color:#3a3632;line-height:1.6;">
          You opted in to this reminder when you used Socra. ·
          <a href="https://socra.app" style="color:#3a3632;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""
