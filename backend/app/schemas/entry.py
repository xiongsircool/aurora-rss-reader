from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


class EntryRead(SQLModel):
    id: str
    feed_id: str
    feed_title: Optional[str]
    title: Optional[str]
    url: Optional[str]
    author: Optional[str]
    summary: Optional[str]
    content: Optional[str]
    published_at: Optional[datetime]
    read: bool
    starred: bool


class EntryStateUpdate(SQLModel):
    read: Optional[bool] = None
    starred: Optional[bool] = None
