from __future__ import annotations

import logging
from html import escape

from ..models.prompt import PromptInput
from ..services import prompt_builder
from ..services.text import strip_html
from ..services.openai_client import openai_client

logger = logging.getLogger(__name__)


def _render_html_from_text(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return ""
    paragraphs = [escape(part).strip() for part in stripped.split("\n") if part.strip()]
    return "".join(f"<p>{paragraph}</p>" for paragraph in paragraphs)


async def generate_suggestion(prompt: PromptInput) -> tuple[list[str], str]:
    system_prompt = prompt_builder.build_system_prompt(prompt.context)
    user_prompt = prompt_builder.build_user_prompt(prompt)

    if openai_client.is_enabled:
        try:
            structured = await openai_client.generate_suggestion(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            commentary, lyrics_text = _parse_structured_response(structured)
            html_suggestion = _render_html_from_text(lyrics_text)
            return commentary, html_suggestion or prompt.document_content
        except Exception as exc:  # noqa: BLE001
            logger.warning("OpenAI request failed, falling back to stub: %s", exc)

    fallback_commentary, fallback_lyrics = _fallback_suggestion(
        prompt.document_content, prompt.user_message
    )
    return fallback_commentary, fallback_lyrics


def _parse_structured_response(raw_text: str) -> tuple[list[str], str]:
    import json

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        return [strip_html(raw_text)], raw_text

    commentary = payload.get("commentary")
    if not isinstance(commentary, list):
        commentary = [payload.get("commentary", "")]
    commentary = [strip_html(str(item)) for item in commentary if str(item).strip()]

    lyrics = payload.get("lyrics")
    if not isinstance(lyrics, str):
        lyrics = raw_text

    return commentary or [strip_html(raw_text)], lyrics


def _fallback_suggestion(current_html: str, message: str) -> tuple[list[str], str]:
    suffix = (
        f"<p><em>Assistant note:</em> {escape(message.strip())}</p>"
        if message.strip()
        else "<p><em>Assistant note:</em> Consider refining this section.</p>"
    )
    if suffix in current_html:
        lyrics_html = current_html
    else:
        lyrics_html = current_html + suffix

    commentary = [
        strip_html(message.strip())
        if message.strip()
        else "Consider refining this section."
    ]
    return commentary, lyrics_html
