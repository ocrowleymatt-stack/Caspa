#!/bin/bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export CASPA_DATA_DIR="${CASPA_DATA_DIR:-$APP_DIR/data}"
mkdir -p "$CASPA_DATA_DIR"
node dist/server.cjs
