#!/usr/bin/env python3
"""
RSSHub配置管理命令行工具
"""
import asyncio
import argparse
import sys
from app.services.rsshub_manager import rsshub_manager


async def list_mirrors():
    """列出所有镜像"""
    mirrors = await rsshub_manager.get_available_mirrors()
    if not mirrors:
        print("没有可用的RSSHub镜像")
        return

    print(f"\n{'名称':<20} {'URL':<40} {'优先级':<8} {'默认':<8}")
    print("-" * 80)
    for mirror in mirrors:
        default = "是" if mirror.is_default else "否"
        print(f"{mirror.name:<20} {mirror.base_url:<40} {mirror.priority:<8} {default:<8}")


async def add_mirror(name: str, base_url: str, priority: int = None, is_default: bool = False):
    """添加新镜像"""
    try:
        mirror = await rsshub_manager.add_mirror(
            name=name,
            base_url=base_url,
            priority=priority,
            is_default=is_default,
            description=f"通过命令行添加"
        )
        print(f"✅ 成功添加镜像: {mirror.name} ({mirror.base_url})")
    except Exception as e:
        print(f"❌ 添加镜像失败: {e}")


async def test_mirror(base_url: str):
    """测试镜像连通性"""
    print(f"\n正在测试镜像: {base_url}")
    result = await rsshub_manager.test_mirror_connectivity(base_url)

    status = "✅ 成功" if result["success"] else "❌ 失败"
    print(f"状态: {status}")
    print(f"消息: {result['message']}")
    if result['response_time']:
        print(f"响应时间: {result['response_time']:.2f}秒")


async def set_default(mirror_id: int):
    """设置默认镜像"""
    success = await rsshub_manager.set_default_mirror(mirror_id)
    if success:
        print("✅ 已设置为默认镜像")
    else:
        print("❌ 设置失败，镜像不存在")


async def disable_mirror(mirror_id: int):
    """禁用镜像"""
    success = await rsshub_manager.disable_mirror(mirror_id)
    if success:
        print("✅ 已禁用镜像")
    else:
        print("❌ 禁用失败，镜像不存在")


async def initialize():
    """初始化默认配置"""
    await rsshub_manager.initialize_default_mirrors()
    print("✅ 已初始化默认RSSHub配置")


async def main():
    parser = argparse.ArgumentParser(description="RSSHub配置管理工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # 列出镜像
    subparsers.add_parser("list", help="列出所有可用镜像")

    # 添加镜像
    add_parser = subparsers.add_parser("add", help="添加新镜像")
    add_parser.add_argument("name", help="镜像名称")
    add_parser.add_argument("url", help="镜像URL")
    add_parser.add_argument("--priority", type=int, help="优先级（数字越小优先级越高）")
    add_parser.add_argument("--default", action="store_true", help="设置为默认镜像")

    # 测试镜像
    test_parser = subparsers.add_parser("test", help="测试镜像连通性")
    test_parser.add_argument("url", help="镜像URL")

    # 设置默认镜像
    default_parser = subparsers.add_parser("set-default", help="设置默认镜像")
    default_parser.add_argument("id", type=int, help="镜像ID")

    # 禁用镜像
    disable_parser = subparsers.add_parser("disable", help="禁用镜像")
    disable_parser.add_argument("id", type=int, help="镜像ID")

    # 初始化
    subparsers.add_parser("init", help="初始化默认配置")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "list":
            await list_mirrors()
        elif args.command == "add":
            await add_mirror(args.name, args.url, args.priority, args.default)
        elif args.command == "test":
            await test_mirror(args.url)
        elif args.command == "set-default":
            await set_default(args.id)
        elif args.command == "disable":
            await disable_mirror(args.id)
        elif args.command == "init":
            await initialize()
    except KeyboardInterrupt:
        print("\n操作已取消")
    except Exception as e:
        print(f"❌ 操作失败: {e}")


if __name__ == "__main__":
    asyncio.run(main())