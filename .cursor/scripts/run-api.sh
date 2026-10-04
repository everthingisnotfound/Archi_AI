#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a
# shellcheck disable=SC1091
source .env
export DATABASE_URL="postgresql://archaeologist:archaeologist@localhost:5432/archaeologist?schema=public&connection_limit=5"
export REDIS_URL="redis://:redis-insecure-dev-only@localhost:6379"
export AI_SERVICE_URL="http://localhost:8000"
export WORKSPACE_ROOT="${WORKSPACE_ROOT:-./data/workspaces}"
set +a
npm run dev:api
