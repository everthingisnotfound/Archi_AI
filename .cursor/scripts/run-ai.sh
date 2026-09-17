#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a
# shellcheck disable=SC1091
source .env
export DATABASE_URL="postgresql://archaeologist:archaeologist@localhost:5432/archaeologist?schema=public"
export REDIS_URL="redis://:redis-insecure-dev-only@localhost:6379"
set +a
# shellcheck source=/dev/null
source services/ai/.venv/bin/activate
cd services/ai
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
