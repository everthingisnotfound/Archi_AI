#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

bash .cursor/scripts/start-docker.sh

docker compose up -d postgres redis

echo "Waiting for postgres..."
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U archaeologist -d archaeologist >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  sleep 1
done

echo "Waiting for redis..."
for _ in $(seq 1 30); do
  if docker compose exec -T redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD:-redis-insecure-dev-only}" ping 2>/dev/null | grep -q PONG; then
    echo "Redis is ready"
    break
  fi
  sleep 1
done

export DATABASE_URL="postgresql://archaeologist:archaeologist@localhost:5432/archaeologist?schema=public"
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
