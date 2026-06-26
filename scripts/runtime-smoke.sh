#!/usr/bin/env bash
set -euo pipefail

echo "=== CASPA RUNTIME SMOKE ==="
date -u

echo "--- PUBLIC HEALTH ---"
curl -sS http://127.0.0.1:3000/health || true
echo

echo "--- PUBLIC DOCTOR ---"
curl -sS http://127.0.0.1:3000/api/doctor || true
echo

echo "--- OLLAMA DIRECT TAGS ---"
curl -sS http://127.0.0.1:11434/api/tags || true
echo

echo "--- PROTECTED ROUTE CHECK ---"
curl -sS -i http://127.0.0.1:3000/api/projects | head -30 || true
echo

echo "--- PM2 ---"
pm2 status || true
