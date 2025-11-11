from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session

from app.db.session import SessionLocal


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
