from __future__ import annotations

import sys
import uvicorn

from app.core.config import settings, APP_DATA_DIR


def main() -> None:
    """启动后端服务"""
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


if __name__ == "__main__":
    main()
