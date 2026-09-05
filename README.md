# Archi AI

> **AI-powered software archaeology for understanding unfamiliar codebases.**

Archi AI turns a software repository — or a public website — into an explorable, evidence-backed engineering model.

Instead of throwing an entire codebase at an LLM and asking it to "understand the project", Archi AI follows a different approach:

**ingest → snapshot → analyze deterministically → build structure → enrich → retrieve → explain with AI**

The result is a platform that can answer questions such as:

- What is actually inside this codebase?
- What languages and technologies does it use?
- How are its files and dependencies connected?
- What are the important symbols and code paths?
- Where are the security risks?
- What would a developer need to know to work on it?
- What would an attacker or competitor learn from the repository?
- Can I ask questions about the codebase using repository-aware context?

The core principle is simple:

> **AI should interpret evidence, not invent the system.**

---

## Contents

- [What is Archi AI?](#what-is-archi-ai)
- [Why this exists](#why-this-exists)
- [Core philosophy](#core-philosophy)
- [What it can do](#what-it-can-do)
- [Architecture](#architecture)
- [End-to-end pipeline](#end-to-end-pipeline)
- [Repository structure](#repository-structure)
- [Analysis engine](#analysis-engine)
- [AI and semantic retrieval](#ai-and-semantic-retrieval)
- [Threat Briefing](#threat-briefing)
- [Website analysis](#website-analysis)
- [Security model](#security-model)
- [Technology stack](#technology-stack)
- [Data model](#data-model)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Docker](#docker)
- [Database](#database)
- [Useful commands](#useful-commands)
- [API overview](#api-overview)
- [Testing and quality](#testing-and-quality)
- [Design decisions](#design-decisions)
- [Current capabilities vs. target architecture](#current-capabilities-vs-target-architecture)
- [Limitations](#limitations)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

# What is Archi AI?

**Archi AI is a software archaeology platform.**

When you inherit a large or unfamiliar codebase, the hardest part usually isn't writing code.

It's understanding:

```text
Where does the application start?
        ↓
How does data move?
        ↓
Which modules depend on which?
        ↓
Where is the business logic?
        ↓
Which parts are security-sensitive?
        ↓
What infrastructure does it rely on?
        ↓
What can break?
        ↓
What should I change first?
```

Archi AI is designed to automate that discovery process.

It accepts a software project, creates a versioned snapshot, analyzes its structure, stores the resulting knowledge, and exposes that knowledge through a web interface and AI-assisted workflows.

---

# Why this exists

Traditional code assistants are extremely good at answering questions about code that you already understand.

They become much less reliable when asked to understand an entire unfamiliar system.

A naive architecture looks like:

```text
Repository
    ↓
LLM
    ↓
"Here's what your project does"
```

Archi AI deliberately avoids making the LLM the primary source of truth.

Instead:

```text
                    Repository
                        │
                        ▼
                  Secure ingestion
                        │
                        ▼
                Immutable snapshot
                        │
                        ▼
             Deterministic analysis
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
        Files        Symbols      Dependencies
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  Knowledge model
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
           Graph      Chunks     Findings
             │          │          │
             └──────────┼──────────┘
                        ▼
                  Semantic retrieval
                        │
                        ▼
                     AI layer
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
         Chat       Documents   Threat Briefing
```

This separation makes AI output more grounded, reproducible, and auditable.

---

# Core philosophy

Archi AI is built around several principles.

### 1. Evidence before interpretation

Static analysis should discover what exists before AI tries to explain why it exists.

### 2. Snapshots over mutable state

Analysis should refer to a known repository state.

A branch can change.

A snapshot gives analysis a concrete boundary.

### 3. AI is not the source of truth

The AI should only make claims supported by retrieved repository evidence.

If the evidence is insufficient, the correct answer is:

> "The available context is insufficient."

not a fabricated explanation.

### 4. Repository content is hostile input

Repositories can contain:

- malicious archives
- path traversal payloads
- enormous files
- unexpected binary content
- secrets
- malformed source
- adversarial text intended to manipulate an AI system

Repository content is therefore treated as **untrusted data**.

### 5. Expensive work belongs outside HTTP requests

Repository cloning, extraction, parsing, embedding generation, enrichment and deeper analysis run asynchronously through background workers.

---

# What it can do

## Repository ingestion

Archi AI currently supports repository ingestion through:

- GitHub repository URLs
- ZIP uploads
- browser folder uploads

The API validates the source and creates an ingestion job before handing the expensive work to the worker layer.

---

## Static code analysis

The analysis service can extract structural information such as:

- files
- languages
- symbols
- functions
- classes
- interfaces
- methods
- types
- imports
- package dependencies
- dependency edges
- code chunks
- basic analysis metrics

The current Tree-sitter integration supports:

- Python
- JavaScript
- TypeScript
- PHP

The analyzer also understands dependency manifests such as:

- `package.json`
- `composer.json`

and skips selected binary file types during source analysis.

---

## Dependency understanding

Archi AI builds relationships between source files and declared dependencies.

Conceptually:

```text
src/api/users.ts
        │
        ├──── imports ────► src/services/userService.ts
        │
        └──── imports ────► express

package.json
        │
        ├──── dependency ─► express
        ├──── dependency ─► zod
        └──── dependency ─► prisma
```

These relationships become part of the repository's persisted knowledge.

---

## Dependency graph

Archi AI persists graph information that can be surfaced through the web application.

The graph is useful for questions such as:

- What depends on this module?
- What does this module depend on?
- Which parts of the application are highly connected?
- Where are external dependencies entering the system?
- Which files form important architectural boundaries?

---

## Security findings

Security analysis is not purely LLM-generated.

The system contains deterministic security scanning and can surface findings associated with:

- repository secret patterns
- website security headers
- cookie security attributes
- other observed security signals

Findings retain information such as:

- severity
- category
- title
- description
- file/path
- line range
- risk explanation
- remediation

---

## AI-generated summaries

When an AI provider is configured, Archi AI can enrich deterministic analysis with an AI-generated project summary.

When AI is unavailable, the system can fall back to a deterministic summary instead of failing the entire analysis pipeline.

---

## Repository-aware AI chat

Users can ask questions about an analyzed repository.

The AI service receives retrieved code context rather than unrestricted access to the entire project.

The intended flow is:

```text
User question
      ↓
Repository context
      ↓
Relevant code chunks
      ↓
AI completion
      ↓
Answer with file references
```

The AI layer is instructed to explicitly state when the available context is insufficient.

---

# Architecture

Archi AI is a multi-service monorepo.

```text
                         ┌───────────────────┐
                         │      Browser      │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    React Web App  │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │ Node.js / Express │
                         │       API         │
                         └──────┬──────┬─────┘
                                │      │
                         database      jobs
                                │      │
                                ▼      ▼
                       ┌──────────┐  ┌──────────┐
                       │Postgres  │  │  Redis   │
                       │+ pgvector│  │ + BullMQ │
                       └──────────┘  └─────┬────┘
                                           │
                                           ▼
                                  ┌────────────────┐
                                  │ Node.js Worker │
                                  └───────┬────────┘
                                          │
                                          ▼
                                ┌──────────────────┐
                                │ Python / FastAPI │
                                │   AI Service     │
                                └───────┬──────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                      Tree-sitter   NetworkX       LLM
```

## Runtime services

### Web

**Location:** `apps/web`

Responsibilities:

- SaaS interface
- authentication UI
- repository dashboard
- ingestion status
- analysis status
- file explorer
- dependency graph
- security findings
- generated documents
- repository chat
- Threat Briefing interface

Technology:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Query
- React Router
- Framer Motion
- Three.js / React Three Fiber
- Zod

### API

**Location:** `apps/api`

Responsibilities:

- authentication
- authorization
- RBAC
- repository management
- source ingestion APIs
- request validation
- rate limiting
- CSRF protection
- audit logging
- database access
- job creation
- chat orchestration

Technology:

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Zod
- Helmet
- Pino
- Multer

The API is intentionally the public application boundary. The Python analysis service is not intended to be called directly by browsers.

### Worker

**Location:** `apps/worker`

Responsibilities:

- repository ingestion
- GitHub cloning
- archive processing
- folder staging
- snapshot creation
- analysis orchestration
- enrichment
- deep analysis
- retry handling
- job lifecycle management

The worker currently manages separate BullMQ processing paths for:

```text
Ingestion
   ↓
Analysis
   ↓
Enrichment
   ↓
Deep analysis
```

### AI / Analysis Service

**Location:** `services/ai`

Responsibilities:

- Tree-sitter parsing
- symbol extraction
- import analysis
- dependency analysis
- graph construction
- code chunk generation
- embeddings
- AI completion
- repository summarization
- website analysis
- security enrichment
- Threat Briefing generation

Technology:

- Python 3.12+
- FastAPI
- Tree-sitter
- tree-sitter-languages
- NetworkX
- GitPython
- OpenAI SDK
- psycopg
- Pydantic Settings
- Uvicorn

### PostgreSQL

PostgreSQL is the durable system of record.

It stores concepts such as:

- organizations
- users
- memberships
- repositories
- repository sources
- snapshots
- ingestion jobs
- analysis runs
- files
- symbols
- dependency edges
- code chunks
- diagrams
- findings
- metrics
- documents
- chat sessions
- chat messages
- audit events

`pgvector` is used for semantic embeddings.

### Redis / BullMQ

Redis provides short-lived coordination and queue infrastructure.

BullMQ handles asynchronous jobs such as:

```text
Repository ingestion
Repository analysis
Enrichment
Deep analysis
```

This prevents large repository operations from blocking HTTP requests.

---

# End-to-end pipeline

## 1. Source submission

A user provides one of:

```text
GitHub repository
ZIP archive
Folder upload
Website URL
```

The API validates the request and creates the relevant repository/source/job records.

## 2. Ingestion

The worker receives the job.

For repositories, it:

```text
retrieve
   ↓
validate
   ↓
stage
   ↓
create snapshot
```

The system applies configured limits around repository size, file count, upload size, individual file size and GitHub clone timeout.

## 3. Static analysis

The Python service receives the snapshot context.

It analyzes supported source files using Tree-sitter and extracts:

```text
Symbols
Imports
Dependencies
Chunks
Graph relationships
Metrics
```

## 4. Security enrichment

The snapshot is scanned for security signals.

For websites, observable response properties such as security headers and cookies can additionally be analyzed.

## 5. Semantic enrichment

Source chunks can be embedded and stored in PostgreSQL using `pgvector`.

This creates a semantic retrieval layer on top of the deterministic repository model.

## 6. AI enrichment

If an AI provider is configured, the system can generate:

- repository summaries
- explanations
- AI chat responses
- deeper threat analysis

The AI receives structured/retrieved evidence rather than being treated as an autonomous repository scanner.

## 7. Persistence

The resulting artifacts are persisted against the repository and snapshot.

Conceptually:

```text
Repository
    │
    └── Snapshot
          │
          ├── Files
          ├── Symbols
          ├── Dependencies
          ├── Code chunks
          ├── Graphs
          ├── Findings
          ├── Metrics
          └── Documents
```

## 8. Exploration

The React application retrieves the persisted artifacts and presents them through the repository detail experience.

Users can inspect:

- ingestion status
- analysis status
- file information
- symbols
- graph information
- findings
- documents
- AI chat
- Threat Briefing

---

# Repository structure

```text
.
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── ai/
│   │       ├── audit/
│   │       ├── auth/
│   │       ├── http/
│   │       ├── jobs/
│   │       ├── repositories/
│   │       ├── routes/
│   │       ├── search/
│   │       └── staging/
│   │
│   ├── web/
│   │   └── src/
│   │       ├── api/
│   │       ├── components/
│   │       └── screens/
│   │
│   └── worker/
│       └── src/
│           ├── analysis/
│           ├── jobs/
│           └── processor/
│
├── services/
│   └── ai/
│       └── app/
│           ├── analysis/
│           ├── providers/
│           ├── config.py
│           ├── security.py
│           └── main.py
│
├── packages/
│   ├── config/
│   ├── database/
│   │   └── prisma/
│   ├── shared/
│   └── ui/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── operations/
│   ├── security/
│   └── testing/
│
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── postgres/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

---

# Analysis engine

The static analyzer is deliberately deterministic wherever possible.

For supported languages it uses Tree-sitter to identify structural syntax nodes.

Current symbol extraction includes:

### Python

- functions
- classes

### JavaScript

- functions
- classes
- methods

### TypeScript

- functions
- classes
- methods
- interfaces
- type aliases

### PHP

- functions
- classes
- methods

The analyzer also extracts import relationships using language-specific parsing patterns.

## Code chunking

Extracted symbols become useful retrieval units.

A chunk contains information such as:

```text
path
start line
end line
text
content hash
symbol name
```

Content is hashed using SHA-256.

This provides deterministic identity for repeated source material.

---

# AI and semantic retrieval

Archi AI intentionally separates AI providers from application/domain logic.

The project currently supports provider configuration through environment variables, with Groq as the example default and OpenAI as an alternative.

Example:

```env
AI_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Retrieval philosophy

The intended retrieval hierarchy is:

```text
1. Exact entity references
          ↓
2. Structural graph neighborhood
          ↓
3. Semantic vector search
          ↓
4. Generated documents
          ↓
5. Conversation-local context
```

This is important because semantic similarity alone is not enough to understand software architecture.

A function that happens to mention "authentication" is not necessarily the authentication boundary.

Structural relationships provide additional context.

## Embeddings

Embeddings are stored alongside the relational repository model using PostgreSQL + `pgvector`.

The goal is to make semantic search aware of:

- organization
- repository
- snapshot
- file
- symbol
- line range
- authorization boundaries

rather than maintaining an isolated vector store with no direct relationship to the application data model.

---

# Threat Briefing

The **Threat Briefing** is Archi AI's deeper security-oriented analysis workflow.

It asks:

> **What would a competent attacker or competitor learn from cloning this repository?**

This is intentionally different from ordinary code chat.

The workflow consumes observed snapshot evidence such as:

- file inventory
- technologies
- symbols
- dependency relationships
- findings
- source excerpts
- website profile information

It then generates seven structured sections:

### 1. Attack Surface Map

Observed:

- HTTP routes
- exported functions
- services
- third-party integrations
- data flows
- trust boundaries

### 2. Competitive Intelligence Exposure

What does a competitor learn from the repository?

Examples:

- technology choices
- business logic
- infrastructure hints
- deployment practices
- vendor relationships
- operational details

### 3. Dependency Risk Assessment

Structural dependency risks are evaluated without pretending to perform a CVE database lookup.

### 4. Security Gap Analysis

The model compares observed controls against expected controls for the technology stack.

### 5. Concrete Threat Scenarios

The briefing generates specific attack paths grounded in observed files, symbols, dependencies or findings.

### 6. Hardening Roadmap

The output provides prioritized remediation actions.

### 7. Confidence and Unknowns

The briefing explicitly identifies information that cannot be known from a static snapshot.

For example:

- runtime configuration
- deployed infrastructure
- production versions
- hidden services
- external identity-provider configuration
- secrets stored outside the repository

The Threat Briefing implementation deliberately does **not** perform external CVE lookup and instructs the model not to invent unobserved controls or infrastructure.

---

# Website analysis

Archi AI can treat a public website as a distinct source type.

This is intentionally **not** presented as source-code access.

The website mode performs a limited public crawl and can observe information such as:

```text
Pages
Assets
Framework hints
Third-party hosts
Security headers
Cookies
Public metadata
```

The application explicitly distinguishes this from repository ingestion:

```text
Repository
→ verified source snapshot

Website
→ limited public crawl
```

This prevents the product from implying that it knows hidden backend implementation details merely because it inspected a public website.

---

# Security model

Security is a first-class architectural concern.

## Authentication

The API provides authenticated sessions and authentication middleware.

## Authorization

Access is organization-scoped.

The system uses organization roles and repository-level access checks.

The general model is:

```text
Organization
    │
    ├── Owner
    ├── Admin
    ├── Analyst
    ├── Developer
    └── Viewer
```

Repository operations require appropriate organization permissions.

## Input validation

The API uses schema validation for request boundaries.

Examples include:

- repository IDs
- organization IDs
- pagination
- GitHub URLs
- website URLs
- upload metadata
- repository source data

## Repository safety

Repository data is considered untrusted.

Important controls include:

- repository size limits
- file count limits
- upload size limits
- individual file size limits
- clone timeouts
- path normalization
- archive extraction restrictions
- symlink handling
- binary file filtering
- SSRF-aware external URL handling

Repository source code is analyzed rather than executed.

## Internal AI service

The Python AI service exposes internal endpoints rather than becoming a browser-facing API.

Internal requests are authenticated using an internal job token.

The internal API includes operations for:

```text
health
static analysis
enrichment
embeddings
chat completion
deep analysis
```

## Website security checks

For live websites, the analyzer can detect observable problems involving:

- HSTS
- Content-Security-Policy
- framing protection
- MIME sniffing protection
- Referrer-Policy
- cookie Secure flags
- cookie HttpOnly flags

These findings are based on what the public site actually exposes.

---

# Technology stack

## Frontend

| Technology | Purpose |
|---|---|
| React 19 | UI |
| TypeScript | Type safety |
| Vite | Frontend tooling |
| Tailwind CSS | Styling |
| React Query | Server state |
| React Router | Routing |
| Framer Motion | Animation |
| Three.js | 3D/visual experiences |
| React Three Fiber | React integration for Three.js |
| Zod | Validation |
| Lucide React | Icons |

## API

| Technology | Purpose |
|---|---|
| Node.js 22+ | Runtime |
| Express 5 | HTTP framework |
| TypeScript | Type safety |
| Prisma | Database access |
| PostgreSQL | Persistent storage |
| Redis | Queue/coordination |
| BullMQ | Background jobs |
| Zod | Validation |
| Helmet | HTTP security |
| Pino | Logging |
| Multer | Upload handling |

## Worker

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| TypeScript | Type safety |
| BullMQ | Background processing |
| Redis | Queue backend |
| Prisma | Database access |
| yauzl | ZIP processing |
| Pino | Logging |

## AI / analysis

| Technology | Purpose |
|---|---|
| Python 3.12+ | Analysis runtime |
| FastAPI | Internal AI service |
| Tree-sitter | Syntax analysis |
| tree-sitter-languages | Language parsers |
| NetworkX | Graph analysis |
| GitPython | Git operations |
| OpenAI SDK | AI/embedding integration |
| psycopg | PostgreSQL access |
| Pydantic Settings | Configuration |
| Uvicorn | ASGI server |

## Infrastructure

```text
Docker
Docker Compose
PostgreSQL + pgvector
Redis
Nginx
GitHub Actions
```

---

# Data model

The central abstraction is the **Repository Snapshot**.

```text
Organization
    │
    ├── Users
    ├── Memberships
    └── Repositories
            │
            ├── RepositorySource
            │
            ├── IngestionJob
            │
            └── RepositorySnapshot
                    │
                    ├── FileNode
                    ├── Symbol
                    ├── DependencyEdge
                    ├── CodeChunk
                    ├── Diagram
                    ├── Finding
                    ├── Metric
                    └── Document
                              │
                              ├── Chat context
                              └── Threat Briefing
```

This provides an important distinction:

```text
Observed evidence
        ≠
AI interpretation
```

A snapshot records what was actually analyzed.

AI-generated documents and explanations are produced from that evidence.

---

# Local development

## Prerequisites

Install:

- Node.js `22+`
- npm `11.12.1`
- Python `3.12+`
- Docker
- Docker Compose

PostgreSQL and Redis can be run locally, but Docker Compose is the easiest development path.

## Clone

```bash
git clone https://github.com/everthingisnotfound/Archi_AI.git
cd Archi_AI
```

## Install Node dependencies

```bash
npm install
```

## Configure environment

Copy:

```bash
cp .env.example .env
```

Then configure your secrets and AI provider.

At minimum, replace development placeholder secrets before using the application in a real environment.

## Start the full stack

```bash
npm run docker:up
```

The Compose environment includes:

```text
PostgreSQL
Redis
API
Worker
AI service
Web
Nginx
```

---

# Environment configuration

The canonical configuration template is:

```text
.env.example
```

Important variables include:

```env
NODE_ENV=development

DATABASE_URL=
REDIS_URL=

API_BASE_URL=
WEB_BASE_URL=
CORS_ORIGIN=

SESSION_SECRET=
INTERNAL_JOB_TOKEN_SECRET=

AI_PROVIDER=groq

OPENAI_API_KEY=
OPENAI_MODEL=

GROQ_API_KEY=
GROQ_MODEL=

AI_SERVICE_URL=

MAX_REPOSITORY_BYTES=
MAX_REPOSITORY_FILES=
MAX_UPLOAD_BYTES=
MAX_SINGLE_FILE_BYTES=

RATE_LIMIT_WINDOW_SECONDS=
RATE_LIMIT_MAX_REQUESTS=

WORKSPACE_ROOT=

GITHUB_CLONE_DEPTH=
GITHUB_CLONE_TIMEOUT_MS=
```

The repository currently provides example development values and limits in `.env.example`.

Do **not** use the example development database credentials or placeholder secrets in production.

---

# Docker

The repository contains a multi-service Docker Compose deployment.

Conceptually:

```text
                         Nginx
                        :8080
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
              Web                   API
             :5173                 :4000
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                      Postgres      Redis         AI
                       :5432        :6379        :8000
                                      │
                                      ▼
                                    Worker
```

The Compose setup uses health checks and service dependencies to coordinate startup.

Persistent volumes are used for:

```text
postgres-data
redis-data
workspace-data
```

---

# Database

Prisma owns the database schema and migrations.

The database package contains:

```text
packages/database/prisma/
```

Generate the Prisma client:

```bash
npm run db:generate
```

Create/apply a development migration:

```bash
npm run db:migrate
```

Deploy existing migrations:

```bash
npm run db:migrate:deploy
```

Validate the schema:

```bash
npm run db:validate
```

---

# Useful commands

## Development

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Formatting

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

## Type checking

```bash
npm run typecheck
```

## Tests

```bash
npm test
```

## Docker

```bash
npm run docker:up
```

## Database

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:validate
```

---

# API overview

The API is organized around authentication, organizations, repositories, snapshots and analysis.

## Authentication

```text
POST /auth/login
POST /auth/logout
GET  /me
```

## Repositories

```text
GET  /organizations/:organizationId/repositories

POST /organizations/:organizationId/repositories/github

POST /organizations/:organizationId/repositories/website

POST /organizations/:organizationId/repositories/zip

POST /organizations/:organizationId/repositories/folder
```

## Repository state

```text
GET /repositories/:repositoryId

GET /repositories/:repositoryId/jobs/:jobId
```

## Snapshot

```text
GET /repositories/:repositoryId/snapshots/:snapshotId/files

GET /repositories/:repositoryId/snapshots/:snapshotId/graph

GET /repositories/:repositoryId/snapshots/:snapshotId/findings

GET /repositories/:repositoryId/snapshots/:snapshotId/documents
```

## Analysis

Retry an analysis:

```text
POST /repositories/:repositoryId/analysis/retry
```

Queue deeper analysis:

```text
POST /repositories/:repositoryId/deep-analysis
```

## Chat

Repository-aware chat is exposed through repository chat session/message APIs.

The browser does not directly call the Python AI service.

Instead:

```text
Browser
   ↓
API
   ↓
Repository access check
   ↓
Retrieval
   ↓
AI service
   ↓
Response
```

---

# Testing and quality

The project uses automated quality checks across the monorepo.

## TypeScript

The Node applications use TypeScript with strict checking.

## Frontend

Frontend tests can cover:

- components
- forms
- repository views
- graph interactions
- chat states
- loading/error states

## API

Important test categories include:

- authentication
- authorization
- validation
- repository access
- cross-tenant access prevention
- upload handling
- rate limiting
- error handling

## Worker

Important worker tests include:

- ingestion
- archive safety
- path validation
- retries
- idempotency
- cleanup
- job state transitions

## AI service

The Python service provides development tooling for:

- pytest
- mypy
- Ruff

Analysis tests should cover:

- parser behavior
- symbol extraction
- chunking
- graph construction
- retrieval
- provider behavior
- malformed input
- unsupported files

---

# Design decisions

## Why a monorepo?

Archi AI has several tightly related runtime components:

```text
Web
API
Worker
AI
Shared packages
Infrastructure
```

A monorepo makes shared contracts and coordinated changes easier to manage.

## Why Node.js for API + workers?

The application layer benefits from a common TypeScript ecosystem while keeping HTTP handling and asynchronous orchestration separate.

## Why Python for analysis?

The repository-analysis layer naturally benefits from Python's ecosystem around:

- Tree-sitter
- graph processing
- AI tooling
- scientific/data processing

The service boundary also prevents the API from becoming tightly coupled to analysis implementation details.

## Why BullMQ?

Repository analysis is inherently asynchronous.

A repository may require:

```text
clone
extract
validate
parse
graph
embed
scan
document
```

Trying to perform all of this during an HTTP request would create poor reliability and terrible request latency.

BullMQ provides a natural job boundary.

## Why PostgreSQL + pgvector?

The system needs both relational data and semantic retrieval.

Using PostgreSQL for both means vectors can remain directly associated with:

```text
organization
repository
snapshot
file
symbol
line range
authorization metadata
```

without introducing another database in the initial architecture.

## Why Tree-sitter?

LLMs are excellent interpreters.

They are not the ideal primitive for deterministic syntax discovery.

Tree-sitter provides a repeatable structural representation from which the AI layer can reason.

## Why snapshots?

A repository is constantly changing.

If an analysis is tied to "whatever happens to be on the branch right now", the result becomes difficult to reproduce.

Snapshots create an explicit evidence boundary:

```text
Repository
    │
    ├── Snapshot A
    ├── Snapshot B
    └── Snapshot C
```

Each snapshot can have its own:

```text
files
symbols
dependencies
findings
metrics
documents
embeddings
```

---

# Current capabilities vs. target architecture

One of the most important things to understand about this project is that the **architecture is broader than the current implementation**.

The architecture document describes the intended production system, while the repository already contains a concrete subset of that system.

This README intentionally does not pretend every architectural idea is already implemented.

## Currently implemented foundations

The repository currently contains concrete implementations for:

- multi-service monorepo
- React frontend
- Node.js API
- Node.js background worker
- Python FastAPI analysis service
- PostgreSQL persistence
- Redis/BullMQ jobs
- repository ingestion
- GitHub ingestion
- ZIP/folder ingestion
- website ingestion
- repository snapshots
- Tree-sitter static analysis
- symbol extraction
- import analysis
- package dependency analysis
- deterministic code chunks
- security scanning
- website security-header analysis
- embeddings
- AI summaries
- repository-aware chat
- dependency graph data
- generated documents
- Threat Briefing / Deeper Analysis
- authentication
- organization-scoped RBAC
- audit logging
- CI configuration
- Docker Compose infrastructure

## Broader target architecture

The architecture documents describe a larger future platform including:

- richer dependency graphs
- call graphs
- class diagrams
- sequence diagrams
- database diagrams
- REST API diagrams
- broader language analysis
- maintainability analysis
- complexity analysis
- technical debt analysis
- duplication analysis
- dead-code analysis
- richer documentation generation
- stronger incremental analysis
- more extensive observability
- production-grade isolation
- more sophisticated security analysis

These should be treated as architectural direction rather than assumed to be completely implemented today.

---

# Limitations

## Static analysis is not runtime analysis

Archi AI cannot automatically know everything about a running production system.

A repository snapshot cannot prove:

- actual production infrastructure
- runtime environment variables
- deployed versions
- hidden services
- production traffic
- runtime feature flags
- private network topology
- secrets outside the repository

## Website analysis is limited

Website ingestion observes the public surface.

It does not imply access to:

- private APIs
- backend source code
- internal databases
- private infrastructure
- internal network services

## Threat Briefing is structural

The Threat Briefing is intentionally based on observed repository/site evidence.

It is not a replacement for:

- penetration testing
- dynamic application security testing
- full vulnerability scanning
- CVE intelligence platforms
- cloud configuration audits
- production incident response

## AI can still be wrong

The architecture reduces hallucination risk by grounding AI responses in retrieved evidence.

It does not make LLM output infallible.

The system should always distinguish:

```text
Observed
Derived
AI interpreted
Unknown
```

---

# Documentation

The repository contains dedicated documentation areas.

```text
docs/
├── architecture/
├── api/
├── operations/
├── security/
└── testing/
```

## Start with architecture

If you are new to the codebase, read:

```text
docs/architecture/phase-01-system-architecture.md
```

It explains:

- system topology
- service boundaries
- domain model
- ingestion pipeline
- analysis pipeline
- AI retrieval
- security architecture
- performance architecture
- observability
- testing strategy
- architectural decisions

## Recommended developer onboarding path

```text
1. package.json
       ↓
2. docker-compose.yml
       ↓
3. apps/api
       ↓
4. apps/worker
       ↓
5. services/ai
       ↓
6. packages/database
       ↓
7. packages/shared
       ↓
8. apps/web
       ↓
9. docs/
```

This follows the runtime direction of the system rather than forcing a newcomer to understand the frontend first.

---

# Roadmap

The long-term direction of Archi AI is to evolve from repository analysis into a complete **software intelligence platform**.

## Analysis

- [ ] Broader language support
- [ ] More accurate cross-file symbol resolution
- [ ] Call graph generation
- [ ] Class relationship analysis
- [ ] REST API discovery
- [ ] Database schema understanding
- [ ] Sequence diagram generation
- [ ] Better dependency resolution
- [ ] Incremental re-analysis

## Security

- [ ] Expanded deterministic security rules
- [ ] Dependency vulnerability intelligence
- [ ] Supply-chain analysis
- [ ] Secret lifecycle analysis
- [ ] Security remediation tracking
- [ ] Stronger repository sandboxing
- [ ] Runtime security integrations

## AI

- [ ] More advanced repository retrieval
- [ ] Better graph-aware retrieval
- [ ] Multi-step codebase reasoning
- [ ] Architecture-aware explanations
- [ ] Refactoring planning
- [ ] Automated migration planning
- [ ] Better provenance tracking
- [ ] More provider implementations

## Documentation

- [ ] Automated architecture documentation
- [ ] API documentation
- [ ] Onboarding guides
- [ ] Deployment documentation
- [ ] Module documentation
- [ ] Testing documentation
- [ ] Change-aware documentation regeneration

## Platform

- [ ] Production-grade observability
- [ ] Usage and AI cost tracking
- [ ] Repository quotas
- [ ] Stronger tenant isolation
- [ ] Scalable worker pools
- [ ] Cloud deployment workflows
- [ ] Richer organization administration

---

# Contributing

Contributions should preserve the project's most important invariant:

> **Deterministic evidence first. AI interpretation second.**

Before opening a pull request, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

For changes crossing service boundaries, update the relevant documentation under `docs/`.

For changes involving repository ingestion or source processing:

- treat repository content as untrusted
- add negative-path tests
- preserve tenant boundaries
- avoid executing repository code
- validate external URLs
- maintain configured resource limits

---

# License

No license file is currently declared in the repository.

Until a license is explicitly added, redistribution and reuse should be treated according to the repository owner's chosen licensing terms.

---

# Project status

**Archi AI is under active development.**

It is already a functioning multi-service foundation rather than a simple LLM wrapper:

```text
Repository / Website
        ↓
Secure ingestion
        ↓
Versioned snapshot
        ↓
Static analysis
        ↓
Dependency + symbol model
        ↓
Security findings
        ↓
Semantic indexing
        ↓
AI interpretation
        ↓
Chat / Documents / Threat Briefing
```

The long-term goal is bigger:

> **Build an evidence-backed intelligence layer for software systems.**

Instead of merely asking an AI to read a codebase, Archi AI is designed to **construct a model of the codebase first — and then let AI reason over that model.**

---

## Author

Built by [@everthingisnotfound](https://github.com/everthingisnotfound).

---

<p align="center">
  <strong>Archi AI — Understand the system before you change the system.</strong>
</p>
