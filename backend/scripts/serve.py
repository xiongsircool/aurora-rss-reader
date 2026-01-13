from __future__ import annotations

import sys
import uvicorn

from app.core.config import settings, APP_DATA_DIR


import logging
import traceback

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
