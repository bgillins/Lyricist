from __future__ import annotations

from .text import normalize_selection
from ..models.prompt import PromptContext, PromptInput

SYSTEM_PROMPT_TEMPLATE = """You are Lyricist, an assistant helping refine song lyrics.\n{metadata_block}\nRespond with clear suggestions and keep structure intact."""

USER_PROMPT_TEMPLATE = """Current lyrics:\n{content}\n{selection_block}\nUser request: {user_message}"""


def build_system_prompt(context: PromptContext) -> str:
    metadata_items = [
        f"- {key}: {value}" for key, value in (context.metadata or {}).items() if value
    ]
    metadata_block = (
        "Context:\n" + "\n".join(metadata_items)
        if metadata_items
        else "Context: (no additional metadata provided)"
    )
    return SYSTEM_PROMPT_TEMPLATE.format(metadata_block=metadata_block)


def build_user_prompt(prompt: PromptInput) -> str:
    selection_text = normalize_selection(prompt.context.selection or "")
    selection_block = (
        f"Highlighted excerpt:\n{selection_text}\n"
        if selection_text
        else ""
    )
    return USER_PROMPT_TEMPLATE.format(
        content=prompt.document_content,
        selection_block=selection_block,
        user_message=prompt.user_message,
    )
