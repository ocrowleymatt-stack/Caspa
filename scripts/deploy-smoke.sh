#!/usr/bin/env bash
# Caspa deployment smoke tests — run after npm run deploy with server on :3000
set -euo pipefail

BASE="${CASPA_SMOKE_URL:-http://127.0.0.1:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "Caspa smoke tests against $BASE"

# Health
HEALTH=$(curl -sf "$BASE/health") || fail "/health"
echo "$HEALTH" | grep -q '"status"' || fail "/health status"
echo "$HEALTH" | grep -q '"gitSha"' || fail "/health gitSha fingerprint"
ok "/health"

# Doctor
DOCTOR=$(curl -sf "$BASE/api/doctor") || fail "/api/doctor"
echo "$DOCTOR" | grep -q '"success":true' || fail "/api/doctor success"
echo "$DOCTOR" | grep -q '"readiness"' || fail "/api/doctor readiness"
echo "$DOCTOR" | grep -q '"version"' || fail "/api/doctor version"
echo "$DOCTOR" | grep -q '"service":"Caspa"' || fail "/api/doctor service Caspa"
echo "$DOCTOR" | grep -q '"gitSha"' || fail "/api/doctor gitSha"
echo "$DOCTOR" | grep -q '"builtAt"' || fail "/api/doctor builtAt"
echo "$DOCTOR" | grep -q '"localGuestAllowed":true' || fail "/api/doctor localGuestAllowed"
ok "/api/doctor"

# Stale-generation guard: old Atlas doctor advertised CASPA Studio / sqlite modules.
echo "$DOCTOR" | grep -qi 'CASPA Studio' && fail "Stale CASPA Studio doctor payload"
echo "$DOCTOR" | grep -q '"sqliteConfigured"' && fail "Stale sqlite doctor shape still present"
ok "doctor generation guard"

# index.html must not be cached as a long-lived asset
HEADERS=$(curl -sI "$BASE/") || fail "HEAD /"
echo "$HEADERS" | grep -qi 'cache-control:.*no-store' || fail "index.html Cache-Control missing no-store"
ok "index.html Cache-Control: no-store"

# Ollama smoke (offline is fine)
curl -sf "$BASE/api/ollama/smoke" | grep -q '"success":true' || fail "/api/ollama/smoke"
ok "/api/ollama/smoke"

# Gold passes
curl -sf "$BASE/api/caspa/gold/passes" | grep -q 'structure' || fail "/api/caspa/gold/passes"
ok "/api/caspa/gold/passes"

# Job audit
curl -sf "$BASE/api/caspa/gold/jobs/audit" | grep -q '"activeJobs"' || fail "/api/caspa/gold/jobs/audit"
ok "/api/caspa/gold/jobs/audit"

# Storage backups list
curl -sf "$BASE/api/caspa/storage/backups" | grep -q '"success":true' || fail "/api/caspa/storage/backups"
ok "/api/caspa/storage/backups"

# Novel Write Pro quality pass
QP=$(curl -sf -X POST "$BASE/api/caspa/novel-write-pro/quality-pass" \
  -H 'Content-Type: application/json' \
  -d '{"content":"She felt very sad suddenly. The room was quiet.","mode":"novel","title":"Smoke"}')
echo "$QP" | grep -q '"success":true' || fail "/api/caspa/novel-write-pro/quality-pass"
echo "$QP" | grep -q '"overallScore"' || fail "quality-pass score"
ok "/api/caspa/novel-write-pro/quality-pass"

# Research deep — must return (live or knowledge fallback), never hang
RESEARCH=$(curl -sf --max-time 70 -X POST "$BASE/api/caspa/research/deep" \
  -H 'Content-Type: application/json' \
  -d '{"topic":"Edinburgh Castle","context":"smoke","projectType":"novel","genre":"Educational","title":"Smoke"}') \
  || fail "/api/caspa/research/deep timed out or failed"
echo "$RESEARCH" | grep -q '"success":true' || fail "/api/caspa/research/deep success"
echo "$RESEARCH" | grep -q '"title"' || fail "/api/caspa/research/deep title"
ok "/api/caspa/research/deep"

# AI call smoke (short prompt; must succeed with some provider)
AICALL=$(curl -sf --max-time 90 -X POST "$BASE/api/ai/call" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Return exactly the word READY","maxTokens":32}') \
  || fail "/api/ai/call timed out or failed"
echo "$AICALL" | grep -qi 'READY\|result' || fail "/api/ai/call result"
ok "/api/ai/call"

# Static UI
curl -sf "$BASE/" | grep -q '<html' || fail "index.html"
curl -sf "$BASE/" | grep -qi 'CASPA Studio' && fail "Stale CASPA Studio title in index.html"
ok "index.html"

# Local-first create path (no Firebase / no server session)
bash "$ROOT/scripts/local-project-smoke.sh"
ok "local-project-smoke"

echo ""
echo "All smoke tests passed."
