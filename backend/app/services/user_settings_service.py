"""
用户设置服务
"""
from sqlalchemy import text
from app.core.config import settings
from app.db.session import async_session_maker, engine
from app.models.user_settings import UserSettings

_schema_checked = False

FETCH_INTERVAL_MIN = 5
FETCH_INTERVAL_MAX = 1440
DEFAULT_FETCH_INTERVAL_MINUTES = 720


def normalize_fetch_interval(value: int | None) -> int:
    if value is None:
        return DEFAULT_FETCH_INTERVAL_MINUTES
    if value < FETCH_INTERVAL_MIN:
        return FETCH_INTERVAL_MIN
    if value > FETCH_INTERVAL_MAX:
        return FETCH_INTERVAL_MAX
    return value


async def ensure_user_settings_schema():
    """Ensure new columns exist for user settings table."""
    global _schema_checked
    if _schema_checked:
        return

    required_columns = {
        "show_entry_summary": "ALTER TABLE user_settings ADD COLUMN show_entry_summary BOOLEAN NOT NULL DEFAULT 1",
        "open_original_mode": "ALTER TABLE user_settings ADD COLUMN open_original_mode TEXT NOT NULL DEFAULT 'system'",
        "enable_date_filter": "ALTER TABLE user_settings ADD COLUMN enable_date_filter BOOLEAN NOT NULL DEFAULT 1",
        "default_date_range": "ALTER TABLE user_settings ADD COLUMN default_date_range TEXT NOT NULL DEFAULT '30d'",
        "time_field": "ALTER TABLE user_settings ADD COLUMN time_field TEXT NOT NULL DEFAULT 'inserted_at'",
        "max_auto_title_translations": "ALTER TABLE user_settings ADD COLUMN max_auto_title_translations INTEGER NOT NULL DEFAULT 10",
        "mark_as_read_range": "ALTER TABLE user_settings ADD COLUMN mark_as_read_range TEXT NOT NULL DEFAULT 'current'",
        "details_panel_mode": "ALTER TABLE user_settings ADD COLUMN details_panel_mode TEXT NOT NULL DEFAULT 'docked'",
        "summary_api_key": "ALTER TABLE user_settings ADD COLUMN summary_api_key TEXT NOT NULL DEFAULT ''",
        "summary_base_url": f"ALTER TABLE user_settings ADD COLUMN summary_base_url TEXT NOT NULL DEFAULT '{settings.glm_base_url}'",
        "summary_model_name": f"ALTER TABLE user_settings ADD COLUMN summary_model_name TEXT NOT NULL DEFAULT '{settings.glm_model}'",
        "translation_api_key": "ALTER TABLE user_settings ADD COLUMN translation_api_key TEXT NOT NULL DEFAULT ''",
        "translation_base_url": f"ALTER TABLE user_settings ADD COLUMN translation_base_url TEXT NOT NULL DEFAULT '{settings.glm_base_url}'",
        "translation_model_name": f"ALTER TABLE user_settings ADD COLUMN translation_model_name TEXT NOT NULL DEFAULT '{settings.glm_model}'",
        "ai_auto_summary": "ALTER TABLE user_settings ADD COLUMN ai_auto_summary BOOLEAN NOT NULL DEFAULT 0",
        "ai_auto_title_translation": "ALTER TABLE user_settings ADD COLUMN ai_auto_title_translation BOOLEAN NOT NULL DEFAULT 0",
        "ai_title_display_mode": "ALTER TABLE user_settings ADD COLUMN ai_title_display_mode TEXT NOT NULL DEFAULT 'original-first'",
        "ai_translation_language": "ALTER TABLE user_settings ADD COLUMN ai_translation_language TEXT NOT NULL DEFAULT 'zh'",
    }

    async with engine.connect() as connection:
        result = await connection.execute(text("PRAGMA table_info('user_settings')"))
        columns = {row[1] for row in result}
        new_columns_added = False
        for column_name, statement in required_columns.items():
            if column_name not in columns:
                await connection.execute(text(statement))
                new_columns_added = True

        if new_columns_added:
            await connection.commit()

    _schema_checked = True


class UserSettingsService:
    """用户设置管理服务"""

    @staticmethod
    async def get_settings() -> UserSettings:
        """获取用户设置，如果不存在则创建默认设置"""
        await ensure_user_settings_schema()
        async with async_session_maker() as session:
            settings = await session.get(UserSettings, 1)
            if not settings:
                settings = UserSettings(id=1)
                session.add(settings)
                await session.commit()
                await session.refresh(settings)
            normalized_interval = normalize_fetch_interval(settings.fetch_interval_minutes)
            if settings.fetch_interval_minutes != normalized_interval:
                settings.fetch_interval_minutes = normalized_interval
                session.add(settings)
                await session.commit()
                await session.refresh(settings)
            return settings

    @staticmethod
    async def update_settings(**kwargs) -> UserSettings:
        """更新用户设置"""
        await ensure_user_settings_schema()
        async with async_session_maker() as session:
            settings = await session.get(UserSettings, 1)
            if not settings:
                settings = UserSettings(id=1)
                session.add(settings)

            # 更新指定字段
            for key, value in kwargs.items():
                if hasattr(settings, key) and value is not None:
                    setattr(settings, key, value)

            session.add(settings)
            await session.commit()
            await session.refresh(settings)
            return settings

    @staticmethod
    async def get_rsshub_url() -> str:
        """获取配置的RSSHub URL"""
        settings = await UserSettingsService.get_settings()
        return settings.rsshub_url.rstrip('/')  # 移除末尾斜杠

    @staticmethod
    async def update_rsshub_url(url: str) -> UserSettings:
        """更新RSSHub URL"""
        # 确保URL格式正确
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        return await UserSettingsService.update_settings(rsshub_url=url)


# 全局实例
user_settings_service = UserSettingsService()
