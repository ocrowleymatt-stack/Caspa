#!/usr/bin/env bash
set -euo pipefail

file=/etc/nginx/conf.d/zzz-atlas-auth.conf
backup="/var/backups/atlas-r8-cutover-$(date -u +%Y%m%dT%H%M%SZ).conf"
cp "$file" "$backup"

python3 - <<'PY'
from pathlib import Path

p = Path('/etc/nginx/conf.d/zzz-atlas-auth.conf')
s = p.read_text()
marker = 'server_name atlas.ocrowley.com;'
m = s.find(marker)
if m < 0:
    raise SystemExit('atlas.ocrowley.com TLS server block not found')

server_start = s.rfind('server {', 0, m)
server_end = s.find('\n}', m)
if server_start < 0 or server_end < 0:
    raise SystemExit('atlas.ocrowley.com server block bounds not found')

block = s[server_start:server_end + 2]
loc = block.find('location / {')
if loc < 0:
    raise SystemExit('atlas.ocrowley.com root location not found')

brace = block.find('{', loc)
depth = 0
end = None
for i in range(brace, len(block)):
    if block[i] == '{':
        depth += 1
    elif block[i] == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
if end is None:
    raise SystemExit('atlas.ocrowley.com root location is unbalanced')

new = '''location / {
        proxy_pass http://127.0.0.1:3110;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_redirect off;
    }'''

block = block[:loc] + new + block[end:]
s = s[:server_start] + block + s[server_end + 2:]
p.write_text(s)
PY

nginx -t
systemctl reload nginx

echo "backup=$backup"
echo "current_release=$(readlink -f /opt/atlas-unified/current)"

headers="$(curl -k -sS -I https://127.0.0.1/ -H 'Host: atlas.ocrowley.com')"
printf '%s\n' "$headers"
if printf '%s\n' "$headers" | grep -qi 'x-nextjs-cache'; then
  echo 'Old Next.js response is still present' >&2
  exit 1
fi

login="$(curl -k -fsS https://127.0.0.1/__atlas/login -H 'Host: atlas.ocrowley.com')"
printf '%s' "$login" | grep -q 'Sign in to private Atlas'

echo 'canonical_atlas_cutover=true'

python3 - <<'PY' >/tmp/atlas-r8-basic
import base64,json
cfg=json.load(open('/etc/atlas-unified/runtime.json'))
print('Basic '+base64.b64encode((cfg['basicUser']+':'+cfg['basicPassword']).encode()).decode())
PY
auth="$(cat /tmp/atlas-r8-basic)"
curl -k -fsS -H 'Host: atlas.ocrowley.com' -H "Authorization: $auth" https://127.0.0.1/ -o /tmp/atlas-r8-root.html
bundle="$(grep -oE 'assets/[^"]+\.js' /tmp/atlas-r8-root.html | head -1)"
test -n "$bundle"
curl -k -fsS -H 'Host: atlas.ocrowley.com' -H "Authorization: $auth" "https://127.0.0.1/$bundle" -o /tmp/atlas-r8-bundle.js
grep -q 'One project context for conversation, deep research, evidence, writing, music, and product work.' /tmp/atlas-r8-bundle.js
grep -q 'From brief to technical master candidate' /tmp/atlas-r8-bundle.js
grep -q 'Search thoroughly' /tmp/atlas-r8-bundle.js
if grep -q 'Command workspace' /tmp/atlas-r8-bundle.js; then
  echo 'Old Command workspace marker remains in active canonical bundle' >&2
  exit 1
fi
echo "r8_bundle=$bundle"
echo 'r8_authenticated_bundle=true'
