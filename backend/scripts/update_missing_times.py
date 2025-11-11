#!/usr/bin/env python3
"""
更新现有数据库中没有时间的条目，使用新的时间解析逻辑重新解析时间
"""
import asyncio
import httpx
import feedparser
from time import mktime
from datetime import datetime, timezone
from loguru import logger
from sqlmodel import Session, select
from app.db.models import Entry, Feed
from app.db.session import SessionLocal
from app.services.fetcher import _extract_time_from_description


def _parse_datetime_enhanced_local(item):
    """本地版本的时间解析函数，避免循环导入"""
    from time import mktime
    from email.utils import parsedate_to_datetime

    # 1. 首先尝试标准的RSS时间字段（已解析的时间结构）
    parsed = item.get("published_parsed") or item.get("updated_parsed")
    if parsed:
        try:
            timestamp = mktime(parsed)
            result = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            logger.debug("从published_parsed/updated_parsed解析时间: %s", result)
            return result
        except Exception as e:
            logger.debug("解析published_parsed/updated_parsed失败: %s", e)
            pass

    # 2. 尝试其他已解析的时间字段
    time_fields = ["created_parsed", "date_parsed", "pubdate_parsed", "issued_parsed"]
    for field in time_fields:
        if field in item:
            try:
                timestamp = mktime(item[field])
                result = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                logger.debug("从%s解析时间: %s", field, result)
                return result
            except Exception as e:
                logger.debug("解析%s失败: %s", field, e)
                continue

    # 3. 尝试字符串时间字段（支持RSS的<pubDate>标签）
    # RSS格式示例: "Tue, 04 Nov 2014 00:00:00 GMT"
    time_str_fields = ["published", "updated", "created", "date", "pubdate", "issued"]
    for field in time_str_fields:
        if field in item:
            time_str = item[field]
            if not time_str:
                continue
                
            logger.debug("尝试解析时间字符串字段 %s: %s", field, time_str)
            
            # 3a. 首先尝试使用email.utils.parsedate_to_datetime解析RFC 822/2822格式
            # 这是RSS <pubDate>标签的标准格式
            try:
                result = parsedate_to_datetime(time_str)
                # 确保时区信息存在
                if result.tzinfo is None:
                    result = result.replace(tzinfo=timezone.utc)
                logger.debug("使用parsedate_to_datetime从%s解析时间: %s", field, result)
                return result
            except Exception as e:
                logger.debug("parsedate_to_datetime解析%s失败: %s", field, e)
            
            # 3b. 尝试使用feedparser内置的日期解析（如果可用）
            try:
                if hasattr(feedparser, '_parse_date'):
                    time_struct = feedparser._parse_date(time_str)
                    if time_struct:
                        timestamp = mktime(time_struct)
                        result = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                        logger.debug("使用feedparser._parse_date从%s解析时间: %s", field, result)
                        return result
            except Exception as e:
                logger.debug("feedparser._parse_date解析%s失败: %s", field, e)
            
            # 3c. 尝试ISO 8601格式
            try:
                result = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                if result.tzinfo is None:
                    result = result.replace(tzinfo=timezone.utc)
                logger.debug("使用fromisoformat从%s解析时间: %s", field, result)
                return result
            except Exception as e:
                logger.debug("fromisoformat解析%s失败: %s", field, e)
                continue

    # 4. 尝试从description中提取时间信息
    description = item.get("summary") or item.get("description")
    if description:
        extracted_time = _extract_time_from_description(description)
        if extracted_time:
            logger.debug("从描述中提取时间: %s", extracted_time)
            return extracted_time

    logger.debug("无法解析时间，所有方法均失败")
    return None


async def reparse_entry_times():
    """重新解析没有时间的条目"""
    logger.info("开始更新没有时间信息的条目...")

    with SessionLocal() as session:
        # 查找所有没有published_at的条目
        entries_without_time = session.exec(
            select(Entry).where(Entry.published_at.is_(None))
        ).all()

        logger.info(f"找到 {len(entries_without_time)} 个没有时间信息的条目")

        if not entries_without_time:
            logger.info("所有条目都有时间信息，无需更新")
            return

        # 按feed分组
        feed_urls = {}
        for entry in entries_without_time:
            feed = session.get(Feed, entry.feed_id)
            if feed and feed.url not in feed_urls:
                feed_urls[feed.url] = feed.id

        logger.info(f"需要重新抓取 {len(feed_urls)} 个订阅源")

        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)",
            "Accept": "application/rss+xml, application/xml, text/xml",
            "Accept-Language": "en-US,en;q=0.9,zh;q=0.8",
            "Cache-Control": "no-cache",
        }

        async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
            updated_count = 0

            for feed_url, feed_id in feed_urls.items():
                try:
                    logger.info(f"重新解析订阅源: {feed_url}")

                    response = await client.get(feed_url)
                    if response.status_code != 200:
                        logger.warning(f"获取RSS源失败: {feed_url}, 状态码: {response.status_code}")
                        continue

                    parsed = feedparser.parse(response.content)
                    if not parsed.entries:
                        logger.warning(f"RSS源没有条目: {feed_url}")
                        continue

                    # 创建URL到条目的映射
                    url_to_entry = {}
                    for entry in entries_without_time:
                        if entry.feed_id == feed_id and entry.url:
                            url_to_entry[entry.url] = entry

                    # 尝试解析每个条目的时间
                    for item in parsed.entries:
                        item_url = item.get("link")
                        if item_url and item_url in url_to_entry:
                            # 使用增强的时间解析逻辑
                            parsed_time = _parse_datetime_enhanced_local(item)

                            if parsed_time:
                                # 更新数据库中的时间
                                entry = url_to_entry[item_url]
                                entry.published_at = parsed_time
                                session.add(entry)
                                updated_count += 1

                                logger.info(f"更新时间: {entry.title[:50]}... -> {parsed_time}")

                    session.commit()
                    logger.info(f"订阅源 {feed_url} 处理完成")

                except Exception as e:
                    logger.error(f"处理订阅源 {feed_url} 时出错: {e}")
                    continue

        logger.info(f"更新完成！总共更新了 {updated_count} 个条目的时间信息")

        # 统计更新后的情况
        total_entries = session.exec(select(Entry)).all()
        with_published_time = session.exec(select(Entry).where(Entry.published_at.is_not(None))).all()

        logger.info(f"数据库总条目数: {len(total_entries)}")
        logger.info(f"有published_at的条目数: {len(with_published_time)}")
        logger.info(f"时间解析成功率: {len(with_published_time)/len(total_entries)*100:.1f}%")


if __name__ == "__main__":
    asyncio.run(reparse_entry_times())