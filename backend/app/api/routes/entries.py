from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.deps import get_session
from app.db.models import Entry, Feed
from app.schemas.entry import EntryPage, EntryRead, EntryStateUpdate
from app.utils.text import clean_html_text
from sqlalchemy import func
from typing import Optional
import httpx
from readability import Document
from app.services.user_settings_service import user_settings_service

router = APIRouter(prefix="/entries", tags=["entries"])


def _entry_preview_summary(entry: Entry) -> str | None:
    """Return a plain-text summary for list/favorite views."""
    return clean_html_text(entry.summary) or clean_html_text(entry.content)

def _encode_cursor(cursor_time: datetime, cursor_id: str) -> str:
    payload = {"t": cursor_time.isoformat(), "id": cursor_id}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        padding = "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode((cursor + padding).encode("utf-8")).decode("utf-8")
        payload = json.loads(raw)
        cursor_time = datetime.fromisoformat(payload["t"])
        cursor_id = payload["id"]
        if not cursor_id:
            raise ValueError("cursor id is missing")
        if cursor_time.tzinfo is None:
            cursor_time = cursor_time.replace(tzinfo=timezone.utc)
        return cursor_time, cursor_id
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc


@router.get("", response_model=EntryPage)
async def list_entries(
    session: AsyncSession = Depends(get_session),
    feed_id: str | None = None,
    group_name: str | None = Query(default=None, description="分组名称，用于获取该分组下所有订阅源的文章"),
    unread_only: bool = Query(default=False),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    cursor: str | None = Query(default=None, description="分页游标"),
    date_range: str | None = Query(default=None, description="时间范围: '1d', '2d', '3d', '7d', '30d', '90d', '180d', '365d'"),
    time_field: str = Query(default="inserted_at", description="时间字段: 'published_at' 或 'inserted_at'"),
) -> EntryPage:
    if limit is None:
        settings = await user_settings_service.get_settings()
        user_limit = settings.items_per_page
        limit = max(1, min(user_limit, 200))
    limit = max(1, min(limit, 200))

    sort_time = func.coalesce(Entry.published_at, Entry.inserted_at)
    stmt = (
        select(Entry, Feed.title)
        .join(Feed, Feed.id == Entry.feed_id)
        .order_by(sort_time.desc(), Entry.id.desc())
    )

    # 现有过滤条件
    if feed_id:
        stmt = stmt.where(Entry.feed_id == feed_id)
    elif group_name:
        # 按分组名称过滤：查询该分组下所有订阅源的文章
        stmt = stmt.where(Feed.group_name == group_name)
    
    if unread_only:
        stmt = stmt.where(Entry.read.is_(False))

    # 新增时间范围过滤
    if date_range and date_range != "all":
        # 解析时间范围
        if date_range.endswith('h'):
            hours = int(date_range.replace('h', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(hours=hours)
        elif date_range.endswith('d'):
            days = int(date_range.replace('d', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        elif date_range.endswith('m'):
            months = int(date_range.replace('m', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
        elif date_range.endswith('y'):
            years = int(date_range.replace('y', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=years * 365)
        else:
            # 默认按天处理
            try:
                days = int(date_range)
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            except ValueError:
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)  # 默认30天

        # 根据选择的字段进行时间过滤
        if time_field == "published_at":
            # 使用 published_at；屏蔽未来时间；published_at 为空时回退到 inserted_at
            now = datetime.now(timezone.utc)
            stmt = stmt.where(
                ((Entry.published_at <= now) & (Entry.published_at >= cutoff_date)) |
                (Entry.published_at.is_(None) & (Entry.inserted_at >= cutoff_date))
            )
        else:
            # 使用 inserted_at
            stmt = stmt.where(Entry.inserted_at >= cutoff_date)

    if cursor:
        cursor_time, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            (sort_time < cursor_time) |
            ((sort_time == cursor_time) & (Entry.id < cursor_id))
        )
    else:
        stmt = stmt.offset(offset)

    fetch_limit = limit + 1
    result = await session.exec(stmt.limit(fetch_limit))
    rows = result.all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        EntryRead(
            id=entry.id,
            feed_id=entry.feed_id,
            feed_title=feed_title,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=_entry_preview_summary(entry),
            content=entry.content,
            published_at=entry.published_at,
            inserted_at=entry.inserted_at,
            read=entry.read,
            starred=entry.starred,
        )
        for entry, feed_title in rows
    ]
    next_cursor = None
    if has_more and rows:
        last_entry = rows[-1][0]
        cursor_time = last_entry.published_at or last_entry.inserted_at
        next_cursor = _encode_cursor(cursor_time, last_entry.id)

    return EntryPage(items=items, next_cursor=next_cursor, has_more=has_more)


@router.patch("/{entry_id}", response_model=EntryRead)
async def update_entry_state(
    entry_id: str, payload: EntryStateUpdate, session: AsyncSession = Depends(get_session)
) -> EntryRead:
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if payload.read is not None:
        entry.read = payload.read
    if payload.starred is not None:
        entry.starred = payload.starred

    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    feed = await session.get(Feed, entry.feed_id)

    return EntryRead(
        id=entry.id,
        feed_id=entry.feed_id,
        feed_title=feed.title if feed else None,
        title=entry.title,
        url=entry.url,
        author=entry.author,
        summary=_entry_preview_summary(entry),
        content=entry.content,
        published_at=entry.published_at,
        inserted_at=entry.inserted_at,
        read=entry.read,
        starred=entry.starred,
    )


# 收藏管理相关的API端点
@router.get("/starred", response_model=list[EntryRead])
async def list_starred_entries(
    session: AsyncSession = Depends(get_session),
    feed_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    date_range: str | None = Query(default=None, description="时间范围: '1d', '2d', '3d', '7d', '30d', '90d', '180d', '365d'"),
    time_field: str = Query(default="inserted_at", description="时间字段: 'published_at' 或 'inserted_at'"),
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

    if date_range and date_range != "all":
        if date_range.endswith('h'):
            hours = int(date_range.replace('h', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(hours=hours)
        elif date_range.endswith('d'):
            days = int(date_range.replace('d', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        elif date_range.endswith('m'):
            months = int(date_range.replace('m', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
        elif date_range.endswith('y'):
            years = int(date_range.replace('y', ''))
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=years * 365)
        else:
            try:
                days = int(date_range)
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            except ValueError:
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)

        if time_field == "published_at":
            now = datetime.now(timezone.utc)
            stmt = stmt.where(
                ((Entry.published_at <= now) & (Entry.published_at >= cutoff_date)) |
                (Entry.published_at.is_(None) & (Entry.inserted_at >= cutoff_date))
            )
        else:
            stmt = stmt.where(Entry.inserted_at >= cutoff_date)

    result = await session.exec(stmt)
    rows = result.all()

    return [
        EntryRead(
            id=entry.id,
            feed_id=entry.feed_id,
            feed_title=feed_title,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=_entry_preview_summary(entry),
            content=entry.content,
            published_at=entry.published_at,
            inserted_at=entry.inserted_at,
            read=entry.read,
            starred=entry.starred,
        )
        for entry, feed_title, feed_group_name in rows
    ]


@router.get("/starred/stats")
async def get_starred_stats(session: AsyncSession = Depends(get_session)) -> dict:
    """获取收藏统计信息"""
    # 总收藏数量
    result = await session.exec(select(func.count(Entry.id)).where(Entry.starred.is_(True)))
    total_starred = result.first() or 0

    # 按订阅分组的收藏数量
    feed_starred_counts = {}
    result = await session.exec(
        select(Feed.id, Feed.title, Feed.group_name, func.count(Entry.id))
        .join(Entry, Feed.id == Entry.feed_id)
        .where(Entry.starred.is_(True))
        .group_by(Feed.id, Feed.title, Feed.group_name)
    )
    feed_rows = result.all()

    for feed_id, feed_title, group_name, count in feed_rows:
        feed_starred_counts[feed_id] = {
            'title': feed_title,
            'group_name': group_name,
            'starred_count': count
        }

    # 按分组分组的收藏数量
    group_starred_counts = {}
    result = await session.exec(
        select(Feed.group_name, func.count(Entry.id))
        .join(Entry, Feed.id == Entry.feed_id)
        .where(Entry.starred.is_(True))
        .group_by(Feed.group_name)
    )
    group_rows = result.all()

    for group_name, count in group_rows:
        group_starred_counts[group_name] = count

    return {
        'total_starred': total_starred,
        'by_feed': feed_starred_counts,
        'by_group': group_starred_counts
    }


@router.post("/{entry_id}/star")
async def star_entry(entry_id: str, session: AsyncSession = Depends(get_session)) -> dict:
    """收藏文章"""
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.starred = True
    session.add(entry)
    await session.commit()

    return {"success": True, "message": "文章已收藏"}


@router.delete("/{entry_id}/star")
async def unstar_entry(entry_id: str, session: AsyncSession = Depends(get_session)) -> dict:
    """取消收藏文章"""
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.starred = False
    session.add(entry)
    await session.commit()

    return {"success": True, "message": "已取消收藏"}


@router.post("/bulk-star")
async def bulk_star_entries(
    entry_ids: list[str], session: AsyncSession = Depends(get_session)
) -> dict:
    """批量收藏文章"""
    try:
        # 获取所有要收藏的文章
        result = await session.exec(select(Entry).where(Entry.id.in_(entry_ids)))
        entries = result.all()

        # 更新收藏状态
        for entry in entries:
            entry.starred = True

        await session.commit()

        return {
            "success": True,
            "message": f"成功收藏 {len(entries)} 篇文章",
            "starred_count": len(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量收藏失败: {str(e)}")


@router.post("/bulk-unstar")
async def bulk_unstar_entries(
    entry_ids: list[str], session: AsyncSession = Depends(get_session)
) -> dict:
    """批量取消收藏文章"""
    try:
        # 获取所有要取消收藏的文章
        result = await session.exec(select(Entry).where(Entry.id.in_(entry_ids)))
        entries = result.all()

        # 更新收藏状态
        for entry in entries:
            entry.starred = False

        await session.commit()

        return {
            "success": True,
            "message": f"成功取消收藏 {len(entries)} 篇文章",
            "unstarred_count": len(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量取消收藏失败: {str(e)}")


from pydantic import BaseModel

class MarkReadRequest(BaseModel):
    """批量标记已读的请求体"""
    feed_id: Optional[str] = None
    group_name: Optional[str] = None
    older_than: Optional[str] = None  # 标记多少天之前的文章为已读
    time_field: str = "inserted_at"


@router.post("/mark-read")
async def mark_entries_as_read(
    request: MarkReadRequest,
    session: AsyncSession = Depends(get_session)
) -> dict:
    """批量标记文章为已读
    
    支持按订阅源、分组、时间范围进行过滤：
    - feed_id: 标记指定订阅源的所有文章为已读
    - group_name: 标记指定分组下所有订阅源的文章为已读
    - older_than: 标记多少天之前的文章为已读 (3d, 7d, 30d 等)
    - time_field: 时间字段 (published_at 或 inserted_at)
    
    如果都不指定，则标记所有未读文章为已读
    """
    try:
        # 构建查询
        stmt = select(Entry).where(Entry.read.is_(False))
        
        # 按订阅源过滤
        if request.feed_id:
            stmt = stmt.where(Entry.feed_id == request.feed_id)
        # 按分组过滤
        elif request.group_name:
            stmt = stmt.join(Feed, Feed.id == Entry.feed_id).where(Feed.group_name == request.group_name)
        
        # 时间范围过滤 - 标记 X 天之前的文章为已读
        if request.older_than and request.older_than != "all":
            if request.older_than.endswith('h'):
                hours = int(request.older_than.replace('h', ''))
                cutoff_date = datetime.now(timezone.utc) - timedelta(hours=hours)
            elif request.older_than.endswith('d'):
                days = int(request.older_than.replace('d', ''))
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            elif request.older_than.endswith('m'):
                months = int(request.older_than.replace('m', ''))
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
            elif request.older_than.endswith('y'):
                years = int(request.older_than.replace('y', ''))
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=years * 365)
            else:
                try:
                    days = int(request.older_than)
                    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
                except ValueError:
                    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
            
            # 注意：这里改为 <= cutoff_date，表示"之前"的文章
            if request.time_field == "published_at":
                stmt = stmt.where(
                    (Entry.published_at <= cutoff_date) |
                    (Entry.published_at.is_(None) & (Entry.inserted_at <= cutoff_date))
                )
            else:
                stmt = stmt.where(Entry.inserted_at <= cutoff_date)
        
        # 获取并更新文章
        result = await session.exec(stmt)
        entries = result.all()
        
        # 统计每个订阅源的已读数量，用于更新未读计数
        feed_read_counts: dict[str, int] = {}
        for entry in entries:
            entry.read = True
            feed_read_counts[entry.feed_id] = feed_read_counts.get(entry.feed_id, 0) + 1
        
        await session.commit()
        
        return {
            "success": True,
            "message": f"成功标记 {len(entries)} 篇文章为已读",
            "marked_count": len(entries),
            "feed_counts": feed_read_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量标记已读失败: {str(e)}")


@router.post("/{entry_id}/fetch-content", response_model=EntryRead)
async def fetch_entry_content(
    entry_id: str,
    session: AsyncSession = Depends(get_session)
) -> EntryRead:
    """获取文章的原文内容 (抓取网页内容)"""
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if not entry.url:
         raise HTTPException(status_code=400, detail="Entry has no URL")

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh;q=0.8",
        }
        
        async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
            response = await client.get(entry.url)
            response.raise_for_status()
            
            # Detect encoding if needed, httpx handles this mostly but sometimes...
            # readability needs correct unicode
            
            doc = Document(response.text)
            content = doc.summary()
            
            # Clean up content a bit if needed? readability usually does a good job.
            
            entry.content = content
            # Also update readability_content just in case
            entry.readability_content = content
            
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
            
            feed = await session.get(Feed, entry.feed_id)
            
            return EntryRead(
                id=entry.id,
                feed_id=entry.feed_id,
                feed_title=feed.title if feed else None,
                title=entry.title,
                url=entry.url,
                author=entry.author,
                summary=_entry_preview_summary(entry),
                content=entry.content,
                published_at=entry.published_at,
                inserted_at=entry.inserted_at,
                read=entry.read,
                starred=entry.starred,
            )

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch upstream content: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process content: {str(e)}")
