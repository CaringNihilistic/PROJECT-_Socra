"""
Clerk JWT verification. Returns user_id (str) or None.
When CLERK_SECRET_KEY / CLERK_FRONTEND_API_URL are not set, auth is disabled
and every request is treated as anonymous — the app still works normally.
"""
import asyncio
import time
from typing import Optional

import httpx
from jose import JWTError, jwt

from core.config import settings

_jwks_cache: dict = {"keys": None, "expires_at": 0.0}
_jwks_lock = asyncio.Lock()


async def _get_jwks() -> dict:
    async with _jwks_lock:
        if _jwks_cache["keys"] and time.time() < _jwks_cache["expires_at"]:
            return _jwks_cache["keys"]
        url = f"{settings.clerk_frontend_api_url}/.well-known/jwks.json"
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url)
            r.raise_for_status()
        _jwks_cache["keys"] = r.json()
        _jwks_cache["expires_at"] = time.time() + 3600  # cache 1 h
    return _jwks_cache["keys"]


async def get_user_id(authorization: Optional[str] = None) -> Optional[str]:
    """
    Extract Clerk user ID from Authorization header.
    Returns None when auth is disabled or token is invalid — callers decide
    whether to reject or allow anonymous access.
    """
    if not settings.clerk_secret_key or not settings.clerk_frontend_api_url:
        return None
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        jwks = await _get_jwks()
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            return None
        payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
        return payload.get("sub")
    except (JWTError, Exception):
        return None
