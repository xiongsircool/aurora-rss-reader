from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import UniqueConstraint, JSON
from sqlmodel import Column, DateTime, Field, SQLModel


def generate_id() -> str:
    return uuid4().hex


class Feed(SQLModel, table=True):
    __tablename__ = "feeds"

    id: str = Field(default_factory=generate_id, primary_key=True, index=True)
    url: str = Field(unique=True, index=True)
    title: Optional[str] = None
    site_url: Optional[str] = None
    description: Optional[str] = None
    favicon_url: Optional[str] = None
    group_name: str = Field(default="default", index=True)
    last_checked_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    last_error: Optional[str] = None
    update_interval_minutes: int = Field(default=60)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    

class Entry(SQLModel, table=True):
    __tablename__ = "entries"
    __table_args__ = (UniqueConstraint("feed_id", "guid", name="uix_feed_guid"),)

    id: str = Field(default_factory=generate_id, primary_key=True, index=True)
    feed_id: str = Field(foreign_key="feeds.id", index=True)
    guid: str
    title: Optional[str] = None
    url: Optional[str] = None
    # TODO:将标题翻译存储在标题翻译{语言:标题}dict中,不同语言的标题翻译存储在不同的字段中，调用翻译api时候先访问这个看是否有对应的翻译没有则更新字典再写入数据库
    title_translations: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    author: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    readability_content: Optional[str] = None
    categories_json: Optional[str] = None
    published_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    inserted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    read: bool = Field(default=False, index=True)
    starred: bool = Field(default=False, index=True)


class Translation(SQLModel, table=True):
    __tablename__ = "translations"
    __table_args__ = (UniqueConstraint("entry_id", "language", name="uix_translation_entry_language"),)

    id: str = Field(default_factory=generate_id, primary_key=True)
    entry_id: str = Field(foreign_key="entries.id", index=True)
    language: str = Field(default="zh", index=True)
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None  # Legacy: full HTML translation
    # New: Block-level translations for immersive mode
    # Format: {"block_hash_1": "translated_text_1", "block_hash_2": "..."}
    paragraph_map: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))


class Summary(SQLModel, table=True):
    __tablename__ = "summaries"
    __table_args__ = (UniqueConstraint("entry_id", "language", name="uix_summary_entry_language"),)

    id: str = Field(default_factory=generate_id, primary_key=True)
    entry_id: str = Field(foreign_key="entries.id", index=True)
    language: str = Field(default="zh", index=True)
    summary: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))


class FetchLog(SQLModel, table=True):
    __tablename__ = "fetch_logs"

    id: str = Field(default_factory=generate_id, primary_key=True)
    feed_id: Optional[str] = Field(default=None, foreign_key="feeds.id", index=True)
    status: str = Field(default="pending", index=True)
    message: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    finished_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    duration_ms: Optional[int] = None
    item_count: int = Field(default=0)
