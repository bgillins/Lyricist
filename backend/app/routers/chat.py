from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..models.prompt import PromptContext, PromptInput
from ..schemas import ChatRequest, ChatResponse
from ..services import diff, prompt_builder

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

    _ = prompt_builder.build_system_prompt(context)
    _ = prompt_builder.build_user_prompt(prompt_input)

    # TODO: Wire in OpenAI client when credentials are present.
    suggestion = _generate_stub_suggestion(payload.document_content, payload.message)
    diff_chunks = diff.diff_chunks(payload.document_content, suggestion)

    return ChatResponse(message=suggestion, diff=diff_chunks, suggested_content=suggestion)


def _generate_stub_suggestion(current_html: str, message: str) -> str:
    suffix = (
        f"<p><em>Assistant note:</em> {message.strip()}</p>"
        if message.strip()
        else "<p><em>Assistant note:</em> Consider refining this section.</p>"
    )
    if suffix in current_html:
        return current_html
    return current_html + suffix
