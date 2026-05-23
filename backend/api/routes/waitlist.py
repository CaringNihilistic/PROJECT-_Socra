from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from db.database import get_db
from db.models import WaitlistEntry

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistRequest(BaseModel):
    email: str


@router.post("")
async def join_waitlist(body: WaitlistRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    if "@" not in email or len(email) > 320:
        raise HTTPException(status_code=422, detail="Invalid email address")

    existing = await db.execute(select(WaitlistEntry).where(WaitlistEntry.email == email))
    if existing.scalar_one_or_none():
        return {"status": "already_registered"}

    entry = WaitlistEntry(email=email)
    db.add(entry)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"status": "already_registered"}

    return {"status": "registered"}
