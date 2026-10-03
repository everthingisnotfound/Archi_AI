\# Archi AI — Software Archaeology Platform



\## Project Structure

\- Monorepo with npm workspaces (npm 11, Node 22+)

\- apps/api — Node.js + Express 5 + TypeScript (port 4000)

\- apps/worker — Node.js + BullMQ job processor (port 4100)

\- apps/web — React 19 + Vite + TypeScript (port 5173)

\- apps/ai — Python + FastAPI AI service (port 8000)

\- packages/database — Prisma 6 + PostgreSQL + pgvector



\## Running Services (all on Docker)

\- PostgreSQL: localhost:5432 (user: archaeologist, db: archaeologist)

\- Redis: localhost:6379

\- Start everything: docker compose up



\## Key Commands

\- docker compose up — start all services

\- docker compose logs api -f — watch API logs

\- docker compose logs worker -f — watch worker logs

\- npm run db:migrate — run Prisma migrations



\## Important

\- AI\_PROVIDER=groq in .env — needs GROQ\_API\_KEY to work

\- pgvector extension required (handled by pgvector/pgvector:pg16 image)

\- All services have health checks — api waits for postgres + redis + ai

