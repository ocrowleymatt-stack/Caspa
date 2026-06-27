#!/usr/bin/env bash
# Fast production smoke — no auth, no AI generation. Completes in seconds.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CURL_TIMEOUT=10
failures=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; failures=$((failures + 1)); }

echo "=== CASPA RUNTIME SMOKE (FAST) ==="
date -u

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "--- GIT ---"
  echo "commit: $(git rev-parse --short HEAD)"
  git status -sb || true
else
  fail "not inside a git repository"
fi

echo "--- HEALTH ---"
health=$(curl -fsS --max-time "$CURL_TIMEOUT" http://127.0.0.1:3000/health 2>/dev/null || true)
if [[ "$health" == *'"status":"ok"'* ]]; then
  pass "GET /health"
else
  fail "GET /health — no ok status (timeout ${CURL_TIMEOUT}s)"
fi

echo "--- DOCTOR ---"
doctor=$(curl -fsS --max-time "$CURL_TIMEOUT" http://127.0.0.1:3000/api/doctor 2>/dev/null || true)
if [[ "$doctor" == *'"service":"CASPA Studio"'* && "$doctor" == *'"status":"ok"'* ]]; then
  pass "GET /api/doctor (CASPA Studio)"
else
  fail "GET /api/doctor — expected CASPA Studio ok (timeout ${CURL_TIMEOUT}s)"
fi

echo "--- AUTH ---"
auth_code=$(curl -sS --max-time "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/projects 2>/dev/null || echo "000")
if [[ "$auth_code" == "401" ]]; then
  pass "GET /api/projects unauthenticated → 401"
else
  fail "GET /api/projects unauthenticated — expected 401, got ${auth_code}"
fi

echo "--- OLLAMA ---"
tags_json=$(curl -fsS --max-time "$CURL_TIMEOUT" http://127.0.0.1:11434/api/tags 2>/dev/null || true)
if [[ -n "$tags_json" ]]; then
  models=$(python3 - <<'PY' "$tags_json"
import json, sys
try:
    data = json.loads(sys.argv[1])
    names = [m.get("name", m.get("model", "?")) for m in data.get("models", [])]
    print(", ".join(names) if names else "(no models)")
except Exception as e:
    print(f"parse error: {e}")
    raise SystemExit(1)
PY
)
  if [[ -n "$models" && "$models" != *"parse error"* ]]; then
    pass "Ollama models: ${models}"
  else
    fail "Ollama /api/tags — could not list models"
  fi
else
  fail "Ollama /api/tags — no response (timeout ${CURL_TIMEOUT}s)"
fi

echo "--- PORT 3000 ---"
port_owner=""
if command -v lsof >/dev/null 2>&1; then
  port_owner=$(lsof -ti :3000 2>/dev/null | head -1 || true)
fi
if [[ -z "$port_owner" ]]; then
  fail "port 3000 — nothing listening"
elif [[ "$doctor" == *'"service":"CASPA Studio"'* ]]; then
  pass "port 3000 serves CASPA Studio"
else
  fail "port 3000 — listener present but doctor is not CASPA Studio (legacy/Vite risk)"
  lsof -i :3000 2>/dev/null || true
fi

echo "--- PM2 ---"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe caspa-server >/dev/null 2>&1; then
    pm2_status=$(pm2 describe caspa-server 2>/dev/null | awk '/status/{print $4; exit}' || true)
    if [[ "$pm2_status" == "online" ]]; then
      pass "pm2 caspa-server online"
    else
      fail "pm2 caspa-server status: ${pm2_status:-unknown}"
    fi
    pm2 status caspa-server || true
  else
    fail "pm2 caspa-server process not found"
  fi
else
  fail "pm2 not available"
fi

echo
if [[ "$failures" -eq 0 ]]; then
  echo "FAST SMOKE: PASS"
  echo "Run: bash scripts/runtime-smoke.sh --full  (full authenticated AI workflow, several minutes)"
  exit 0
fi

echo "FAST SMOKE: FAIL (${failures} check(s))"
if [[ "${CASPA_SMOKE_STRICT:-}" == "1" ]]; then
  exit 1
fi
exit 1
