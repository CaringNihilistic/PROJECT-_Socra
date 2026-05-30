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


async def _verify_token(authorization: Optional[str]) -> Optional[dict]:
    """Verify a Clerk JWT and return its payload, or None when invalid/disabled."""
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
        return jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
    except (JWTError, Exception):
        return None


async def get_user_id(authorization: Optional[str] = None) -> Optional[str]:
    """
    Extract Clerk user ID from Authorization header.
    Returns None when auth is disabled or token is invalid — callers decide
    whether to reject or allow anonymous access.
    """
    payload = await _verify_token(authorization)
    return payload.get("sub") if payload else None


# user_id -> primary email, cached to avoid hitting the Clerk API on every admin check
_email_cache: dict[str, str] = {}


async def _fetch_clerk_email(user_id: str) -> Optional[str]:
    """Look up a Clerk user's primary email via the Backend API. Cached per user_id."""
    if user_id in _email_cache:
        return _email_cache[user_id]
    if not settings.clerk_secret_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            r.raise_for_status()
        data = r.json()
        primary_id = data.get("primary_email_address_id")
        email = next(
            (e.get("email_address") for e in data.get("email_addresses", [])
             if e.get("id") == primary_id),
            None,
        )
        if not email and data.get("email_addresses"):
            email = data["email_addresses"][0].get("email_address")
        if email:
            _email_cache[user_id] = email
        return email
    except Exception:
        return None


async def is_admin(authorization: Optional[str] = None) -> bool:
    """True when the request's verified Clerk identity is on the ADMIN_EMAILS allowlist.
    The allowlist accepts emails (preferred) or raw Clerk user IDs as a fallback.
    When Clerk auth is not configured at all, the deployment is treated as an open
    dev environment and every request is admin (matches the app's no-auth behavior)."""
    if not settings.clerk_secret_key or not settings.clerk_frontend_api_url:
        return True
    allow = settings.admin_identifiers
    if not allow:
        return False
    payload = await _verify_token(authorization)
    if not payload:
        return False
    user_id = payload.get("sub")
    if user_id and user_id.lower() in allow:
        return True
    # Email may be present as a custom claim; otherwise look it up via the Clerk API
    email = payload.get("email")
    if not email and user_id:
        email = await _fetch_clerk_email(user_id)
    return bool(email and email.lower() in allow)


async def get_identity(authorization: Optional[str] = None) -> dict:
    """Return identity + admin diagnostics for the current request."""
    allow = settings.admin_identifiers
    clerk_host = (settings.clerk_frontend_api_url or "").replace("https://", "").replace("http://", "").rstrip("/")
    base = {"user_id": None, "email": None, "is_admin": False, "admin_count": len(allow),
            "token_ok": False, "email_source": "none", "clerk_url": clerk_host, "verify_reason": ""}

    if not settings.clerk_secret_key or not settings.clerk_frontend_api_url:
        return {**base, "is_admin": True, "token_ok": None, "verify_reason": "clerk_disabled"}
    if not authorization or not authorization.startswith("Bearer "):
        return {**base, "verify_reason": "no_bearer"}
    token = authorization.removeprefix("Bearer ").strip()
    try:
        jwks = await _get_jwks()
    except Exception as e:
        return {**base, "verify_reason": f"jwks_fetch_failed:{type(e).__name__}"}
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            return {**base, "verify_reason": f"kid_not_in_jwks:{kid}"}
        payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
    except Exception as e:
        return {**base, "verify_reason": f"decode_failed:{type(e).__name__}"}

    user_id = payload.get("sub")
    email = payload.get("email")
    email_source = "jwt" if email else "none"
    if not email and user_id:
        email = await _fetch_clerk_email(user_id)
        email_source = "clerk_api" if email else "lookup_failed"
    admin = bool(allow and (
        (user_id and user_id.lower() in allow) or (email and email.lower() in allow)
    ))
    return {"user_id": user_id, "email": email, "is_admin": admin, "admin_count": len(allow),
            "token_ok": True, "email_source": email_source, "clerk_url": clerk_host, "verify_reason": "ok"}
