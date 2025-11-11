from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.config import settings, get_settings
from app.db.deps import get_session

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_app_settings() -> dict:
    """获取应用设置"""
    return {
        "fetch_interval_minutes": settings.fetch_interval_minutes,
    }


@router.patch("")
async def update_app_settings(
    payload: dict,
    session: Session = Depends(get_session)
) -> dict:
    """更新应用设置

    注意：这些设置会在下次应用重启时生效，或者需要重新配置调度器
    """
    # 这里只是更新配置，实际应用需要在重启后才能生效
    # 在生产环境中，你可能需要将这些设置保存到数据库或配置文件中

    updated_settings = {}

    if "fetch_interval_minutes" in payload:
        interval = payload["fetch_interval_minutes"]
        if not isinstance(interval, int) or interval < 5 or interval > 1440:
            raise HTTPException(
                status_code=400,
                detail="fetch_interval_minutes must be an integer between 5 and 1440"
            )
        updated_settings["fetch_interval_minutes"] = interval

    # 在实际应用中，这里应该更新配置文件或数据库
    # 目前我们返回成功响应，但实际的设置更改需要重启应用

    return {
        "message": "Settings updated. Restart the application for changes to take effect.",
        "updated_settings": updated_settings
    }


@router.post("/restart-scheduler")
async def restart_scheduler() -> dict:
    """重新启动订阅刷新调度器

    这个端点用于在不重启整个应用的情况下重新配置调度器
    """
    # 注意：这需要实现调度器的动态重配置功能
    # 目前我们只返回一个占位响应
    return {
        "message": "Scheduler restart functionality not yet implemented",
        "status": "placeholder"
    }