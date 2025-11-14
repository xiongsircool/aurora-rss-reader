from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone, timedelta
from time import mktime
from time import perf_counter
from typing import Any, Tuple
from urllib.parse import urljoin, urlparse

import feedparser

# 导入增强时间解析器
try:
    from dateutil import parser as dateutil_parser
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False
import httpx
from loguru import logger
from readability import Document
from sqlmodel import Session, select

# 记录dateutil库状态
if HAS_DATEUTIL:
    logger.info("dateutil库已加载，将增强时间解析能力")
else:
    logger.info("dateutil库未安装，将使用基础时间解析功能")

from app.db.models import Entry, Feed, FetchLog
from app.db.session import SessionLocal
from app.services.feed_config import (
    DEFAULT_RSSHUB_MIRRORS, SPECIAL_USER_AGENTS, KNOWN_ALTERNATIVES,
    TIMEOUT_CONFIG, RETRY_CONFIG, get_rsshub_mirrors
)
from app.utils.text import clean_html_text


async def refresh_feed(feed_id: str) -> None:
    """Fetch a single feed and store new entries."""

    # 首先获取feed信息以确定特殊配置
    with SessionLocal() as session:
        feed = session.get(Feed, feed_id)
        if not feed:
            logger.warning("Feed %s not found", feed_id)
            return
        feed_url = feed.url

    # 根据域名配置特殊的User-Agent
    default_user_agent = "Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)"
    user_agent = default_user_agent

    for domain, special_ua in SPECIAL_USER_AGENTS.items():
        if domain in feed_url:
            user_agent = special_ua
            logger.info("为域名 %s 使用特殊User-Agent", domain)
            break

    headers = {
        "User-Agent": user_agent,
        "Accept": "application/rss+xml, application/xml, text/xml",
        "Accept-Language": "en-US,en;q=0.9,zh;q=0.8",
        "Cache-Control": "no-cache",
    }

    timeout = httpx.Timeout(**TIMEOUT_CONFIG)

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        await _refresh_feed_with_client(feed_id, client)


async def refresh_all_feeds() -> None:
    # 为批量刷新配置相同的优化参数
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)",
        "Accept": "application/rss+xml, application/xml, text/xml",
        "Accept-Language": "en-US,en;q=0.9,zh;q=0.8",
        "Cache-Control": "no-cache",
    }

    timeout = httpx.Timeout(
        connect=10.0,
        read=30.0,
        write=10.0,
        pool=60.0
    )

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
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
        logger.info("开始获取RSS feed: %s", feed.url)

        # 智能重试和备用URL处理
        urls_to_try = await _get_urls_to_try(feed.url)
        response = None
        last_exception = None

        for attempt, url_to_try in enumerate(urls_to_try):
            try:
                logger.info("尝试获取RSS (第%d次): %s", attempt + 1, url_to_try)
                response = await client.get(url_to_try)
                break
            except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError) as exc:
                last_exception = exc
                logger.warning("RSS feed %s (尝试 %d/%d) 失败: %s",
                             url_to_try, attempt + 1, len(urls_to_try), exc)
                if attempt == len(urls_to_try) - 1:  # 最后一次尝试
                    raise

        if not response:
            raise last_exception or Exception("无法获取RSS响应")

        # 记录HTTP状态信息
        logger.info("RSS feed %s HTTP状态: %s", feed.url, response.status_code)

        response.raise_for_status()

        # 检查内容类型
        content_type = response.headers.get('content-type', '').lower()
        if not any(ct in content_type for ct in ['xml', 'rss']):
            logger.warning("RSS feed %s 返回的内容类型可能不是RSS: %s", feed.url, content_type)

        parsed = await asyncio.to_thread(feedparser.parse, response.content)

        # 检查feedparser解析结果
        if parsed.bozo:
            logger.warning("RSS feed %s 解析时警告: %s", feed.url, parsed.bozo_exception)

        if not parsed.entries and not parsed.feed:
            logger.error("RSS feed %s 解析后没有找到任何内容", feed.url)

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

                icon_url = _select_feed_icon(parsed, feed_db.site_url or feed.url, feed.url)
                if icon_url and icon_url != feed_db.favicon_url:
                    feed_db.favicon_url = icon_url
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
    except httpx.TimeoutException as exc:
        error_msg = f"请求超时: {str(exc)}"
        logger.error("RSS feed %s 请求超时: %s", feed.url, exc)
        _log_error(feed_id, log_id, "timeout", error_msg)

    except httpx.ConnectError as exc:
        error_msg = f"连接错误: {str(exc)}"
        logger.error("RSS feed %s 连接失败: %s", feed.url, exc)
        _log_error(feed_id, log_id, "connect_error", error_msg)

    except httpx.HTTPStatusError as exc:
        error_msg = f"HTTP错误 {exc.response.status_code}: {str(exc)}"
        logger.error("RSS feed %s HTTP错误 %s: %s", feed.url, exc.response.status_code, exc)
        _log_error(feed_id, log_id, "http_error", error_msg)

    except Exception as exc:  # pylint: disable=broad-except
        error_msg = f"未知错误: {str(exc)}"
        logger.exception("RSS feed %s 处理失败: %s", feed.url, exc)
        _log_error(feed_id, log_id, "unknown_error", error_msg)


