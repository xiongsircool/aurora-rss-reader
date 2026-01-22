"""
用户设置模型
"""
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

from app.core.config import settings


class UserSettings(SQLModel, table=True):
    """用户设置"""
    __tablename__ = "user_settings"

    id: int = Field(default=1, primary_key=True)  # 单例设置，固定ID为1
    rsshub_url: str = Field(default="https://rsshub.app", description="RSSHub基础URL")
    fetch_interval_minutes: int = Field(default=720, description="RSS获取间隔（分钟），默认12小时")
    auto_refresh: bool = Field(default=True, description="是否自动刷新")
    show_description: bool = Field(default=True, description="是否显示RSS描述")
    items_per_page: int = Field(default=50, description="每页显示条目数")
    show_entry_summary: bool = Field(default=True, description="时间线是否显示摘要")
    open_original_mode: str = Field(default="system", description="打开原文方式: 'system' | 'window'")

    # 时间过滤相关设置
    enable_date_filter: bool = Field(default=True, description="是否启用时间过滤")
    default_date_range: str = Field(default="30d", description="默认时间范围: '1d', '2d', '3d', '7d', '30d', '90d', '180d', '365d', 'all'")
    time_field: str = Field(default="inserted_at", description="时间字段: 'published_at' 或 'inserted_at'")
    max_auto_title_translations: int = Field(default=10, description="自动标题翻译的并发/批量上限")
    mark_as_read_range: str = Field(default="current", description="一键已读范围: 'current', '3d', '7d', '30d', 'all'")

    # AI config and features
    summary_api_key: str = Field(default="", description="AI summary API key")
    summary_base_url: str = Field(default=settings.glm_base_url, description="AI summary base URL")
    summary_model_name: str = Field(default=settings.glm_model, description="AI summary model")
    translation_api_key: str = Field(default="", description="AI translation API key")
    translation_base_url: str = Field(default=settings.glm_base_url, description="AI translation base URL")
    translation_model_name: str = Field(default=settings.glm_model, description="AI translation model")
    ai_auto_summary: bool = Field(default=False, description="Auto-generate summaries")
    ai_auto_title_translation: bool = Field(default=False, description="Auto-translate titles")
    ai_title_display_mode: str = Field(default="original-first", description="Title display mode")
    ai_translation_language: str = Field(default="zh", description="Title translation language")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        """SQLModel配置"""
        table_name = "user_settings"
