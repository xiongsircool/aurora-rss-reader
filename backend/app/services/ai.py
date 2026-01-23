from __future__ import annotations

from typing import Any, Dict, Literal

import httpx

from app.core.config import settings

ServiceKey = Literal["summary", "translation"]


class GLMClient:
    def __init__(self, *, base_url: str = "", model: str = "", api_key: str = "") -> None:
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.model = model
        self.api_key = api_key

    def configure(self, *, base_url: str | None = None, model: str | None = None, api_key: str | None = None) -> None:
        if base_url is not None:
            self.base_url = base_url.rstrip("/") if base_url else ""
        if model is not None:
            self.model = model
        if api_key is not None:
            self.api_key = api_key

    def snapshot(self) -> Dict[str, str]:
        return {
            "base_url": self.base_url,
            "model": self.model,
            "api_key": self.api_key,
        }

    def _ensure_ready(self) -> None:
        if not self.api_key:
            raise RuntimeError("GLM_API_KEY 未配置")
        if not self.base_url:
            raise RuntimeError("GLM_BASE_URL 未配置")
        if not self.model:
            raise RuntimeError("GLM_MODEL 未配置")

    async def summarize(self, content: str, *, language: str = "zh") -> str:
        self._ensure_ready()

        max_input_length = 8000
        if len(content) > max_input_length:
            content = content[:max_input_length] + "..."

        language_names = {
            "zh": "中文",
            "en": "English",
            "ja": "日本語",
            "ko": "한국어",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español",
        }
        lang_display = language_names.get(language, language)

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"你是一个专业的RSS阅读器助手。你会收到一段文章文本，其中开头部分可能包含文章的标题、作者、时间等元信息，之后是正文内容。请用{lang_display}对整体内容生成全面而精炼的摘要。摘要应该：\n"
                    f"1. 抓住文章的核心观点和主要论据\n"
                    f"2. 包含重要的细节和支撑数据\n"
                    f"3. 保持逻辑结构清晰，层次分明\n"
                    f"4. 适当保持原文的风格和语调\n"
                    f"5. 控制长度在合理范围内，确保信息密度",
                },
                {"role": "user", "content": content},
            ],
            "max_tokens": 1000,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60) as client:
            response = await client.post("/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            message = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if isinstance(message, list):
                return "".join(part.get("text", "") for part in message)
            return str(message)

    async def translate(self, text: str, *, target_language: str = "zh") -> str:
        self._ensure_ready()

        language_names = {
            "zh": "中文",
            "en": "English",
            "ja": "日本語",
            "ko": "한국어",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español",
        }
        lang_display = language_names.get(target_language, target_language)

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"你是专业翻译助手。请将以下文本翻译为{lang_display}，保持 Markdown 格式和 HTML 标签不变，只翻译文本内容。",
                },
                {"role": "user", "content": text},
            ],
            "max_tokens": 2048,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=90) as client:
            response = await client.post("/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            message = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if isinstance(message, list):
                return "".join(part.get("text", "") for part in message)
            return str(message)

    async def translate_batch(
        self,
        blocks: list[Dict[str, str]],
        *,
        target_language: str = "zh",
    ) -> Dict[str, str]:
        """
        批量翻译多个段落。

        Args:
            blocks: [{"id": "hash_id", "text": "原文"}, ...]
            target_language: 目标语言代码

        Returns:
            {"block_id": "翻译文本", ...}
        """
        self._ensure_ready()

        if not blocks:
            return {}

        language_names = {
            "zh": "中文",
            "en": "English",
            "ja": "日本語",
            "ko": "한국어",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español",
        }
        lang_display = language_names.get(target_language, target_language)

        # 构建批量翻译 prompt
        blocks_text = "\n\n".join(
            f"[ID:{b['id']}]\n{b['text']}" for b in blocks
        )

        prompt = f"""请将以下段落翻译成{lang_display}，保持原文格式和语气。

每段用 [ID:xxx] 标记，请保持对应关系。

{blocks_text}

请按以下格式输出（每段翻译前加上对应的 ID 标记）："""

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是专业翻译助手。请严格按照要求的格式输出翻译结果，保持 ID 标记与原文一一对应。",
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 4096,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=120) as client:
            response = await client.post("/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if isinstance(content, list):
                content = "".join(part.get("text", "") for part in content)

        # 解析响应，提取 ID 和翻译文本
        return self._parse_batch_response(content, blocks)

    def _parse_batch_response(
        self, response: str, blocks: list[Dict[str, str]]
    ) -> Dict[str, str]:
        """解析批量翻译响应"""
        import re

        result: Dict[str, str] = {}
        block_ids = {b["id"] for b in blocks}

        # 尝试匹配 [ID:xxx] 格式
        pattern = r"\[ID:([a-fA-F0-9]+)\]\s*\n?([\s\S]*?)(?=\[ID:|$)"
        matches = re.findall(pattern, response)

        for block_id, text in matches:
            if block_id in block_ids:
                result[block_id] = text.strip()

        # 如果解析失败且只有一个 block，直接返回整个响应
        if not result and len(blocks) == 1:
            result[blocks[0]["id"]] = response.strip()

        return result


class AIClientManager:
    def __init__(self) -> None:
        default_base = settings.glm_base_url.rstrip("/") if settings.glm_base_url else ""
        default_model = settings.glm_model
        default_key = settings.glm_api_key
        self._clients: dict[ServiceKey, GLMClient] = {
            "summary": GLMClient(base_url=default_base, model=default_model, api_key=default_key),
            "translation": GLMClient(base_url=default_base, model=default_model, api_key=default_key),
        }

    def get_client(self, service: ServiceKey) -> GLMClient:
        return self._clients[service]

    def update_client(self, service: ServiceKey, *, api_key: str | None = None, base_url: str | None = None, model_name: str | None = None) -> None:
        client = self._clients[service]
        client.configure(api_key=api_key, base_url=base_url, model=model_name)

    def snapshot(self, service: ServiceKey) -> Dict[str, str]:
        return self._clients[service].snapshot()


ai_client_manager = AIClientManager()
