from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db.deps import get_session
from app.db.models import Entry, Summary, Translation
from app.schemas.ai import SummaryRequest, SummaryResponse, TranslationRequest, TranslationResponse
from app.services.ai import GLMClient, ai_client_manager, ServiceKey
from app.core.config import settings


def _default_service_config() -> dict[str, str]:
    return {
        "api_key": settings.glm_api_key or "",
        "base_url": settings.glm_base_url,
        "model_name": settings.glm_model,
    }


def _ensure_cache_initialized() -> None:
    if "summary" not in _ai_settings_cache:
        base = _default_service_config()
        _ai_settings_cache["summary"] = base.copy()
    if "translation" not in _ai_settings_cache:
        _ai_settings_cache["translation"] = _ai_settings_cache["summary"].copy()
    if "features" not in _ai_settings_cache:
        _ai_settings_cache["features"] = {
            "auto_summary": False,
            "auto_translation": False,
            "auto_title_translation": False,
            "translation_language": "zh",
        }


_ai_settings_cache: dict[str, dict[str, str | bool]] = {
    "summary": _default_service_config(),
    "translation": _default_service_config(),
    "features": {
        "auto_summary": False,
        "auto_translation": False,
        "auto_title_translation": False,
        "translation_language": "zh",
    },
}

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(
    payload: SummaryRequest, session: Session = Depends(get_session)
) -> SummaryResponse:
    entry = session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    existing = session.exec(
        select(Summary).where(
            Summary.entry_id == payload.entry_id, Summary.language == payload.language
        )
    ).first()
    if existing:
        return SummaryResponse(entry_id=entry.id, language=existing.language, summary=existing.summary or "")

    content = entry.readability_content or entry.content or entry.summary
    if not content:
        raise HTTPException(status_code=400, detail="Entry has no content to summarize")

    client = ai_client_manager.get_client("summary")
    summary_text = await client.summarize(content, language=payload.language)

    summary = Summary(entry_id=entry.id, language=payload.language, summary=summary_text)
    session.add(summary)
    session.commit()
    session.refresh(summary)

    return SummaryResponse(entry_id=entry.id, language=payload.language, summary=summary.summary or "")


@router.post("/translate-title")
async def translate_entry_title(
    payload: dict, session: Session = Depends(get_session)
) -> dict:
    """专门翻译文章标题"""
    entry = session.get(Entry, payload["entry_id"])
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if not entry.title:
        return {"entry_id": entry.id, "title": "", "language": payload["language"]}

    client = ai_client_manager.get_client("translation")

    try:
        translated_title = await client.translate(entry.title, target_language=payload["language"])
        return {
            "entry_id": entry.id,
            "title": translated_title,
            "language": payload["language"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


@router.post("/translate", response_model=TranslationResponse)
async def translate_entry(
    payload: TranslationRequest, session: Session = Depends(get_session)
) -> TranslationResponse:
    entry = session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    existing = session.exec(
        select(Translation).where(
            Translation.entry_id == payload.entry_id, Translation.language == payload.language
        )
    ).first()
    if existing:
        return TranslationResponse(
            entry_id=entry.id,
            language=existing.language,
            title=existing.title,
            summary=existing.summary,
            content=existing.content,
        )

    translated_title = None
    translated_summary = None
    translated_content = None

    if entry.title:
        client = ai_client_manager.get_client("translation")
        translated_title = await client.translate(entry.title, target_language=payload.language)

    if entry.summary:
        client = ai_client_manager.get_client("translation")
        translated_summary = await client.translate(entry.summary, target_language=payload.language)

    content_to_translate = entry.readability_content or entry.content
    if content_to_translate:
        client = ai_client_manager.get_client("translation")
        translated_content = await client.translate(content_to_translate, target_language=payload.language)

    translation = Translation(
        entry_id=entry.id,
        language=payload.language,
        title=translated_title,
        summary=translated_summary,
        content=translated_content,
    )
    session.add(translation)
    session.commit()
    session.refresh(translation)

    return TranslationResponse(
        entry_id=entry.id,
        language=translation.language,
        title=translation.title,
        summary=translation.summary,
        content=translation.content,
    )


class AIServiceConfig(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model_name: str = ""
    has_api_key: bool = False


class AIFeatureConfig(BaseModel):
    auto_summary: bool = False
    auto_translation: bool = False
    auto_title_translation: bool = False
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
    auto_translation: bool | None = None
    auto_title_translation: bool | None = None
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


def _build_service_config(service: ServiceKey) -> AIServiceConfig:
    _ensure_cache_initialized()
    cached = _ai_settings_cache[service]
    return AIServiceConfig(
        api_key=str(cached.get("api_key", "") or ""),
        base_url=str(cached.get("base_url", "") or ""),
        model_name=str(cached.get("model_name", "") or ""),
        has_api_key=bool(cached.get("api_key")),
    )


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config() -> AIConfigResponse:
    """获取AI配置信息"""
    _ensure_cache_initialized()
    return AIConfigResponse(
        summary=_build_service_config("summary"),
        translation=_build_service_config("translation"),
        features=AIFeatureConfig(**_ai_settings_cache["features"]),
    )


def _apply_service_update(service: ServiceKey, update: AIServiceConfigUpdate) -> None:
    _ensure_cache_initialized()
    cached = _ai_settings_cache[service]
    client_kwargs: dict[str, str] = {}
    if update.api_key is not None:
        cached["api_key"] = update.api_key
        client_kwargs["api_key"] = update.api_key
    if update.base_url is not None:
        cached["base_url"] = update.base_url
        client_kwargs["base_url"] = update.base_url
    if update.model_name is not None:
        cached["model_name"] = update.model_name
        client_kwargs["model_name"] = update.model_name
    if client_kwargs:
        ai_client_manager.update_client(service, **client_kwargs)


@router.patch("/config")
async def update_ai_config(payload: AIConfigUpdate) -> dict:
    """更新AI配置"""
    try:
        if payload.summary:
            _apply_service_update("summary", payload.summary)
        if payload.translation:
            _apply_service_update("translation", payload.translation)
        if payload.features:
            features = _ai_settings_cache["features"]
            if payload.features.auto_summary is not None:
                features["auto_summary"] = payload.features.auto_summary
            if payload.features.auto_translation is not None:
                features["auto_translation"] = payload.features.auto_translation
            if payload.features.auto_title_translation is not None:
                features["auto_title_translation"] = payload.features.auto_title_translation
            if payload.features.translation_language is not None:
                features["translation_language"] = payload.features.translation_language

        return {"success": True, "message": "配置更新成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新失败: {str(e)}")


@router.post("/test")
async def test_ai_connection(payload: TestConnectionRequest) -> dict:
    """测试AI连接"""
    try:
        _ensure_cache_initialized()
        service = payload.service or "summary"
        fallback = _ai_settings_cache[service]
        temp_client = GLMClient(
            base_url=payload.base_url or str(fallback.get("base_url", "") or ""),
            model=payload.model_name or str(fallback.get("model_name", "") or ""),
            api_key=payload.api_key or str(fallback.get("api_key", "") or ""),
        )

        test_result = await temp_client.summarize("测试连接", language="zh")

        return {"success": True, "message": "连接测试成功", "test_result": test_result[:50] + "..."}

    except Exception as e:
        return {"success": False, "message": f"连接测试失败: {str(e)}"}
