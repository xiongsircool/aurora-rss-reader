from __future__ import annotations

import os
import sys
import uvicorn

from app.core.config import settings, APP_DATA_DIR


def is_packaged_runtime() -> bool:
    """
    检测是否为打包运行环境。

    - PyInstaller 会设置 sys.frozen = True
    - Nuitka onefile 会设置环境变量 NUITKA_ONEFILE_PARENT
    """
    return getattr(sys, "frozen", False) or bool(os.getenv("NUITKA_ONEFILE_PARENT"))


def main() -> None:
    """启动后端服务"""
    # 打印启动信息
    is_packaged = is_packaged_runtime()
    print(f"🚀 Aurora RSS Backend Starting...")
    print(f"📦 Packaged: {is_packaged}")
    print(f"🌍 Environment: {settings.app_env}")
    print(f"📂 Data Directory: {APP_DATA_DIR}")
    print(f"🗄️  Database: {settings.sqlite_path}")
    print(f"🌐 Server: http://{settings.api_host}:{settings.api_port}")
    print(f"💚 Health Check: http://{settings.api_host}:{settings.api_port}/health")
    print("-" * 60)

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        # 在打包环境中禁用 reload（Nuitka & PyInstaller 都会走这里）
        reload=not is_packaged and settings.app_env == "development",
        log_level="info",
    )


if __name__ == "__main__":
    main()
