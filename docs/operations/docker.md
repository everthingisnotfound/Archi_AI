# Docker Operations

Docker Compose defines the foundation runtime:

- PostgreSQL with `pgvector`.
- Redis.
- Express API.
- BullMQ worker.
- FastAPI AI service.
- React web app served by Nginx.
- Gateway Nginx proxy.

Use:

```bash
docker compose up --build
```

The API, worker, and AI service expose health checks used by Compose. The gateway listens on `http://localhost:8080`.

