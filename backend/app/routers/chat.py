from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models.prompt import PromptContext, PromptInput
from ..schemas import ChatRequest, ChatResponse
from ..services import diff
from ..services.chat_service import generate_suggestion
from ..services.text import strip_html

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{document_id}", response_model=ChatResponse)
async def post_chat_message(document_id: str, payload: ChatRequest) -> ChatResponse:
    if payload.context.document_id and payload.context.document_id != document_id:
        raise HTTPException(status_code=400, detail="Mismatched document context")

    context = PromptContext(
        document_id=document_id,
        document_version_id=payload.context.document_version_id,
        metadata=payload.context.metadata or {},
        selection=payload.selection,
    )
    prompt_input = PromptInput(
        user_message=payload.message,
        document_content=payload.document_content,
        context=context,
    )

    commentary, html_lyrics = await generate_suggestion(prompt_input)
    original_text = strip_html(payload.document_content)
    suggested_text = strip_html(html_lyrics)
    diff_chunks = diff.diff_chunks(original_text, suggested_text)

    return ChatResponse(
        commentary=commentary,
        lyrics=html_lyrics,
        diff=diff_chunks,
    )
