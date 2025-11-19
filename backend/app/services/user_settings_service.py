"""
用户设置服务
"""
from typing import Optional
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.user_settings import UserSettings

_schema_checked = False


def ensure_user_settings_schema():
    """Ensure new columns exist for user settings table."""
    global _schema_checked
    if _schema_checked:
        return

    required_columns = {
        "show_entry_summary": "ALTER TABLE user_settings ADD COLUMN show_entry_summary BOOLEAN NOT NULL DEFAULT 1",
        "enable_date_filter": "ALTER TABLE user_settings ADD COLUMN enable_date_filter BOOLEAN NOT NULL DEFAULT 1",
        "default_date_range": "ALTER TABLE user_settings ADD COLUMN default_date_range TEXT NOT NULL DEFAULT '30d'",
        "time_field": "ALTER TABLE user_settings ADD COLUMN time_field TEXT NOT NULL DEFAULT 'inserted_at'",
        "max_auto_title_translations": "ALTER TABLE user_settings ADD COLUMN max_auto_title_translations INTEGER NOT NULL DEFAULT 6",
    }

    with engine.connect() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info('user_settings')"))}
        new_columns_added = False
        for column_name, statement in required_columns.items():
            if column_name not in columns:
                connection.execute(text(statement))
                new_columns_added = True

        if new_columns_added:
            connection.commit()

    _schema_checked = True


class UserSettingsService:
    """用户设置管理服务"""

    @staticmethod
    def get_settings() -> UserSettings:
        """获取用户设置，如果不存在则创建默认设置"""
        ensure_user_settings_schema()
        with SessionLocal() as session:
            settings = session.get(UserSettings, 1)
            if not settings:
                settings = UserSettings(id=1)
                session.add(settings)
                session.commit()
                session.refresh(settings)
            return settings

    @staticmethod
    def update_settings(**kwargs) -> UserSettings:
        """更新用户设置"""
        ensure_user_settings_schema()
        with SessionLocal() as session:
            settings = session.get(UserSettings, 1)
            if not settings:
                settings = UserSettings(id=1)
                session.add(settings)

            # 更新指定字段
            for key, value in kwargs.items():
                if hasattr(settings, key) and value is not None:
                    setattr(settings, key, value)

            session.add(settings)
            session.commit()
            session.refresh(settings)
            return settings

    @staticmethod
    def get_rsshub_url() -> str:
        """获取配置的RSSHub URL"""
        settings = UserSettingsService.get_settings()
        return settings.rsshub_url.rstrip('/')  # 移除末尾斜杠

    @staticmethod
    def update_rsshub_url(url: str) -> UserSettings:
        """更新RSSHub URL"""
        # 确保URL格式正确
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        return UserSettingsService.update_settings(rsshub_url=url)


# 全局实例
user_settings_service = UserSettingsService()
