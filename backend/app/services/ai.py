from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class GLMClient:
    def __init__(self) -> None:
        self.base_url = settings.glm_base_url.rstrip("/")
        self.model = settings.glm_model
        self.api_key = settings.glm_api_key

    async def summarize(self, content: str, *, language: str = "zh") -> str:
        if not self.api_key:
            raise RuntimeError("GLM_API_KEY 未配置")

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"你是一个 RSS 阅读器助手，请用{language}输出精炼摘要。",
                },
                {"role": "user", "content": content},
            ],
            "max_tokens": 512,
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
        if not self.api_key:
            raise RuntimeError("GLM_API_KEY 未配置")

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


glm_client = GLMClient()
