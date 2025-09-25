from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .schemas import Document, DocumentVersion


class DocumentStore:
    """Simple JSON file-backed storage for lyric documents."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or Path(__file__).resolve().parent.parent / "data" / "documents"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_id(self, document_id: str) -> str:
        safe_id = document_id.strip()
        if not safe_id:
            raise ValueError("document_id must not be empty")
        return safe_id

    def _path_for(self, document_id: str) -> Path:
        return self._base_dir / self._safe_id(document_id)

    def _current_path(self, document_id: str) -> Path:
        return self._path_for(document_id) / "current.json"

    def _versions_path(self, document_id: str) -> Path:
        return self._path_for(document_id) / "versions"

    def _legacy_file_path(self, document_id: str) -> Path:
        return self._base_dir / f"{self._safe_id(document_id)}.json"

    def _migrate_legacy_document(self, document_id: str) -> Document | None:
        legacy_path = self._legacy_file_path(document_id)
        if not legacy_path.exists():
            return None

        with legacy_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        content = payload.get("content", "")
        # Clean up legacy artifact before rewriting to avoid recursive loops if save fails.
        try:
            legacy_path.unlink()
        except FileNotFoundError:
            pass
        return self.save(document_id, content)

    def load(self, document_id: str) -> Document:
        path = self._current_path(document_id)
        if not path.exists():
            migrated = self._migrate_legacy_document(document_id)
            if migrated is not None:
                return migrated
            raise FileNotFoundError(document_id)
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return Document.model_validate(payload)

    def get_version(self, document_id: str, version_id: str) -> DocumentVersion:
        versions_dir = self._versions_path(document_id)
        version_path = versions_dir / f"{version_id}.json"
        if not version_path.exists():
            raise FileNotFoundError(version_id)
        with version_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return DocumentVersion.model_validate(payload)

    def save(self, document_id: str, content: str) -> Document:
        document_dir = self._path_for(document_id)
        versions_dir = self._versions_path(document_id)
        versions_dir.mkdir(parents=True, exist_ok=True)

        now = datetime.now(timezone.utc)
        version_id = now.strftime("%Y%m%dT%H%M%S%fZ")

        version = DocumentVersion(
            id=version_id,
            document_id=document_id,
            content=content,
            created_at=now,
        )

        version_path = versions_dir / f"{version_id}.json"
        with version_path.open("w", encoding="utf-8") as handle:
            json.dump(version.model_dump(mode="json"), handle, ensure_ascii=False, indent=2)

        document_dir.mkdir(parents=True, exist_ok=True)
        document = Document(
            id=document_id,
            content=content,
            updated_at=now,
            version_id=version_id,
        )
        current_path = self._current_path(document_id)
        with current_path.open("w", encoding="utf-8") as handle:
            json.dump(document.model_dump(mode="json"), handle, ensure_ascii=False, indent=2)

        return document

    def list_versions(self, document_id: str) -> list[DocumentVersion]:
        versions_dir = self._versions_path(document_id)
        if not versions_dir.exists():
            migrated = self._migrate_legacy_document(document_id)
            if migrated is not None:
                return self.list_versions(document_id)
            # If there's no current document either, surface missing-id semantics.
            if not self._current_path(document_id).exists():
                raise FileNotFoundError(document_id)
            return []

        versions: list[DocumentVersion] = []
        for file_path in versions_dir.glob("*.json"):
            with file_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            versions.append(DocumentVersion.model_validate(payload))

        versions.sort(key=lambda item: item.created_at, reverse=True)
        return versions

    def clear(self) -> None:
        if self._base_dir.exists():
            shutil.rmtree(self._base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def restore(self, document_id: str, version_id: str) -> Document:
        version = self.get_version(document_id, version_id)
        return self.save(document_id, version.content)
