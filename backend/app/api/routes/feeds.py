from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.db.deps import get_session
from app.db.models import Entry, Feed
from app.schemas.feed import FeedCreate, FeedRead
from app.services.fetcher import refresh_feed

router = APIRouter(prefix="/feeds", tags=["feeds"])


@router.get("", response_model=list[FeedRead])
async def list_feeds(session: Session = Depends(get_session)) -> list[FeedRead]:
    feeds = session.exec(select(Feed).order_by(Feed.created_at.desc())).all()

    unread_counts = dict(
        session.exec(
            select(Entry.feed_id, func.count(Entry.id))
            .where(Entry.read.is_(False))
            .group_by(Entry.feed_id)
        ).all()
    )

    return [
        FeedRead(
            id=feed.id,
            url=feed.url,
            title=feed.title,
            group_name=feed.group_name,
            unread_count=unread_counts.get(feed.id, 0),
            last_checked_at=feed.last_checked_at,
            last_error=feed.last_error,
        )
        for feed in feeds
    ]


@router.post("", response_model=FeedRead)
async def add_feed(payload: FeedCreate, session: Session = Depends(get_session)) -> FeedRead:
    existing = session.exec(select(Feed).where(Feed.url == payload.url.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feed already exists")

    feed = Feed(url=payload.url.strip(), group_name=payload.group_name or "default")
    session.add(feed)
    session.commit()
    session.refresh(feed)

    asyncio.create_task(refresh_feed(feed.id))

    return FeedRead(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        group_name=feed.group_name,
        unread_count=0,
        last_checked_at=feed.last_checked_at,
        last_error=feed.last_error,
    )


@router.post("/{feed_id}/refresh", status_code=202)
async def manual_refresh(feed_id: str) -> dict[str, str]:
    asyncio.create_task(refresh_feed(feed_id))
    return {"status": "scheduled"}


@router.delete("/{feed_id}", status_code=204)
async def delete_feed(feed_id: str, session: Session = Depends(get_session)) -> None:
    feed = session.get(Feed, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    session.delete(feed)
    session.commit()


@router.patch("/{feed_id}", response_model=FeedRead)
async def update_feed(
    feed_id: str, 
    payload: dict[str, str | int], 
    session: Session = Depends(get_session)
) -> FeedRead:
    feed = session.get(Feed, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    if "group_name" in payload:
        feed.group_name = str(payload["group_name"])
    if "update_interval_minutes" in payload:
        feed.update_interval_minutes = int(payload["update_interval_minutes"])
    
    session.add(feed)
    session.commit()
    session.refresh(feed)
    
    unread_count = session.exec(
        select(func.count(Entry.id))
        .where(Entry.feed_id == feed_id, Entry.read.is_(False))
    ).one()
    
    return FeedRead(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        group_name=feed.group_name,
        unread_count=unread_count,
        last_checked_at=feed.last_checked_at,
        last_error=feed.last_error,
    )
