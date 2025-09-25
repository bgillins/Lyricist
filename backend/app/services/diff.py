from __future__ import annotations

from difflib import SequenceMatcher

from ..schemas import DiffChunk


def diff_chunks(original: str, revised: str) -> list[DiffChunk]:
    matcher = SequenceMatcher(a=original, b=revised)
    chunks: list[DiffChunk] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            text = revised[j1:j2]
            if text:
                chunks.append(DiffChunk(type="equal", text=text))
        elif tag == "replace":
            removed = original[i1:i2]
            added = revised[j1:j2]
            if removed:
                chunks.append(DiffChunk(type="delete", text=removed))
            if added:
                chunks.append(DiffChunk(type="insert", text=added))
        elif tag == "delete":
            text = original[i1:i2]
            if text:
                chunks.append(DiffChunk(type="delete", text=text))
        elif tag == "insert":
            text = revised[j1:j2]
            if text:
                chunks.append(DiffChunk(type="insert", text=text))
    return chunks
