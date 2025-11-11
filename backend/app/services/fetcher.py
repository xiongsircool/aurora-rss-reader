from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from time import mktime
from time import perf_counter
from typing import Any

import feedparser
import httpx
from loguru import logger
from readability import Document
from sqlmodel import Session, select

from app.db.models import Entry, Feed, FetchLog
from app.db.session import SessionLocal


async def refresh_feed(feed_id: str) -> None:
    """Fetch a single feed and store new entries."""

    async with httpx.AsyncClient(timeout=45) as client:
        await _refresh_feed_with_client(feed_id, client)


async def refresh_all_feeds() -> None:
    async with httpx.AsyncClient(timeout=45) as client:
        with SessionLocal() as session:
            feeds = session.exec(select(Feed)).all()

        for feed in feeds:
            await _refresh_feed_with_client(feed.id, client)


async def _refresh_feed_with_client(feed_id: str, client: httpx.AsyncClient) -> None:
    with SessionLocal() as session:
        feed = session.get(Feed, feed_id)
        if not feed:
            logger.warning("Feed %s not found", feed_id)
            return

    # 创建日志记录并获取log_id
    log_id = None
    with SessionLocal() as session:
        log = FetchLog(feed_id=feed_id, status="running")
        session.add(log)
        session.commit()
        session.refresh(log)  # 确保获取生成的ID
        log_id = log.id

    start = perf_counter()
    try:
        response = await client.get(feed.url, follow_redirects=True)
        response.raise_for_status()
        parsed = await asyncio.to_thread(feedparser.parse, response.content)
        new_items = await _persist_entries(feed_id, parsed)

        duration = int((perf_counter() - start) * 1000)
        with SessionLocal() as session:
            feed_db = session.get(Feed, feed_id)
            if feed_db:
                feed_db.title = parsed.feed.get("title") or feed_db.title or feed_db.url
                feed_db.site_url = parsed.feed.get("link")
                feed_db.description = parsed.feed.get("subtitle")
                feed_db.last_checked_at = datetime.now(timezone.utc)
                feed_db.last_error = None
                feed_db.updated_at = datetime.now(timezone.utc)
                session.add(feed_db)

            # 使用log_id查找日志记录
            log_db = session.get(FetchLog, log_id) if log_id else None
            if log_db:
                log_db.status = "success"
                log_db.finished_at = datetime.now(timezone.utc)
                log_db.duration_ms = duration
                log_db.item_count = new_items
                session.add(log_db)
            session.commit()
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to refresh feed %s", feed_id)
        with SessionLocal() as session:
            feed_db = session.get(Feed, feed_id)
            if feed_db:
                feed_db.last_error = str(exc)
                feed_db.last_checked_at = datetime.now(timezone.utc)
                session.add(feed_db)

            # 使用log_id查找日志记录
            log_db = session.get(FetchLog, log_id) if log_id else None
            if log_db:
                log_db.status = "failed"
                log_db.message = str(exc)
                log_db.finished_at = datetime.now(timezone.utc)
                session.add(log_db)
            session.commit()


async def _persist_entries(feed_id: str, parsed: Any) -> int:
    if not parsed.entries:
        return 0

    new_items = 0
    with SessionLocal() as session:
        for item in parsed.entries:
            guid = _extract_guid(item)
            if not guid:
                continue

            exists = session.exec(
                select(Entry).where(Entry.feed_id == feed_id, Entry.guid == guid)
            ).first()
            if exists:
                continue

            summary = item.get("summary") or item.get("subtitle")
            content = _extract_content(item)
            readability_content = _render_readability(content or summary or "")
            categories = item.get("tags")
            categories_json = json.dumps([c["term"] for c in categories]) if categories else None

            entry = Entry(
                feed_id=feed_id,
                guid=guid,
                title=item.get("title"),
                url=item.get("link"),
                author=item.get("author"),
                summary=summary,
                content=content or summary,
                readability_content=readability_content,
                categories_json=categories_json,
                published_at=_parse_datetime(item),
            )
            session.add(entry)
            new_items += 1

        session.commit()

    if new_items:
        logger.info("Feed %s stored %s new entries", feed_id, new_items)

    return new_items


def _extract_guid(item: Any) -> str | None:
    return (
        item.get("id")
        or item.get("guid")
        or item.get("link")
        or (item.get("title") and f"{item.get('title')}-{item.get('published', '')}")
    )


def _extract_content(item: Any) -> str | None:
    if "content" in item and item["content"]:
        return item["content"][0].get("value")
    return item.get("summary")


def _parse_datetime(item: Any) -> datetime | None:
    parsed = item.get("published_parsed") or item.get("updated_parsed")
    if not parsed:
        return None
    timestamp = mktime(parsed)
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _render_readability(html: str) -> str | None:
    if not html:
        return None
    try:
        doc = Document(html)
        return doc.summary()
    except Exception:  # pylint: disable=broad-except
        return None


def schedule_refresh(feed_id: str) -> None:
    asyncio.create_task(refresh_feed(feed_id))


def schedule_refresh_all() -> None:
    asyncio.create_task(refresh_all_feeds())
