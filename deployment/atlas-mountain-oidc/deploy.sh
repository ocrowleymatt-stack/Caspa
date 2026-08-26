#!/usr/bin/env bash
set -euo pipefail

SHA="${1:?commit sha required}"
ARCHIVE="${2:?archive path required}"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'invalid commit sha' >&2; exit 2; }
test -s "$ARCHIVE"

APP_ROOT=/opt/atlas-mountain
RELEASE_DIR="$APP_ROOT/releases/$SHA"
CURRENT_LINK="$APP_ROOT/current"
DATA_DIR=/var/lib/atlas-mountain
ENV_DIR=/etc/atlas-mountain
ENV_FILE="$ENV_DIR/atlas.env"
WEB_ROOT=/var/www/atlas-mountain/v12
LEGACY_ENV=/root/.atlas-secrets/atlas-router.env
VHOST_SNIPPET=/etc/nginx/snippets/atlas-mountain-v12.conf
FIXED=/root/AtlasMountainDeploy
SERVICE=atlas-mountain-nexus.service
PUBLIC_HOST=atlas.ocrowley.com
PREVIOUS=""
NGINX_BACKUP_DIR=""
NGINX_MANIFEST=""

command -v node >/dev/null
command -v npm >/dev/null
command -v nginx >/dev/null
command -v python3 >/dev/null
node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
(( node_major >= 22 )) || { echo "Node 22+ required; found $node_major" >&2; exit 2; }

# The deploy receiver runs in a strict systemd filesystem namespace. Validate a
# temporary top-level nginx config that points pid/error logging at PrivateTmp,
# while still loading the real /etc/nginx include tree. This validates the same
# vhosts without opening the live runtime pid or log files.
make_nginx_test_conf() {
  local dest="$1"
  python3 - /etc/nginx/nginx.conf "$dest" <<'PY'
import re, sys
source, dest = sys.argv[1:]
text = open(source, encoding='utf-8').read()
text, pid_count = re.subn(
    r'(?m)^\s*pid\s+[^;]+;',
    'pid /tmp/atlas-mountain-nginx-test.pid;',
    text,
    count=1,
)
if pid_count == 0:
    text = 'pid /tmp/atlas-mountain-nginx-test.pid;\n' + text
text, error_count = re.subn(
    r'(?m)^\s*error_log\s+[^;]+;',
    'error_log stderr notice;',
    text,
    count=1,
)
if error_count == 0:
    text = 'error_log stderr notice;\n' + text
open(dest, 'w', encoding='utf-8').write(text)
PY
}

nginx_test() {
  local test_conf
  test_conf="$(mktemp /tmp/atlas-mountain-nginx.XXXXXX.conf)"
  make_nginx_test_conf "$test_conf"
  nginx -t -p /etc/nginx/ -c "$test_conf"
  local rc=$?
  rm -f "$test_conf" /tmp/atlas-mountain-nginx-test.pid
  return "$rc"
}

# Emit the real loaded config paths through the same sandbox-safe top-level
# config used by nginx_test. The Atlas release helper consumes these as seed
# files, so it does not depend on a naked `nginx -T` succeeding inside the
# receiver's systemd namespace.
nginx_effective_paths() {
  local test_conf dump_file rc
  test_conf="$(mktemp /tmp/atlas-mountain-nginx.XXXXXX.conf)"
  dump_file="$(mktemp /tmp/atlas-mountain-nginx-dump.XXXXXX.txt)"
  make_nginx_test_conf "$test_conf"
  set +e
  nginx -T -p /etc/nginx/ -c "$test_conf" >"$dump_file" 2>&1
  rc=$?
  set -e
  if (( rc != 0 )); then
    cat "$dump_file" >&2
    rm -f "$test_conf" "$dump_file" /tmp/atlas-mountain-nginx-test.pid
    return "$rc"
  fi
  python3 - "$dump_file" <<'PY'
import re, sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
seen = set()
for match in re.finditer(r'^# configuration file (?P<path>/[^:]+):\s*$', text, flags=re.M):
    path = Path(match.group('path'))
    try:
        resolved = path.resolve()
    except OSError:
        continue
    if resolved.is_file() and str(resolved) not in seen:
        seen.add(str(resolved))
        print(resolved)
PY
  rm -f "$test_conf" "$dump_file" /tmp/atlas-mountain-nginx-test.pid
}

