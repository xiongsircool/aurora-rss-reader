"""
创建RSSHub配置表的脚本
"""
from sqlalchemy import text
from app.db.session import engine


def create_rsshub_tables():
    """创建RSSHub配置相关的数据库表"""
    with engine.connect() as connection:
        # 创建RSSHub配置表
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS rsshub_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                base_url VARCHAR(500) NOT NULL UNIQUE,
                priority INTEGER DEFAULT 1,
                enabled BOOLEAN DEFAULT TRUE,
                timeout INTEGER DEFAULT 30,
                is_default BOOLEAN DEFAULT FALSE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 创建URL映射表
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS rsshub_url_mapping (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_url VARCHAR(1000) NOT NULL,
                alternative_url VARCHAR(1000) NOT NULL,
                enabled BOOLEAN DEFAULT TRUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 创建索引
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_rsshub_config_enabled_priority
            ON rsshub_config(enabled, priority)
        """))

        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_rsshub_url_mapping_enabled
            ON rsshub_url_mapping(enabled)
        """))

        connection.commit()
        print("✅ RSSHub配置表创建成功")


if __name__ == "__main__":
    create_rsshub_tables()