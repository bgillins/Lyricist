  # Codex Product Definition Report

  ## Vision
  Local-only web prototype that mirrors an “OpenAI Canvas” experience for lyric crafting, GPT collaboration, and granular revision control. Frontend in Next.js 14 (App Router + TypeScript + TipTap editor) and backend in FastAPI (Python 3.11) with PostgreSQL persistence.

  ## Success Criteria
  - Users compose/edit lyrics in a structured canvas with drag-in segment templates.
  - GPT chat panel generates revisions with diffs and revert capability.
  - Keyword bubbles and song metadata (key, BPM, mood, etc.) enrich prompts.
  - Export lyrics as Markdown or plain text (with metadata frontmatter for Markdown).
  - Clean, modular codebase with only vetted dependencies.

  ## Functional Scope

  ### Lyric Canvas
  - TipTap-based rich editor.
  - Custom nodes for segment markers.
  - Inline selection capture for GPT requests.
  - Visual indicators for applied segment templates.

  ### Segment Palette
  - Left rail library of predefined templates (Intro, Verse, Chorus, Bridge, Outro, Instrumental).
  - Configurable via JSON folders.
  - Drag-and-drop inserts snippet plus metadata tag.

  ### Chat Dock
  - Right/bottom panel with message thread per document.
  - Displays system prompt (view/edit).
  - GPT responses show before/after diff.
  - Actions to apply, discard, or fork into a new version.

  ### Keyword Bar
  - Horizontal scroll of taxonomy bubbles (genre, vibe, emotions, instruments).
  - Clicking toggles inclusion; selected tags stored in document metadata and used in GPT context.

  ### Metadata Panel
  - Modal or sheet exposing structured fields: Key (dropdown A–G with sharps/flats), BPM (numeric), Time Signature, Mood, Vocal Range, Export format.
  - Values included in GPT prompt assembly.

  ### Revision History
  - Timeline including GPT and manual checkpoints.
  - Diff view vs current state, with revert/restore actions and annotations.

  ### Highlight-to-GPT Flow
  - Context menu on selection (Revise, Explain, Strengthen Rhyme).
  - Backend sends full lyric plus highlighted excerpt, metadata, and labeled “Past Requests”; avoids resending entire chat history.

  ### Exports
  - Download current lyric as `.md` or `.txt`.
  - Markdown export includes frontmatter with metadata.

  ### Prompt Assets
  - Persisted system prompts per document.
  - Taxonomy files for segments/keywords stored in repo for easy extension.

  ## Non-Functional Requirements
  - Modular architecture (frontend feature folders; backend routers: `documents`, `revisions`, `prompts`, `taxonomy`; shared schema definitions).
  - Local-only secrets via `.env`; no external hosting.
  - No automatic dependency updates; manual vetting of each package (activity, advisories, maintainers).
  - OpenAI error handling with retries/backoff and user-facing messaging.
  - Structured JSON logging for GPT requests/results; diagnostics behind env flag.
  - Basic accessibility (keyboard navigation, aria labels, contrast).

  ## Architecture Overview

  ### Frontend
  - Next.js 14 App Router, TypeScript.
  - Tailwind CSS + Radix UI primitives.
  - TipTap editor.
  - Zustand for feature-local state management.
  - React Query for client/server data fetching.
  - SSE support for streaming GPT responses.

  ### Backend
  - FastAPI with Uvicorn.
  - SQLAlchemy 2.0 ORM + Alembic migrations.
  - Pydantic models for request/response validation.
  - HTTPX for OpenAI calls; Tenacity for retries.
  - Diff Match Patch for server-side diff generation.

  ### Database (PostgreSQL)
  - Runs via Docker Compose.
  - Schema designed to support future multi-user collaboration.

  ### OpenAI Integration
  - Configurable model (default `gpt-4.1-mini`).
  - Streaming completions.
  - System prompt templates in DB.
  - Highlight context appended per request.

  ## Data Model Sketch
  - `users`: id, email (nullable), api_key_ref.
  - `documents`: id, title, slug, current_version_id, metadata JSON (key, bpm, keywords[], mood, time_signature, vocal_range).
  - `document_versions`: id, document_id, created_at, created_by, source (`manual`, `gpt`), summary, diff_patch, content (text/markdown), metadata_snapshot.
  - `gpt_sessions`: id, document_id, system_prompt, created_at, status.
  - `gpt_messages`: id, session_id, role (`user`, `assistant`, `system`), prompt_excerpt, full_prompt_hash, response_text, version_id.
  - `taxonomy_segments`: id, label, slug, snippet, category, order.
  - `taxonomy_keywords`: id, label, slug, category, order, description.

  ## API Contract (Initial)
  - `GET /api/documents` – list documents (supports search/filter).
  - `POST /api/documents` – create blank document with default prompt.
  - `GET /api/documents/{id}` – fetch document + metadata.
  - `PUT /api/documents/{id}` – update metadata, selected keywords, export prefs.
  - `POST /api/documents/{id}/checkpoint` – manual save; returns new version id.
  - `GET /api/documents/{id}/versions` – list timeline entries.
  - `POST /api/documents/{id}/revert` – set current version to specified revision.
  - `POST /api/documents/{id}/gpt` – body `{ selectionRange, requestType, instructions }`; streams GPT response and diff metadata.
  - `GET /api/taxonomy/segments` – returns segment definitions.
  - `GET /api/taxonomy/keywords` – returns keyword definitions.
  - `PUT /api/documents/{id}/system-prompt` – update stored system prompt.
  - `GET /api/documents/{id}/export?format=md|txt` – download lyric export.

  ## Frontend Module Plan
  - `app/(dashboard)/documents/[slug]/page.tsx` – orchestrates document view (data fetching + layout).
  - `components/editor/LyricCanvas.tsx` – TipTap instance with custom extensions.
  - `components/palette/SegmentPalette.tsx` – taxonomy loader + drag/drop integration.
  - `components/chat/ChatDock.tsx` – thread list, composer, diff actions.
  - `components/revisions/RevisionTimeline.tsx` – timeline visualization.
  - `components/keywords/KeywordScroller.tsx` – bubble toggles tied to taxonomy.
  - `components/metadata/MetadataSheet.tsx` – metadata editing UI.
  - `components/diff/DiffViewer.tsx` – visual diff rendering.
  - `lib/api/client.ts` – HTTP client wrapper (axios or fetch-based).
  - `lib/prompts/template.ts` – TypeScript helpers for prompt payloads.

  ## Dependency Vetting List (to approve before install)
  Verify activity, maintainers, and advisories before adoption.

  ### Frontend
  - `next`, `react`, `react-dom`
  - `typescript`, `tsx`, `eslint`, `@typescript-eslint/*`, `prettier`
  - `tailwindcss`, `postcss`, `autoprefixer`
  - `@radix-ui/react-*`
  - `class-variance-authority`, `clsx`
  - `lucide-react`
  - `@tanstack/react-query`
  - `zustand`, `immer`
  - `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`
  - `@dnd-kit/core`
  - `zod`
  - `date-fns`

  ### Backend
  - `fastapi`
  - `uvicorn[standard]`
  - `sqlalchemy`
  - `alembic`
  - `psycopg[binary]`
  - `pydantic`
  - `httpx`
  - `tenacity`
  - `python-dotenv`
  - `diff-match-patch`

  ### Testing & Tooling
  - `pytest`, `pytest-asyncio`
  - `respx`
  - `ruff`, `black`, `mypy`
  - `pre-commit`

  ### Docker Images
  - `python:3.11-slim`
  - `postgres:15-alpine`

  ## Step-by-Step Execution Plan
  1. **Environment Prep**
     - Install Node 20 LTS, pnpm/npm, Python 3.11, Docker Desktop, Postgres client.
     - Initialize repo structure (`frontend`, `backend`, `infrastructure`).

  2. **Frontend Bootstrap**
     - Run `npx create-next-app@latest --typescript --eslint --app`.
     - Configure Tailwind, ESLint, Prettier, TS path aliases.
     - Install vetted packages; lock versions.
     - Scaffold base layout with palette, canvas, chat docks.

  3. **Backend Setup**
     - Initialize FastAPI project with modular routers.
     - Configure dependency management (pip-tools or poetry); add `.env.example`.
     - Define SQLAlchemy models; generate first Alembic migration.
     - Build taxonomy endpoints loading JSON seed files.

  4. **Shared Contracts**
     - Define Pydantic schemas for documents, versions, GPT payloads.
     - Generate matching TypeScript interfaces (manual or codegen).

  5. **GPT Integration**
     - Implement prompt builder (system template + metadata + selection context).
     - Add streaming endpoint using `httpx.AsyncClient`.
     - Compute diff vs current version; persist version/message metadata.

  6. **Frontend Features**
     - Integrate TipTap editor with custom segment extensions.
     - Implement drag/drop palette, metadata sheet, keyword bubbles.
     - Connect ChatDock to backend via SSE for streaming responses.
     - Build revision timeline UI with diff viewer.

  7. **Persistence & Revisions**
     - Wire React Query mutations for saves, GPT responses, reverts.
     - Ensure document state updates track current version pointer.
     - Implement export modal calling backend endpoint.

  8. **Testing & QA**
     - Backend unit tests (prompt builder, diff generator, API routes).
     - Frontend component tests (Testing Library, Vitest) + integration smoke tests.
     - Manual verification of highlight-to-GPT flow, revision revert, metadata updates.

  9. **Security & Vetting**
     - Review third-party licenses/security advisories.
     - Run `npm audit` and `pip-audit`; document results.
     - Document dependency vetting policy; disable auto-update bots.

  10. **Documentation**
      - README with overview, setup, vetting process, security notes, usage instructions.
      - Developer docs for taxonomy updates, prompt templates, testing instructions.

  ## Testing Strategy
  - Local CI pipeline (linting, type checks, tests) for both frontend and backend.
  - Backend tests with ephemeral Postgres (testcontainers or docker-compose).
  - Snapshot tests for diff outputs.
  - Manual regression checklist (GPT request flows, metadata inclusion, exports).

  ## Risks & Mitigations
  - **Package compromise**: strict vetting, pinned versions, monitor advisories.
  - **Editor complexity**: start minimal; encapsulate extensions for future swaps.
  - **Prompt drift**: store system prompt snapshots; expose edit history.
  - **Diff inaccuracies**: validate algorithms; allow raw response inspection.

  ## Future Extensions
  - Real-time collaboration (WebSockets, CRDT/OT).
  - Authentication and role-based access.
  - Audio reference attachments and DAW exports.
  - Prompt template editor UI.
  - Usage analytics dashboards.