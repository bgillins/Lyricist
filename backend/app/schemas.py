from datetime import datetime

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
