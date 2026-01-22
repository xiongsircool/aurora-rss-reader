from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.db.deps import get_session
from app.db.models import Entry, Summary, Translation
from app.schemas.ai import SummaryRequest, SummaryResponse
from app.services.ai import GLMClient, ai_client_manager, ServiceKey
from app.services.user_settings_service import user_settings_service

logger = logging.getLogger(__name__)

_ai_clients_initialized = False
_ai_clients_lock = asyncio.Lock()


def _resolve_service_value(value: str | None, fallback: str) -> str:
    return value if value else fallback


def _service_config_from_settings(settings_row, service: ServiceKey) -> tuple[str, str, str]:
    if service == "summary":
        api_key = settings_row.summary_api_key or settings.glm_api_key or ""
        base_url = _resolve_service_value(settings_row.summary_base_url, settings.glm_base_url or "")
        model_name = _resolve_service_value(settings_row.summary_model_name, settings.glm_model or "")
    else:
        api_key = settings_row.translation_api_key or settings.glm_api_key or ""
        base_url = _resolve_service_value(settings_row.translation_base_url, settings.glm_base_url or "")
        model_name = _resolve_service_value(settings_row.translation_model_name, settings.glm_model or "")
    return api_key, base_url, model_name


def _apply_settings_to_clients(settings_row) -> None:
    for service in ("summary", "translation"):
        api_key, base_url, model_name = _service_config_from_settings(settings_row, service)
        ai_client_manager.update_client(
            service,
            api_key=api_key,
            base_url=base_url,
            model_name=model_name,
        )


async def _ensure_ai_clients_initialized() -> None:
    global _ai_clients_initialized
    if _ai_clients_initialized:
        return
    async with _ai_clients_lock:
        if _ai_clients_initialized:
            return
        settings_row = await user_settings_service.get_settings()
        _apply_settings_to_clients(settings_row)
        _ai_clients_initialized = True


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(
    payload: SummaryRequest, session: AsyncSession = Depends(get_session)
) -> SummaryResponse:
    entry = await session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    result = await session.exec(
        select(Summary).where(
            Summary.entry_id == payload.entry_id, Summary.language == payload.language
        )
    )
    existing = result.first()
    if existing:
        return SummaryResponse(entry_id=entry.id, language=existing.language, summary=existing.summary or "")

    content = entry.readability_content or entry.content or entry.summary
    if not content:
        raise HTTPException(status_code=400, detail="Entry has no content to summarize")

    # 安全地组合元信息（标题 / 作者 / 时间），字段缺失时自动跳过
    meta_lines: list[str] = []
    if entry.title:
        meta_lines.append(f"标题：{entry.title}")
    if entry.author:
        meta_lines.append(f"作者：{entry.author}")
    if entry.published_at:
        # 统一格式化为可读字符串；缺失时不输出
        meta_lines.append(f"时间：{entry.published_at.strftime('%Y-%m-%d %H:%M')}")

    if meta_lines:
        meta_block = "文章元信息：\n" + "\n".join(meta_lines) + "\n\n正文内容：\n"
    else:
        meta_block = ""

    combined_content = f"{meta_block}{content}"

    await _ensure_ai_clients_initialized()
    client = ai_client_manager.get_client("summary")
    summary_text = await client.summarize(combined_content, language=payload.language)

    try:
        summary = Summary(entry_id=entry.id, language=payload.language, summary=summary_text)
        session.add(summary)
        await session.commit()
        await session.refresh(summary)
    except IntegrityError:
        # 捕获并发写入导致的唯一键冲突
        await session.rollback()
        # 重新查询已存在的记录
        result = await session.exec(
            select(Summary).where(
                Summary.entry_id == payload.entry_id, Summary.language == payload.language
            )
        )
        existing = result.first()
        if existing:
             return SummaryResponse(entry_id=entry.id, language=existing.language, summary=existing.summary or "")
        # 如果还是没有，可能是其他错误，这里抛出异常或重试
        raise HTTPException(status_code=500, detail="Summary generation conflict")

    return SummaryResponse(entry_id=entry.id, language=payload.language, summary=summary.summary or "")


@router.post("/translate-title")
async def translate_entry_title(
    payload: dict, session: AsyncSession = Depends(get_session)
) -> dict:
    """专门翻译文章标题，支持数据库缓存"""
    entry = await session.get(Entry, payload["entry_id"])
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    target_language = payload.get("language", "zh")

    if not entry.title:
        return {"entry_id": entry.id, "title": "", "language": target_language}

    # 检查数据库缓存
    result = await session.exec(
        select(Translation).where(
            Translation.entry_id == payload["entry_id"],
            Translation.language == target_language
        )
    )
    existing = result.first()

    # 如果已有缓存且包含标题翻译，直接返回
    if existing and existing.title:
        return {
            "entry_id": entry.id,
            "title": existing.title,
            "language": target_language,
            "from_cache": True
        }

    # 调用 AI 翻译
    await _ensure_ai_clients_initialized()
    client = ai_client_manager.get_client("translation")

    try:
        translated_title = await client.translate(entry.title, target_language=target_language)

        try:
            # 重新检查一次，减少可预见的冲突（Double Checked Locking pattern logic in DB）
            result = await session.exec(
                select(Translation).where(
                    Translation.entry_id == payload["entry_id"],
                    Translation.language == target_language
                )
            )
            existing = result.first()

            if existing:
                # 更新现有记录的标题 (如果之前只有内容翻译)
                existing.title = translated_title
                session.add(existing)
            else:
                # 创建新记录（只包含标题）
                translation = Translation(
                    entry_id=entry.id,
                    language=target_language,
                    title=translated_title,
                )
                session.add(translation)

            await session.commit()
            
            return {
                "entry_id": entry.id,
                "title": translated_title,
                "language": target_language,
                "from_cache": False
            }

        except IntegrityError:
            # 并发冲突处理
            await session.rollback()
            # 重新获取已存在的记录
            result = await session.exec(
                select(Translation).where(
                    Translation.entry_id == payload["entry_id"],
                    Translation.language == target_language
                )
            )
            existing = result.first()
            if existing and existing.title:
                 return {
                    "entry_id": entry.id,
                    "title": existing.title,
                    "language": target_language,
                    "from_cache": True
                }
            # 如果有了记录但没有title（理论上update不会触发IntegrityError除非entry_id变了），或者其他异常情况
            # 简单起见，如果还是没拿到，直接返回刚才翻译的结果（虽然没存进去，但前端能用）
            return {
                "entry_id": entry.id,
                "title": translated_title,
                "language": target_language,
                "from_cache": False
            }

    except Exception as e:
        logger.error(f"Title translation error: {e}")
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


