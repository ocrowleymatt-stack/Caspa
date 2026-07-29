#!/usr/bin/env bash
# Ensure Caspa nginx site allows long AI/research requests.
# Safe to re-run. Reloads nginx only when the config changes.
set -euo pipefail

SITE="${1:-/etc/nginx/sites-enabled/caspa.ocrowley.com}"
if [ ! -f "$SITE" ]; then
  echo "SKIP: nginx site not found at $SITE"
  exit 0
fi

if grep -q 'proxy_read_timeout 300s' "$SITE"; then
  echo "OK: $SITE already has long proxy timeouts"
  exit 0
fi

python3 - "$SITE" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
needle = "        proxy_cache_bypass $http_upgrade;"
block = """        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;"""
if needle not in text:
    raise SystemExit(f"Could not find insertion point in {path}")
if "proxy_read_timeout 300s" in text:
    print("already patched")
else:
    path.write_text(text.replace(needle, block, 1))
    print(f"patched {path}")
PY

nginx -t
systemctl reload nginx
echo "OK: nginx reloaded with Caspa AI timeouts"
