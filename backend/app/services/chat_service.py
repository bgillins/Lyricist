from __future__ import annotations

import json
import logging
from html import escape
from typing import Any

from ..models.prompt import PromptInput
from ..services import prompt_builder
from ..services.openai_client import openai_client
from ..services.text import strip_html

logger = logging.getLogger(__name__)


def _render_html_from_text(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return ""
    paragraphs = [escape(part).strip() for part in stripped.split("\n") if part.strip()]
    return "".join(f"<p>{paragraph}</p>" for paragraph in paragraphs)


def _normalize_option(index: int, option: dict[str, Any], fallback_html: str) -> dict[str, str]:
    label = str(option.get("label") or f"Option {index}")
    lyrics_raw = option.get("lyrics")
    lyrics_text = str(lyrics_raw) if isinstance(lyrics_raw, str) else ""
    html = _render_html_from_text(lyrics_text)
    if not html:
        html = fallback_html
    return {
        "label": label,
        "lyrics_text": lyrics_text or strip_html(html),
        "lyrics_html": html,
    }


async def generate_suggestion(prompt: PromptInput) -> tuple[list[str], list[dict[str, str]]]:
    system_prompt = prompt_builder.build_system_prompt(prompt.context)
    user_prompt = prompt_builder.build_user_prompt(prompt)

    if openai_client.is_enabled:
        try:
            structured = await openai_client.generate_suggestion(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            commentary, options = _parse_structured_response(structured)
            normalized = [
                _normalize_option(idx, option, prompt.document_content)
                for idx, option in enumerate(options, start=1)
            ]
            if normalized:
                return commentary, normalized
        except Exception as exc:  # noqa: BLE001
            logger.warning("OpenAI request failed, falling back to stub: %s", exc)

    commentary, options = _fallback_suggestion(prompt)
    return commentary, options


def _parse_structured_response(raw_text: str) -> tuple[list[str], list[dict[str, Any]]]:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        return [strip_html(raw_text)], [{"label": "Option 1", "lyrics": raw_text}]

    commentary_raw = payload.get("commentary")
    if isinstance(commentary_raw, list):
        commentary = [strip_html(str(item)) for item in commentary_raw if str(item).strip()]
    elif commentary_raw is None:
        commentary = []
    else:
        commentary = [strip_html(str(commentary_raw))]

    options_raw = payload.get("options")
    options: list[dict[str, Any]] = []
    if isinstance(options_raw, list):
        for item in options_raw:
            if isinstance(item, dict) and str(item.get("lyrics", "")).strip():
                options.append(item)

    if not options:
        single_lyrics = payload.get("lyrics")
        if isinstance(single_lyrics, str) and single_lyrics.strip():
            options = [{"label": "Option 1", "lyrics": single_lyrics}]

    if not options:
        options = [{"label": "Option 1", "lyrics": raw_text}]

    return commentary, options


def _fallback_suggestion(prompt: PromptInput) -> tuple[list[str], list[dict[str, str]]]:
    message = prompt.user_message.strip()
    commentary_text = message if message else "Consider refining this section."
    suffix = (
        f"<p><em>Assistant note:</em> {escape(message)}</p>"
        if message
        else "<p><em>Assistant note:</em> Consider refining this section.</p>"
    )

    if suffix in prompt.document_content:
        lyrics_html = prompt.document_content
    else:
        lyrics_html = prompt.document_content + suffix

    return (
        [commentary_text],
        [
            {
                "label": "Option 1",
                "lyrics_text": strip_html(lyrics_html),
                "lyrics_html": lyrics_html,
            }
        ],
    )
