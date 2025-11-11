"""
用户设置服务
"""
from typing import Optional
from sqlmodel import Session, select
from app.db.session import SessionLocal
from app.models.user_settings import UserSettings


class UserSettingsService:
    """用户设置管理服务"""

    @staticmethod
    def get_settings() -> UserSettings:
        """获取用户设置，如果不存在则创建默认设置"""
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