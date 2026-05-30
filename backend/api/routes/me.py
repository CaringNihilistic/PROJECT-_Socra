from typing import Optional

from fastapi import APIRouter, Header

from core.auth import get_identity

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    """Return the current request's identity and whether it is an admin.
    Used by the frontend to decide whether to show admin/dev shortcuts."""
    return await get_identity(authorization)
