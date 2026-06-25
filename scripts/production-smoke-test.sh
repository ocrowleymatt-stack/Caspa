#!/usr/bin/env bash
# Production smoke + feature test for caspa-studio.
# Usage: BASE_URL=https://caspa.ocrowley.com ADMIN_EMAIL=... ADMIN_PASSWORD=... bash scripts/production-smoke-test.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://caspa.ocrowley.com}"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -n "$line" && "$line" == *=* ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < "$file"
}

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  load_env_file ".env"
fi

ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

pass=0
fail=0
skip=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
    pass=$((pass + 1))
  else
    echo "FAIL  $name"
    fail=$((fail + 1))
  fi
}

skip() {
  echo "SKIP  $1"
  skip=$((skip + 1))
}

json_get() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)" 2>/dev/null
}

echo "==> CASPA production smoke test"
echo "    BASE_URL=$BASE_URL"
echo

check "health returns ok" bash -c "
  curl -sf \"$BASE_URL/health\" | grep -q '\"status\":\"ok\"'
"

check "health includes version 1.0.0" bash -c "
  curl -sf \"$BASE_URL/health\" | grep -q '\"version\":\"1.0.0\"'
"

check "index.html served (not Vite blocked host)" bash -c "
  body=\$(curl -sf \"$BASE_URL/\")
  echo \"\$body\" | grep -q 'assets/index-'
  ! echo \"\$body\" | grep -q 'Blocked request'
"

check "warm UI bundle contains marker text" bash -c "
  js=\$(curl -sf \"$BASE_URL/\" | grep -o 'assets/index-[^\"]*\\.js' | head -1)
  curl -sf \"$BASE_URL/\$js\" | grep -q 'Your rooms of work'
"

check "login page loads" bash -c "
  curl -sf \"$BASE_URL/login\" | grep -q 'assets/index-'
"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  skip "auth login (set ADMIN_EMAIL and ADMIN_PASSWORD)"
  skip "authenticated API routes"
else
  login_resp=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}") || login_resp=""

  if echo "$login_resp" | grep -q '"success":true'; then
    check "admin login" true
    TOKEN=$(echo "$login_resp" | json_get "['data']['token']")
    AUTH="Authorization: Bearer $TOKEN"

    check "GET /api/projects" bash -c "
      curl -sf -H \"$AUTH\" \"$BASE_URL/api/projects\" | grep -q '\"success\":true'
    "

    check "GET /providers (AI status)" bash -c "
      curl -sf -H \"$AUTH\" \"$BASE_URL/providers\" | grep -q '\"success\":true'
    "

    check "GET /api/casper/status" bash -c "
      curl -sf -H \"$AUTH\" \"$BASE_URL/api/casper/status\" | grep -q '\"success\":true'
    "

    check "GET /api/show-catalogue/show-factory" bash -c "
      curl -sf -H \"$AUTH\" \"$BASE_URL/api/show-catalogue/show-factory\" | grep -q '\"success\":true'
    "

    check "POST /api/command/interpret" bash -c "
      curl -sf -X POST -H \"$AUTH\" -H 'Content-Type: application/json' \
        -d '{\"text\":\"Check my project quality\"}' \
        \"$BASE_URL/api/command/interpret\" | grep -q '\"success\":true'
    "

    check "POST /api/publish-confidence/check" bash -c "
      curl -sf -X POST -H \"$AUTH\" -H 'Content-Type: application/json' \
        -d '{\"projectId\":\"demo\",\"sections\":[]}' \
        \"$BASE_URL/api/publish-confidence/check\" | grep -q '\"success\":true'
    "
  else
    check "admin login" false
    skip "authenticated API routes (login failed)"
  fi
fi

echo
echo "==> Results: $pass passed, $fail failed, $skip skipped"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
