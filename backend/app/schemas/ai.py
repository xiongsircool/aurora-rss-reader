from __future__ import annotations

from sqlmodel import SQLModel


class SummaryRequest(SQLModel):
    entry_id: str
    language: str = "zh"


class SummaryResponse(SQLModel):
    entry_id: str
    language: str
    summary: str


class TranslationRequest(SQLModel):
    entry_id: str
    language: str = "zh"
    display_mode: str = "replace"  # replace | bilingual


class TranslationResponse(SQLModel):
    entry_id: str
    language: str
    title: str | None = None
    summary: str | None = None
    content: str | None = None