# Publish browser assets with deterministic public-read permissions. Do not use
# cp -a here: it preserves the build directory's mode onto WEB_ROOT, which can
# make nginx lose traversal/read access even though the individual files exist.
publish_static_tree() {
  local source_dir="$1"
  test -s "$source_dir/index.html"
  rm -rf "$WEB_ROOT"
  install -d -o root -g root -m 0755 "$WEB_ROOT"
  cp -R "$source_dir"/. "$WEB_ROOT"/
  chown -R root:root "$WEB_ROOT"
  find "$WEB_ROOT" -type d -exec chmod 0755 {} +
  find "$WEB_ROOT" -type f -exec chmod 0644 {} +
  test -s "$WEB_ROOT/index.html"

  local nginx_user
  nginx_user="$(awk '$1 == "user" {gsub(/;/, "", $2); print $2; exit}' /etc/nginx/nginx.conf 2>/dev/null || true)"
  if [[ -n "$nginx_user" ]] && id "$nginx_user" >/dev/null 2>&1; then
    runuser -u "$nginx_user" -- test -r "$WEB_ROOT/index.html"
  fi
}

restore_nginx() {
  if [[ -n "$NGINX_MANIFEST" && -f "$NGINX_MANIFEST" && -s "$RELEASE_DIR/deploy/hetzner/mount-nginx-snippet.py" ]]; then
    python3 "$RELEASE_DIR/deploy/hetzner/mount-nginx-snippet.py" restore --manifest "$NGINX_MANIFEST" || true
    nginx_test >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
  fi
}

cleanup_nginx_backup() {
  if [[ -n "$NGINX_BACKUP_DIR" ]]; then
    rm -rf "$NGINX_BACKUP_DIR"
    NGINX_BACKUP_DIR=""
    NGINX_MANIFEST=""
  fi
}

nginx_test >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:3002/health >/dev/null

if ! id atlasmountain >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --create-home --shell /usr/sbin/nologin atlasmountain
fi
install -d -o root -g root -m 0755 "$APP_ROOT" "$APP_ROOT/releases" /var/www/atlas-mountain /etc/nginx/snippets
install -d -o atlasmountain -g atlasmountain -m 0750 "$DATA_DIR" "$DATA_DIR/workspace"
install -d -o root -g atlasmountain -m 0750 "$ENV_DIR"

