from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models.prompt import PromptContext, PromptInput
from ..schemas import ChatRequest, ChatResponse, LyricOption
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

    commentary, options = await generate_suggestion(prompt_input)
    original_text = strip_html(payload.document_content)

    response_options: list[LyricOption] = []
    for option in options:
        lyrics_html = option.get("lyrics_html", "")
        lyrics_text = option.get("lyrics_text", strip_html(lyrics_html))
        diff_chunks = diff.diff_chunks(original_text, lyrics_text)
        response_options.append(
            LyricOption(
                label=option.get("label", "Option"),
                lyrics=lyrics_html,
                diff=diff_chunks,
            )
        )

    return ChatResponse(commentary=commentary, options=response_options)
