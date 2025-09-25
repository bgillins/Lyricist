from __future__ import annotations

import html


def normalize_selection(selection: str) -> str:
    cleaned = selection.strip()
    if not cleaned:
        return ""
    return html.unescape(cleaned)
