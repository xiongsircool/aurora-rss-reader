from __future__ import annotations

import os
import sys
import logging
import multiprocessing
import traceback
from pathlib import Path
import uvicorn

# PyInstaller: 显式导入关键模块，确保打包时能正确发现依赖
# noinspection PyUnresolvedReferences
import fastapi  # noqa: F401
# noinspection PyUnresolvedReferences
import pydantic_settings  # noqa: F401
# noinspection PyUnresolvedReferences
import pydantic  # noqa: F401
# noinspection PyUnresolvedReferences
import apscheduler  # noqa: F401
# noinspection PyUnresolvedReferences
import sqlmodel  # noqa: F401
# noinspection PyUnresolvedReferences
import sqlalchemy  # noqa: F401
# noinspection PyUnresolvedReferences
import httpx  # noqa: F401
# noinspection PyUnresolvedReferences
import feedparser  # noqa: F401
# noinspection PyUnresolvedReferences
import bs4  # noqa: F401
# noinspection PyUnresolvedReferences
import lxml  # noqa: F401
# noinspection PyUnresolvedReferences
import readability  # noqa: F401
# noinspection PyUnresolvedReferences
import loguru  # noqa: F401
# 显式导入 app 模块，触发其依赖链
# noinspection PyUnresolvedReferences
import app.main  # noqa: F401

from app.core.config import settings, APP_DATA_DIR

# DEBUG: 极其原始的启动标记，用于确证 Python 进程是否启动
try:
    # 尝试写入 APPDATA，如果失败则尝试 TEMP
    debug_dir = os.path.join(os.getenv('APPDATA', ''), 'Aurora RSS Reader')
    if not os.path.exists(debug_dir):
        os.makedirs(debug_dir, exist_ok=True)
    
    debug_path = os.path.join(debug_dir, 'python_alive.txt')
    with open(debug_path, 'a') as f:
        import datetime
        f.write(f"\n[{datetime.datetime.now()}] Python process started.\n")
        f.write(f"CWD: {os.getcwd()}\n")
        f.write(f"Executable: {sys.executable}\n")
        f.write(f"Path: {sys.path}\n")
except Exception as e:
    pass


def setup_logging():
    """Setup file logging for debugging packaged app."""
    try:
        log_file = APP_DATA_DIR / "backend_startup.log"
        logging.basicConfig(
            filename=str(log_file),
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            force=True
        )
        # Add console handler
        console = logging.StreamHandler()
        console.setLevel(logging.INFO)
        logging.getLogger('').addHandler(console)
        return log_file
    except Exception as e:
        print(f"Failed to setup logging: {e}")
        return None

def main() -> None:
    """启动后端服务"""
    setup_logging()
    
    # 强制使用 UTF-8 输出，防止 Windows 下 UnicodeEncodeError
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
            
    try:
        # 打印启动信息
        is_packaged = getattr(sys, 'frozen', False)
        print(f"🚀 Aurora RSS Backend Starting...")
        print(f"📦 Packaged: {is_packaged}")
        print(f"🌍 Environment: {settings.app_env}")
        print(f"📂 Data Directory: {APP_DATA_DIR}")
        print(f"🗄️  Database: {settings.sqlite_path}")
        print(f"🌐 Server: http://{settings.api_host}:{settings.api_port}")
        print(f"💚 Health Check: http://{settings.api_host}:{settings.api_port}/health")
        print("-" * 60)

        # 在打包环境中强制禁用reload
        is_packaged = getattr(sys, 'frozen', False)

        uvicorn.run(
            "app.main:app",
            host=settings.api_host,
            port=settings.api_port,
            reload=not is_packaged and settings.app_env == "development",
            log_level="info",
        )
    except Exception as e:
        logging.critical(f"Fatal error during startup: {e}")
        logging.critical(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