# Reject absolute/path-traversing archive entries before extraction.
while IFS= read -r entry; do
  [[ -n "$entry" ]] || continue
  [[ "$entry" != /* ]] || { echo "absolute archive entry rejected: $entry" >&2; exit 2; }
  [[ "/$entry/" != *"/../"* ]] || { echo "traversal archive entry rejected: $entry" >&2; exit 2; }
done < <(tar -tzf "$ARCHIVE")

rm -rf "$RELEASE_DIR"
install -d -o atlasmountain -g atlasmountain -m 0755 "$RELEASE_DIR"
tar --no-same-owner --no-same-permissions -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R atlasmountain:atlasmountain "$RELEASE_DIR"

# Build and run the repository verification gate without root privileges.
runuser -u atlasmountain -- env HOME="$DATA_DIR" PATH="$PATH" bash -lc \
  "cd '$RELEASE_DIR' && npm ci && npm run verify"

test -s "$RELEASE_DIR/apps/desktop/dist/index.html"
test -s "$RELEASE_DIR/services/nexus/dist/index.js"
test -s "$RELEASE_DIR/deploy/hetzner/nginx-atlas-mountain-v12.conf"
test -s "$RELEASE_DIR/deploy/hetzner/mount-nginx-snippet.py"

# Build the Nexus EnvironmentFile without executing repository code as root.
python3 - "$LEGACY_ENV" "$ENV_FILE" <<'PY'
import json, os, re, sys
source_path, dest_path = sys.argv[1:]

def parse(path):
    out = {}
    try:
        text = open(path, encoding='utf-8').read()
    except FileNotFoundError:
        return out
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
        if not m:
            continue
        value = m.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        out[m.group(1)] = value
    return out

source = parse(source_path)
dest = parse(dest_path)
aliases = {
    'OPENAI_API_KEY': ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
    'ANTHROPIC_API_KEY': ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY'],
    'GOOGLE_API_KEY': ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
    'OPENROUTER_API_KEY': ['OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY'],
    'VENICE_API_KEY': ['VENICE_API_KEY', 'VITE_VENICE_API_KEY'],
    'BRAVE_SEARCH_API_KEY': ['BRAVE_SEARCH_API_KEY', 'VITE_BRAVE_SEARCH_API_KEY'],
    'OLLAMA_BASE_URL': ['OLLAMA_BASE_URL'],
    'OLLAMA_MODEL': ['OLLAMA_MODEL'],
    'OLLAMA_MODELS': ['OLLAMA_MODELS'],
    'NEXUS_MCP_SERVERS': ['NEXUS_MCP_SERVERS'],
}
for target, names in aliases.items():
    if dest.get(target):
        continue
    for name in names:
        if source.get(name):
            dest[target] = source[name]
            break

# Deployment-owned settings cannot be overridden by legacy config.
dest.update({
    'NEXUS_HOST': '127.0.0.1',
    'NEXUS_PORT': '43101',
    'NEXUS_DATABASE_PATH': '/var/lib/atlas-mountain/atlas.db',
    'NEXUS_FILESYSTEM_ROOT': '/var/lib/atlas-mountain/workspace',
    'NEXUS_ALLOW_FILESYSTEM_WRITE': 'true',
    'ATLAS_BASE_PATH': '/v12/',
})
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
with open(dest_path, 'w', encoding='utf-8') as f:
    f.write('# Atlas Mountain production environment\n')
    for key in sorted(dest):
        f.write(f'{key}={json.dumps(str(dest[key]))}\n')
os.chmod(dest_path, 0o640)
print('atlas_mountain_env_ready=true')
print('configured_keys=' + str(len(dest)))
PY
chown root:atlasmountain "$ENV_FILE"

install -o root -g root -m 0644 "$FIXED/atlas-mountain-nexus.service" "/etc/systemd/system/$SERVICE"
# The immutable Atlas release owns the application edge contract. The deploy
# bridge owns transport/authentication only; keeping a second fixed app snippet
# here caused production to lag behind Device Bridge/dev/bootstrap routes.
install -o root -g root -m 0644 "$RELEASE_DIR/deploy/hetzner/nginx-atlas-mountain-v12.conf" "$VHOST_SNIPPET"

# Prefer exactly the files nginx says are loaded. The old fallback recursively
# grepped conf.d and mutated timestamped .bak files that nginx never included.
mapfile -t effective_candidates < <(nginx_effective_paths)
if (( ${#effective_candidates[@]} > 0 )); then
  mount_candidates=("${effective_candidates[@]}")
else
  mapfile -t mount_candidates < <(
    {
      find /etc/nginx/conf.d -maxdepth 1 -type f -name '*.conf' -print 2>/dev/null
      find -L /etc/nginx/sites-enabled -maxdepth 1 -type f -print 2>/dev/null
    } | while read -r file; do readlink -f "$file"; done | sort -u
  )
fi
(( ${#mount_candidates[@]} > 0 )) || { echo 'no loaded nginx config paths discovered' >&2; exit 2; }

NGINX_BACKUP_DIR="$(mktemp -d /tmp/atlas-nginx-backup.XXXXXX)"
NGINX_MANIFEST="$NGINX_BACKUP_DIR/manifest.json"
python3 "$RELEASE_DIR/deploy/hetzner/mount-nginx-snippet.py" apply \
  --backup-dir "$NGINX_BACKUP_DIR/files" \
  --manifest "$NGINX_MANIFEST" \
  "${mount_candidates[@]}"

if ! nginx_test; then
  restore_nginx
  cleanup_nginx_backup
  echo 'nginx validation failed; restored every Atlas edge file' >&2
  exit 2
fi

if [[ -L "$CURRENT_LINK" ]]; then PREVIOUS="$(readlink -f "$CURRENT_LINK")"; fi
publish_static_tree "$RELEASE_DIR/apps/desktop/dist"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

rollback_runtime() {
  local rc=$?
  if (( rc != 0 )); then
    echo 'atlas_mountain_runtime_rollback=true' >&2
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
      ln -sfn "$PREVIOUS" "$CURRENT_LINK"
      publish_static_tree "$PREVIOUS/apps/desktop/dist" 2>/dev/null || true
      systemctl restart "$SERVICE" >/dev/null 2>&1 || true
    fi
    restore_nginx
  fi
  cleanup_nginx_backup
  exit "$rc"
}
trap rollback_runtime EXIT

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"
for _ in $(seq 1 40); do
  curl -fsS --max-time 3 http://127.0.0.1:43101/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:43101/health >/dev/null
systemctl reload nginx

# The anonymous UI intentionally redirects to Atlas's own login shell. The API
# remains authentication-gated; the login shell itself must be a real Atlas
# document, not a redirect loop or legacy application.
curl -fsS --max-time 8 https://atlas.ocrowley.com/health >/dev/null
api_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/api/models || true)"
case "$api_status" in 401|403) ;; *) echo "anonymous v12 API gate failed: HTTP ${api_status:-000}" >&2; exit 2 ;; esac
ui_headers="$(mktemp /tmp/atlas-v12-headers.XXXXXX)"
ui_status="$(curl -ksS -D "$ui_headers" -o /dev/null -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/ || true)"
[[ "$ui_status" == '302' ]] || { echo "anonymous v12 UI did not redirect to Atlas login: HTTP ${ui_status:-000}" >&2; cat "$ui_headers" >&2 || true; exit 2; }
grep -Eqi '^location:[[:space:]]*(https://atlas\.ocrowley\.com)?/v12/login([[:space:]]|$)' "$ui_headers" || { echo 'v12 UI redirect target was not /v12/login' >&2; cat "$ui_headers" >&2 || true; exit 2; }
login_body="$(mktemp /tmp/atlas-login-body.XXXXXX)"
login_status="$(curl -ksS -o "$login_body" -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/login || true)"
[[ "$login_status" == '200' ]] || { echo "Atlas login shell unavailable: HTTP ${login_status:-000}" >&2; exit 2; }
grep -qi '<!doctype html' "$login_body" || { echo 'Atlas login route did not return the application shell' >&2; exit 2; }
rm -f "$ui_headers" "$login_body"

# Device Bridge must reach Nexus on the host-selected Atlas vhost. The external
# GitHub workflow separately verifies the true public socket after this deploy.
direct_bridge_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 -X POST http://127.0.0.1:43101/device-bridge/device/not-a-device/poll || true)"
local_bridge_status="$(curl -ksS --resolve "${PUBLIC_HOST}:443:127.0.0.1" -o /dev/null -w '%{http_code}' --max-time 8 -X POST "https://${PUBLIC_HOST}/v12/device-bridge/device/not-a-device/poll" || true)"
public_bridge_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 -X POST "https://${PUBLIC_HOST}/v12/device-bridge/device/not-a-device/poll" || true)"
[[ "$direct_bridge_status" == '401' ]] || { echo "direct Nexus Device Bridge probe failed: HTTP ${direct_bridge_status:-000}" >&2; exit 2; }
[[ "$local_bridge_status" == '401' ]] || { echo "local SNI Device Bridge probe failed: HTTP ${local_bridge_status:-000}" >&2; exit 2; }
[[ "$public_bridge_status" == '401' ]] || { echo "public DNS Device Bridge probe failed: HTTP ${public_bridge_status:-000}" >&2; exit 2; }

echo "atlas_bridge_probe=direct_nexus:${direct_bridge_status:-000},local_sni:${local_bridge_status:-000},public_dns:${public_bridge_status:-000}"
python3 - "$NGINX_MANIFEST" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path, encoding='utf-8'))
except Exception as error:
    print('atlas_nginx_manifest_error=' + type(error).__name__)
else:
    compact = {
        'matching_https_blocks': data.get('matching_https_blocks'),
        'effective_config_files': data.get('effective_config_files'),
        'resolved_public_addresses': data.get('resolved_public_addresses'),
        'address_specific_listener_targets': data.get('address_specific_listener_targets'),
        'public_listeners_added': data.get('public_listeners_added'),
        'ipv6_listeners_added': data.get('ipv6_listeners_added'),
        'static_edge_routes_added': data.get('static_edge_routes_added'),
        'files': [
            {
                'path': row.get('path'),
                'matching_https_blocks': row.get('matching_https_blocks'),
                'public_listeners_added': row.get('public_listeners_added'),
                'static_edge_routes_added': row.get('static_edge_routes_added'),
                'ipv6_listeners_added': row.get('ipv6_listeners_added'),
            }
            for row in data.get('files', [])
        ],
    }
    print('atlas_nginx_manifest=' + json.dumps(compact, separators=(',', ':')))
PY

trap - EXIT
cleanup_nginx_backup
rm -f "$ARCHIVE"
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr | awk 'NR>5 {print $2}' | xargs -r rm -rf

echo 'atlas_mountain_deploy=true'
echo "deployed_sha=$SHA"
echo "public_ui_status=$ui_status"
echo "public_login_status=$login_status"
echo "anonymous_api_status=$api_status"
echo "device_bridge_local_status=$local_bridge_status"
echo "device_bridge_public_dns_status=$public_bridge_status"