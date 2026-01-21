from __future__ import annotations

import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.db.deps import get_session
from app.db.models import Entry, Summary, Translation
from app.schemas.ai import SummaryRequest, SummaryResponse, TranslationRequest, TranslationResponse
from app.services.ai import GLMClient, ai_client_manager, ServiceKey
from app.services.translation_engine import IncrementalTranslator, SmartSegmenter
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


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
            "content_display_mode": "replace",
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
        "content_display_mode": "replace",
        "translation_language": "zh",
    },
}

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


@router.post("/translate", response_model=TranslationResponse)
async def translate_entry(
    payload: TranslationRequest, session: AsyncSession = Depends(get_session)
) -> TranslationResponse:
    """
    翻译文章（使用增量段落翻译）
    支持长文章，按段落进行翻译以突破长度限制
    """
    entry = await session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 检查缓存
    result = await session.exec(
        select(Translation).where(
            Translation.entry_id == payload.entry_id, Translation.language == payload.language
        )
    )
    existing = result.first()
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
            logger.info(f"使用段落翻译模式，内容长度: {content_length}")
            translated_content = await translator.translate_long_text(
                content_to_translate,
                target_language=payload.language,
                max_segment_length=1000,  # 每段最大1000字符
                max_concurrent=3,  # 最多3个并发请求
            )
            # 注意：上面的 translate_long_text 默认是普通合并。
            # 为了支持双语，我们需要拆开调用或者修改 translate_long_text
            # 鉴于代码复用，我们这里改为手动拆解调用
            pass
        else:  # 短文章直接翻译
            logger.info(f"使用直接翻译模式，内容长度: {content_length}")
            translated_content = await client.translate(
                content_to_translate, 
                target_language=payload.language
            )
    
    # 根据显示模式处理内容
    if payload.display_mode == "bilingual" and translated_content:
        # 如果是短文章直接翻译的，我们也尝试构造简单的双语结构
        # 但通常长文章才会进段落清洗。
        # 为了统一，如果是短文直接翻译，我们简单包装一下
        # 注意：这里的 translated_content 是全文。
        # 如果是长文段落翻译，translated_content 已经在上面被 merge_segments 处理了(还没改)
        pass 
        # 修正逻辑：上面的 translate_long_text 默认调用的 merge_segments 是普通合并
        # 我们需要修改 translate_long_text 让它支持传入 merge_function 或者我们在外面自己处理
        
        # 更好的做法：不要在 routes 里改太深，而是让 IncrementalTranslator 支持模式
        
    # 等等，我们需要重构下上面的调用逻辑
    # 实际上 translate_long_text 内部调用了 merge_segments。
    # 我们应该在 routes 里调用 translate_segments (获取 raw segments)，然后自己在 routes 里决定怎么 merge
    # 或者给 translate_long_text 传参。
    
    # 让我们修改 routes 里的逻辑：
    
    if content_to_translate:
        content_length = len(content_to_translate)
        
        if content_length > 2000:  # 长文章使用段落翻译
            logger.info(f"使用段落翻译模式，内容长度: {content_length}")
            
            # 手动执行步骤以控制 merge 方式
            segments = SmartSegmenter.split_by_paragraphs(content_to_translate, max_length=1000)
            translated_segments = await translator.translate_segments(
                segments, 
                target_language=payload.language,
                max_concurrent=3
            )
            
            if payload.display_mode == "bilingual":
                translated_content = translator.merge_bilingual_segments(translated_segments)
            else:
                translated_content = translator.merge_segments(translated_segments)
                
        else:  # 短文章直接翻译
            logger.info(f"使用直接翻译模式，内容长度: {content_length}")
            raw_translation = await client.translate(
                content_to_translate, 
                target_language=payload.language
            )
            
            if payload.display_mode == "bilingual":
                # 短文也支持双语：清洗+包装
                clean_translation = translator._clean_html_for_display(raw_translation)
                if clean_translation:
                     translated_content = (
                        f'<div class="bilingual-segment" style="position: relative; margin-bottom: 1.5em;">'
                        f'<div class="original" style="margin-bottom: 0.5em;">{content_to_translate}</div>'
                        f'<div class="translated" style="color: #5F6368; font-size: 0.95em; padding-left: 12px; border-left: 3px solid #4C74FF; background: rgba(76, 116, 255, 0.05); padding: 8px 12px; border-radius: 4px;">'
                        f'{clean_translation}'
                        f'</div>'
                        f'</div>'
                    )
                else:
                    translated_content = content_to_translate
            else:
                translated_content = raw_translation

    # 保存到数据库
    # 保存到数据库
    try:
        # Re-check to avoid race condition on insert
        result = await session.exec(
            select(Translation).where(
                Translation.entry_id == entry.id,
                Translation.language == payload.language
            )
        )
        existing = result.first()
        
        if existing:
            existing.title = translated_title or existing.title
            existing.summary = translated_summary or existing.summary
            existing.content = translated_content or existing.content
            session.add(existing)
            await session.commit()
            await session.refresh(existing)
            translation = existing
        else:
            translation = Translation(
                entry_id=entry.id,
                language=payload.language,
                title=translated_title,
                summary=translated_summary,
                content=translated_content,
            )
            session.add(translation)
            await session.commit()
            await session.refresh(translation)
    except IntegrityError:
        await session.rollback()
        # Race condition hit, fetch the existing one
        result = await session.exec(
            select(Translation).where(
                Translation.entry_id == payload.entry_id, Translation.language == payload.language
            )
        )
        existing = result.first()
        if existing:
            translation = existing
        else:
            # Should not happen typically
            raise HTTPException(status_code=500, detail="Translation save conflict")

    return TranslationResponse(
        entry_id=entry.id,
        language=translation.language,
        title=translation.title,
        summary=translation.summary,
        content=translation.content,
    )


