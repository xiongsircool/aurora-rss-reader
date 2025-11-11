"""
用户设置模型
"""
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class UserSettings(SQLModel, table=True):
    """用户设置"""
    __tablename__ = "user_settings"

    id: int = Field(default=1, primary_key=True)  # 单例设置，固定ID为1
    rsshub_url: str = Field(default="https://rsshub.app", description="RSSHub基础URL")
    fetch_interval_minutes: int = Field(default=720, description="RSS获取间隔（分钟），默认12小时")
    auto_refresh: bool = Field(default=True, description="是否自动刷新")
    show_description: bool = Field(default=True, description="是否显示RSS描述")
    items_per_page: int = Field(default=50, description="每页显示条目数")

    # 时间过滤相关设置
    enable_date_filter: bool = Field(default=True, description="是否启用时间过滤")
    default_date_range: str = Field(default="30d", description="默认时间范围: '1d', '7d', '30d', '90d', '180d', '365d', 'all'")
    time_field: str = Field(default="inserted_at", description="时间字段: 'published_at' 或 'inserted_at'")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """SQLModel配置"""
        table_name = "user_settings"