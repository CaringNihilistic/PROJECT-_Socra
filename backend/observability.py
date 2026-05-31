"""
Optional Langfuse v4 observability — all functions no-op when LANGFUSE_SECRET_KEY is unset.

Design: ContextVar for session propagation, context manager for each generation.

Usage:
  1. At the start of each streaming generator or route handler, call:
       set_session_id(session_id)
  2. Inside each LLM provider function, wrap the API call with:
       with trace_generation("anthropic", "claude-haiku-4-5-20251001", input_msgs) as gen:
           result = await provider_api_call(...)
           if gen:
               gen.update(output=result, usage_details={"input_tokens": n, "output_tokens": m})
"""
import sys
import logging
import contextvars
from contextlib import contextmanager, nullcontext
from typing import Optional, Any

log = logging.getLogger(__name__)

_session_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "lf_session_id", default=None
)

_lf_client = None


def _client():
    """Lazy singleton — creates the Langfuse v4 client once, or returns None if unconfigured."""
    global _lf_client
    if _lf_client is None:
        from core.config import settings
        if settings.langfuse_secret_key and settings.langfuse_public_key:
            try:
                from langfuse import Langfuse
                import os
                _lf_client = Langfuse(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    base_url=settings.langfuse_host or "https://cloud.langfuse.com",
                    # Enable debug via env var: LANGFUSE_DEBUG=true in Railway
                    debug=os.getenv("LANGFUSE_DEBUG", "").lower() in ("true", "1"),
                )
                if _lf_client.auth_check():
                    log.info("Langfuse connected — tracing active (base_url=%s)",
                             settings.langfuse_host or "https://cloud.langfuse.com")
                else:
                    log.warning("Langfuse auth_check failed — traces will not be sent. Check keys.")
                    _lf_client = None
            except ImportError:
                log.warning("langfuse package not installed — observability disabled")
            except Exception as e:
                log.warning("Langfuse init failed: %s", e)
    return _lf_client


def flush():
    """Flush pending Langfuse events — called on FastAPI shutdown."""
    lf = _lf_client
    if lf:
        try:
            lf.flush()
        except Exception:
            pass


def set_session_id(session_id: Optional[str]) -> None:
    """Tag all LLM calls in this async task with the given session UUID."""
    _session_id_ctx.set(session_id)


@contextmanager
def trace_generation(
    name: str,
    model: str,
    input: Any,
    metadata: Optional[dict] = None,
):
    """Wrap one LLM call as a Langfuse generation. No-op when Langfuse is not configured.

    Correctly handles both normal exits and exceptions from inside the caller's with-block
    without triggering the double-yield RuntimeError that the naive try/except pattern causes.
    """
    lf = _client()
    if not lf:
        yield None
        return

    # --- Setup phase: enter context managers. If anything here fails, yield None
    # and return cleanly (one yield, no exception leaks to caller). ---------------
    session_id = _session_id_ctx.get()

    try:
        from langfuse import propagate_attributes
        _prop_ctx = propagate_attributes(session_id=session_id) if session_id else nullcontext()
    except Exception:
        _prop_ctx = nullcontext()

    try:
        _prop_ctx.__enter__()
        obs_ctx = lf.start_as_current_observation(
            as_type="generation",
            name=name,
            model=model,
            input=input,
            metadata=metadata or {},
        )
        gen = obs_ctx.__enter__()
    except Exception as e:
        log.warning("Langfuse observation setup failed (%s): %s", name, e)
        yield None
        return

    # --- Yield phase: give gen to caller. Capture any caller exception so we can
    # pass it to __exit__ correctly (Langfuse records the span even on error). ----
    caller_exc = (None, None, None)
    try:
        yield gen
    except Exception:
        caller_exc = sys.exc_info()
        raise
    finally:
        # Always exit both context managers, passing the exception info if any.
        # This is what records the observation in Langfuse.
        try:
            obs_ctx.__exit__(*caller_exc)
        except Exception as e:
            log.debug("Langfuse obs_ctx exit error: %s", e)
        try:
            _prop_ctx.__exit__(*caller_exc)
        except Exception:
            pass
