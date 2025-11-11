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
    fetch_interval_minutes: int = Field(default=15, description="RSS获取间隔（分钟）")
    auto_refresh: bool = Field(default=True, description="是否自动刷新")
    show_description: bool = Field(default=True, description="是否显示RSS描述")
    items_per_page: int = Field(default=50, description="每页显示条目数")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """SQLModel配置"""
        table_name = "user_settings"