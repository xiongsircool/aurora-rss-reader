from __future__ import annotations

from pathlib import Path
from typing import AsyncGenerator
import logging

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.core.config import settings

from sqlalchemy.pool import NullPool

# 使用 aiosqlite 驱动
DATABASE_URL = f"sqlite+aiosqlite:///{settings.sqlite_path}"

Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # SQLite specific
    poolclass=NullPool,
)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def init_db() -> None:
    """
    Create tables during first launch (async version).
    Ideally this should be handled by Alembic, but we keep it for simplicity in dev/first-run.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
    except Exception as e:
        logger = logging.getLogger("backend.db")
        logger.info(f"Database init info: {e}")

