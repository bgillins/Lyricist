# Lyricist Backend

FastAPI backend for the Lyricist prototype. Uses file-backed persistence for now so we can iterate on the canvas editor quickly before wiring in PostgreSQL.

## Setup

Install dependencies with [`uv`](https://docs.astral.sh/uv/):

```bash
uv sync
```

This creates a local virtual environment at `.venv` with FastAPI and Uvicorn.

Copy the provided example environment file and add your OpenAI credentials when we hook
up the live integration:

```bash
cp .env.example .env
# edit .env with your OPENAI_API_KEY and preferred OPENAI_MODEL
```

## Development Server

Start the API with autoreload:

```bash
uv run python main.py
```

This exposes the service on `http://127.0.0.1:8000`. Key routes:

- `GET /health` — service heartbeat.
- `GET /documents/{id}` — fetch a lyric document (404 if it has not been saved yet).
- `PUT /documents/{id}` — create or update a document body (creates a new version).
- `GET /documents/{id}/versions` — list saved revisions for that document (newest first).
- `GET /documents/{id}/versions/{version_id}` — fetch the full contents of a specific revision.
- `POST /documents/{id}/revert` — restore a revision (creates a new head version with that content).
- `POST /chat/{id}` — (prototype) generate a suggestion and diff against the current canvas content.
- Chat responses return structured JSON: commentary bullet points plus revised lyrics (no prose mixed in), ensuring the frontend can diff lyrics cleanly before applying them.
- `DELETE /documents` — clear all stored documents and versions (destructive).

Documents are stored as JSON under `data/documents/`. Each save writes a timestamped
version in `versions/` alongside a `current.json` pointer until we wire up Postgres
in a later iteration.

### Code Structure

- `app/routers/` groups FastAPI routes by feature (`documents`, `chat`).
- `app/services/` houses prompt construction, diff helpers, and future OpenAI clients.
- `app/models/` provides lightweight dataclasses shared across services.
