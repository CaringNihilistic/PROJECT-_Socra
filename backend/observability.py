"""
Optional Langfuse v4 observability — all functions no-op when LANGFUSE_SECRET_KEY is unset.

Design: ContextVar for session propagation, context manager for each generation.

Usage:
  1. At the start of each streaming generator or route handler, call:
       set_session_id(session_id)
     This stores the session UUID in a Python ContextVar. The value is automatically
     copied into any asyncio.create_task() children spawned afterward (e.g. parallel
     council agents), so all parallel LLM calls in one request share the same session_id.

  2. Inside each LLM provider function, wrap the API call with:
       with trace_generation("anthropic", "claude-haiku-4-5-20251001", input_msgs) as gen:
           result = await provider_api_call(...)
           if gen:
               gen.update(output=result, usage_details={"input_tokens": n, "output_tokens": m})
     trace_generation reads the current session_id from the ContextVar and attaches it
     to the Langfuse observation via propagate_attributes, so every generation is tagged
     with its session. No root span is needed — Langfuse's Sessions view groups all
     generations that share a session_id.

Why not a root span? FastAPI's StreamingResponse iterates the generator AFTER the route
handler returns. Context managers opened at route-handler level exit before any streaming
happens. Using ContextVar + per-generation propagate_attributes sidesteps this completely.
"""
import contextvars
from contextlib import contextmanager, nullcontext
from typing import Optional, Any

# Stores the current Socra session UUID. Set once per request; read inside each LLM call.
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
                import logging as _log
                # v4 uses base_url= (not host=). Passing it explicitly ensures Railway env
                # vars take precedence over any SDK defaults.
                _lf_client = Langfuse(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    base_url=settings.langfuse_host or "https://cloud.langfuse.com",
                )
                if _lf_client.auth_check():
                    _log.getLogger(__name__).info("Langfuse connected — tracing active")
                else:
                    _log.getLogger(__name__).warning("Langfuse auth_check failed — check keys")
                    _lf_client = None
            except ImportError:
                import logging
                logging.getLogger(__name__).warning(
                    "langfuse package not installed — observability disabled"
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("Langfuse init failed: %s", e)
    return _lf_client


def flush():
    """Flush pending Langfuse events — call on FastAPI shutdown to avoid losing buffered traces."""
    lf = _lf_client
    if lf:
        try:
            lf.flush()
        except Exception:
            pass


def set_session_id(session_id: Optional[str]) -> None:
    """Tag all subsequent LLM calls in this async task with the given session UUID.

    Call once at the top of each event_stream() generator or route handler.
    The ContextVar value is automatically copied into asyncio.create_task() children
    at task-creation time, so parallel agent calls (council, tribunal) all inherit it.

    No-op when Langfuse is not configured — safe to call unconditionally.
    """
    _session_id_ctx.set(session_id)


@contextmanager
def trace_generation(
    name: str,
    model: str,
    input: Any,
    metadata: Optional[dict] = None,
):
    """Wrap one LLM API call as a Langfuse generation tagged with the current session.

    Automatically reads the session_id set by set_session_id() and attaches it to the
    observation via propagate_attributes — no manual plumbing needed at the call site.
    Yields None and is a complete no-op when Langfuse is not configured.

    name:   label in Langfuse ("anthropic", "groq", "anthropic/agent", etc.)
    model:  exact model string ("claude-haiku-4-5-20251001", "gemini-2.0-flash", etc.)
    input:  the messages/prompt sent to the LLM

    Usage:
        with trace_generation("anthropic", "claude-haiku-4-5-20251001", msgs) as gen:
            response = await client.messages.create(...)
            if gen:
                gen.update(
                    output=response.content[0].text,
                    usage_details={
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                    }
                )
    """
    lf = _client()
    if not lf:
        yield None
        return
    try:
        session_id = _session_id_ctx.get()
        # propagate_attributes attaches session_id to this observation and all
        # child observations created inside the with block.
        try:
            from langfuse import propagate_attributes
            _prop_ctx = propagate_attributes(session_id=session_id) if session_id else nullcontext()
        except ImportError:
            _prop_ctx = nullcontext()

        with _prop_ctx:
            with lf.start_as_current_observation(
                as_type="generation",
                name=name,
                model=model,
                input=input,
                metadata=metadata or {},
            ) as gen:
                yield gen
    except Exception:
        yield None
