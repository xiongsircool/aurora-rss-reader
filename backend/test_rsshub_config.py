#!/usr/bin/env python3
"""
测试RSSHub配置功能
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.user_settings_service import user_settings_service
from app.services.fetcher import _get_urls_to_try


async def test_rsshub_config():
    """测试RSSHub配置功能"""
    print("=== RSSHub配置功能测试 ===\n")

    # 1. 测试获取默认设置
    print("1. 获取默认设置:")
    settings = user_settings_service.get_settings()
    print(f"   当前RSSHub URL: {settings.rsshub_url}")
    print(f"   获取间隔: {settings.fetch_interval_minutes}分钟\n")

    # 2. 测试更新RSSHub URL
    print("2. 更新RSSHub URL为您提供的地址:")
    try:
        updated_settings = user_settings_service.update_rsshub_url("http://58.198.178.157:1200")
        print(f"   ✅ 更新成功: {updated_settings.rsshub_url}\n")
    except Exception as e:
        print(f"   ❌ 更新失败: {e}\n")

    # 3. 测试URL转换逻辑
    print("3. 测试RSS URL转换逻辑:")
    test_urls = [
        "https://rsshub.app/nature/research/ng",
        "https://rsshub.app/bilibili/user/dynamic/2267573",
        "https://rsshub.app/github/issue/vuejs/vue",
        "https://example.com/normal-rss.xml"  # 非RSSHub链接
    ]

    for original_url in test_urls:
        converted_urls = await _get_urls_to_try(original_url)
        print(f"   原始: {original_url}")
        print(f"   转换: {converted_urls}")
        print()

    # 4. 测试获取当前RSSHub URL
    print("4. 验证当前配置的RSSHub URL:")
    current_url = user_settings_service.get_rsshub_url()
    print(f"   当前配置: {current_url}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_rsshub_config())