#!/bin/sh
set -eu

cd /app

echo "[worker] applying database migrations..."
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

echo "[worker] starting worker..."
exec node apps/worker/dist/index.js
