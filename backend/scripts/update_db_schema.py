#!/usr/bin/env python3
"""
数据库结构更新脚本
添加缺失的 user_settings 表字段
"""
import sqlite3
import sys
from pathlib import Path

# 获取数据库路径
db_path = Path(__file__).parent.parent / "data" / "rss.sqlite"

def update_database():
    """更新数据库表结构"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 检查 user_settings 表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='user_settings'
        """)
        table_exists = cursor.fetchone()

        if not table_exists:
            print("user_settings 表不存在，正在创建...")
            # 如果表不存在，让应用启动时创建
            conn.close()
            return True

        # 检查列是否存在
        cursor.execute("PRAGMA table_info(user_settings)")
        columns = [row[1] for row in cursor.fetchall()]

        # 需要添加的列
        columns_to_add = [
            ("enable_date_filter", "BOOLEAN DEFAULT 1"),
            ("default_date_range", "TEXT DEFAULT '30d'"),
            ("time_field", "TEXT DEFAULT 'inserted_at'")
        ]

        updated = False
        for col_name, col_def in columns_to_add:
            if col_name not in columns:
                print(f"添加列: {col_name}")
                cursor.execute(f"""
                    ALTER TABLE user_settings
                    ADD COLUMN {col_name} {col_def}
                """)
                updated = True
            else:
                print(f"列 {col_name} 已存在")

        if updated:
            conn.commit()
            print("数据库结构更新完成")
        else:
            print("数据库结构已是最新")

        conn.close()
        return True

    except Exception as e:
        print(f"更新数据库失败: {e}")
        return False

if __name__ == "__main__":
    if update_database():
        sys.exit(0)
    else:
        sys.exit(1)