def _log_error(feed_id: str, log_id: str | None, error_type: str, error_msg: str) -> None:
    """统一的错误记录函数"""
    with SessionLocal() as session:
        feed_db = session.get(Feed, feed_id)
        if feed_db:
            feed_db.last_error = f"[{error_type}] {error_msg}"
            feed_db.last_checked_at = datetime.now(timezone.utc)
            session.add(feed_db)

        log_db = session.get(FetchLog, log_id) if log_id else None
        if log_db:
            log_db.status = "failed"
            log_db.message = f"[{error_type}] {error_msg}"
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

            raw_summary = item.get("summary") or item.get("subtitle")
            content = _extract_content(item)
            readability_source = content or raw_summary or ""
            readability_content = _render_readability(readability_source)
            summary_text = clean_html_text(raw_summary) or clean_html_text(content)
            categories = item.get("tags")
            categories_json = json.dumps([c["term"] for c in categories]) if categories else None

            entry = Entry(
                feed_id=feed_id,
                guid=guid,
                title=item.get("title"),
                url=item.get("link"),
                author=item.get("author"),
                summary=summary_text,
                content=content or raw_summary,
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


def _is_reasonable_time(dt: datetime) -> Tuple[bool, Optional[datetime]]:
    """
    验证时间是否合理，返回(是否合理, 修正后的时间)

    根据用户建议：
    - 未来时间 -> 使用导入时间
    - 过于陈旧 -> 使用导入时间
    """
    now = datetime.now(timezone.utc)

    # 检查是否为未来时间（允许1小时时区误差）
    if dt > (now + timedelta(hours=1)):
        logger.info("检测到未来时间 %s，将使用导入时间 %s", dt, now)
        return False, now  # 使用当前时间作为发表时间

    # 检查是否过于陈旧（10年前）
    if dt < (now - timedelta(days=3650)):
        logger.info("检测到过于陈旧的时间 %s，将使用导入时间 %s", dt, now)
        return False, now  # 使用当前时间作为发表时间

    return True, dt


def _parse_datetime(item: Any) -> datetime | None:
    """增强的时间解析函数，融合多库策略和智能时间修正"""
    from email.utils import parsedate_to_datetime

    now = datetime.now(timezone.utc)

    # 1. 首先尝试标准的RSS时间字段（已解析的时间结构）
    parsed = item.get("published_parsed") or item.get("updated_parsed")
    if parsed:
        try:
            # 修复时区计算bug：确保正确处理时区
            if hasattr(parsed, 'tm_mon'):  # 确保是有效的time_struct
                timestamp = mktime(parsed)
                result = datetime.fromtimestamp(timestamp, tz=timezone.utc)

                # 验证时间合理性
                is_reasonable, corrected_time = _is_reasonable_time(result)
                if is_reasonable:
                    logger.debug("从published_parsed/updated_parsed解析时间: %s", result)
                    return result
                else:
                    return corrected_time
        except Exception as e:
            logger.debug("解析published_parsed/updated_parsed失败: %s", e)

    # 2. 尝试其他已解析的时间字段
    time_fields = ["created_parsed", "date_parsed", "pubdate_parsed", "issued_parsed"]
    for field in time_fields:
        if field in item:
            try:
                timestamp = mktime(item[field])
                result = datetime.fromtimestamp(timestamp, tz=timezone.utc)

                is_reasonable, corrected_time = _is_reasonable_time(result)
                if is_reasonable:
                    logger.debug("从%s解析时间: %s", field, result)
                    return result
                else:
                    return corrected_time
            except Exception as e:
                logger.debug("解析%s失败: %s", field, e)
                continue

    # 3. 尝试字符串时间字段，使用多库策略
    time_str_fields = ["published", "updated", "created", "date", "pubdate", "issued"]
    for field in time_str_fields:
        if field in item:
            time_str = item[field]
            if not time_str:
                continue

            logger.debug("尝试解析时间字符串字段 %s: %s", field, time_str)

            # 3a. 首先尝试使用email.utils.parsedate_to_datetime
            try:
                result = parsedate_to_datetime(time_str)
                if result.tzinfo is None:
                    result = result.replace(tzinfo=timezone.utc)

                is_reasonable, corrected_time = _is_reasonable_time(result)
                if is_reasonable:
                    logger.debug("使用parsedate_to_datetime从%s解析时间: %s", field, result)
                    return result
                else:
                    return corrected_time
            except Exception as e:
                logger.debug("parsedate_to_datetime解析%s失败: %s", field, e)

            # 3b. 使用dateutil增强解析（如果可用）
            if HAS_DATEUTIL:
                try:
                    result = dateutil_parser.parse(time_str)
                    if result.tzinfo is None:
                        result = result.replace(tzinfo=timezone.utc)

                    is_reasonable, corrected_time = _is_reasonable_time(result)
                    if is_reasonable:
                        logger.info("使用dateutil从%s解析时间: %s", field, result)
                        return result
                    else:
                        return corrected_time
                except Exception as e:
                    logger.debug("dateutil解析%s失败: %s", field, e)

            # 3c. 尝试feedparser内置解析
            try:
                if hasattr(feedparser, '_parse_date'):
                    time_struct = feedparser._parse_date(time_str)
                    if time_struct:
                        timestamp = mktime(time_struct)
                        result = datetime.fromtimestamp(timestamp, tz=timezone.utc)

                        is_reasonable, corrected_time = _is_reasonable_time(result)
                        if is_reasonable:
                            logger.debug("使用feedparser._parse_date从%s解析时间: %s", field, result)
                            return result
                        else:
                            return corrected_time
            except Exception as e:
                logger.debug("feedparser._parse_date解析%s失败: %s", field, e)

            # 3d. 尝试ISO 8601格式
            try:
                result = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                if result.tzinfo is None:
                    result = result.replace(tzinfo=timezone.utc)

                is_reasonable, corrected_time = _is_reasonable_time(result)
                if is_reasonable:
                    logger.debug("使用fromisoformat从%s解析时间: %s", field, result)
                    return result
                else:
                    return corrected_time
            except Exception as e:
                logger.debug("fromisoformat解析%s失败: %s", field, e)
                continue

    # 4. 尝试从description中提取时间信息
    description = item.get("summary") or item.get("description")
    if description:
        extracted_time = _extract_time_from_description(description)
        if extracted_time:
            is_reasonable, corrected_time = _is_reasonable_time(extracted_time)
            if is_reasonable:
                logger.debug("从描述中提取时间: %s", extracted_time)
                return extracted_time
            else:
                return corrected_time

    # 5. 所有方法都失败，使用导入时间
    logger.warning("所有时间解析方法均失败，使用导入时间: %s", item.get('title', ''))
    return now


def _extract_time_from_description(description: str) -> datetime | None:
    """从HTML描述中提取时间信息，增强版支持多种格式"""
    import re
    from datetime import datetime, timezone

    if not description:
        return None

    # 扩展的时间格式匹配模式
    patterns = [
        # ScienceDirect格式
        r'Publication date:\s*([A-Za-z]+\s+\d{4})',
        r'Publication date:\s*Available online\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})',
        r'Published:\s*([A-Za-z]+\s+\d{4})',
        r'Date:\s*([A-Za-z]+\s+\d{4})',
        r'Published:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',

        # Nature期刊格式
        r'First published:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',
        r'Published online:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',

        # 其他常见格式
        r'Online publication date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',
        r'Received:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',
        r'Accepted:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',
    ]

    for pattern in patterns:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            time_str = match.group(1)

            # 优先使用dateutil解析（如果可用）
            if HAS_DATEUTIL:
                try:
                    result = dateutil_parser.parse(time_str)
                    if result.tzinfo is None:
                        result = result.replace(tzinfo=timezone.utc)

                    # 设置为中午12点，避免午夜时间的问题
                    result = result.replace(hour=12, minute=0, second=0, microsecond=0)
                    logger.debug("使用dateutil从描述解析时间: %s", result)
                    return result
                except Exception as e:
                    logger.debug("dateutil解析描述时间失败: %s", e)

            # 回退到标准解析
            try:
                # 解析不同格式的时间字符串
                if re.match(r'^[A-Za-z]+\s+\d{4}$', time_str):
                    # "December 2025" 格式
                    parsed = datetime.strptime(time_str, "%B %Y")
                elif re.match(r'^\d{1,2}\s+[A-Za-z]+\s+\d{4}$', time_str):
                    # "10 October 2025" 格式
                    parsed = datetime.strptime(time_str, "%d %B %Y")
                else:
                    continue

                # 设置时间为当天的中午12点UTC
                return parsed.replace(hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

            except ValueError:
                # 尝试英文月份的其他格式
                try:
                    # 尝试解析缩写月份名
                    if re.match(r'^[A-Za-z]{3}\s+\d{4}$', time_str):
                        parsed = datetime.strptime(time_str, "%b %Y")
                        return parsed.replace(hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                    elif re.match(r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$', time_str):
                        parsed = datetime.strptime(time_str, "%d %b %Y")
                        return parsed.replace(hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                except ValueError:
                    continue

    return None


def _render_readability(html: str) -> str | None:
    if not html:
        return None
    try:
        doc = Document(html)
        return doc.summary()
    except Exception:  # pylint: disable=broad-except
        return None


def _select_feed_icon(parsed_feed: Any, site_url: str | None, feed_url: str) -> str | None:
    """Pick the best icon URL for a feed using metadata and sane fallbacks."""
    feed_meta = getattr(parsed_feed, "feed", parsed_feed) or {}
    base_url = site_url or feed_url
    candidates: list[str] = []

    def add_candidate(value: Any) -> None:
        normalized = _normalize_icon_url(_extract_href(value), base_url)
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    # RSS/Atom common fields
    add_candidate(feed_meta.get("image"))
    add_candidate(feed_meta.get("icon"))
    add_candidate(feed_meta.get("logo"))
    add_candidate(feed_meta.get("itunes_image"))

    # Link tags such as <link rel="icon"> or image types
    links = feed_meta.get("links")
    if isinstance(links, list):
        for link in links:
            href = link.get("href")
            rel = link.get("rel")
            rels = rel if isinstance(rel, list) else [rel]
            if any(isinstance(r, str) and "icon" in r.lower() for r in rels if r):
                add_candidate(href)
                continue
            link_type = link.get("type")
            if isinstance(link_type, str) and link_type.startswith("image/"):
                add_candidate(href)

    # Prefer default favicon over Apple touch icons to avoid hotlink/CORS issues
    origin = _build_origin_url(base_url)
    if origin:
        for extra in ["/favicon.ico", "/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]:
            add_candidate(f"{origin}{extra}")

    return candidates[0] if candidates else None


def _extract_href(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("href") or value.get("url")
    return None


def _normalize_icon_url(candidate: str | None, base_url: str | None) -> str | None:
    if not candidate:
        return None
    candidate = candidate.strip()
    if candidate.startswith("data:"):
        return None
    if candidate.startswith("//"):
        return f"https:{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"}:
        return candidate
    if base_url:
        normalized_base = base_url
        if not urlparse(base_url).scheme:
            normalized_base = f"https://{base_url}"
        return urljoin(normalized_base, candidate)
    return None


def _build_origin_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url if "://" in url else f"https://{url}")
    if not parsed.netloc:
        return None
    scheme = parsed.scheme or "https"
    return f"{scheme}://{parsed.netloc}"


def schedule_refresh(feed_id: str) -> None:
    asyncio.create_task(refresh_feed(feed_id))


async def _get_urls_to_try(original_url: str) -> list[str]:
    """获取要尝试的URL列表，结合用户配置与已知替代方案。

    变更说明：
    - 原逻辑仅识别固定4个RSSHub域名。现在放宽为“任意包含 rsshub 的域名”均按用户配置的RSSHub基址改写，
      如 `rsshub.usebio.top` 这类第三方镜像也会被替换，从而使前端设置在更多镜像上生效。
    """
    from app.services.user_settings_service import user_settings_service

    urls: list[str] = [original_url]

    try:
        user_rsshub_base = user_settings_service.get_rsshub_url().rstrip('/')
    except Exception as e:  # 容错：设置读取失败时保持原行为
        user_rsshub_base = None
        logger.warning("获取用户RSSHub配置失败，使用原始URL: %s", e)

    # 识别是否为RSSHub类链接（放宽为域名包含rsshub的情况）
    try:
        parsed = urlparse(original_url)
        host = (parsed.netloc or "").lower()
        is_rsshub_like = (
            "rsshub" in host or host in {
                "rsshub.app",
                "rsshub.rssforever.com",
                "rsshub.ktachibana.party",
                "rsshub.cskaoyan.com",
            }
        )

        if is_rsshub_like and user_rsshub_base:
            # 如果原始URL不是用户配置基址开头，则改写为用户配置的RSSHub基址
            if not original_url.startswith(user_rsshub_base + "/"):
                rebuilt = f"{user_rsshub_base}{parsed.path or ''}"
                if parsed.query:
                    rebuilt += f"?{parsed.query}"
                # 将用户配置的URL放在最前面尝试
                urls.insert(0, rebuilt)
                logger.info("使用用户配置的RSSHub基址改写: %s -> %s", original_url, rebuilt)

            # 同时追加已配置/默认的RSSHub镜像作为备选
            try:
                mirrors = await get_rsshub_mirrors()
                for base in mirrors:
                    base = base.rstrip('/')
                    candidate = f"{base}{parsed.path or ''}"
                    if parsed.query:
                        candidate += f"?{parsed.query}"
                    if candidate not in urls:
                        urls.append(candidate)
            except Exception as e:  # 若获取失败，忽略
                logger.debug("获取RSSHub镜像列表失败，跳过镜像扩展: %s", e)
    except Exception as e:
        logger.debug("解析/改写RSSHub链接失败，跳过改写: %s", e)

    # 检查是否有已知的替代方案
    if original_url in KNOWN_ALTERNATIVES:
        urls.extend(KNOWN_ALTERNATIVES[original_url])

    return urls


def schedule_refresh(feed_id: str) -> None:
    asyncio.create_task(refresh_feed(feed_id))


def schedule_refresh_all() -> None:
    asyncio.create_task(refresh_all_feeds())
