#!/usr/bin/env python3
"""
检查用户设置存储情况
"""

import sqlite3
import os
from datetime import datetime

def check_settings_storage():
    """检查用户设置存储情况"""

    print("=== 用户设置存储情况检查 ===")
    print()

    # 数据库文件路径
    db_path = "/Users/Apple/Documents/RSSpage/backend/data/rss.sqlite"

    if not os.path.exists(db_path):
        print("❌ 数据库文件不存在")
        return

    print(f"✅ 数据库文件存在: {db_path}")
    print(f"📁 文件大小: {os.path.getsize(db_path):,} 字节")
    print(f"📅 修改时间: {datetime.fromtimestamp(os.path.getmtime(db_path))}")
    print()

    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 检查表结构
        print("📋 用户设置表结构:")
        cursor.execute("PRAGMA table_info(user_settings)")
        columns = cursor.fetchall()

        for col in columns:
            print(f"   • {col[1]} ({col[2]}) - {'主键' if col[5] else '普通字段'}")
        print()

        # 检查数据
        print("📊 当前存储的设置:")
        cursor.execute("SELECT * FROM user_settings")
        settings = cursor.fetchall()

        if settings:
            setting = settings[0]
            print(f"   🆔 ID: {setting[0]}")
            print(f"   🔗 RSSHub URL: {setting[1]}")
            print(f"   ⏰ 获取间隔: {setting[2]} 分钟")
            print(f"   🔄 自动刷新: {'开启' if setting[3] else '关闭'}")
            print(f"   📝 显示描述: {'开启' if setting[4] else '关闭'}")
            print(f"   📄 每页条目数: {setting[5]}")
            print(f"   🕐 创建时间: {setting[6]}")
            print(f"   🕐 更新时间: {setting[7]}")
        else:
            print("   ⚠️  没有找到设置记录")
        print()

        # 检查数据库完整性
        print("🔍 数据库完整性检查:")
        cursor.execute("SELECT COUNT(*) FROM user_settings")
        count = cursor.fetchone()[0]

        if count == 1:
            print("   ✅ 设置记录数量正确 (单例模式)")
        elif count == 0:
            print("   ⚠️  没有设置记录，将使用默认值")
        else:
            print(f"   ⚠️  发现 {count} 条设置记录，可能有问题")

        # 检查其他相关表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        print("\n📚 数据库中的所有表:")
        for table in sorted(tables):
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"   • {table}: {count:,} 条记录")

        conn.close()

    except Exception as e:
        print(f"❌ 数据库操作失败: {e}")

def demonstrate_settings_persistence():
    """演示设置的持久性"""
    print("\n=== 设置持久性演示 ===")

    from app.services.user_settings_service import user_settings_service

    try:
        # 获取当前设置
        print("1. 获取当前设置:")
        settings = user_settings_service.get_settings()
        print(f"   RSSHub URL: {settings.rsshub_url}")
        print(f"   获取间隔: {settings.fetch_interval_minutes} 分钟")
        print()

        # 修改设置
        print("2. 修改RSSHub URL为测试值:")
        test_url = "https://test-rsshub.example.com"
        updated_settings = user_settings_service.update_rsshub_url(test_url)
        print(f"   ✅ 更新为: {updated_settings.rsshub_url}")
        print()

        # 重新获取验证
        print("3. 重新获取设置验证:")
        new_settings = user_settings_service.get_settings()
        print(f"   RSSHub URL: {new_settings.rsshub_url}")

        if new_settings.rsshub_url == test_url:
            print("   ✅ 设置已持久化到数据库")
        else:
            print("   ❌ 设置持久化失败")
        print()

        # 恢复原始设置
        print("4. 恢复原始设置:")
        original_settings = user_settings_service.update_rsshub_url("http://58.198.178.157:1200")
        print(f"   ✅ 恢复为: {original_settings.rsshub_url}")

    except Exception as e:
        print(f"❌ 演示失败: {e}")

if __name__ == "__main__":
    check_settings_storage()
    demonstrate_settings_persistence()