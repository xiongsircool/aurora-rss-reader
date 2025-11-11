from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.db.session import init_db
from app.services.fetcher import refresh_all_feeds

# 允许所有localhost端口访问
import re

def is_localhost_origin(origin: str) -> bool:
    """检查是否为localhost或127.0.0.1的任何端口"""
    if not origin:
        return False
    # 匹配 localhost:* 或 127.0.0.1:* 的任何端口
    return bool(re.match(r'^(https?://)?(localhost|127\.0\.0\.1)(:\d+)?/?$', origin))


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    scheduler = AsyncIOScheduler()
    scheduler.start()
    scheduler.add_job(refresh_all_feeds, "interval", minutes=settings.fetch_interval_minutes)
    asyncio.create_task(refresh_all_feeds())
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    app = FastAPI(title="RSS READER API", version="0.1.0", lifespan=lifespan)

    # CORS配置
    if settings.app_env == "development":
        # 开发环境：允许所有localhost和127.0.0.1的任意端口
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # 开发环境允许所有源
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        # 生产环境：使用配置的origins
        allow_origins = list(settings.frontend_origins) if settings.frontend_origins else []

        app.add_middleware(
            CORSMiddleware,
            allow_origins=allow_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
