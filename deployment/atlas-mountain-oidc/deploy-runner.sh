#!/usr/bin/env bash
set -euo pipefail
umask 077

SHA="${1:?commit sha required}"
ARCHIVE="${2:?archive path required}"
RUN_ID="${3:-unknown}"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'invalid commit sha' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || RUN_ID=unknown
test -s "$ARCHIVE"

ROOT=/root/AtlasMountainDeploy
LOG_DIR="$ROOT/logs"
LOCK_FILE="$ROOT/deploy.lock"
LOG_FILE="$LOG_DIR/${SHA}.log"
RUNTIME_DEPLOY="$ROOT/.deploy-login-canary-${SHA}-$$.sh"

install -d -o root -g root -m 0700 "$LOG_DIR"
touch "$LOG_FILE"
chmod 0600 "$LOG_FILE"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo 'atlas_mountain_deploy_busy=true' >&2
  exit 75
fi

started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_start sha=%s run_id=%s\n' "$started" "$SHA" "$RUN_ID" >>"$LOG_FILE"

# The normal deploy implementation is authoritative. Patch only the redirect
# assertion in a private one-run copy: Atlas deliberately preserves the original
# request as ?next=... on /v12/login, which is a valid native-login redirect.
cp "$ROOT/deploy.sh" "$RUNTIME_DEPLOY"
chmod 0700 "$RUNTIME_DEPLOY"
python3 - "$RUNTIME_DEPLOY" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
old = "grep -Eqi '^location:[[:space:]]*(https://atlas\\.ocrowley\\.com)?/v12/login([[:space:]]|$)' \"$ui_headers\""
new = "grep -Eqi '^location:[[:space:]]*(https://atlas\\.ocrowley\\.com)?/v12/login([?[:space:]]|$)' \"$ui_headers\""
if old not in text:
    raise SystemExit('Could not locate Atlas native-login redirect canary')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
PY

set +e
"$RUNTIME_DEPLOY" "$SHA" "$ARCHIVE" \
  > >(tee -a "$LOG_FILE") \
  2> >(tee -a "$LOG_FILE" >&2)
status=$?
set -e
rm -f "$RUNTIME_DEPLOY"

finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_end sha=%s run_id=%s status=%s\n' "$finished" "$SHA" "$RUN_ID" "$status" >>"$LOG_FILE"

exit "$status"