@router.post("/translate-stream")
async def translate_entry_stream(
    payload: TranslationRequest, session: AsyncSession = Depends(get_session)
):
    """
    流式翻译API - 支持实时进度更新
    使用Server-Sent Events (SSE)返回翻译进度
    """
    entry = await session.get(Entry, payload.entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 检查缓存 - 在外部获取并存储结果以便传递给生成器
    result = await session.exec(
        select(Translation).where(
            Translation.entry_id == payload.entry_id, Translation.language == payload.language
        )
    )
    cached_translation = result.first()
    
    # 预先获取需要的 entry 数据，避免在生成器中访问可能已关闭的 session
    entry_id = entry.id
    entry_title = entry.title
    entry_summary = entry.summary
    entry_content = entry.readability_content or entry.content
    target_language = payload.language
    display_mode = payload.display_mode
    
    async def generate_events():
        """生成SSE事件流"""
        nonlocal cached_translation
        try:
            # 如果有缓存，直接返回
            if cached_translation:
                yield f"data: {json.dumps({'type': 'progress', 'percent': 100, 'message': '从缓存加载'})}\n\n"
                yield f"data: {json.dumps({'type': 'complete', 'result': {'title': cached_translation.title, 'summary': cached_translation.summary, 'content': cached_translation.content}})}\n\n"
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
            if entry_title:
                translated_title = await client.translate(entry_title, target_language=target_language)

            # 翻译摘要
            yield f"data: {json.dumps({'type': 'progress', 'percent': 10, 'message': '正在翻译摘要...'})}\n\n"
            if entry_summary:
                translated_summary = await client.translate(entry_summary, target_language=target_language)

            # 翻译正文
            content_to_translate = entry_content
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
                    
                    total_segments = len(segments)
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 20, 'message': f'开始翻译 {total_segments} 个段落...'})}\n\n"
                    
                    # 流式处理每个段落
                    translated_segments = []
                    completed_count = 0
                    
                    async for result_seg in translator.translate_segments_stream(
                        segments, 
                        target_language=target_language,
                        max_concurrent=3
                    ):
                        translated_segments.append(result_seg)
                        completed_count += 1
                        
                        # 计算进度
                        progress_percent = 20 + int((completed_count / total_segments) * 70)
                        
                        # 发送进度事件
                        yield f"data: {json.dumps({'type': 'progress', 'percent': progress_percent, 'message': f'翻译段落 {completed_count}/{total_segments}'})}\n\n"
                        
                        # 发送段落完成事件 (支持前端增量渲染)
                        yield f"data: {json.dumps({'type': 'segment_completed', 'index': result_seg['index'], 'translated': result_seg['translated'], 'is_code': result_seg['is_code']})}\n\n"
                    
                    # 合并结果
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 95, 'message': '正在合并翻译结果...'})}\n\n"
                    
                    # 确保按顺序合并
                    translated_segments.sort(key=lambda x: x['index'])
                    
                    if display_mode == "bilingual":
                        translated_content = translator.merge_bilingual_segments(translated_segments)
                    else:
                        translated_content = translator.merge_segments(translated_segments)
                else:
                    # 短文章：直接翻译
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 50, 'message': '正在翻译内容...'})}\n\n"
                    raw_translation = await client.translate(
                        content_to_translate,
                        target_language=target_language
                    )
                    
                    if display_mode == "bilingual":
                        clean_translation = translator._clean_html_for_display(raw_translation)
                        if clean_translation:
                             translated_content = (
                                f'<div class="bilingual-segment" style="position: relative; margin-bottom: 1.5em;">'
                                f'<div class="original" style="margin-bottom: 0.5em;">{content_to_translate}</div>'
                                f'<div class="translated" style="color: #5F6368; font-size: 0.95em; padding-left: 12px; border-left: 3px solid #4C74FF; background: rgba(76, 116, 255, 0.05); padding: 8px 12px; border-radius: 4px;">'
                                f'{clean_translation}'
                                f'</div>'
                                f'</div>'
                            )
                        else:
                            translated_content = content_to_translate
                    else:
                        translated_content = raw_translation

            # 保存到数据库
            yield f"data: {json.dumps({'type': 'progress', 'percent': 98, 'message': '正在保存翻译...'})}\n\n"
            try:
                # Re-check for existing
                result = await session.exec(
                    select(Translation).where(
                        Translation.entry_id == entry_id,
                        Translation.language == target_language
                    )
                )
                existing = result.first()
                if existing:
                    existing.title = translated_title or existing.title
                    existing.summary = translated_summary or existing.summary
                    existing.content = translated_content or existing.content
                    session.add(existing)
                    await session.commit()
                    await session.refresh(existing)
                    translation = existing
                else:
                    translation = Translation(
                        entry_id=entry_id,
                        language=target_language,
                        title=translated_title,
                        summary=translated_summary,
                        content=translated_content,
                    )
                    session.add(translation)
                    await session.commit()
                    await session.refresh(translation)
            except IntegrityError:
                await session.rollback()
                result = await session.exec(
                    select(Translation).where(
                        Translation.entry_id == entry_id, Translation.language == target_language
                    )
                )
                translation = result.first()
                # If still None, we just don't return the ID, but we have the content so it's fine for the user
                if not translation:
                    # Fallback object just for response
                    translation = Translation(
                        title=translated_title,
                        summary=translated_summary,
                        content=translated_content
                    )

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
    content_display_mode: str = "replace"
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
    content_display_mode: str | None = None
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
            if payload.features.content_display_mode is not None:
                features["content_display_mode"] = payload.features.content_display_mode
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
