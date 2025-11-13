from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def get_app_data_dir() -> Path:
    """获取应用数据目录，优先使用用户数据目录"""
    # 如果环境变量指定了数据目录，使用它
    if data_dir := os.getenv("AURORA_DATA_DIR"):
        return Path(data_dir)

    # 检测是否在打包环境中
    is_packaged = getattr(sys, 'frozen', False)

    if is_packaged:
        # 打包环境：使用用户数据目录
        if sys.platform == "darwin":  # macOS
            base_dir = Path.home() / "Library" / "Application Support" / "Aurora RSS Reader"
        elif sys.platform == "win32":  # Windows
            base_dir = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / "Aurora RSS Reader"
        else:  # Linux
            base_dir = Path.home() / ".config" / "aurora-rss-reader"
    else:
        # 开发环境：使用项目目录
        base_dir = Path(__file__).resolve().parents[2] / "data"

    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_DATA_DIR = get_app_data_dir()
DEFAULT_SQLITE_PATH = APP_DATA_DIR / "rss.sqlite"


class Settings(BaseSettings):
    """Application-level configuration loaded from environment/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 15432

    sqlite_path: Path = DEFAULT_SQLITE_PATH
    rsshub_base: str = "https://rsshub.app"
    fetch_interval_minutes: int = 720
    frontend_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]

    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4/"
    glm_model: str = "glm-4-flash"
    glm_api_key: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
