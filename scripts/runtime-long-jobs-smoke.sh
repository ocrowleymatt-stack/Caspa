#!/usr/bin/env bash
# Long job smoke — verifies creative routes return jobId quickly (no sync 504 pattern).
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== CASPA LONG JOB SMOKE ==="
echo "$(date)"
echo "Base URL: $BASE_URL"

failures=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; failures=$((failures + 1)); }

now_ms() {
  python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
}

assert_job_enqueue() {
  local label="$1"
  local path="$2"
  local body="$3"
  local check_progress="${4:-0}"
  local start_ms end_ms elapsed json job_id

  start_ms=$(now_ms)
  json=$(curl -sS -X POST "$BASE_URL$path" "${AUTH[@]}" -d "$body")
  end_ms=$(now_ms)
  elapsed=$((end_ms - start_ms))
  job_id=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.jobId||'')" <<< "$json")

  if [[ -n "$job_id" ]]; then
    pass "$label returned jobId in ${elapsed}ms"
  else
    fail "$label missing jobId (response: $json)"
  fi

  if [[ "$elapsed" -lt 5000 ]]; then
    pass "$label response under 5s"
  else
    fail "$label response ${elapsed}ms (>5s)"
  fi

  if [[ "$check_progress" == "1" && -n "$job_id" ]]; then
    progress_json=$(curl -sS "$BASE_URL/api/jobs/$job_id/progress" -H "Authorization: Bearer $TOKEN")
    if echo "$progress_json" | grep -q '"success":true'; then pass "GET job progress"; else fail "GET job progress"; fi
  fi
}

health_code=$(curl -sS -o /tmp/caspa-health.json -w '%{http_code}' "$BASE_URL/health")
if [[ "$health_code" == "200" ]]; then pass "GET /health"; else fail "GET /health ($health_code)"; fi

projects_code=$(curl -sS -o /tmp/caspa-projects.json -w '%{http_code}' "$BASE_URL/api/projects")
if [[ "$projects_code" == "401" ]]; then pass "GET /api/projects unauthenticated → 401"; else fail "GET /api/projects expected 401 got $projects_code"; fi

doctor_json=$(curl -sS "$BASE_URL/api/doctor")
if echo "$doctor_json" | grep -q '"success":true'; then pass "GET /api/doctor"; else fail "GET /api/doctor"; fi
if echo "$doctor_json" | grep -qi 'api_key\|password\|secret\|token'; then fail "doctor exposes secrets"; else pass "doctor has no obvious secrets"; fi

if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.env" 2>/dev/null || true
  set +a
fi

EMAIL="${ADMIN_EMAIL:-${CASPA_ADMIN_EMAIL:-admin@caspa.local}}"
PASSWORD="${ADMIN_PASSWORD:-${CASPA_ADMIN_PASSWORD:-changeme}}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "SKIP: authenticated long-job tests (set ADMIN_EMAIL and ADMIN_PASSWORD in .env)"
  if [[ "$failures" -eq 0 ]]; then
    echo "LONG JOB SMOKE: PASS (public checks only)"
    exit 0
  fi
  echo "LONG JOB SMOKE: FAIL"
  exit 1
fi

login_json=$(curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.token||'')" <<< "$login_json")

if [[ -z "$TOKEN" ]]; then
  fail "login"
  echo "LONG JOB SMOKE: FAIL"
  exit 1
fi
pass "login"

AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

project_json=$(curl -sS -X POST "$BASE_URL/api/projects" "${AUTH[@]}" \
  -d '{"title":"Long Job Smoke","genre":"General","description":"smoke","targetWordCount":5000,"status":"draft","workType":"novel"}')
PROJECT_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.id||'')" <<< "$project_json")

if [[ -z "$PROJECT_ID" ]]; then fail "create project"; echo "LONG JOB SMOKE: FAIL"; exit 1; fi
pass "create project $PROJECT_ID"

assert_job_enqueue "NWP" "/api/casper/novel-write-pro" \
  "{\"projectId\":\"$PROJECT_ID\",\"mode\":\"novel\",\"spark\":\"Smoke test opening.\",\"source\":\"A short smoke test paragraph for job queue verification.\"}" \
  1

lock_json=$(curl -sS -X POST "$BASE_URL/api/gold/source-lock" "${AUTH[@]}" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"sourceType\":\"pasted-text\",\"pastedText\":\"Smoke test manuscript paragraph for gold job queue with enough words.\",\"mode\":\"improve-same-story\"}")
LOCK_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.sourceLockId||'')" <<< "$lock_json")

if [[ -n "$LOCK_ID" ]]; then
  pass "gold source lock"
  assert_job_enqueue "Gold Pass" "/api/gold/run" \
    "{\"projectId\":\"$PROJECT_ID\",\"sourceLockId\":\"$LOCK_ID\",\"improveText\":true,\"stage\":\"revision\"}"
  assert_job_enqueue "Gold Pipeline" "/api/goldpipeline/execute" \
    "{\"projectId\":\"$PROJECT_ID\",\"sourceLockId\":\"$LOCK_ID\",\"chapters\":[\"book\"],\"config\":{\"depth\":\"structural\",\"biases\":[\"literary\"],\"route\":\"hybrid\",\"runMode\":\"controlled\",\"chapterIds\":[\"book\"]}}"
else
  fail "gold source lock"
fi

assert_job_enqueue "Agent Swarm" "/api/agents/swarm" \
  "{\"projectId\":\"$PROJECT_ID\",\"mode\":\"critique\",\"agentIds\":[\"voice-guardian\",\"anti-filler-inspector\",\"structural-editor\"],\"sourceText\":\"Swarm smoke paragraph with enough substance for critique agents.\"}"

minimal_json=$(curl -sS -X POST "$BASE_URL/api/minimal/projects" "${AUTH[@]}" \
  -d '{"title":"Long Job Minimal Smoke","targetWordCount":5000}')
MINIMAL_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.id||'')" <<< "$minimal_json")

if [[ -n "$MINIMAL_ID" ]]; then
  pass "create minimal project $MINIMAL_ID"
  asset_json=$(curl -sS -X POST "$BASE_URL/api/projects/$MINIMAL_ID/assets" "${AUTH[@]}" \
    -d '{"title":"Smoke notes","sourceText":"Minimal long job smoke material with enough characters to satisfy auto-build gates without blocking HTTP responses."}')
  if echo "$asset_json" | grep -q '"success":true'; then pass "minimal project asset"; else fail "minimal project asset"; fi

  assert_job_enqueue "Minimal Auto Build" "/api/projects/$MINIMAL_ID/minimal/auto-build" '{}'
  assert_job_enqueue "Minimal Auto Write" "/api/projects/$MINIMAL_ID/minimal/auto-write" '{}'
  assert_job_enqueue "Minimal Improve" "/api/projects/$MINIMAL_ID/minimal/improve" '{}'
else
  fail "create minimal project"
fi

if [[ "$failures" -eq 0 ]]; then
  echo "LONG JOB SMOKE: PASS"
  exit 0
fi

echo "LONG JOB SMOKE: FAIL ($failures)"
exit 1
