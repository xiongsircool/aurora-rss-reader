"""
段落级翻译引擎
支持长文本的增量翻译，类似浏览器网页翻译
"""
from __future__ import annotations

import asyncio
import re
from typing import List, Dict, Optional, Callable
from html.parser import HTMLParser
import hashlib

from app.services.ai import GLMClient
import logging

logger = logging.getLogger(__name__)


class HTMLSegmentParser(HTMLParser):
    """智能HTML段落分割器，保持HTML结构完整"""
    
    def __init__(self):
        super().__init__()
        self.segments = []
        self.current_segment = []
        self.tag_stack = []
        self.in_code_block = False
        self.in_pre = False
        
    def handle_starttag(self, tag, attrs):
        """处理开始标签"""
        self.current_segment.append(self.get_starttag_text())
        self.tag_stack.append(tag)
        
        # 检测代码块
        if tag in ['code', 'pre']:
            self.in_code_block = True
            self.in_pre = tag == 'pre'
    
    def handle_endtag(self, tag):
        """处理结束标签"""
        self.current_segment.append(f'</{tag}>')
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
        
        if tag in ['code', 'pre']:
            self.in_code_block = False
            self.in_pre = False
    
    def handle_data(self, data):
        """处理文本数据"""
        # 代码块内容不分割
        if self.in_code_block or self.in_pre:
            self.current_segment.append(data)
            return
        
        # 按段落分割（双换行或<p>标签）
        lines = data.split('\n\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            self.current_segment.append(line)
            
            # 如果不是最后一行，且当前没有未闭合的标签，则保存段落
            if i < len(lines) - 1 and not self.tag_stack:
                if self.current_segment:
                    self.segments.append(''.join(self.current_segment))
                    self.current_segment = []
    
    def handle_startendtag(self, tag, attrs):
        """处理自闭合标签（如<img />）"""
        self.current_segment.append(self.get_starttag_text())
    
    def get_segments(self) -> List[str]:
        """获取分割后的段落"""
        # 添加最后一个段落
        if self.current_segment:
            self.segments.append(''.join(self.current_segment))
        return [seg.strip() for seg in self.segments if seg.strip()]


class SmartSegmenter:
    """智能文本分割器"""
    
    @staticmethod
    def split_by_paragraphs(
        text: str,
        max_length: int = 1000,
        preserve_html: bool = True
    ) -> List[Dict[str, any]]:
        """
        按段落智能分割文本
        
        Args:
            text: 要分割的文本
            max_length: 每个段落的最大长度
            preserve_html: 是否保留HTML结构
            
        Returns:
            段落列表，每个段落包含：
            - content: 段落内容
            - index: 段落索引
            - is_code: 是否为代码块
            - hash: 段落哈希（用于缓存）
        """
        segments = []
        
        # 检测是否包含HTML
        has_html = bool(re.search(r'<[^>]+>', text))
        
        if has_html and preserve_html:
            # 使用HTML解析器分割
            parser = HTMLSegmentParser()
            parser.feed(text)
            raw_segments = parser.get_segments()
        else:
            # 简单的段落分割
            # 按段落标记分割：双换行、标题、列表等
            pattern = r'\n\n+|(?=^#{1,6}\s)|(?=^\s*[-*+]\s)|(?=^\s*\d+\.\s)'
            raw_segments = re.split(pattern, text, flags=re.MULTILINE)
        
        # 处理每个段落
        for idx, segment in enumerate(raw_segments):
            segment = segment.strip()
            if not segment:
                continue
            
            # 检测是否为代码块
            is_code = bool(
                re.match(r'^```|^<code>|^<pre>', segment) or
                segment.startswith('    ')  # Markdown代码缩进
            )
            
            # 如果段落太长，进一步分割
            if len(segment) > max_length and not is_code:
                # 按句子分割
                sentences = re.split(r'([.!?。！？][\s\n])', segment)
                current_chunk = []
                current_length = 0
                
                for i in range(0, len(sentences), 2):
                    sentence = sentences[i]
                    punctuation = sentences[i + 1] if i + 1 < len(sentences) else ''
                    full_sentence = sentence + punctuation
                    
                    if current_length + len(full_sentence) > max_length and current_chunk:
                        # 保存当前块
                        chunk_text = ''.join(current_chunk)
                        segments.append({
                            'content': chunk_text,
                            'index': len(segments),
                            'is_code': False,
                            'hash': hashlib.md5(chunk_text.encode()).hexdigest()
                        })
                        current_chunk = [full_sentence]
                        current_length = len(full_sentence)
                    else:
                        current_chunk.append(full_sentence)
                        current_length += len(full_sentence)
                
                # 添加最后一个块
                if current_chunk:
                    chunk_text = ''.join(current_chunk)
                    segments.append({
                        'content': chunk_text,
                        'index': len(segments),
                        'is_code': False,
                        'hash': hashlib.md5(chunk_text.encode()).hexdigest()
                    })
            else:
                # 段落长度合适，直接添加
                segments.append({
                    'content': segment,
                    'index': len(segments),
                    'is_code': is_code,
                    'hash': hashlib.md5(segment.encode()).hexdigest()
                })
        
        return segments


class IncrementalTranslator:
    """增量翻译器 - 支持段落级翻译和实时进度反馈"""
    
    def __init__(self, client: GLMClient):
        self.client = client
        self.cache: Dict[str, str] = {}  # 段落级缓存
    
    async def translate_segments_stream(
        self,
        segments: List[Dict[str, any]],
        target_language: str = "zh",
        max_concurrent: int = 3,
        context_window: int = 1
    ):
        """
        流式翻译多个段落，yield每个完成的段落
        """
        total = len(segments)
        translated_contexts = [""] * total
        
        # 使用队列来收集完成的任务
        queue = asyncio.Queue()
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def translate_one(segment: Dict[str, any]) -> None:
            async with semaphore:
                idx = segment['index']
                content = segment['content']
                result = None
                
                try:
                    # 代码块不翻译
                    if segment['is_code']:
                        result = {**segment, 'translated': content, 'from_cache': False}
                    else:
                        # 检查缓存
                        cache_key = f"{segment['hash']}_{target_language}"
                        if cache_key in self.cache:
                            translated = self.cache[cache_key]
                            translated_contexts[idx] = translated
                            result = {**segment, 'translated': translated, 'from_cache': True}
                        else:
                            # 构建上下文
                            context_parts = []
                            if context_window > 0:
                                for i in range(max(0, idx - context_window), idx):
                                    if translated_contexts[i]:
                                        context_parts.append(f"[前文]: {translated_contexts[i][:200]}...")
                            context_info = "\n".join(context_parts) if context_parts else None
                            
                            translated = await self._translate_with_context(
                                content, target_language, context_info
                            )
                            
                            self.cache[cache_key] = translated
                            translated_contexts[idx] = translated
                            result = {**segment, 'translated': translated, 'from_cache': False}
                except Exception as e:
                    logger.error(f"段落 {idx} 翻译失败: {str(e)}")
                    # 翻译失败，使用原文
                    result = {
                        **segment, 
                        'translated': content, 
                        'error': str(e), 
                        'from_cache': False
                    }
                
                await queue.put(result)

        # 启动所有任务
        tasks = [asyncio.create_task(translate_one(seg)) for seg in segments]
        
        # 收集结果
        for _ in range(total):
            result = await queue.get()
            yield result
            
        # 确保所有任务结束
        await asyncio.gather(*tasks)

    async def translate_segments(
        self,
        segments: List[Dict[str, any]],
        target_language: str = "zh",
        max_concurrent: int = 3,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
        context_window: int = 1  # 上下文窗口大小
    ) -> List[Dict[str, any]]:
        """
        翻译多个段落，支持并发和进度反馈
        
        Args:
            segments: 段落列表
            target_language: 目标语言
            max_concurrent: 最大并发数
            progress_callback: 进度回调函数 (current, total, message)
            context_window: 上下文窗口大小（为0则不使用上下文）
            
        Returns:
            翻译后的段落列表
        """
        total = len(segments)
        completed = 0
        results = [None] * total
        
        # 用于存储已翻译的内容，作为后续段落的上下文
        translated_contexts = [""] * total
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def translate_one(segment: Dict[str, any]) -> None:
            nonlocal completed
            
            async with semaphore:
                idx = segment['index']
                content = segment['content']
                
                # 代码块不翻译
                if segment['is_code']:
                    results[idx] = {
                        **segment,
                        'translated': content,
                        'from_cache': False
                    }
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total, f"跳过代码块 {idx + 1}")
                    return
                
                # 检查缓存
                cache_key = f"{segment['hash']}_{target_language}"
                if cache_key in self.cache:
                    results[idx] = {
                        **segment,
                        'translated': self.cache[cache_key],
                        'from_cache': True
                    }
                    translated_contexts[idx] = self.cache[cache_key]
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total, f"从缓存加载 {idx + 1}/{total}")
                    return
                
                try:
                    # 构建上下文
                    context_parts = []
                    if context_window > 0:
                        # 获取前面的段落作为上下文
                        for i in range(max(0, idx - context_window), idx):
                            if translated_contexts[i]:
                                context_parts.append(f"[前文]: {translated_contexts[i][:200]}...")
                    
                    context_info = "\n".join(context_parts) if context_parts else None
                    
                    # 翻译段落
                    if progress_callback:
                        progress_callback(completed, total, f"正在翻译段落 {idx + 1}/{total}")
                    
                    translated = await self._translate_with_context(
                        content,
                        target_language,
                        context_info
                    )
                    
                    # 保存到缓存
                    self.cache[cache_key] = translated
                    translated_contexts[idx] = translated
                    
                    results[idx] = {
                        **segment,
                        'translated': translated,
                        'from_cache': False
                    }
                    
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total, f"完成段落 {idx + 1}/{total}")
                    
                except Exception as e:
                    # 翻译失败，使用原文
                    logger.error(f"段落 {idx} 翻译失败: {str(e)}")
                    results[idx] = {
                        **segment,
                        'translated': content,
                        'error': str(e),
                        'from_cache': False
                    }
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total, f"段落 {idx + 1} 翻译失败，使用原文")
        
        # 并发翻译所有段落
        await asyncio.gather(*[translate_one(seg) for seg in segments])
        
        return results
    
    async def _translate_with_context(
        self,
        text: str,
        target_language: str,
        context: Optional[str] = None
    ) -> str:
        """
        带上下文的翻译
        
        Args:
            text: 要翻译的文本
            target_language: 目标语言
            context: 上下文信息（前面段落的翻译）
        """
        language_names = {
            "zh": "中文",
            "en": "English",
            "ja": "日本語",
            "ko": "한국어",
        }
        lang_display = language_names.get(target_language, target_language)
        
        # 构建prompt
        system_content = f"""你是专业的翻译助手。请将以下段落翻译为{lang_display}。

翻译要求：
1. 保持原文的格式（Markdown、HTML标签等）
2. 准确传达原文意思
3. 使用地道、流畅的{lang_display}表达
4. 专业术语要准确、前后一致
5. 保持原文的语气和风格
6. 代码、链接URL不要翻译

{f"参考上下文（保持术语一致性）：{context}" if context else ""}

请直接输出翻译结果，不要添加任何解释。"""
        
        return await self.client.translate(text, target_language=target_language)
    
    def merge_segments(self, segments: List[Dict[str, any]]) -> str:
        """
        合并翻译后的段落
        
        Args:
            segments: 翻译后的段落列表
            
        Returns:
            完整的翻译文本
        """
        # 按索引排序
        sorted_segments = sorted(segments, key=lambda x: x['index'])
        
        # 合并内容
        parts = [seg['translated'] for seg in sorted_segments]
        
        # 智能连接段落
        result = []
        for i, part in enumerate(parts):
            result.append(part)
            
            # 添加段落间隔
            # 如果下一段不是以HTML标签开始，添加双换行
            if i < len(parts) - 1:
                next_part = parts[i + 1]
                if not next_part.startswith('<') and not part.endswith('\n\n'):
                    result.append('\n\n')
        
        return ''.join(result)
    
    async def translate_long_text(
        self,
        text: str,
        target_language: str = "zh",
        max_segment_length: int = 1000,
        max_concurrent: int = 3,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> str:
        """
        翻译长文本的完整流程
        
        Args:
            text: 要翻译的文本
            target_language: 目标语言
            max_segment_length: 每段最大长度
            max_concurrent: 最大并发数
            progress_callback: 进度回调
            
        Returns:
            翻译后的完整文本
        """
        # 1. 分割段落
        if progress_callback:
            progress_callback(0, 100, "正在分析文章结构...")
        
        segments = SmartSegmenter.split_by_paragraphs(
            text,
            max_length=max_segment_length
        )
        
        if not segments:
            return text
        
        # 2. 翻译段落
        if progress_callback:
            progress_callback(10, 100, f"开始翻译 {len(segments)} 个段落...")
        
        def wrapped_callback(current: int, total: int, message: str):
            # 将段落进度映射到总进度 (10% - 90%)
            percent = 10 + int((current / total) * 80)
            if progress_callback:
                progress_callback(percent, 100, message)
        
        translated_segments = await self.translate_segments(
            segments,
            target_language,
            max_concurrent,
            wrapped_callback,
            context_window=1  # 使用上一段作为上下文
        )
        
        # 3. 合并结果
        if progress_callback:
            progress_callback(95, 100, "正在合并翻译结果...")
        
        result = self.merge_segments(translated_segments)
        
        if progress_callback:
            progress_callback(100, 100, "翻译完成！")
        
        return result
    
    def _clean_html_for_display(self, html_content: str) -> str:
        """
        清洗翻译后的HTML，移除媒体元素以避免双语对照时出现重复图像
        只保留文本相关的格式标签
        """
        if not html_content:
            return ""
            
        # 移除 img, video, audio, iframe, object, embed
        # 使用非贪婪匹配移除标签及其属性
        patterns = [
            r'<img[^>]*>',
            r'<video[^>]*>.*?</video>',
            r'<audio[^>]*>.*?</audio>',
            r'<iframe[^>]*>.*?</iframe>',
            r'<object[^>]*>.*?</object>',
            r'<embed[^>]*>',
            # 移除 figure 容器但保留其中的 figcaption 内容 (如果有)
            r'<figure[^>]*>',
            r'</figure>'
        ]
        
        cleaned = html_content
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
            
        # 清理可能产生的空标签 (如 <p></p>)
        cleaned = re.sub(r'<p>\s*</p>', '', cleaned)
        
        return cleaned.strip()

    def merge_bilingual_segments(self, segments: List[Dict[str, any]]) -> str:
        """
        合并为双语对照格式
        
        结构:
        <div class="segment-wrapper">
            <div class="original">{content}</div>
            <div class="translated">{translated}</div>
        </div>
        """
        # 按索引排序
        sorted_segments = sorted(segments, key=lambda x: x['index'])
        
        result = []
        for seg in sorted_segments:
            original = seg['content']
            translated_raw = seg.get('translated', '')
            
            # 代码块特殊处理：只显示原文，或者特殊标记
            if seg.get('is_code'):
                result.append(original)
                continue
                
            # 清洗译文中的媒体标签，防止双图
            translated_clean = self._clean_html_for_display(translated_raw)
            
            # 如果译文清洗后为空（例如纯图片段落），只保留原文
            if not translated_clean:
                result.append(original)
                continue

            # 构建双语块
            # 使用特定 class 方便前端定制样式
            block = (
                f'<div class="bilingual-segment" style="position: relative; margin-bottom: 1.5em;">'
                f'<div class="original" style="margin-bottom: 0.5em;">{original}</div>'
                f'<div class="translated" style="color: #5F6368; font-size: 0.95em; padding-left: 12px; border-left: 3px solid #4C74FF; background: rgba(76, 116, 255, 0.05); padding: 8px 12px; border-radius: 4px;">'
                f'{translated_clean}'
                f'</div>'
                f'</div>'
            )
            result.append(block)
            
        return '\n'.join(result)

    def clear_cache(self):
        """清空缓存"""
        self.cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """获取缓存统计"""
        return {
            'total_segments': len(self.cache),
            'total_size_bytes': sum(len(v.encode()) for v in self.cache.values())
        }










