from __future__ import annotations

from .text import normalize_selection
from ..models.prompt import PromptContext, PromptInput

USER_PROMPT_TEMPLATE = """Current lyrics:
{content}
{selection_block}
User request: {user_message}

Return JSON with this structure:
{{
  "commentary": ["bullet one", "bullet two"],
  "options": [
    {{ "label": "Option 1", "lyrics": "full revised lyrics" }},
    {{ "label": "Option 2", "lyrics": "alternate revised lyrics" }}
  ]
}}

-----------------------------------------------------------------------
CRITICAL FORMATTING RULES:
-----------------------------------------------------------------------
- Each "lyrics" field must contain ONLY the complete song lyrics
- Preserve exact line breaks, spacing, and structure
- NO explanations, comments, or JSON inside the lyrics field
- Keep existing Suno meta tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]
- Add new tags only where appropriate: [Spoken Word], [Pre-chorus], [Drop]
- Sound effects use asterisks: *rain*, *applause*, *synth swell*
- Spoken sections: (text in parentheses) or [Spoken Word]

-----------------------------------------------------------------------
STYLE ENHANCEMENTS (when relevant to user request):
-----------------------------------------------------------------------
- Genre: ALL CAPS (e.g., INDIE ROCK, SYNTHWAVE)
- Mood/descriptors: Title Case (e.g., Melancholic, Uplifting)
- Instruments: lowercase (e.g., acoustic guitar, 808 bass)
- Keep 4-7 descriptors for optimal results

-----------------------------------------------------------------------
REQUIREMENTS:
-----------------------------------------------------------------------
- Provide at least one option; more if request implies alternatives
- "commentary" explains what changed and why (NOT in lyrics field)
- Return complete, properly formatted lyrics ready for Suno AI
- Maintain song flow and section transitions"""


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