class AIServiceConfig(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model_name: str = ""
    has_api_key: bool = False


class AIFeatureConfig(BaseModel):
    auto_summary: bool = False
    auto_title_translation: bool = False
    title_display_mode: str = "original-first"
    translation_language: str = "zh"


class AIConfigResponse(BaseModel):
    summary: AIServiceConfig
    translation: AIServiceConfig
    features: AIFeatureConfig


class AIServiceConfigUpdate(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    model_name: str | None = None


class AIFeatureConfigUpdate(BaseModel):
    auto_summary: bool | None = None
    auto_title_translation: bool | None = None
    title_display_mode: str | None = None
    translation_language: str | None = None


class AIConfigUpdate(BaseModel):
    summary: AIServiceConfigUpdate | None = None
    translation: AIServiceConfigUpdate | None = None
    features: AIFeatureConfigUpdate | None = None


class TestConnectionRequest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    model_name: str | None = None
    service: ServiceKey = "summary"


def _build_service_config(settings_row, service: ServiceKey) -> AIServiceConfig:
    api_key, base_url, model_name = _service_config_from_settings(settings_row, service)
    return AIServiceConfig(
        api_key=str(api_key or ""),
        base_url=str(base_url or ""),
        model_name=str(model_name or ""),
        has_api_key=bool(api_key),
    )


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config() -> AIConfigResponse:
    """获取AI配置信息"""
    settings_row = await user_settings_service.get_settings()
    return AIConfigResponse(
        summary=_build_service_config(settings_row, "summary"),
        translation=_build_service_config(settings_row, "translation"),
        features=AIFeatureConfig(
            auto_summary=bool(settings_row.ai_auto_summary),
            auto_title_translation=bool(settings_row.ai_auto_title_translation),
            title_display_mode=settings_row.ai_title_display_mode,
            translation_language=settings_row.ai_translation_language,
        ),
    )

@router.patch("/config")
async def update_ai_config(payload: AIConfigUpdate) -> dict:
    """更新AI配置"""
    global _ai_clients_initialized
    try:
        update_dict: dict[str, object] = {}
        if payload.summary:
            if payload.summary.api_key is not None:
                update_dict["summary_api_key"] = payload.summary.api_key
            if payload.summary.base_url is not None:
                update_dict["summary_base_url"] = payload.summary.base_url
            if payload.summary.model_name is not None:
                update_dict["summary_model_name"] = payload.summary.model_name
        if payload.translation:
            if payload.translation.api_key is not None:
                update_dict["translation_api_key"] = payload.translation.api_key
            if payload.translation.base_url is not None:
                update_dict["translation_base_url"] = payload.translation.base_url
            if payload.translation.model_name is not None:
                update_dict["translation_model_name"] = payload.translation.model_name
        if payload.features:
            if payload.features.auto_summary is not None:
                update_dict["ai_auto_summary"] = payload.features.auto_summary
            if payload.features.auto_title_translation is not None:
                update_dict["ai_auto_title_translation"] = payload.features.auto_title_translation
            if payload.features.title_display_mode is not None:
                update_dict["ai_title_display_mode"] = payload.features.title_display_mode
            if payload.features.translation_language is not None:
                update_dict["ai_translation_language"] = payload.features.translation_language

        if update_dict:
            settings_row = await user_settings_service.update_settings(**update_dict)
        else:
            settings_row = await user_settings_service.get_settings()

        if payload.summary or payload.translation:
            _apply_settings_to_clients(settings_row)
            _ai_clients_initialized = True

        return {"success": True, "message": "配置更新成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新失败: {str(e)}")


@router.post("/test")
async def test_ai_connection(payload: TestConnectionRequest) -> dict:
    """测试AI连接"""
    try:
        service = payload.service or "summary"
        settings_row = await user_settings_service.get_settings()
        fallback_api_key, fallback_base_url, fallback_model_name = _service_config_from_settings(
            settings_row, service
        )
        temp_client = GLMClient(
            base_url=payload.base_url or fallback_base_url,
            model=payload.model_name or fallback_model_name,
            api_key=payload.api_key or fallback_api_key,
        )

        test_result = await temp_client.summarize("测试连接", language="zh")

        return {"success": True, "message": "连接测试成功", "test_result": test_result[:50] + "..."}

    except Exception as e:
        return {"success": False, "message": f"连接测试失败: {str(e)}"}
