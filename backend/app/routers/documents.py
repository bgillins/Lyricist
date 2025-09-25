from fastapi import APIRouter, HTTPException

from ..schemas import (
    Document,
    DocumentRevertRequest,
    DocumentUpdate,
    DocumentVersion,
)
from ..storage import DocumentStore

router = APIRouter(prefix="/documents", tags=["documents"])

store = DocumentStore()


@router.get("/{document_id}", response_model=Document)
async def read_document(document_id: str) -> Document:
    try:
        return store.load(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Document not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{document_id}", response_model=Document)
async def upsert_document(document_id: str, payload: DocumentUpdate) -> Document:
    try:
        return store.save(document_id, payload.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{document_id}/versions", response_model=list[DocumentVersion])
async def document_versions(document_id: str) -> list[DocumentVersion]:
    try:
        return store.list_versions(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Document not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{document_id}/versions/{version_id}", response_model=DocumentVersion
)
async def document_version(document_id: str, version_id: str) -> DocumentVersion:
    try:
        return store.get_version(document_id, version_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Version not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{document_id}/revert", response_model=Document)
async def revert_document(
    document_id: str, payload: DocumentRevertRequest
) -> Document:
    try:
        return store.restore(document_id, payload.version_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Version not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("", status_code=204)
async def clear_documents() -> None:
    store.clear()
