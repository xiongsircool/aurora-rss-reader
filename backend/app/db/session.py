from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

DATABASE_URL = f"sqlite:///{settings.sqlite_path}"

Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)


def init_db() -> None:
    """Create tables during first launch (placeholder until Alembic migrations land)."""

    SQLModel.metadata.create_all(bind=engine)
