#!/bin/sh
set -eu

cd /app

echo "[api] applying database migrations..."
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

echo "[api] starting server..."
exec node apps/api/dist/server.js
