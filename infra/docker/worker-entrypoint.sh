#!/bin/sh
set -eu

cd /app

# Database migrations are owned by the API service. Keeping them out of the
# worker prevents two containers from competing for Prisma's migration lock.
echo "[worker] starting worker..."
exec node apps/worker/dist/index.js
