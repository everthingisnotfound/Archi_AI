#!/bin/sh
set -eu

cd /app

echo "[api] applying database migrations..."
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma migrate deploy --schema packages/database/prisma/schema.prisma; then
    echo "[api] migrations applied successfully"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      DELAY=$((2 ** RETRY_COUNT))
      echo "[api] migration failed, retrying in ${DELAY}s (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
      sleep $DELAY
    else
      echo "[api] migration failed after $MAX_RETRIES attempts"
      exit 1
    fi
  fi
done

echo "[api] starting server..."
exec node apps/api/dist/server.js
