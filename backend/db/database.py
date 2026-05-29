from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from core.config import settings

db_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    from db import models  # noqa: F401 — registers models with Base.metadata
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent migration: add user_id if the table existed before this column
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions (user_id)"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS agent_reports JSONB"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pitch_deck JSONB"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mode VARCHAR DEFAULT 'standard'"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tribunal_history JSONB DEFAULT '[]'::jsonb"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tribunal_verdicts JSONB"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tribunal_paid BOOLEAN DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS follow_up_email VARCHAR(320)"
        ))
        await conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE"
        ))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
