# Development Setup

## Prerequisites

- Node.js 22 or newer.
- npm 11 or newer.
- Docker with Docker Compose.
- Python 3.12 for local AI service development outside Docker.

## Environment

Copy `.env.example` to `.env` and replace secrets with random values of at least 32 characters:

- `SESSION_SECRET`
- `INTERNAL_JOB_TOKEN_SECRET`
- `OPENAI_API_KEY` when AI provider calls are enabled in a later phase.
- `WORKSPACE_ROOT` for local ingestion staging (defaults to `./data/workspaces`).

See `docs/development/testing-guide.md` for a full manual test walkthrough.

## Local Services

Start infrastructure and application containers:

```bash
docker compose up --build
```

Run Node validation locally:

```bash
npm install
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run test
npm run build
```

Run Python validation locally:

```bash
cd services/ai
python -m pip install ".[dev]"
ruff check .
mypy app
pytest
```

## URLs

- Web app: `http://localhost:5173`
- API health: `http://localhost:4000/healthz`
- Worker health: `http://localhost:4100/healthz`
- AI service health: `http://localhost:8000/healthz`
- Nginx gateway: `http://localhost:8080`

