# Phase 02 Foundation Plan

Status: blocked until Phase 01 architecture is reviewed and accepted.

This plan describes the first implementation phase after architecture approval. It is intentionally scoped to foundation work only.

## Objectives

- Create the monorepo structure.
- Configure strict TypeScript for Node services and React.
- Configure Python 3.12 service scaffolding.
- Add Docker Compose for Postgres, Redis, API, worker, AI service, web, and Nginx.
- Add database schema foundation with Prisma.
- Add health checks, structured logging, configuration validation, and secure error handling.
- Add authentication and RBAC foundations.
- Add repository ingestion job skeleton without full analysis.
- Add CI-ready lint, format, test, typecheck, build, and migration commands.

## Non-Objectives

- Full repository analysis.
- AI chat.
- Diagram generation.
- Documentation generation.
- Production deployment automation.

## Implementation Units

1. Workspace and tooling
   - Package manager workspace.
   - Strict TypeScript base configs.
   - ESLint and Prettier.
   - Commitlint and Husky.
   - Shared validation and error contracts.

2. API foundation
   - Express app factory.
   - Configuration loader with environment validation.
   - Request ID middleware.
   - Secure headers.
   - Rate limiting.
   - Structured logging.
   - Error mapping.
   - Health endpoint.

3. Database foundation
   - Prisma schema for organizations, users, memberships, repositories, jobs, audit events, and sessions.
   - Initial migration.
   - Database indexes for tenant-scoped access.
   - Seed script for local development.

4. Auth and RBAC foundation
   - Password hashing.
   - Session creation and rotation.
   - Session cookie configuration.
   - Organization-scoped role checks.
   - Negative authorization tests.

5. Worker foundation
   - BullMQ connection.
   - Job registration.
   - Job state transitions.
   - Retry policy.
   - Idempotency key handling.
   - Cleanup hooks.

6. AI service foundation
   - FastAPI app factory.
   - Configuration validation.
   - Health endpoint.
   - Internal job token validation.
   - Provider abstraction interface without calling a provider in foundation tests.

7. Web foundation
   - Vite React app.
   - Tailwind and ShadCN setup.
   - SaaS shell layout.
   - Auth screens.
   - Repository list shell.
   - Job status shell.
   - Error and empty states.

8. Infrastructure foundation
   - Docker Compose services.
   - Nginx local routing.
   - Postgres `pgvector` extension setup.
   - Redis service.
   - Health checks.

## Review Gates

Architecture review:

- The implemented structure matches the accepted service boundaries.
- Shared packages contain contracts only where reuse is real.
- No circular dependencies exist between packages.

Security review:

- Configuration fails closed when required secrets are missing.
- Cookies and sessions use secure defaults.
- Rate limits apply to public API routes.
- Authorization checks are centralized and covered by negative tests.
- Errors do not leak stack traces or secrets in production mode.

Performance review:

- API startup and health checks are lightweight.
- Database indexes support tenant-scoped lookups.
- Worker jobs are asynchronous and do not block the API.

Code quality review:

- Strict TypeScript is enabled.
- No unused exports or dead modules.
- No duplicated validation schemas.
- Tests are deterministic and isolated.

Maintainability review:

- App factories allow test injection.
- Config, logging, validation, and error handling are shared consistently.
- Service boundaries remain understandable from the folder structure.

Bug hunt and edge cases:

- Missing environment variables.
- Invalid session cookie.
- Expired session.
- Cross-tenant repository access.
- Duplicate organization membership.
- Redis unavailable.
- Database unavailable.
- Worker retry after partial failure.

Dependency review:

- Every dependency must have a foundation-phase use.
- No UI library beyond the accepted stack.
- No AI provider-specific dependency may leak into browser or API domain code.

## Required Validation Commands

Commands will be finalized after package manager selection during implementation. The expected categories are:

- Install reproducibly from lockfile.
- Typecheck all TypeScript packages.
- Lint all TypeScript packages.
- Format check.
- Run Node unit and integration tests.
- Run Python unit tests.
- Run Prisma migration check.
- Build web, API, worker, and AI service images.
- Run Docker Compose smoke test.

## Deliverable

Phase 02 is complete only when the foundation runs locally, tests pass, Docker Compose starts all core services, and the review gates above have been explicitly checked.

