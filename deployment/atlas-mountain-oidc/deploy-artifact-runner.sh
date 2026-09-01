#!/usr/bin/env bash
set -euo pipefail
umask 077

SHA="${1:?commit sha required}"
RUN_ID="${2:?workflow run id required}"
ARTIFACT_NAME="${3:?artifact name required}"
TOKEN_FILE="${4:?token file required}"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'invalid commit sha' >&2; exit 64; }
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || { echo 'invalid workflow run id' >&2; exit 64; }
[[ "$ARTIFACT_NAME" == "atlas-production-$SHA" ]] || { echo 'unexpected artifact name' >&2; exit 64; }
[[ -s "$TOKEN_FILE" ]] || { echo 'missing ephemeral GitHub token' >&2; exit 66; }

ROOT=/root/AtlasMountainDeploy
WORK_ROOT="$ROOT/artifact-work"
JOB_ROOT="$WORK_ROOT/$SHA/$RUN_ID"
LOG_DIR="$ROOT/logs"
CONTROL_DIR="$ROOT/control-status"
LOG_FILE="$LOG_DIR/${SHA}.artifact.log"
CONTROL_FILE="$CONTROL_DIR/${SHA}.json"
REPO='ocrowleymatt-stack/atlas-mountain'
API='https://api.github.com'

install -d -o root -g root -m 0700 "$WORK_ROOT" "$JOB_ROOT" "$LOG_DIR" "$CONTROL_DIR"
touch "$LOG_FILE"
chmod 0600 "$LOG_FILE"

write_control() {
  local state="$1" stage="$2" reason="${3:-}"
  python3 - "$CONTROL_FILE" "$SHA" "$RUN_ID" "$state" "$stage" "$reason" <<'PY'
import json, os, sys
from datetime import datetime, timezone
path, sha, run_id, state, stage, reason = sys.argv[1:]
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
data = {}
try:
    with open(path, encoding='utf-8') as f: data = json.load(f)
except Exception: pass
data.setdefault('requestedSha', sha)
data.setdefault('runId', run_id)
data.setdefault('startedAt', now)
data['state'] = state
data['stage'] = stage
if reason: data['failureReason'] = reason
if state in {'succeeded','failed','rolled_back'}: data['finishedAt'] = now
tmp = path + '.tmp'
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, sort_keys=True); f.write('\n')
os.replace(tmp, path); os.chmod(path, 0o600)
PY
}

fail() {
  local reason="$1" code="${2:-1}"
  write_control failed failed "$reason"
  echo "$reason" >&2
  exit "$code"
}

cleanup_token() { rm -f "$TOKEN_FILE"; }
trap cleanup_token EXIT

write_control running artifact_lookup
TOKEN="$(cat "$TOKEN_FILE")"
[[ ${#TOKEN} -ge 20 ]] || fail 'ephemeral GitHub token was malformed' 65

ARTIFACTS_JSON="$JOB_ROOT/artifacts.json"
curl -fsSL --retry 3 --retry-delay 2 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "$API/repos/$REPO/actions/runs/$RUN_ID/artifacts?per_page=100" \
  -o "$ARTIFACTS_JSON" || fail 'could not list workflow artifacts'

ARTIFACT_URL="$(python3 - "$ARTIFACTS_JSON" "$ARTIFACT_NAME" "$SHA" <<'PY'
import json, sys
path, name, sha = sys.argv[1:]
data=json.load(open(path, encoding='utf-8'))
rows=[a for a in data.get('artifacts',[]) if a.get('name')==name and not a.get('expired')]
if len(rows)!=1: raise SystemExit(2)
a=rows[0]
run=a.get('workflow_run') or {}
if str(run.get('head_sha') or '').lower()!=sha.lower(): raise SystemExit(3)
print(a['archive_download_url'])
PY
)" || fail 'exact workflow artifact could not be resolved'

write_control running artifact_download
ARTIFACT_ZIP="$JOB_ROOT/artifact.zip"
curl -fsSL --retry 3 --retry-delay 2 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "$ARTIFACT_URL" -o "$ARTIFACT_ZIP" || fail 'workflow artifact download failed'
cleanup_token
TOKEN=''
[[ -s "$ARTIFACT_ZIP" ]] || fail 'downloaded workflow artifact was empty'

EXTRACT="$JOB_ROOT/release"
rm -rf "$EXTRACT"
install -d -o root -g root -m 0700 "$EXTRACT"
python3 - "$ARTIFACT_ZIP" "$EXTRACT" <<'PY' || exit 65
import os, pathlib, sys, zipfile
archive, dest = sys.argv[1:]
root=pathlib.Path(dest).resolve()
with zipfile.ZipFile(archive) as z:
    for info in z.infolist():
        target=(root / info.filename).resolve()
        if target != root and root not in target.parents:
            raise SystemExit('artifact zip traversal rejected')
    z.extractall(root)
PY

ARCHIVE="$EXTRACT/atlas-mountain-$SHA.tgz"
MANIFEST="$EXTRACT/manifest.json"
[[ -s "$ARCHIVE" && -s "$MANIFEST" ]] || fail 'artifact did not contain release archive and manifest'

write_control running artifact_verify
python3 - "$SHA" "$ARCHIVE" "$MANIFEST" <<'PY' || exit 65
import hashlib, json, sys
sha, archive, manifest_path=sys.argv[1:]
m=json.load(open(manifest_path, encoding='utf-8'))
if str(m.get('requestedSha') or m.get('sha') or '').lower()!=sha.lower():
    raise SystemExit('manifest SHA mismatch')
h=hashlib.sha256()
with open(archive,'rb') as f:
    for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
if h.hexdigest()!=str(m.get('archiveSha256') or '').lower():
    raise SystemExit('manifest archive hash mismatch')
print('atlas_artifact_hash_verified=true')
PY

HELPER="$JOB_ROOT/atlas-mountain-deploy"
tar -xOf "$ARCHIVE" './deploy/hetzner/atlas-mountain-deploy.sh' > "$HELPER" || fail 'release lacks canonical deploy helper'
chmod 0700 "$HELPER"

write_control running host_local_deploy
set +e
ATLAS_DEPLOY_WORKSPACE_PREFIX="$WORK_ROOT" \
  "$HELPER" "$SHA" "$ARCHIVE" >>"$LOG_FILE" 2>&1
rc=$?
set -e
if (( rc != 0 )); then
  tail -n 200 "$LOG_FILE" >&2 || true
  fail "host-local deploy helper failed with status $rc" "$rc"
fi

STATUS_FILE="/var/lib/atlas-mountain/deployments/$SHA.json"
python3 - "$STATUS_FILE" "$SHA" <<'PY' || fail 'deployment status did not prove requested SHA'
import json, sys
path, sha=sys.argv[1:]
data=json.load(open(path, encoding='utf-8'))
if data.get('state')!='succeeded' or str(data.get('deployedSha') or '').lower()!=sha.lower():
    raise SystemExit(1)
print('atlas_host_local_status_verified=true')
PY

write_control succeeded succeeded
printf '%s artifact_deploy_success sha=%s run_id=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" "$RUN_ID" >>"$LOG_FILE"
