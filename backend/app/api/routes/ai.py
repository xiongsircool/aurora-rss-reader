from __future__ import annotations

import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db.deps import get_session
from app.db.models import Entry, Summary, Translation
from app.schemas.ai import SummaryRequest, SummaryResponse, TranslationRequest, TranslationResponse
from app.services.ai import GLMClient, ai_client_manager, ServiceKey
from app.services.translation_engine import IncrementalTranslator, SmartSegmenter
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
            "title_display_mode": "original-first",
            "translation_language": "zh",
        }


_ai_settings_cache: dict[str, dict[str, str | bool]] = {
    "summary": _default_service_config(),
    "translation": _default_service_config(),
    "features": {
        "auto_summary": False,
        "auto_translation": False,
        "auto_title_translation": False,
        "title_display_mode": "original-first",
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

    client = ai_client_manager.get_client("summary")
    summary_text = await client.summarize(combined_content, language=payload.language)

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
    """
    翻译文章（使用增量段落翻译）
    支持长文章，按段落进行翻译以突破长度限制
    """
    entry = session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 检查缓存
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

    # 初始化翻译器
    client = ai_client_manager.get_client("translation")
    translator = IncrementalTranslator(client)
    
    translated_title = None
    translated_summary = None
    translated_content = None

    # 翻译标题（简短，直接翻译）
    if entry.title:
        translated_title = await client.translate(entry.title, target_language=payload.language)

    # 翻译摘要（简短，直接翻译）
    if entry.summary:
        translated_summary = await client.translate(entry.summary, target_language=payload.language)

    # 翻译正文内容（使用段落级翻译）
    content_to_translate = entry.readability_content or entry.content
    if content_to_translate:
        # 检查内容长度，决定是否使用段落翻译
        content_length = len(content_to_translate)
        
        if content_length > 2000:  # 长文章使用段落翻译
            print(f"使用段落翻译模式，内容长度: {content_length}")
            translated_content = await translator.translate_long_text(
                content_to_translate,
                target_language=payload.language,
                max_segment_length=1000,  # 每段最大1000字符
                max_concurrent=3,  # 最多3个并发请求
            )
        else:  # 短文章直接翻译
            print(f"使用直接翻译模式，内容长度: {content_length}")
            translated_content = await client.translate(
                content_to_translate, 
                target_language=payload.language
            )

    # 保存到数据库
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


@router.post("/translate-stream")
async def translate_entry_stream(
    payload: TranslationRequest, session: Session = Depends(get_session)
):
    """
    流式翻译API - 支持实时进度更新
    使用Server-Sent Events (SSE)返回翻译进度
    """
    entry = session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 检查缓存
    existing = session.exec(
        select(Translation).where(
            Translation.entry_id == payload.entry_id, Translation.language == payload.language
        )
    ).first()
    
    async def generate_events():
        """生成SSE事件流"""
        try:
            # 如果有缓存，直接返回
            if existing:
                yield f"data: {json.dumps({'type': 'progress', 'percent': 100, 'message': '从缓存加载'})}\n\n"
                yield f"data: {json.dumps({'type': 'complete', 'result': {'title': existing.title, 'summary': existing.summary, 'content': existing.content}})}\n\n"
                return

            # 初始化翻译器
            client = ai_client_manager.get_client("translation")
            translator = IncrementalTranslator(client)
            
            translated_title = None
            translated_summary = None
            translated_content = None

            # 进度回调函数
            async def progress_callback(current: int, total: int, message: str):
                """发送进度更新"""
                percent = int((current / total) * 100) if total > 0 else 0
                event_data = {
                    'type': 'progress',
                    'percent': percent,
                    'current': current,
                    'total': total,
                    'message': message
                }
                # 注意：在生成器中不能直接yield，需要通过队列传递
                return event_data

            # 翻译标题
            yield f"data: {json.dumps({'type': 'progress', 'percent': 5, 'message': '正在翻译标题...'})}\n\n"
            if entry.title:
                translated_title = await client.translate(entry.title, target_language=payload.language)

            # 翻译摘要
            yield f"data: {json.dumps({'type': 'progress', 'percent': 10, 'message': '正在翻译摘要...'})}\n\n"
            if entry.summary:
                translated_summary = await client.translate(entry.summary, target_language=payload.language)

            # 翻译正文
            content_to_translate = entry.readability_content or entry.content
            if content_to_translate:
                content_length = len(content_to_translate)
                
                if content_length > 2000:
                    # 长文章：使用段落翻译，发送详细进度
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 15, 'message': f'正在分析文章（{content_length}字符）...'})}\n\n"
                    
                    # 分割段落
                    segments = SmartSegmenter.split_by_paragraphs(
                        content_to_translate,
                        max_length=1000
                    )
                    
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 20, 'message': f'开始翻译 {len(segments)} 个段落...'})}\n\n"
                    
                    # 翻译每个段落时发送进度
                    total_segments = len(segments)
                    completed_segments = 0
                    
                    def sync_progress_callback(current: int, total: int, message: str):
                        """同步进度回调"""
                        percent = 20 + int((current / total) * 70)  # 20% - 90%
                        return {'type': 'progress', 'percent': percent, 'message': message}
                    
                    # 由于不能在回调中yield，我们手动处理段落翻译
                    translated_segments = []
                    for i, segment in enumerate(segments):
                        progress_percent = 20 + int(((i + 1) / total_segments) * 70)
                        yield f"data: {json.dumps({'type': 'progress', 'percent': progress_percent, 'message': f'翻译段落 {i+1}/{total_segments}'})}\n\n"
                        
                        # 翻译段落
                        if segment['is_code']:
                            translated_segments.append({**segment, 'translated': segment['content']})
                        else:
                            try:
                                translated_text = await client.translate(
                                    segment['content'],
                                    target_language=payload.language
                                )
                                translated_segments.append({**segment, 'translated': translated_text})
                            except Exception as e:
                                # 翻译失败，使用原文
                                translated_segments.append({**segment, 'translated': segment['content']})
                    
                    # 合并段落
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 95, 'message': '正在合并翻译结果...'})}\n\n"
                    translated_content = translator.merge_segments(translated_segments)
                else:
                    # 短文章：直接翻译
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 50, 'message': '正在翻译内容...'})}\n\n"
                    translated_content = await client.translate(
                        content_to_translate,
                        target_language=payload.language
                    )

            # 保存到数据库
            yield f"data: {json.dumps({'type': 'progress', 'percent': 98, 'message': '正在保存翻译...'})}\n\n"
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

            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete', 'result': {'title': translation.title, 'summary': translation.summary, 'content': translation.content}})}\n\n"
            
        except Exception as e:
            # 发送错误事件
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
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
    auto_translation: bool | None = None
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
            if payload.features.title_display_mode is not None:
                features["title_display_mode"] = payload.features.title_display_mode
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
