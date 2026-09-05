# ADR 0001: Service Boundaries and Repository Analysis Architecture

Status: proposed.

## Context

The platform must ingest untrusted repositories, analyze source code across languages, generate graphs and documentation, detect risks, and answer codebase questions. The required stack includes React, Express, Prisma, PostgreSQL, Redis, BullMQ, FastAPI, Tree-sitter, GitPython, NetworkX, a configurable OpenAI SDK provider, Docker, Docker Compose, and Nginx.

Repository analysis is CPU-heavy, IO-heavy, security-sensitive, and often slow. It must not run inside request-response handlers.

## Decision

Use a monorepo with four primary runtime applications:

- React web app for the SaaS interface.
- Node.js Express API for auth, RBAC, request validation, audit logging, domain APIs, and job orchestration.
- Node.js BullMQ worker for repository intake, staging, lifecycle management, retries, and coordination.
- Python FastAPI AI analysis service for parsing, graph construction, embeddings, retrieval, and AI-assisted generation.

Use PostgreSQL as the transactional database and semantic vector store through `pgvector`. Use Redis for BullMQ, rate limiting, and short-lived coordination.

## Consequences

Positive:

- Request handling stays responsive.
- Python analysis libraries remain isolated from the TypeScript domain services.
- Repository content can be staged and analyzed through controlled job boundaries.
- Snapshot-based analysis supports reproducibility, caching, and auditability.
- `pgvector` reduces infrastructure count for the first production version.

Negative:

- The system needs cross-service observability from the beginning.
- Local development requires multiple runtimes.
- Shared contracts must be curated carefully to avoid tight coupling.
- Python and TypeScript packaging must both be maintained.

## Alternatives Considered

Single Node.js service:

- Rejected because Python has stronger support for Tree-sitter workflows, graph analysis, and AI analysis tooling. It would also place expensive analysis too close to request handling.

Single Python service:

- Rejected because the required stack includes Express, Prisma, BullMQ, and a React-oriented TypeScript contract workflow. Node remains a strong fit for SaaS API orchestration.

Separate vector database:

- Deferred. `pgvector` is sufficient for the initial production architecture and keeps tenant filtering, snapshots, and vector search in one transactional system.

Synchronous analysis API:

- Rejected because clone, upload, parsing, embedding, and documentation generation are long-running operations with failure and retry requirements.

