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

# The normal deploy implementation is authoritative. It verifies Atlas native
# authentication directly: anonymous /v12 API access must be denied and the UI
# must redirect to the Atlas-native login shell. Do not rewrite that contract
# into temporary public break-glass mode here.
set +e
"$ROOT/deploy.sh" "$SHA" "$ARCHIVE" \
  > >(tee -a "$LOG_FILE") \
  2> >(tee -a "$LOG_FILE" >&2)
status=$?
set -e

finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_end sha=%s run_id=%s status=%s\n' "$finished" "$SHA" "$RUN_ID" "$status" >>"$LOG_FILE"

exit "$status"
