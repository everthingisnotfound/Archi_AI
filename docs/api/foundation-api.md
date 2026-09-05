# Foundation API

## Health

- `GET /healthz`
- `GET /readyz`

## Authentication

- `GET /auth/csrf`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Repositories

- `GET /organizations/:organizationId/repositories`
- `POST /organizations/:organizationId/repositories/github`
- `POST /organizations/:organizationId/repositories/zip`
- `POST /organizations/:organizationId/repositories/folder`

Repository creation endpoints create a repository source, persist staged uploads where required, enqueue an ingestion job, and return the job identifier.

Phase 03 read endpoints are documented in `docs/api/ingestion-api.md`.

