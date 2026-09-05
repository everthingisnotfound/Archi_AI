# Architecture Review Checklist

Use this checklist before approving Phase 01 and again after every implementation module.

## Architecture

- Service responsibilities are explicit and respected.
- Repository content is handled as untrusted input.
- Long-running work is asynchronous.
- Data model supports organization, repository, snapshot, and analysis-run boundaries.
- AI provider details are isolated behind interfaces.
- Diagrams, findings, metrics, documents, and chat responses have provenance.

## Security

- OWASP Top 10 controls are addressed.
- Every API input is schema validated.
- Every API route has authentication, authorization, or a documented public reason.
- Mutating routes are audited.
- Rate limits apply to public and expensive endpoints.
- Sensitive values are not logged.
- Repository archives cannot escape their workspace.
- GitHub URL intake includes SSRF protections.
- Repository content is never executed.

## Performance

- Expensive work runs in queues.
- Database access is indexed for tenant-scoped queries.
- Large responses are paginated or streamed.
- Graph APIs support filtering and size caps.
- Frontend heavy views are lazy loaded.
- Reanalysis can skip unchanged content by hash.

## Code Quality

- Strict TypeScript is enabled.
- Modules have single, testable responsibilities.
- Validation schemas are not duplicated.
- No dead code, unused exports, or placeholder implementations.
- Errors use stable codes and safe messages.
- Dependency additions are justified by actual use.

## Maintainability

- App factories support testing.
- Business rules are not buried in route handlers.
- Authorization policy code is centralized.
- Shared packages do not become dumping grounds.
- Migrations are reviewed and reversible where practical.
- Documentation changes accompany architectural or operational changes.

## Scalability

- Queue workers can scale horizontally.
- AI analysis can scale independently of the API.
- Snapshot records avoid destructive overwrites.
- Repository quotas and job limits are explicit.
- Storage paths and cleanup jobs are deterministic.

## Testing

- Unit tests cover validation, policy, parsing, chunking, and graph logic.
- Integration tests cover database, Redis, queues, and service boundaries.
- E2E tests cover critical user workflows.
- Negative tests cover cross-tenant access, invalid uploads, malformed archives, and dependency failures.
- Fixtures include small representative repositories.

## Final Validation Categories

- Type errors.
- Lint errors.
- Build errors.
- Runtime errors.
- Broken imports.
- Broken links.
- Unused code.
- Dependency issues.
- Docker build failures.
- Production build failures.
- Accessibility regressions.
- Responsiveness regressions.

