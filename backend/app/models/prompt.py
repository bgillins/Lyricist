from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class PromptContext:
    document_id: str
    document_version_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    selection: str | None = None


@dataclass(slots=True)
class PromptInput:
    user_message: str
    document_content: str
    context: PromptContext
