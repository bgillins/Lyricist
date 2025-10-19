# Project Context

## Purpose
Lyricist is a local-first lyric writing canvas that combines structured editing with AI-assisted revisions. The prototype targets songwriters who want to capture sections such as Verse or Chorus, experiment with alternatives, and preserve a revision history while working offline-first and syncing to a FastAPI service when available.
The product delivers a TipTap-powered editor with inline AI feedback, a timestamped version feed, and a Suno-style tag picker so writers can iterate quickly without losing prior ideas.

## Tech Stack
- Frontend: Next.js 15 (App Router) with React 19, TypeScript 5, Turbopack dev server, and TipTap editor bindings.
- Styling: global CSS authored under `src/app/globals.css`; no CSS-in-JS framework.
- Backend: Python 3.13 FastAPI application served via Uvicorn with Pydantic models and dependency management through `uv`.
- Persistence: JSON files stored under `backend/data/` for documents, versions, and chat transcripts (PostgreSQL planned later).
- AI integration: OpenAI Python SDK (async via `run_in_threadpool`) with a graceful offline stub when credentials are absent.

## Project Conventions

### Code Style
- TypeScript runs in `strict` mode with the `@/*` path alias; client components must declare `"use client"` at the top.
- React components favor hooks and local state, grouping shared logic under `src/hooks/` or `src/features/`.
- Python code is fully type hinted, leans on Pydantic schemas for request/response validation, and raises FastAPI `HTTPException` for error paths.
- Shared backend logic lives in `app/services/` (prompt building, diffing, OpenAI client) while routers stay skinny.

### Architecture Patterns
- Frontend uses a feature-first layout: reusable UI in `src/components/`, domain logic and hooks in `src/features/`, and static datasets in `src/data/` (e.g., Suno tag catalog).
- `LyricCanvas` orchestrates document fetching, TipTap editor state, version history, and composes the chat dock plus diff previewer.
- Chat interactions flow through `useChatSession`, which posts to `/chat/{document_id}` and normalizes assistant payloads before rendering.
- Backend groups FastAPI routers by domain (`documents`, `chat`), isolates persistence in `DocumentStore` and `ChatHistoryStore`, and keeps OpenAI-specific work behind `services/chat_service.py`.
- HTML is the source of truth for lyric content so diffing and selective merges (section-level updates) operate on markup rather than raw text.

### Testing Strategy
- No automated suites yet; developers exercise flows via `npm run dev` and `uv run python main.py` while iterating.
- When adding backend logic, prefer fast unit or API tests with `pytest` once introduced; mirror key happy-paths for documents, versions, and chat fallbacks.
- Frontend work should include storybook-style manual checks today, with plans to add Playwright or React Testing Library when the UI stabilizes.
- Document ad-hoc test steps in PRs until formal tooling is in place.

### Git Workflow
- Use topic branches per change, keep them short-lived, and rebase on `main` before opening PRs.
- Reference the relevant OpenSpec change (proposal or task) in the PR description and commit messages when applicable.
- Favor imperative commit summaries ("Add lyric merge helper") and keep commits focused; avoid mixing backend and frontend work unless tightly coupled.
- Run linters (`npm run lint`) and basic smoke checks locally prior to pushing.

## Domain Context
Lyricist centers on songwriting workflows: documents are segmented into labeled sections (Verse, Chorus, Bridge, etc.), often tagged using the bundled Suno AI taxonomy to guide downstream models. Writers expect to toggle between current lyrics, prior revisions, and AI-generated options while preserving any manual tweaks. The assistant returns commentary plus diff chunks, enabling selective adoption of suggestions without overwriting unrelated sections.

## Important Constraints
- Local JSON storage is authoritative for now; deleting `backend/data/` erases all documents and chat history.
- `OPENAI_API_KEY` and `OPENAI_MODEL` configure live completions—without them the backend supplies deterministic fallback suggestions, so callers must tolerate both paths.
- CORS is limited to `http://localhost:3000` and `http://127.0.0.1:3000`; update this list before deploying elsewhere.
- Document IDs must be URL-safe strings; blank IDs raise `400` errors from `DocumentStore`.
- Frontend assumes lyrics are HTML paragraphs; merging logic relies on heading patterns (e.g., `Chorus:`) when applying assistant options.
- `NEXT_PUBLIC_API_BASE_URL` controls which API endpoint the frontend targets; defaults to the local FastAPI URL.

## External Dependencies
- OpenAI Chat Completions API for AI-generated suggestions (optional but primary integration).
- Browser fetch to the internal FastAPI service (`/documents`, `/chat`) for persistence and collaboration features.
- TipTap (ProseMirror) editor stack for rich-text editing and section parsing.
- `uv` (Python) and `npm`/`node` tooling for local development environments.
