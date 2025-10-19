from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    """Represents a single message in the conversation history."""

    role: Literal["system", "user", "assistant"]
    content: str
    timestamp: datetime
    context: Literal["document", "selection"] | None = None


class ChatHistory(BaseModel):
    """Conversation history for a document."""
    document_id: str
    messages: list[ChatMessage]
    created_at: datetime
    updated_at: datetime


class ChatHistoryStore:
    """Storage for chat conversation history per document."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or Path(__file__).resolve().parent.parent / "data" / "chat_history"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_id(self, document_id: str) -> str:
        safe_id = document_id.strip()
        if not safe_id:
            raise ValueError("document_id must not be empty")
        return safe_id

    def _path_for(self, document_id: str) -> Path:
        return self._base_dir / f"{self._safe_id(document_id)}.json"

    def load(self, document_id: str) -> ChatHistory:
        """Load chat history for a document."""
        path = self._path_for(document_id)
        if not path.exists():
            # Return empty history if none exists
            now = datetime.now(timezone.utc)
            return ChatHistory(
                document_id=document_id,
                messages=[],
                created_at=now,
                updated_at=now,
            )

        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return ChatHistory.model_validate(payload)

    def save(self, history: ChatHistory) -> ChatHistory:
        """Save chat history for a document."""
        history.updated_at = datetime.now(timezone.utc)
        path = self._path_for(history.document_id)

        with path.open("w", encoding="utf-8") as handle:
            json.dump(history.model_dump(mode="json"), handle, ensure_ascii=False, indent=2)

        return history

    def add_message(
        self,
        document_id: str,
        role: Literal["system", "user", "assistant"],
        content: str,
        *,
        context: Literal["document", "selection"] | None = None,
    ) -> ChatHistory:
        """Add a message to the conversation history."""
        history = self.load(document_id)

        message = ChatMessage(
            role=role,
            content=content,
            timestamp=datetime.now(timezone.utc),
            context=context,
        )
        history.messages.append(message)

        return self.save(history)

    def clear(self, document_id: str | None = None) -> None:
        """Clear chat history for a document, or all documents if None."""
        if document_id:
            path = self._path_for(document_id)
            if path.exists():
                path.unlink()
        else:
            # Clear all chat histories
            import shutil
            if self._base_dir.exists():
                shutil.rmtree(self._base_dir)
            self._base_dir.mkdir(parents=True, exist_ok=True)


# Global instance
chat_history_store = ChatHistoryStore()
