#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ ! -f .env ]]; then
  cp .env.example .env
fi
sed -i 's/SESSION_SECRET=replace-with-at-least-32-random-characters/SESSION_SECRET=dev-session-secret-32chars-minimum-ok/' .env
sed -i 's/INTERNAL_JOB_TOKEN_SECRET=replace-with-at-least-32-random-characters/INTERNAL_JOB_TOKEN_SECRET=dev-internal-job-token-32chars-min/' .env
sed -i 's|DATABASE_URL=postgresql://archaeologist:\[REDACTED\]@postgres:5432|DATABASE_URL=postgresql://archaeologist:archaeologist@postgres:5432|' .env
sed -i 's/MAX_REPOSITORY_BYTES=\[REDACTED\]/MAX_REPOSITORY_BYTES=268435456/' .env
sed -i 's/MAX_UPLOAD_BYTES=\[REDACTED\]/MAX_UPLOAD_BYTES=104857600/' .env
sed -i 's/CORS_ORIGIN=\[http/CORS_ORIGIN=http/' .env

if ! dpkg -s python3-dev >/dev/null 2>&1 || ! dpkg -s python3.12-venv >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-dev python3.12-venv build-essential
fi

npm ci
npm run build:packages

if [[ ! -d services/ai/.venv ]]; then
  python3 -m venv services/ai/.venv
fi
# shellcheck source=/dev/null
source services/ai/.venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install "./services/ai[dev]"

mkdir -p data/workspaces
