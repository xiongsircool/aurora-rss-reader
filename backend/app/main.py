from __future__ import annotations

import asyncio
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import re
import logging
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.services.rsshub_manager import rsshub_manager
from app.core.config import settings, APP_DATA_DIR
from app.db.session import init_db  # Also call this to ensure tables exist
from scripts.migrate import run_migrations
from app.services.fetcher import refresh_all_feeds
from app.services.user_settings_service import ensure_user_settings_schema

# 允许所有localhost端口访问

def is_localhost_origin(origin: str) -> bool:
    """检查是否为localhost或127.0.0.1的任何端口"""
    if not origin:
        return False
    # 匹配 localhost:* 或 127.0.0.1:* 的任何端口
    return bool(re.match(r'^(https?://)?(localhost|127\.0\.0\.1)(:\d+)?/?$', origin))


def build_allowed_origins() -> list[str]:
    """
    根据运行环境生成 CORS 白名单。

    - 开发环境：保持全开放，方便前端调试
    - 打包环境：自动添加 file:// (在浏览器里会被识别为 null) 以及 Electron 自定义协议
    - 其余情况下使用 .env 中的 FRONTEND_ORIGINS
    """
    if settings.app_env == "development":
        return ["*"]

    allowed = set(settings.frontend_origins or [])
    is_packaged = getattr(sys, 'frozen', False)

    if is_packaged:
        # Electron 渲染进程从 file:// 加载时，Origin 会被标记为 "null"
        # 一些定制打包方案会改成 app:// 协议，这里一并放开
        allowed.update({
            "null",
            "app://.",
            "app://aurora",
        })

    # 如果用户完全禁用了白名单，至少保留 loopback 以免本地客户端无法访问
    if not allowed:
        allowed.update({
            "http://127.0.0.1",
            "http://localhost",
        })

    return sorted(allowed)




# ... existing code ...

@asynccontextmanager
async def lifespan(_: FastAPI):
    # 先确保表存在，再运行迁移
    # await init_db()
    
    logger = logging.getLogger("backend.startup")
    logger.info("Application starting up...")
    
    start_time = time.time()
    try:
        # logger.info("Running database migrations...")
        # await asyncio.to_thread(run_migrations)
        logger.info(f"Database migrations completed in {time.time() - start_time:.2f}s")
    except Exception as e:
        logger.error(f"Startup migration failed: {e}", exc_info=True)
        # 这里可以选择是否继续运行，对于必须的数据库变更，失败应该退出
        # 但为了用户体验，有时会选择记录日志继续
        pass

    await ensure_user_settings_schema()
    # 初始化RSSHub配置
    await rsshub_manager.initialize_default_mirrors()
    
    logger.info(f"Application fully initialized in {time.time() - start_time:.2f}s")

    scheduler = AsyncIOScheduler()
    scheduler.start()
    scheduler.add_job(refresh_all_feeds, "interval", minutes=settings.fetch_interval_minutes)
    asyncio.create_task(refresh_all_feeds())
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    app = FastAPI(title="RSS READER API", version="0.1.3", lifespan=lifespan)

    # CORS配置：开发态保持全开放，打包态自动允许 file:///app:// 渲染进程，其余情况使用环境变量
    allow_origins = build_allowed_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 健康检查端点
    @app.get("/health")
    async def health_check():
        """健康检查端点，用于确认后端服务已就绪"""
        return JSONResponse({
            "status": "ok",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "environment": settings.app_env,
            "data_dir": str(APP_DATA_DIR),
            "is_packaged": getattr(sys, 'frozen', False),
        })

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
