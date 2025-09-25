from __future__ import annotations

import html
import re


def normalize_selection(selection: str) -> str:
    cleaned = selection.strip()
    if not cleaned:
        return ""
    return html.unescape(cleaned)


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    no_tags = _HTML_TAG_RE.sub(" ", raw_html)
    return html.unescape(" ".join(no_tags.split()))
