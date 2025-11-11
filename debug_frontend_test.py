#!/usr/bin/env python3
"""
调试前端测试问题
"""

import asyncio
import httpx
import json


async def test_frontend_like_requests():
    """模拟前端请求，看看具体错误"""
    rsshub_url = "http://58.198.178.157:1200"

    print("=== 模拟前端请求测试 ===")
    print(f"目标RSSHub: {rsshub_url}")
    print()

    # 测试多个路由，模拟前端测试逻辑
    test_routes = [
        "/nature/research/ng",
        "/bilibili/user/dynamic/2267573",
        "/github/issue/vuejs/vue"
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        for route in test_routes:
            test_url = f"{rsshub_url.rstrip('/')}{route}"
            print(f"测试路由: {route}")
            print(f"完整URL: {test_url}")

            try:
                # 模拟前端的fetch请求
                response = await client.get(
                    test_url,
                    headers={
                        'Origin': 'http://localhost:5173',
                        'Referer': 'http://localhost:5173/',
                        'Accept': 'application/rss+xml, application/xml, text/xml',
                    },
                    follow_redirects=True
                )

                print(f"  状态码: {response.status_code}")
                print(f"  Content-Type: {response.headers.get('content-type', 'N/A')}")
                print(f"  Content-Length: {len(response.content)} bytes")

                # 检查CORS头
                cors_origin = response.headers.get('Access-Control-Allow-Origin')
                cors_methods = response.headers.get('Access-Control-Allow-Methods')

                print(f"  CORS-Allow-Origin: {cors_origin}")
                print(f"  CORS-Allow-Methods: {cors_methods}")

                if response.status_code == 200:
                    content_type = response.headers.get('content-type', '').lower()
                    if 'xml' in content_type:
                        print("  ✅ RSS内容正常")
                        # 提取标题
                        content = response.text
                        if '<title>' in content:
                            import re
                            title_match = re.search(r'<title>(.*?)</title>', content)
                            if title_match:
                                title = title_match.group(1)
                                print(f"  标题: {title[:50]}...")
                    else:
                        print(f"  ⚠️  不是RSS格式: {content_type}")
                        print(f"  内容预览: {response.text[:200]}...")
                else:
                    print(f"  ❌ HTTP错误")
                    print(f"  响应内容: {response.text[:200]}...")

            except httpx.TimeoutException:
                print("  ❌ 请求超时")
            except httpx.ConnectError as e:
                print(f"  ❌ 连接错误: {e}")
            except Exception as e:
                print(f"  ❌ 其他错误: {e}")

            print("-" * 60)

    # 测试通过后端代理访问
    print("\n=== 测试通过后端代理访问 ===")
    backend_api = "http://localhost:8787/api/settings/rsshub-url"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(backend_api)
            if response.ok:
                data = response.json()
                print(f"后端配置的RSSHub URL: {data.get('rsshub_url')}")
            else:
                print(f"获取后端配置失败: {response.status_code}")
    except Exception as e:
        print(f"后端连接失败: {e}")
        print("提示: 请启动后端服务: python -m uvicorn app.main:app --host 0.0.0.0 --port 8787")


async def test_rsshub_response_analysis():
    """分析RSSHub响应的具体情况"""
    print("\n=== RSSHub响应分析 ===")

    rsshub_url = "http://58.198.178.157:1200/nature/research/ng"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(rsshub_url)
            content = response.text

            print(f"响应大小: {len(content)} bytes")
            print(f"是否包含RSS标签: {'<rss' in content.lower()}")
            print(f"是否包含channel标签: {'<channel>' in content}")
            print(f"是否包含item标签: {'<item>' in content}")

            # 统计条目数量
            import re
            items = re.findall(r'<item>.*?</item>', content, re.DOTALL)
            print(f"RSS条目数量: {len(items)}")

            if items:
                print("第一个条目标题:")
                first_item = items[0]
                title_match = re.search(r'<title>(.*?)</title>', first_item)
                if title_match:
                    print(f"  {title_match.group(1)[:100]}...")

        except Exception as e:
            print(f"分析失败: {e}")


if __name__ == "__main__":
    asyncio.run(test_frontend_like_requests())
    asyncio.run(test_rsshub_response_analysis())