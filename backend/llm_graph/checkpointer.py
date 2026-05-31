"""
LangGraph Phase 2 — Postgres checkpointer.

Uses a SEPARATE psycopg (v3) connection pool, NOT the asyncpg/SQLAlchemy
engine. The two drivers are incompatible and must not share a pool.

Lifecycle: setup_checkpointer() is called once in FastAPI lifespan startup.
           teardown_checkpointer() closes the pool on shutdown.
           get_checkpointer() returns the singleton (or None if disabled/failed).

When None is returned, council_graph falls back to MemorySaver so the
LangGraph pipeline still works — just without durable checkpoints.
"""
import logging
from typing import Optional

log = logging.getLogger(__name__)

_checkpointer = None  # AsyncPostgresSaver singleton
_pool = None          # psycopg AsyncConnectionPool singleton


async def setup_checkpointer() -> None:
    """
    Build the psycopg pool and create LangGraph checkpoint tables.
    Idempotent — safe to call on every startup.
    Only runs when LANGGRAPH_ENABLED=true.
    """
    global _checkpointer, _pool
    from core.config import settings
    if not settings.langgraph_enabled:
        return

    try:
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        # SQLAlchemy uses postgresql+asyncpg:// — psycopg needs plain postgresql://
        connstr = (
            settings.database_url
            .replace("postgresql+asyncpg://", "postgresql://")
            .replace("postgresql+psycopg://", "postgresql://")
        )

        _pool = AsyncConnectionPool(
            connstr,
            min_size=1,
            max_size=5,  # modest pool — keeps Railway Postgres connection count low
            open=False,
        )
        await _pool.open()

        _checkpointer = AsyncPostgresSaver(_pool)
        # Creates checkpoints / checkpoint_writes / checkpoint_blobs tables if absent
        await _checkpointer.setup()

        log.info("LangGraph Postgres checkpointer ready (thread_id = session_id)")
    except Exception as exc:
        log.warning("LangGraph checkpointer setup failed — falling back to MemorySaver: %s", exc)
        _checkpointer = None


async def teardown_checkpointer() -> None:
    """Close the psycopg pool gracefully. Called in lifespan shutdown."""
    global _pool
    if _pool:
        try:
            await _pool.close()
            log.info("LangGraph checkpointer pool closed")
        except Exception:
            pass


def get_checkpointer():
    """Return the configured checkpointer, or None if not set up."""
    return _checkpointer
