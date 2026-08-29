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
RUNTIME_DEPLOY="$ROOT/.deploy-breakglass-${SHA}-$$.sh"

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

# TEMPORARY BREAK-GLASS MODE.
# Keep the normal deploy implementation authoritative for archive validation,
# rollback, OIDC transport, nginx mounting and Device Bridge checks. Replace
# only the human-login canary in a private one-run copy: current Atlas maps the
# fixed service's NEXUS_NATIVE_AUTH_ENABLED=false to NEXUS_AUTH_MODE=public.
cp "$ROOT/deploy.sh" "$RUNTIME_DEPLOY"
chmod 0700 "$RUNTIME_DEPLOY"
python3 - "$RUNTIME_DEPLOY" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
pattern = re.compile(
    r"# The anonymous UI intentionally redirects to Atlas's own login shell\..*?rm -f \"\$ui_headers\" \"\$login_body\"\n",
    re.S,
)
replacement = r'''# TEMPORARY BREAK-GLASS PUBLIC AVAILABILITY CANARY.
# Human login is deliberately disabled while the login edge is repaired.
# Deployment OIDC and paired-device authentication remain separate.
curl -fsS --max-time 8 https://atlas.ocrowley.com/health >/dev/null
api_status="$(curl -ksS -o /tmp/atlas-breakglass-models.json -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/api/models || true)"
[[ "$api_status" == '200' ]] || { echo "break-glass public v12 API unavailable: HTTP ${api_status:-000}" >&2; exit 2; }
python3 - /tmp/atlas-breakglass-models.json <<'PYJSON'
import json, sys
payload=json.load(open(sys.argv[1], encoding='utf-8'))
assert isinstance(payload, (dict, list)), type(payload).__name__
PYJSON
ui_body="$(mktemp /tmp/atlas-v12-body.XXXXXX)"
ui_status="$(curl -ksS -o "$ui_body" -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/ || true)"
[[ "$ui_status" == '200' ]] || { echo "break-glass public v12 UI unavailable: HTTP ${ui_status:-000}" >&2; exit 2; }
grep -qi '<!doctype html' "$ui_body" || { echo 'break-glass Atlas UI did not return HTML' >&2; exit 2; }
device_api_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/device-api/models || true)"
case "$device_api_status" in 401|403) ;; *) echo "paired-device API unexpectedly public: HTTP ${device_api_status:-000}" >&2; exit 2 ;; esac
login_status=disabled
rm -f "$ui_body" /tmp/atlas-breakglass-models.json
echo "atlas_breakglass_mode=true"
echo "atlas_breakglass_public_api=true status=$api_status"
echo "atlas_breakglass_public_ui=true status=$ui_status"
echo "atlas_breakglass_device_api_protected=true status=$device_api_status"
'''
updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('Could not locate the authenticated Atlas deployment canary to replace')
path.write_text(updated, encoding='utf-8')
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
