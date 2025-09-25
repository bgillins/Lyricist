from __future__ import annotations

import logging
from typing import Any, List

from fastapi.concurrency import run_in_threadpool
from openai import OpenAI

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

    async def generate_suggestion(self, system_prompt: str, user_prompt: str) -> str:
        if not self.is_enabled:
            raise RuntimeError("OpenAI client is not configured")

        messages: List[dict[str, Any]] = [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_prompt}],
            },
        ]

        def _call() -> str:
            response = self._client.responses.create(
                model=self._model,
                input=messages,
            )
            try:
                return response.output_text  # type: ignore[attr-defined]
            except AttributeError:
                # Fallback for older SDKs
                outputs = []
                for item in getattr(response, "output", []):
                    if item.get("type") == "output_text":
                        outputs.append(item.get("text", ""))
                return "".join(outputs)

        return await run_in_threadpool(_call)


openai_client = OpenAIClient()
