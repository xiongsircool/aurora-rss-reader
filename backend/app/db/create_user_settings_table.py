"""
创建用户设置表
"""
from sqlalchemy import text
from app.db.session import engine


def create_user_settings_table():
    """创建用户设置表"""
    with engine.connect() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY,
                rsshub_url VARCHAR(500) NOT NULL DEFAULT 'https://rsshub.app',
                fetch_interval_minutes INTEGER NOT NULL DEFAULT 15,
                auto_refresh BOOLEAN NOT NULL DEFAULT TRUE,
                show_description BOOLEAN NOT NULL DEFAULT TRUE,
                items_per_page INTEGER NOT NULL DEFAULT 50,
                show_entry_summary BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT user_settings_singleton CHECK (id = 1)
            )
        """))

        # 创建唯一约束确保只有一条记录
        connection.execute(text("""
            INSERT OR IGNORE INTO user_settings (id) VALUES (1)
        """))

        connection.commit()
        print("✅ 用户设置表创建成功")


if __name__ == "__main__":
    create_user_settings_table()
