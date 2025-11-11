"""
RSSHub连通性测试服务
"""
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
from feedparser import parse
import re

from app.services.user_settings_service import user_settings_service


@dataclass
class RSSHubTestResult:
    """RSSHub测试结果"""
    success: bool
    rsshub_url: str
    total_tests: int
    successful_tests: int
    failed_tests: int
    response_times: List[float]
    error_messages: List[str]
    test_details: List[Dict]
    test_duration: float
    tested_at: datetime


class RSSHubTestService:
    """RSSHub测试服务"""

    # 预定义的测试路由（选择一些稳定的、代表性的路由）
    TEST_ROUTES = [
        {
            "path": "/nature/research/ng",
            "name": "Nature Genetics",
            "expected_content": ["rss", "xml"],
            "min_size": 1000  # 最小预期内容大小（字节）
        },
        {
            "path": "/github/issue/vuejs/vue",
            "name": "Vue.js GitHub Issues",
            "expected_content": ["rss", "xml"],
            "min_size": 500
        },
        {
            "path": "/bilibili/user/dynamic/2267573",
            "name": "Bilibili 动态",
            "expected_content": ["rss", "xml"],
            "min_size": 200
        },
        {
            "path": "/v2ex/topics/hot",
            "name": "V2EX 热门话题",
            "expected_content": ["rss", "xml"],
            "min_size": 1000
        },
        {
            "path": "/csdn/blog",
            "name": "CSDN 博客",
            "expected_content": ["rss", "xml"],
            "min_size": 1000
        }
    ]

    def __init__(self):
        self.timeout = httpx.Timeout(15.0, connect=5.0)
        self.headers = {
            "User-Agent": "RSS Reader Test Bot (RSSHub Connectivity Test)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }

    async def test_rsshub_connectivity(self, rsshub_url: str = None) -> RSSHubTestResult:
        """测试RSSHub连通性"""
        if rsshub_url is None:
            rsshub_url = user_settings_service.get_rsshub_url()

        start_time = datetime.now()

        # 清理URL格式
        rsshub_url = rsshub_url.rstrip('/')

        results = []
        successful_tests = 0
        failed_tests = 0
        response_times = []
        error_messages = []
        test_details = []

        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
            for route in self.TEST_ROUTES:
                test_url = f"{rsshub_url}{route['path']}"
                route_start_time = datetime.now()

                try:
                    response = await client.get(test_url, follow_redirects=True)

                    # 计算响应时间
                    response_time = (datetime.now() - route_start_time).total_seconds()
                    response_times.append(response_time)

                    # 检查响应状态
                    if response.status_code != 200:
                        failed_tests += 1
                        error_messages.append(f"{route['name']}: HTTP {response.status_code}")
                        test_details.append({
                            "route": route,
                            "url": test_url,
                            "success": False,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "error": f"HTTP {response.status_code}"
                        })
                        continue

                    # 检查内容类型
                    content_type = response.headers.get('content-type', '').lower()
                    if not any(expected in content_type for expected in route['expected_content']):
                        failed_tests += 1
                        error_messages.append(f"{route['name']}: 内容类型错误 ({content_type})")
                        test_details.append({
                            "route": route,
                            "url": test_url,
                            "success": False,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "error": f"内容类型错误: {content_type}"
                        })
                        continue

                    # 检查内容大小
                    content_size = len(response.content)
                    if content_size < route['min_size']:
                        failed_tests += 1
                        error_messages.append(f"{route['name']}: 内容过小 ({content_size}字节)")
                        test_details.append({
                            "route": route,
                            "url": test_url,
                            "success": False,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "error": f"内容过小: {content_size}字节"
                        })
                        continue

                    # 尝试解析RSS内容
                    try:
                        parsed = parse(response.content)
                        if not hasattr(parsed, 'feed') or not parsed.feed:
                            failed_tests += 1
                            error_messages.append(f"{route['name']}: RSS解析失败")
                            test_details.append({
                                "route": route,
                                "url": test_url,
                                "success": False,
                                "status_code": response.status_code,
                                "response_time": response_time,
                                "error": "RSS解析失败"
                            })
                            continue

                        # 获取RSS信息
                        feed_title = getattr(parsed.feed, 'title', '无标题')
                        entries_count = len(getattr(parsed, 'entries', []))

                        successful_tests += 1
                        test_details.append({
                            "route": route,
                            "url": test_url,
                            "success": True,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "feed_title": feed_title,
                            "entries_count": entries_count,
                            "content_size": content_size
                        })

                    except Exception as parse_error:
                        failed_tests += 1
                        error_messages.append(f"{route['name']}: RSS解析异常 ({str(parse_error)})")
                        test_details.append({
                            "route": route,
                            "url": test_url,
                            "success": False,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "error": f"RSS解析异常: {str(parse_error)}"
                        })

                except httpx.TimeoutException:
                    failed_tests += 1
                    error_messages.append(f"{route['name']}: 请求超时")
                    test_details.append({
                        "route": route,
                        "url": test_url,
                        "success": False,
                        "response_time": 15.0,  # 超时时间
                        "error": "请求超时"
                    })

                except httpx.ConnectError as e:
                    failed_tests += 1
                    error_messages.append(f"{route['name']}: 连接失败")
                    test_details.append({
                        "route": route,
                        "url": test_url,
                        "success": False,
                        "error": "连接失败"
                    })

                except Exception as e:
                    failed_tests += 1
                    error_messages.append(f"{route['name']}: 未知错误 ({str(e)})")
                    test_details.append({
                        "route": route,
                        "url": test_url,
                        "success": False,
                        "error": f"未知错误: {str(e)}"
                    })

        test_duration = (datetime.now() - start_time).total_seconds()
        total_tests = len(self.TEST_ROUTES)

        return RSSHubTestResult(
            success=successful_tests > 0,
            rsshub_url=rsshub_url,
            total_tests=total_tests,
            successful_tests=successful_tests,
            failed_tests=failed_tests,
            response_times=response_times,
            error_messages=error_messages,
            test_details=test_details,
            test_duration=test_duration,
            tested_at=start_time
        )

    async def quick_test(self, rsshub_url: str = None) -> Dict:
        """快速测试RSSHub连通性（只测试一个路由）"""
        if rsshub_url is None:
            rsshub_url = user_settings_service.get_rsshub_url()

        # 选择最稳定的路由进行快速测试
        quick_route = self.TEST_ROUTES[0]  # Nature Genetics
        test_url = f"{rsshub_url.rstrip('/')}{quick_route['path']}"

        start_time = datetime.now()

        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                response = await client.get(test_url, follow_redirects=True)

                test_duration = (datetime.now() - start_time).total_seconds()

                if response.status_code == 200:
                    content_type = response.headers.get('content-type', '').lower()
                    if any(expected in content_type for expected in quick_route['expected_content']):
                        # 尝试解析RSS
                        try:
                            parsed = parse(response.content)
                            feed_title = getattr(parsed.feed, 'title', '无标题')
                            entries_count = len(getattr(parsed, 'entries', []))

                            return {
                                "success": True,
                                "message": f"RSSHub连接测试成功！",
                                "rsshub_url": rsshub_url,
                                "test_url": test_url,
                                "response_time": test_duration,
                                "feed_title": feed_title,
                                "entries_count": entries_count,
                                "content_size": len(response.content),
                                "tested_at": start_time.isoformat()
                            }
                        except:
                            return {
                                "success": False,
                                "message": "RSSHub连接成功但RSS解析失败",
                                "rsshub_url": rsshub_url,
                                "test_url": test_url,
                                "response_time": test_duration,
                                "tested_at": start_time.isoformat()
                            }
                    else:
                        return {
                            "success": False,
                            "message": f"RSSHub返回了非RSS内容: {content_type}",
                            "rsshub_url": rsshub_url,
                            "test_url": test_url,
                            "response_time": test_duration,
                            "tested_at": start_time.isoformat()
                        }
                else:
                    return {
                        "success": False,
                        "message": f"RSSHub响应错误: HTTP {response.status_code}",
                        "rsshub_url": rsshub_url,
                        "test_url": test_url,
                        "response_time": test_duration,
                        "tested_at": start_time.isoformat()
                    }

        except httpx.TimeoutException:
            return {
                "success": False,
                "message": "RSSHub连接超时",
                "rsshub_url": rsshub_url,
                "test_url": test_url,
                "response_time": 15.0,
                "tested_at": start_time.isoformat()
            }

        except httpx.ConnectError:
            return {
                "success": False,
                "message": "无法连接到RSSHub实例",
                "rsshub_url": rsshub_url,
                "test_url": test_url,
                "response_time": (datetime.now() - start_time).total_seconds(),
                "tested_at": start_time.isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"RSSHub测试失败: {str(e)}",
                "rsshub_url": rsshub_url,
                "test_url": test_url,
                "response_time": (datetime.now() - start_time).total_seconds(),
                "tested_at": start_time.isoformat()
            }


# 全局实例
rsshub_test_service = RSSHubTestService()