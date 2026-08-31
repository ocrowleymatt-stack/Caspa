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
DEPLOY_SCRIPT="$ROOT/deploy.sh"
TEMP_ROOT_DEPLOY=""

install -d -o root -g root -m 0700 "$LOG_DIR"
touch "$LOG_FILE"
chmod 0600 "$LOG_FILE"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo 'atlas_mountain_deploy_busy=true' >&2
  exit 75
fi

# The deployment bridge predates the root-canonical Atlas cut-over. Preserve the
# legacy /v12 deploy implementation for old releases, but adapt it transactionally
# when an incoming immutable release declares the root nginx contract. This keeps
# the receiver/bootstrap independent of application release cadence without
# hand-editing live nginx.
if tar -tzf "$ARCHIVE" | grep -qx './deploy/hetzner/nginx-atlas-mountain-root.conf'; then
  TEMP_ROOT_DEPLOY="$(mktemp "$ROOT/root-deploy.XXXXXX.sh")"
  python3 - "$ROOT/deploy.sh" "$TEMP_ROOT_DEPLOY" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding='utf-8')
out = source
replacements = [
    ('WEB_ROOT=/var/www/atlas-mountain/v12', 'WEB_ROOT=/var/www/atlas-mountain'),
    ('VHOST_SNIPPET=/etc/nginx/snippets/atlas-mountain-v12.conf', 'VHOST_SNIPPET=/etc/nginx/snippets/atlas-mountain-root.conf'),
    ('nginx-atlas-mountain-v12.conf', 'nginx-atlas-mountain-root.conf'),
    ("'ATLAS_BASE_PATH': '/v12/',", "'ATLAS_BASE_PATH': '/',"),
    ('https://atlas.ocrowley.com/v12/api/models', 'https://atlas.ocrowley.com/api/models'),
    ('https://atlas.ocrowley.com/v12/', 'https://atlas.ocrowley.com/'),
    ('https://atlas.ocrowley.com/v12/login', 'https://atlas.ocrowley.com/login'),
    ('https://${PUBLIC_HOST}/v12/device-bridge/device/not-a-device/poll', 'https://${PUBLIC_HOST}/device-bridge/device/not-a-device/poll'),
    (r"^location:[[:space:]]*(https://atlas\\.ocrowley\\.com)?/v12/login([[:space:]]|$)", r"^location:[[:space:]]*(https://atlas\\.ocrowley\\.com)?/login([[:space:]]|$)"),
]
for old, new in replacements:
    if old not in out:
        raise SystemExit(f'root deploy adapter contract drift: missing {old!r}')
    out = out.replace(old, new)

# The root cut-over intentionally removes /v12 as the application base. Keep the
# legacy script's diagnostics/messages harmless, but reject any remaining live
# URL/config dependency that would route the deployment back through /v12.
for forbidden in (
    'WEB_ROOT=/var/www/atlas-mountain/v12',
    'VHOST_SNIPPET=/etc/nginx/snippets/atlas-mountain-v12.conf',
    "'ATLAS_BASE_PATH': '/v12/'",
    'https://atlas.ocrowley.com/v12/api/models',
    'https://${PUBLIC_HOST}/v12/device-bridge/',
):
    if forbidden in out:
        raise SystemExit(f'root deploy adapter left stale contract: {forbidden}')

Path(sys.argv[2]).write_text(out, encoding='utf-8')
PY
  chmod 0700 "$TEMP_ROOT_DEPLOY"
  DEPLOY_SCRIPT="$TEMP_ROOT_DEPLOY"
  echo 'atlas_mountain_root_deploy_adapter=true' >>"$LOG_FILE"
fi

cleanup() {
  [[ -z "$TEMP_ROOT_DEPLOY" ]] || rm -f "$TEMP_ROOT_DEPLOY"
}
trap cleanup EXIT

started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_start sha=%s run_id=%s\n' "$started" "$SHA" "$RUN_ID" >>"$LOG_FILE"

# The normal authenticated deploy implementation remains authoritative. The
# root adapter changes only the retired path contract; authentication, locking,
# verification, rollback and nginx transaction handling are unchanged.
set +e
"$DEPLOY_SCRIPT" "$SHA" "$ARCHIVE" \
  > >(tee -a "$LOG_FILE") \
  2> >(tee -a "$LOG_FILE" >&2)
status=$?
set -e

finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s deploy_end sha=%s run_id=%s status=%s\n' "$finished" "$SHA" "$RUN_ID" "$status" >>"$LOG_FILE"

exit "$status"
