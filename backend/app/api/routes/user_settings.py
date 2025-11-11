"""
用户设置API
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.user_settings import UserSettings
from app.services.user_settings_service import user_settings_service

router = APIRouter(prefix="/settings", tags=["用户设置"])


class UserSettingsResponse(BaseModel):
    """用户设置响应模型"""
    rsshub_url: str
    fetch_interval_minutes: int
    auto_refresh: bool
    show_description: bool
    items_per_page: int


class UserSettingsUpdate(BaseModel):
    """用户设置更新模型"""
    rsshub_url: Optional[str] = None
    fetch_interval_minutes: Optional[int] = None
    auto_refresh: Optional[bool] = None
    show_description: Optional[bool] = None
    items_per_page: Optional[int] = None


class RSSHubURLUpdate(BaseModel):
    """RSSHub URL更新模型"""
    rsshub_url: str


@router.get("", response_model=UserSettingsResponse)
async def get_settings():
    """获取用户设置"""
    settings = user_settings_service.get_settings()
    return UserSettingsResponse(
        rsshub_url=settings.rsshub_url,
        fetch_interval_minutes=settings.fetch_interval_minutes,
        auto_refresh=settings.auto_refresh,
        show_description=settings.show_description,
        items_per_page=settings.items_per_page
    )


@router.patch("", response_model=UserSettingsResponse)
async def update_settings(update_data: UserSettingsUpdate):
    """更新用户设置"""
    try:
        # 过滤None值
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        settings = user_settings_service.update_settings(**update_dict)

        return UserSettingsResponse(
            rsshub_url=settings.rsshub_url,
            fetch_interval_minutes=settings.fetch_interval_minutes,
            auto_refresh=settings.auto_refresh,
            show_description=settings.show_description,
            items_per_page=settings.items_per_page
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"更新设置失败: {str(e)}")


@router.post("/rsshub-url", response_model=UserSettingsResponse)
async def update_rsshub_url(update_data: RSSHubURLUpdate):
    """更新RSSHub URL"""
    try:
        settings = user_settings_service.update_rsshub_url(update_data.rsshub_url)

        return UserSettingsResponse(
            rsshub_url=settings.rsshub_url,
            fetch_interval_minutes=settings.fetch_interval_minutes,
            auto_refresh=settings.auto_refresh,
            show_description=settings.show_description,
            items_per_page=settings.items_per_page
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"更新RSSHub URL失败: {str(e)}")


@router.get("/rsshub-url")
async def get_rsshub_url():
    """获取当前RSSHub URL"""
    url = user_settings_service.get_rsshub_url()
    return {"rsshub_url": url}


@router.post("/test-rsshub-quick")
async def test_rsshub_quick():
    """快速测试RSSHub连通性"""
    from app.services.rsshub_test_service import rsshub_test_service

    try:
        result = await rsshub_test_service.quick_test()
        return result
    except Exception as e:
        return {
            "success": False,
            "message": f"RSSHub测试失败: {str(e)}",
            "tested_at": datetime.utcnow().isoformat()
        }


@router.post("/test-rsshub-full")
async def test_rsshub_full():
    """完整测试RSSHub连通性"""
    from app.services.rsshub_test_service import rsshub_test_service

    try:
        result = await rsshub_test_service.test_rsshub_connectivity()

        return {
            "success": result.success,
            "message": "RSSHub完整测试完成" if result.success else "RSSHub测试发现问题",
            "summary": {
                "rsshub_url": result.rsshub_url,
                "total_tests": result.total_tests,
                "successful_tests": result.successful_tests,
                "failed_tests": result.failed_tests,
                "success_rate": f"{(result.successful_tests / result.total_tests * 100):.1f}%",
                "average_response_time": f"{sum(result.response_times) / len(result.response_times):.2f}s" if result.response_times else "N/A",
                "test_duration": f"{result.test_duration:.2f}s",
                "tested_at": result.tested_at.isoformat()
            },
            "details": result.test_details,
            "errors": result.error_messages
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"RSSHub完整测试失败: {str(e)}",
            "tested_at": datetime.utcnow().isoformat()
        }