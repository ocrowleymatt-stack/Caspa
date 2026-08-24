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
PREVIOUS=""

command -v node >/dev/null
command -v npm >/dev/null
command -v nginx >/dev/null
node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
(( node_major >= 22 )) || { echo "Node 22+ required; found $node_major" >&2; exit 2; }
nginx -t >/dev/null
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
    'NEXUS_ALLOW_FILESYSTEM_WRITE': 'false',
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
install -o root -g root -m 0644 "$FIXED/nginx-app.conf" "$VHOST_SNIPPET"

# Add one managed include to the existing atlas.ocrowley.com vhost, never replace it.
mapfile -t candidates < <(
  grep -RIl --include='*.conf' --include='*' 'atlas\.ocrowley\.com' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | while read -r f; do readlink -f "$f"; done | sort -u
)
vhost=""
for candidate in "${candidates[@]}"; do
  if grep -Eq 'server_name[^;]*atlas\.ocrowley\.com' "$candidate"; then vhost="$candidate"; break; fi
done
[[ -n "$vhost" ]] || { echo 'atlas.ocrowley.com nginx vhost not found' >&2; exit 2; }
backup="${vhost}.atlas-mountain.$(date -u +%Y%m%dT%H%M%SZ).bak"
cp -a "$vhost" "$backup"

python3 - "$vhost" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
include_path = '/etc/nginx/snippets/atlas-mountain-v12.conf'
if include_path in text:
    raise SystemExit(0)
m = re.search(r'server_name\s+[^;]*\batlas\.ocrowley\.com\b[^;]*;', text)
if not m:
    raise SystemExit('server_name not found')
starts = list(re.finditer(r'\bserver\s*\{', text[:m.start()]))
if not starts:
    raise SystemExit('server block start not found')
open_pos = text.find('{', starts[-1].start())
depth = 0
quote = None
comment = False
escape = False
close = None
for i in range(open_pos, len(text)):
    c = text[i]
    if comment:
        if c == '\n': comment = False
        continue
    if quote:
        if escape: escape = False
        elif c == '\\': escape = True
        elif c == quote: quote = None
        continue
    if c == '#': comment = True; continue
    if c in ('"', "'"): quote = c; continue
    if c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            close = i
            break
if close is None or close < m.end():
    raise SystemExit('server block end not found')
text = text[:close] + '    include /etc/nginx/snippets/atlas-mountain-v12.conf;\n' + text[close:]
open(path, 'w', encoding='utf-8').write(text)
PY

if ! nginx -t; then
  cp -a "$backup" "$vhost"
  nginx -t >/dev/null 2>&1 || true
  echo 'nginx validation failed; restored vhost' >&2
  exit 2
fi

if [[ -L "$CURRENT_LINK" ]]; then PREVIOUS="$(readlink -f "$CURRENT_LINK")"; fi
rm -rf "$WEB_ROOT"
install -d -o root -g root -m 0755 "$WEB_ROOT"
cp -a "$RELEASE_DIR/apps/desktop/dist"/. "$WEB_ROOT"/
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

rollback_runtime() {
  local rc=$?
  if (( rc != 0 )); then
    echo 'atlas_mountain_runtime_rollback=true' >&2
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
      ln -sfn "$PREVIOUS" "$CURRENT_LINK"
      rm -rf "$WEB_ROOT"
      install -d -o root -g root -m 0755 "$WEB_ROOT"
      cp -a "$PREVIOUS/apps/desktop/dist"/. "$WEB_ROOT"/ 2>/dev/null || true
      systemctl restart "$SERVICE" >/dev/null 2>&1 || true
    fi
  fi
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

# Existing Atlas stays live and the new API must reject an anonymous request.
curl -fsS --max-time 8 https://atlas.ocrowley.com/health >/dev/null
api_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/api/models || true)"
case "$api_status" in 401|403) ;; *) echo "anonymous v12 API gate failed: HTTP ${api_status:-000}" >&2; exit 2 ;; esac
ui_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 https://atlas.ocrowley.com/v12/ || true)"
[[ "$ui_status" == '200' ]] || { echo "v12 static UI unavailable: HTTP ${ui_status:-000}" >&2; exit 2; }

trap - EXIT
rm -f "$ARCHIVE"
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr | awk 'NR>5 {print $2}' | xargs -r rm -rf

echo 'atlas_mountain_deploy=true'
echo "deployed_sha=$SHA"
echo "public_ui_status=$ui_status"
echo "anonymous_api_status=$api_status"
