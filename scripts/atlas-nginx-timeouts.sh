#!/usr/bin/env bash
# Ensure Caspa nginx site allows long AI/research requests.
# Safe to re-run. Reloads nginx only when the config changes.
set -euo pipefail

SITE="${1:-/etc/nginx/sites-enabled/caspa.ocrowley.com}"
if [ ! -f "$SITE" ]; then
  echo "SKIP: nginx site not found at $SITE"
  exit 0
fi

TARGET="1800s"

python3 - "$SITE" "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
target = sys.argv[2]
text = path.read_text()
needle = "        proxy_cache_bypass $http_upgrade;"
block = f"""        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout {target};
        proxy_read_timeout {target};
        send_timeout {target};"""

# Upgrade any previous Caspa timeout block in place.
pattern = re.compile(
    r"        proxy_cache_bypass \$http_upgrade;\n"
    r"        proxy_connect_timeout \S+;\n"
    r"        proxy_send_timeout \S+;\n"
    r"        proxy_read_timeout \S+;\n"
    r"        send_timeout \S+;"
)

if pattern.search(text):
    new = pattern.sub(block, text, count=1)
elif needle in text:
    new = text.replace(needle, block, 1)
else:
    raise SystemExit(f"Could not find insertion point in {path}")

if new == text:
    print(f"OK: {path} already has {target} proxy timeouts")
else:
    path.write_text(new)
    print(f"patched {path} to {target}")
PY

nginx -t
systemctl reload nginx
echo "OK: nginx reloaded with Caspa long-job timeouts"
