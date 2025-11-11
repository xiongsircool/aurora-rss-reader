from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db.deps import get_session
from app.db.models import Entry, Summary, Translation
from app.schemas.ai import SummaryRequest, SummaryResponse, TranslationRequest, TranslationResponse
from app.services.ai import glm_client
from app.core.config import settings

# 全局AI设置缓存（在生产环境中应该使用数据库或配置文件）
_ai_settings_cache = {
    "auto_summary": False,
    "auto_translation": False,
    "auto_title_translation": False,
    "translation_language": "zh"
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

    summary_text = await glm_client.summarize(content, language=payload.language)

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

    try:
        translated_title = await glm_client.translate(entry.title, target_language=payload["language"])
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
        translated_title = await glm_client.translate(entry.title, target_language=payload.language)

    if entry.summary:
        translated_summary = await glm_client.translate(entry.summary, target_language=payload.language)

    content_to_translate = entry.readability_content or entry.content
    if content_to_translate:
        translated_content = await glm_client.translate(content_to_translate, target_language=payload.language)

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


# AI配置管理
class AIConfig(BaseModel):
    api_key: str
    base_url: str
    model_name: str
    auto_summary: bool = False
    auto_translation: bool = False
    auto_title_translation: bool = False
    translation_language: str = "zh"


class AIConfigResponse(BaseModel):
    api_key: str
    base_url: str
    model_name: str
    auto_summary: bool = False
    auto_translation: bool = False
    auto_title_translation: bool = False
    translation_language: str = "zh"
    has_api_key: bool = False


class TestConnectionRequest(BaseModel):
    api_key: str
    base_url: str
    model_name: str


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config() -> AIConfigResponse:
    """获取AI配置信息"""
    return AIConfigResponse(
        api_key=settings.glm_api_key,
        base_url=settings.glm_base_url,
        model_name=settings.glm_model,
        auto_summary=_ai_settings_cache["auto_summary"],
        auto_translation=_ai_settings_cache["auto_translation"],
        auto_title_translation=_ai_settings_cache["auto_title_translation"],
        translation_language=_ai_settings_cache["translation_language"],
        has_api_key=bool(settings.glm_api_key)
    )


@router.patch("/config")
async def update_ai_config(payload: dict) -> dict:
    """更新AI配置（通过环境变量）"""
    # 这里应该更新环境变量或配置文件
    # 由于settings是从环境变量加载的，我们需要重新加载或使用其他机制

    # 简单实现：存储到临时配置中
    # 在实际应用中，你可能需要使用配置文件或数据库来存储这些设置
    try:
        global _ai_settings_cache

        # 更新AI功能设置
        if "auto_summary" in payload:
            _ai_settings_cache["auto_summary"] = bool(payload["auto_summary"])
        if "auto_translation" in payload:
            _ai_settings_cache["auto_translation"] = bool(payload["auto_translation"])
        if "auto_title_translation" in payload:
            _ai_settings_cache["auto_title_translation"] = bool(payload["auto_title_translation"])
        if "translation_language" in payload:
            _ai_settings_cache["translation_language"] = str(payload["translation_language"])

        # 更新glm_client的配置
        if "api_key" in payload and payload["api_key"]:
            glm_client.api_key = payload["api_key"]
        if "base_url" in payload and payload["base_url"]:
            glm_client.base_url = payload["base_url"]
        if "model_name" in payload and payload["model_name"]:
            glm_client.model = payload["model_name"]

        return {"success": True, "message": "配置更新成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新失败: {str(e)}")


@router.post("/test")
async def test_ai_connection(payload: TestConnectionRequest) -> dict:
    """测试AI连接"""
    try:
        # 临时设置配置进行测试
        original_api_key = glm_client.api_key
        original_base_url = glm_client.base_url
        original_model = glm_client.model

        glm_client.api_key = payload.api_key
        glm_client.base_url = payload.base_url
        glm_client.model = payload.model_name

        # 测试连接 - 尝试生成一个简单的摘要
        test_result = await glm_client.summarize("测试连接", language="zh")

        # 恢复原始配置
        glm_client.api_key = original_api_key
        glm_client.base_url = original_base_url
        glm_client.model = original_model

        return {"success": True, "message": "连接测试成功", "test_result": test_result[:50] + "..."}

    except Exception as e:
        return {"success": False, "message": f"连接测试失败: {str(e)}"}
