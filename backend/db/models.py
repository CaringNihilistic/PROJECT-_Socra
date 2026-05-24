import uuid
from sqlalchemy import Column, String, Float, Text, Integer, DateTime, JSON, UniqueConstraint
from sqlalchemy.sql import func
from db.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True, index=True)
    initial_idea = Column(Text, nullable=False)

    problem_clarity = Column(Float, default=0.0)
    scale_constraints = Column(Float, default=0.0)
    tech_context = Column(Float, default=0.0)
    success_definition = Column(Float, default=0.0)
    risk_awareness = Column(Float, default=0.0)

    phase = Column(String, default="intake")
    turn_number = Column(Integer, default=0)

    conversation_history = Column(JSON, default=list)
    assumptions = Column(JSON, default=list)
    masterplan = Column(Text, nullable=True)
    agent_reports = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WaitlistEntry(Base):
    __tablename__ = "waitlist"
    __table_args__ = (UniqueConstraint("email", name="uq_waitlist_email"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(320), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
