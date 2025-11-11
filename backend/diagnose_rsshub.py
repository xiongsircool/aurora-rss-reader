#!/usr/bin/env python3
"""
RSSHub诊断工具
"""

import asyncio
import httpx
import sys
import os

# 添加项目路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.user_settings_service import user_settings_service
from app.services.fetcher import _get_urls_to_try


async def diagnose_rsshub(rsshub_url: str):
    """诊断RSSHub连接问题"""
    print(f"=== RSSHub诊断工具 ===")
    print(f"目标RSSHub: {rsshub_url}")
    print()

    # 1. 测试基础连通性
    print("1. 测试基础连通性...")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(rsshub_url.rstrip('/'))
            print(f"   ✅ 基础连接成功 - 状态码: {response.status_code}")
            if response.status_code == 200:
                content_preview = response.text[:200]
                print(f"   响应预览: {content_preview}...")
    except Exception as e:
        print(f"   ❌ 基础连接失败: {e}")
        return

    # 2. 测试具体RSS路由
    print("\n2. 测试RSS路由...")
    test_routes = [
        "/nature/research/ng",
        "/bilibili/user/dynamic/2267573",
        "/github/issue/vuejs/vue"
    ]

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for route in test_routes:
            test_url = f"{rsshub_url.rstrip('/')}{route}"
            try:
                response = await client.get(test_url)
                content_type = response.headers.get('content-type', '')

                print(f"   📡 {route}")
                print(f"      状态码: {response.status_code}")
                print(f"      内容类型: {content_type}")

                if response.status_code == 200 and 'xml' in content_type.lower():
                    # 检查RSS内容
                    content = response.text
                    if '<rss' in content.lower():
                        print(f"      ✅ RSS内容正常")
                        # 尝试解析第一条记录
                        if '<title>' in content:
                            import re
                            title_match = re.search(r'<title>(.*?)</title>', content)
                            if title_match:
                                print(f"      标题示例: {title_match.group(1)[:50]}...")
                    else:
                        print(f"      ⚠️  响应不是RSS格式")
                else:
                    print(f"      ❌ RSS获取失败")

            except Exception as e:
                print(f"   📡 {route}")
                print(f"      ❌ 连接失败: {e}")

    # 3. 测试URL转换逻辑
    print("\n3. 测试URL转换逻辑...")

    # 先设置RSSHub URL
    user_settings_service.update_rsshub_url(rsshub_url)

    test_urls = [
        "https://rsshub.app/nature/research/ng",
        "https://rsshub.app/bilibili/user/dynamic/2267573",
        "https://example.com/normal-rss.xml"  # 非RSSHub链接
    ]

    for original_url in test_urls:
        converted_urls = await _get_urls_to_try(original_url)
        print(f"   原始: {original_url}")
        print(f"   转换: {converted_urls}")

        # 测试转换后的URL是否可用
        if converted_urls and converted_urls[0] != original_url:
            test_url = converted_urls[0]
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.get(test_url)
                    if response.status_code == 200:
                        print(f"   ✅ 转换后URL可用")
                    else:
                        print(f"   ⚠️  转换后URL状态: {response.status_code}")
            except Exception as e:
                print(f"   ❌ 转换后URL测试失败: {e}")
        print()

    # 4. 测试CORS相关
    print("4. 测试CORS配置...")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 模拟前端请求
            response = await client.get(
                rsshub_url.rstrip('/'),
                headers={
                    'Origin': 'http://localhost:5173',
                    'Referer': 'http://localhost:5173/'
                }
            )
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }

            print(f"   CORS响应头:")
            for header, value in cors_headers.items():
                if value:
                    print(f"     {header}: {value}")
                else:
                    print(f"     {header}: (未设置)")

    except Exception as e:
        print(f"   ❌ CORS测试失败: {e}")


async def main():
    if len(sys.argv) < 2:
        print("用法: python diagnose_rsshub.py <RSSHub_URL>")
        print("示例: python diagnose_rsshub.py http://58.198.178.157:1200")
        sys.exit(1)

    rsshub_url = sys.argv[1]
    await diagnose_rsshub(rsshub_url)


if __name__ == "__main__":
    asyncio.run(main())