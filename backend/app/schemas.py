from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Document(BaseModel):
    id: str
    content: str = Field(default="", description="Full text content of the lyric document")
    updated_at: datetime
    version_id: str


class DocumentUpdate(BaseModel):
    content: str = Field(default="", description="New lyric text to persist")


class DocumentVersion(BaseModel):
    id: str
    document_id: str
    content: str
    created_at: datetime


class DocumentRevertRequest(BaseModel):
    version_id: str = Field(description="Identifier of the version to restore")


class ChatContext(BaseModel):
    document_id: str
    document_version_id: str | None = Field(
        default=None,
        description="Current version identifier if available",
    )
    metadata: dict[str, str] | None = Field(
        default=None, description="Additional document metadata"
    )


class ChatRequest(BaseModel):
    message: str = Field(description="User-authored message for the assistant")
    document_content: str = Field(
        default="", description="HTML content of the active document"
    )
    selection: str | None = Field(
        default=None, description="Optional highlighted excerpt from the canvas"
    )
    context: ChatContext


class DiffChunk(BaseModel):
    type: Literal["equal", "insert", "delete"]
    text: str


class ChatResponse(BaseModel):
    message: str
    diff: list[DiffChunk] = Field(
        default_factory=list,
        description="Git-style diff chunks comparing current content to assistant suggestion",
    )
    suggested_content: str = Field(
        default="", description="Assistant's full suggested document content"
    )
