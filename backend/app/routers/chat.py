from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..chat_storage import chat_history_store
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

    # Load existing chat history for this document
    history = chat_history_store.load(document_id)

    # Add the user's message to history
    chat_history_store.add_message(document_id, "user", payload.message)

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

    # Generate suggestion with conversation history
    commentary, options = await generate_suggestion(prompt_input, history.messages)
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

    # Save assistant's response to history
    assistant_content = "\n".join(commentary)
    if response_options:
        assistant_content += f"\n\nProvided {len(response_options)} option(s)"
    chat_history_store.add_message(document_id, "assistant", assistant_content)

    return ChatResponse(commentary=commentary, options=response_options)


@router.delete("/{document_id}/history")
async def clear_chat_history(document_id: str) -> dict[str, str]:
    """Clear conversation history for a specific document."""
    chat_history_store.clear(document_id)
    return {"status": "success", "message": f"Chat history cleared for document {document_id}"}
