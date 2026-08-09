#!/usr/bin/env bash
# Ensure Caspa nginx site allows long AI/research requests.
# Safe to re-run. Auto-detects the live Caspa nginx config when no path is supplied.
set -euo pipefail

TARGET="1800s"
SITE="${1:-}"

if [ -z "$SITE" ]; then
  for candidate in \
    /etc/nginx/sites-enabled/caspa.ocrowley.com \
    /etc/nginx/sites-available/caspa.ocrowley.com \
    /etc/nginx/conf.d/caspa.ocrowley.com.conf \
    /etc/nginx/conf.d/caspa.conf; do
    if [ -f "$candidate" ] && grep -q 'server_name[[:space:]].*caspa\.ocrowley\.com' "$candidate"; then
      SITE="$candidate"
      break
    fi
  done
fi

if [ -z "$SITE" ]; then
  SITE=$(grep -RIl --include='*.conf' --include='*caspa*' 'server_name[[:space:]].*caspa\.ocrowley\.com' /etc/nginx 2>/dev/null | head -n 1 || true)
fi

if [ -z "$SITE" ] || [ ! -f "$SITE" ]; then
  echo "ERROR: could not locate nginx config containing server_name caspa.ocrowley.com" >&2
  exit 2
fi

echo "Using nginx site: $SITE"

python3 - "$SITE" "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
target = sys.argv[2]
text = path.read_text()

# Replace any existing timeout directives in the Caspa server config first.
replacements = {
    'proxy_connect_timeout': '60s',
    'proxy_send_timeout': target,
    'proxy_read_timeout': target,
    'send_timeout': target,
}
new = text
for directive, value in replacements.items():
    pattern = re.compile(rf'(?m)^(\s*){directive}\s+\S+;\s*$')
    if pattern.search(new):
        new = pattern.sub(lambda m, d=directive, v=value: f"{m.group(1)}{d} {v};", new)

# If the relevant directives do not exist, insert them in the proxy location.
missing = [d for d in replacements if not re.search(rf'(?m)^\s*{d}\s+\S+;\s*$', new)]
if missing:
    insertion = "\n".join(f"        {d} {replacements[d]};" for d in missing)
    needle_patterns = [
        r'(?m)^(\s*)proxy_cache_bypass\s+\$http_upgrade;\s*$',
        r'(?m)^(\s*)proxy_http_version\s+1\.1;\s*$',
        r'(?m)^(\s*)proxy_pass\s+http://127\.0\.0\.1:3000;\s*$',
    ]
    inserted = False
    for p in needle_patterns:
        m = re.search(p, new)
        if m:
            indent = m.group(1)
            block = "\n".join(f"{indent}{d} {replacements[d]};" for d in missing)
            new = new[:m.end()] + "\n" + block + new[m.end():]
            inserted = True
            break
    if not inserted:
        raise SystemExit(f"Could not find a safe proxy insertion point in {path}")

if new == text:
    print(f"OK: {path} already has {target} proxy timeouts")
else:
    backup = path.with_suffix(path.suffix + '.pre-caspa-timeout')
    if not backup.exists():
        backup.write_text(text)
    path.write_text(new)
    print(f"patched {path} to {target}")
PY

nginx -t
systemctl reload nginx

if ! nginx -T 2>/dev/null | grep -qE 'proxy_read_timeout[[:space:]]+(1800s|30m);'; then
  echo "ERROR: nginx reloaded but 30-minute proxy_read_timeout is not active" >&2
  exit 3
fi

echo "OK: nginx reloaded with Caspa long-job timeouts"
