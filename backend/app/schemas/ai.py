from __future__ import annotations

from sqlmodel import SQLModel


class SummaryRequest(SQLModel):
    entry_id: str
    language: str = "zh"


class SummaryResponse(SQLModel):
    entry_id: str
    language: str
    summary: str
