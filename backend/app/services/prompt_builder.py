from __future__ import annotations

from .text import normalize_selection
from ..models.prompt import PromptContext, PromptInput

SYSTEM_PROMPT_TEMPLATE = """You are Lyricist, an assistant helping refine song lyrics.\n{metadata_block}\nFollow the response format exactly so the client can parse your output."""

USER_PROMPT_TEMPLATE = """Current lyrics:\n{content}\n{selection_block}\nUser request: {user_message}\n\nReturn JSON with this structure:\n{{
  "commentary": ["bullet one", "bullet two"],
  "options": [
    {{ "label": "Option 1", "lyrics": "full revised lyrics" }},
    {{ "label": "Option 2", "lyrics": "alternate revised lyrics" }}
  ]
}}\n- Provide at least one option; include more whenever the request implies alternatives.\n- "commentary" must highlight key differences between the options and the original lyrics.\n- Each "lyrics" value must contain only the lyrical content (no commentary or JSON)."""


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
