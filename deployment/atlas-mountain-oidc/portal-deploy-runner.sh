#!/usr/bin/env bash
set -euo pipefail
umask 077

SHA="${1:?commit sha required}"
ARCHIVE="${2:?archive path required}"
RUN_ID="${3:-unknown}"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || exit 2
test -s "$ARCHIVE"

ROOT=/root/PortalDeploy
LOG_DIR="$ROOT/logs"
LOCK_FILE="$ROOT/deploy.lock"
LOG_FILE="$LOG_DIR/${SHA}.log"
install -d -m 0700 "$LOG_DIR"
touch "$LOG_FILE" && chmod 0600 "$LOG_FILE"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 75

started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_start sha=%s run_id=%s\n' "$started" "$SHA" "$RUN_ID" >>"$LOG_FILE"
work="$ROOT/work/$SHA"
rm -rf "$work"
install -d -m 0700 "$work"
tar -xzf "$ARCHIVE" -C "$work"
test -x "$work/deploy/hetzner/install-existing-host.sh" || chmod +x "$work/deploy/hetzner/install-existing-host.sh"
set +e
bash "$work/deploy/hetzner/install-existing-host.sh" "$SHA" > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2)
status=$?
set -e
rm -rf "$work"
printf '%s deploy_end sha=%s run_id=%s status=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" "$RUN_ID" "$status" >>"$LOG_FILE"
exit "$status"
