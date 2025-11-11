from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


class FeedCreate(SQLModel):
    url: str
    group_name: Optional[str] = "default"


class FeedRead(SQLModel):
    id: str
    url: str
    title: Optional[str]
    group_name: str
    favicon_url: Optional[str] = None
    unread_count: int
    last_checked_at: Optional[datetime]
    last_error: Optional[str]
