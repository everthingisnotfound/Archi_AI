# Foundation Security Notes

## Implemented Controls

- Strict server-side request validation with Zod.
- HTTP security headers through Helmet.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Passwords are hashed with Node.js `scrypt` and random salts.
- Session tokens are stored as HMAC hashes.
- Mutating API requests require CSRF header and cookie agreement.
- Redis-backed rate limiting is applied before authenticated routes.
- RBAC checks are organization scoped.
- Mutating authentication and repository actions emit audit events.
- Repository paths are normalized and rejected if they escape the repository workspace.
- GitHub repository URLs are limited to `https://github.com`.
- Python internal endpoints require signed short-lived job tokens.

## Explicit Non-Goals In Phase 02

- OAuth login.
- Repository cloning.
- Archive extraction.
- Static code analysis.
- AI provider calls.

These are intentionally deferred so their security reviews can be performed as dedicated modules.

