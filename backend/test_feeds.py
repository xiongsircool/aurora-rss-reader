#!/usr/bin/env python3
"""
RSS链接测试工具
用于快速测试RSS链接的可访问性和解析情况
"""

import asyncio
import sys
import httpx
import feedparser
from app.services.feed_config import SPECIAL_USER_AGENTS, TIMEOUT_CONFIG


async def test_rss_url(url: str):
    """测试单个RSS链接"""
    print(f"\n测试RSS链接: {url}")
    print("=" * 60)

    # 配置请求头
    user_agent = "Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)"
    for domain, special_ua in SPECIAL_USER_AGENTS.items():
        if domain in url:
            user_agent = special_ua
            print(f"使用特殊User-Agent (域名: {domain})")
            break

    headers = {
        "User-Agent": user_agent,
        "Accept": "application/rss+xml, application/xml, text/xml",
        "Accept-Language": "en-US,en;q=0.9,zh;q=0.8",
    }

    timeout = httpx.Timeout(**TIMEOUT_CONFIG)

    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            print("1. 发送HTTP请求...")
            response = await client.get(url)
            print(f"   状态码: {response.status_code}")
            print(f"   内容类型: {response.headers.get('content-type', 'Unknown')}")
            print(f"   响应大小: {len(response.content)} bytes")

            if response.status_code != 200:
                print(f"   ❌ HTTP错误: {response.status_code}")
                return

            print("\n2. 解析RSS内容...")
            parsed = feedparser.parse(response.content)

            if parsed.bozo:
                print(f"   ⚠️  解析警告: {parsed.bozo_exception}")

            feed_info = parsed.feed
            if feed_info:
                print(f"   ✅ Feed标题: {feed_info.get('title', 'Unknown')}")
                print(f"   Feed描述: {feed_info.get('description', 'No description')[:100]}...")
                print(f"   Feed链接: {feed_info.get('link', 'Unknown')}")

            entries = parsed.entries
            if entries:
                print(f"   ✅ 找到 {len(entries)} 个条目")

                # 显示前3个条目的信息
                for i, entry in enumerate(entries[:3]):
                    print(f"\n   条目 {i+1}:")
                    print(f"     标题: {entry.get('title', 'No title')[:80]}...")
                    print(f"     链接: {entry.get('link', 'No link')}")
                    print(f"     发布时间: {entry.get('published', 'Unknown')}")

                if len(entries) > 3:
                    print(f"   ... 还有 {len(entries) - 3} 个条目")
            else:
                print("   ❌ 没有找到任何条目")

    except httpx.TimeoutException:
        print("   ❌ 请求超时")
    except httpx.ConnectError as e:
        print(f"   ❌ 连接错误: {e}")
    except httpx.HTTPStatusError as e:
        print(f"   ❌ HTTP错误: {e.response.status_code} - {e}")
    except Exception as e:
        print(f"   ❌ 未知错误: {e}")


async def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python test_feeds.py <RSS_URL> [RSS_URL2] ...")
        print("\n示例:")
        print("  python test_feeds.py https://academic.oup.com/rss/site_5154/3017.xml")
        print("  python test_feeds.py https://rsshub.app/nature/research/ng")
        sys.exit(1)

    urls = sys.argv[1:]

    print(f"开始测试 {len(urls)} 个RSS链接...")
    print("=" * 60)

    for url in urls:
        await test_rss_url(url)

    print("\n" + "=" * 60)
    print("测试完成!")


if __name__ == "__main__":
    asyncio.run(main())