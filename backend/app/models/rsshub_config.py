"""
RSSHub镜像配置模型
"""
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class RSSHubConfig(SQLModel, table=True):
    """RSSHub镜像配置"""
    __tablename__ = "rsshub_config"

    id: int = Field(default=None, primary_key=True)
    name: str = Field(description="配置名称，如'主镜像', '备用镜像1'")
    base_url: str = Field(description="RSSHub基础URL，如'https://rsshub.app'")
    priority: int = Field(default=1, description="优先级，数字越小优先级越高")
    enabled: bool = Field(default=True, description="是否启用")
    timeout: int = Field(default=30, description="超时时间（秒）")
    is_default: bool = Field(default=False, description="是否为默认镜像")
    description: Optional[str] = Field(None, description="描述信息")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """SQLModel配置"""
        table_name = "rsshub_config"


class RSSHubURLMapping(SQLModel, table=True):
    """RSSHub URL映射表"""
    __tablename__ = "rsshub_url_mapping"

    id: int = Field(default=None, primary_key=True)
    original_url: str = Field(description="原始RSSHub URL")
    alternative_url: str = Field(description="替代URL（非RSSHub）")
    enabled: bool = Field(default=True, description="是否启用")
    description: Optional[str] = Field(None, description="描述")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        table_name = "rsshub_url_mapping"


# RSSHub镜像预设配置
DEFAULT_RSSHUB_MIRRORS = [
    {
        "name": "主镜像 (官方)",
        "base_url": "https://rsshub.app",
        "priority": 1,
        "is_default": True,
        "description": "RSSHub官方镜像"
    },
    {
        "name": "备用镜像1",
        "base_url": "https://rsshub.rssforever.com",
        "priority": 2,
        "description": "RSSHub备用镜像1"
    },
    {
        "name": "备用镜像2",
        "base_url": "https://rsshub.ktachibana.party",
        "priority": 3,
        "description": "RSSHub备用镜像2"
    },
    {
        "name": "备用镜像3",
        "base_url": "https://rsshub.cskaoyan.com",
        "priority": 4,
        "description": "RSSHub备用镜像3"
    }
]