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

EMAIL="${ADMIN_EMAIL:-${CASPA_ADMIN_EMAIL:-}}"
PASSWORD="${ADMIN_PASSWORD:-${CASPA_ADMIN_PASSWORD:-}}"

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

start_ms=$(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
)

nwp_json=$(curl -sS -X POST "$BASE_URL/api/casper/novel-write-pro" "${AUTH[@]}" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"mode\":\"novel\",\"spark\":\"Smoke test opening.\",\"source\":\"A short smoke test paragraph for job queue verification.\"}")

elapsed=$(( $(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
) - start_ms ))

JOB_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.jobId||'')" <<< "$nwp_json")

if [[ -n "$JOB_ID" ]]; then
  pass "NWP returned jobId in ${elapsed}ms"
else
  fail "NWP missing jobId (response: $nwp_json)"
fi

if [[ "$elapsed" -lt 5000 ]]; then pass "NWP response under 5s"; else fail "NWP response ${elapsed}ms (>5s)"; fi

if [[ -n "$JOB_ID" ]]; then
  progress_json=$(curl -sS "$BASE_URL/api/jobs/$JOB_ID/progress" -H "Authorization: Bearer $TOKEN")
  if echo "$progress_json" | grep -q '"success":true'; then pass "GET job progress"; else fail "GET job progress"; fi
fi

lock_json=$(curl -sS -X POST "$BASE_URL/api/gold/source-lock" "${AUTH[@]}" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"sourceType\":\"current-manuscript\",\"pastedText\":\"Smoke test manuscript paragraph for gold job queue.\",\"mode\":\"improve-same-story\"}")
LOCK_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.sourceLockId||'')" <<< "$lock_json")

if [[ -n "$LOCK_ID" ]]; then
  pass "gold source lock"
  gold_start=$(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
)
  gold_json=$(curl -sS -X POST "$BASE_URL/api/gold/run" "${AUTH[@]}" \
    -d "{\"projectId\":\"$PROJECT_ID\",\"sourceLockId\":\"$LOCK_ID\",\"improveText\":true,\"stage\":\"revision\"}")
  gold_elapsed=$(( $(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
) - gold_start ))
  GOLD_JOB=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.data?.jobId||'')" <<< "$gold_json")
  if [[ -n "$GOLD_JOB" ]]; then pass "Gold returned jobId in ${gold_elapsed}ms"; else fail "Gold missing jobId"; fi
  if [[ "$gold_elapsed" -lt 5000 ]]; then pass "Gold response under 5s"; else fail "Gold response ${gold_elapsed}ms"; fi
else
  fail "gold source lock"
fi

if [[ "$failures" -eq 0 ]]; then
  echo "LONG JOB SMOKE: PASS"
  exit 0
fi

echo "LONG JOB SMOKE: FAIL ($failures)"
exit 1
