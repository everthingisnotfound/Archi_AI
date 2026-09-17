#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export VITE_API_BASE_URL="http://localhost:4000"
npm run dev:web
