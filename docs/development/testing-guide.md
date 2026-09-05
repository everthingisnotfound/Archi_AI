# Testing Guide

This guide explains how to run **AI Software Archaeologist** locally and verify each pipeline stage.

## What the platform does today

| Phase | Capability |
|-------|------------|
| Foundation | Auth, RBAC, Docker stack, CI tooling |
| Phase 03 | Real ingestion (GitHub / ZIP / folder), snapshots, file tree |
| Phase 04 | Tree-sitter static analysis, symbols, import graph, code chunks |
| Phase 05 | Embeddings, repo summary, secret findings, semantic chat |

Pipeline per repository:

1. **Ingestion** → clone/extract, scan files, create snapshot
2. **Static analysis** → symbols, dependency edges, chunks, graph
3. **Enrichment** → embeddings + summary + security findings
4. **Chat** → ask questions with retrieved code context

---

## Prerequisites

- Docker Desktop with Compose
- Node.js 22+ and npm 11+ (optional, for local lint/test)
- An OpenAI API key (optional but recommended for embeddings, summaries, and chat)

---

## One-time setup

From the project root:

```powershell
cd "D:\coding folders\Archi_ai"
copy .env.example .env
```

Edit `.env` and set at minimum:

```env
SESSION_SECRET=replace-with-at-least-32-random-characters-here
INTERNAL_JOB_TOKEN_SECRET=replace-with-another-32-char-secret-value
OPENAI_API_KEY=sk-your-key-here
```

`OPENAI_API_KEY` is optional. Without it:

- Ingestion and static analysis still work
- Secret scanning still runs
- AI summary, embeddings, and chat fall back to basic/deterministic behavior

---

## Start the full stack (recommended)

```powershell
docker compose up --build
```

Wait until these are healthy:

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:4000/healthz |
| Worker | http://localhost:4100/healthz |
| AI service | http://localhost:8000/healthz |
| Gateway | http://localhost:8080 |

First boot also runs Postgres migrations via the API/worker Prisma clients.

---

## Manual test flow (UI)

### 1. Register and sign in

1. Open http://localhost:5173
2. Go to **Sign in** → register a new account (creates an organization)
3. You land on the **Repositories** page

### 2. Add a repository

**Easiest option — public GitHub repo:**

```
https://github.com/octocat/Hello-World
```

Or upload a small ZIP / folder of your own code.

You are redirected to the repository detail page.

### 3. Watch the pipeline

On the detail page, poll until statuses settle:

| Stage | Badge / section | Expected |
|-------|-----------------|----------|
| Ingestion | Ingestion job | `SUCCEEDED`, file tree appears |
| Static analysis | Static analysis | stage moves through parsing/graphing |
| Enrichment | Analysis status | stage `COMPLETED`, summary + findings |
| Graph | Dependency graph | node/edge counts |
| Chat | Ask this repository | enabled after enrichment |

Typical timeline for a small repo: 30 seconds – 3 minutes.

### 4. Verify intelligence features

- **File tree** — indexed paths with languages
- **Detected stack** — languages / technologies badges
- **Dependency graph** — node and edge counts
- **Repository summary** — markdown document (AI-written if key set)
- **Findings** — secret-pattern hits if any exist in source
- **Chat** — ask e.g. “What is the main entry point?” or “Summarize the architecture”

---

## Manual test flow (API)

After registering in the UI (session cookie required), you can hit:

```http
GET  /repositories/{id}
GET  /repositories/{id}/snapshots/{snapshotId}/files
GET  /repositories/{id}/snapshots/{snapshotId}/graph
GET  /repositories/{id}/snapshots/{snapshotId}/documents
GET  /repositories/{id}/snapshots/{snapshotId}/findings
POST /repositories/{id}/chat/sessions
POST /repositories/{id}/chat/sessions/{sessionId}/messages
```

Use browser devtools to copy the session cookie, or test through the UI.

---

## Local development without Docker

Run infrastructure only:

```powershell
docker compose up postgres redis -d
```

Then in separate terminals:

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run dev:api
npm run dev:worker
npm run dev:web
```

AI service:

```powershell
cd services/ai
python -m pip install ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Set in `.env`:

```env
DATABASE_URL=postgresql://archaeologist:archaeologist@localhost:5432/archaeologist?schema=public
REDIS_URL=redis://localhost:6379
WORKSPACE_ROOT=./data/workspaces
AI_SERVICE_URL=http://localhost:8000
```

---

## Run automated checks

```powershell
npm run typecheck
npm run test
npm run build
```

Python (from `services/ai`, Python 3.12 recommended):

```powershell
python -m pip install ".[dev]"
ruff check .
mypy app
pytest
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Ingestion stuck on `RUNNING` | Worker not running | `docker compose logs worker` |
| Analysis never completes | AI service down | `docker compose logs ai` |
| Chat says API key missing | No `OPENAI_API_KEY` | Add key to `.env`, restart compose |
| GitHub clone fails | Network / private repo | Use public HTTPS URL or ZIP upload |
| Empty embeddings | No OpenAI key or zero chunks | Add key; ensure repo has source files |

Logs:

```powershell
docker compose logs -f worker api ai
```

---

## Suggested test repositories

| Repo | Why |
|------|-----|
| `https://github.com/octocat/Hello-World` | Tiny, fast smoke test |
| A small personal Node or Python project | Exercises symbols + imports |
| A ZIP of this monorepo (excluding `node_modules`) | Richer graph and findings |

---

## What is not implemented yet

- Interactive graph visualization canvas
- Full OWASP / dependency CVE scoring
- AI-generated API docs and onboarding guides
- OAuth, production deployment, E2E test suite

Those are planned for later phases.
