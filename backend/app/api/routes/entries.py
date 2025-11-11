from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.deps import get_session
from app.db.models import Entry, Feed
from app.schemas.entry import EntryRead, EntryStateUpdate
from sqlalchemy import func
from typing import Optional

router = APIRouter(prefix="/entries", tags=["entries"])


@router.get("", response_model=list[EntryRead])
async def list_entries(
    session: Session = Depends(get_session),
    feed_id: str | None = None,
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[EntryRead]:
    stmt = (
        select(Entry, Feed.title)
        .join(Feed, Feed.id == Entry.feed_id)
        .order_by(Entry.published_at.desc().nullslast(), Entry.inserted_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if feed_id:
        stmt = stmt.where(Entry.feed_id == feed_id)
    if unread_only:
        stmt = stmt.where(Entry.read.is_(False))

    rows = session.exec(stmt).all()

    return [
        EntryRead(
            id=entry.id,
            feed_id=entry.feed_id,
            feed_title=feed_title,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=entry.summary,
            content=entry.content,
            published_at=entry.published_at,
            read=entry.read,
            starred=entry.starred,
        )
        for entry, feed_title in rows
    ]


@router.patch("/{entry_id}", response_model=EntryRead)
async def update_entry_state(
    entry_id: str, payload: EntryStateUpdate, session: Session = Depends(get_session)
) -> EntryRead:
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if payload.read is not None:
        entry.read = payload.read
    if payload.starred is not None:
        entry.starred = payload.starred

    session.add(entry)
    session.commit()
    session.refresh(entry)

    feed = session.get(Feed, entry.feed_id)

    return EntryRead(
        id=entry.id,
        feed_id=entry.feed_id,
        feed_title=feed.title if feed else None,
        title=entry.title,
        url=entry.url,
        author=entry.author,
        summary=entry.summary,
        content=entry.content,
        published_at=entry.published_at,
        read=entry.read,
        starred=entry.starred,
    )


# 收藏管理相关的API端点
@router.get("/starred", response_model=list[EntryRead])
async def list_starred_entries(
    session: Session = Depends(get_session),
    feed_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[EntryRead]:
    """获取收藏的文章列表"""
    stmt = (
        select(Entry, Feed.title, Feed.group_name)
        .join(Feed, Feed.id == Entry.feed_id)
        .where(Entry.starred.is_(True))
        .order_by(Entry.inserted_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if feed_id:
        stmt = stmt.where(Entry.feed_id == feed_id)

    rows = session.exec(stmt).all()

    return [
        EntryRead(
            id=entry.id,
            feed_id=entry.feed_id,
            feed_title=feed_title,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=entry.summary,
            content=entry.content,
            published_at=entry.published_at,
            read=entry.read,
            starred=entry.starred,
        )
        for entry, feed_title, feed_group_name in rows
    ]


@router.get("/starred/stats")
async def get_starred_stats(session: Session = Depends(get_session)) -> dict:
    """获取收藏统计信息"""
    # 总收藏数量
    total_starred = session.exec(select(func.count(Entry.id)).where(Entry.starred.is_(True))).first() or 0

    # 按订阅分组的收藏数量
    feed_starred_counts = {}
    feed_rows = session.exec(
        select(Feed.id, Feed.title, Feed.group_name, func.count(Entry.id))
        .join(Entry, Feed.id == Entry.feed_id)
        .where(Entry.starred.is_(True))
        .group_by(Feed.id, Feed.title, Feed.group_name)
    ).all()

    for feed_id, feed_title, group_name, count in feed_rows:
        feed_starred_counts[feed_id] = {
            'title': feed_title,
            'group_name': group_name,
            'starred_count': count
        }

    # 按分组分组的收藏数量
    group_starred_counts = {}
    group_rows = session.exec(
        select(Feed.group_name, func.count(Entry.id))
        .join(Entry, Feed.id == Entry.feed_id)
        .where(Entry.starred.is_(True))
        .group_by(Feed.group_name)
    ).all()

    for group_name, count in group_rows:
        group_starred_counts[group_name] = count

    return {
        'total_starred': total_starred,
        'by_feed': feed_starred_counts,
        'by_group': group_starred_counts
    }


@router.post("/{entry_id}/star")
async def star_entry(entry_id: str, session: Session = Depends(get_session)) -> dict:
    """收藏文章"""
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.starred = True
    session.add(entry)
    session.commit()

    return {"success": True, "message": "文章已收藏"}


@router.delete("/{entry_id}/star")
async def unstar_entry(entry_id: str, session: Session = Depends(get_session)) -> dict:
    """取消收藏文章"""
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.starred = False
    session.add(entry)
    session.commit()

    return {"success": True, "message": "已取消收藏"}


@router.post("/bulk-star")
async def bulk_star_entries(
    entry_ids: list[str], session: Session = Depends(get_session)
) -> dict:
    """批量收藏文章"""
    try:
        # 获取所有要收藏的文章
        entries = session.exec(select(Entry).where(Entry.id.in_(entry_ids))).all()

        # 更新收藏状态
        for entry in entries:
            entry.starred = True

        session.commit()

        return {
            "success": True,
            "message": f"成功收藏 {len(entries)} 篇文章",
            "starred_count": len(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量收藏失败: {str(e)}")


@router.post("/bulk-unstar")
async def bulk_unstar_entries(
    entry_ids: list[str], session: Session = Depends(get_session)
) -> dict:
    """批量取消收藏文章"""
    try:
        # 获取所有要取消收藏的文章
        entries = session.exec(select(Entry).where(Entry.id.in_(entry_ids))).all()

        # 更新收藏状态
        for entry in entries:
            entry.starred = False

        session.commit()

        return {
            "success": True,
            "message": f"成功取消收藏 {len(entries)} 篇文章",
            "unstarred_count": len(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量取消收藏失败: {str(e)}")
