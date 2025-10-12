from __future__ import annotations

import logging
from typing import Any, List

from fastapi.concurrency import run_in_threadpool
from openai import OpenAI

from ..chat_storage import ChatMessage
from ..config import settings

logger = logging.getLogger(__name__)


class OpenAIClient:
    def __init__(self) -> None:
        api_key = settings.openai_api_key
        self._enabled = bool(api_key)
        self._model = settings.openai_model
        self._client = OpenAI(api_key=api_key) if api_key else None

    @property
    def is_enabled(self) -> bool:
        return self._enabled and self._client is not None

    async def generate_suggestion(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: list[ChatMessage] | None = None,
    ) -> str:
        if not self.is_enabled:
            raise RuntimeError("OpenAI client is not configured")

        messages: List[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
        ]

        # Add conversation history (excluding the current user message which is in user_prompt)
        if conversation_history:
            for msg in conversation_history:
                # Skip system messages from history to avoid duplication
                if msg.role != "system":
                    messages.append({"role": msg.role, "content": msg.content})

        # Add current user message
        messages.append({"role": "user", "content": user_prompt})

        def _call() -> str:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=messages,
            )
            choice = response.choices[0]
            content = choice.message.content if choice.message else ""
            return content or ""

        return await run_in_threadpool(_call)


openai_client = OpenAIClient()
