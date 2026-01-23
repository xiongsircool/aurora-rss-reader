from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel


class SummaryRequest(SQLModel):
    entry_id: str
    language: str = "zh"


class SummaryResponse(SQLModel):
    entry_id: str
    language: str
    summary: str


# --- Block Translation Schemas ---

class TranslateBlock(SQLModel):
    """单个待翻译段落"""
    id: str  # block hash_id
    text: str  # 原文文本


class TranslateBlocksRequest(SQLModel):
    """批量翻译请求"""
    entry_id: str  # 文章 ID（用于缓存关联）
    source_lang: str = "en"  # 源语言
    target_lang: str = "zh"  # 目标语言
    blocks: list[TranslateBlock]  # 待翻译段落列表


class TranslationEvent(SQLModel):
    """SSE 翻译结果事件"""
    id: str  # block hash_id
    text: Optional[str] = None  # 翻译文本
    error: Optional[str] = None  # 错误信息


class TranslationDoneEvent(SQLModel):
    """SSE 完成事件"""
    total: int
    success: int
    failed: int
    cached: int
