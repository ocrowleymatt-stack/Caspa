#!/usr/bin/env bash
# Verify the live nginx identity path before any Caspa deploy.
# Fail-closed: missing conf is a failure. Client-supplied $http_ identity
# headers must never be forwarded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

evaluate_conf() {
  local conf="$1"
  [[ -f "$conf" ]] || fail "nginx conf not found: $conf"
  if [[ -x "$ROOT/node_modules/.bin/tsx" ]]; then
    "$ROOT/node_modules/.bin/tsx" "$ROOT/src/services/nginxIdentityPolicy.ts" "$conf"
  elif command -v tsx >/dev/null 2>&1; then
    tsx "$ROOT/src/services/nginxIdentityPolicy.ts" "$conf"
  else
    node --experimental-strip-types "$ROOT/src/services/nginxIdentityPolicy.ts" "$conf"
  fi
}

if [[ -n "${VERIFY_NGINX_CONF:-}" ]]; then
  evaluate_conf "$VERIFY_NGINX_CONF"
  ok "$(basename "$VERIFY_NGINX_CONF") satisfies the fail-closed identity policy"
  exit 0
fi

BIND="${CASPA_BIND_HOST:-127.0.0.1}"
if [[ "$BIND" != "127.0.0.1" && "$BIND" != "localhost" && "$BIND" != "::1" ]]; then
  fail "CASPA_BIND_HOST is $BIND — Caspa must bind loopback/internal-only"
fi
ok "Caspa bind host is loopback ($BIND)"

if ss -ltn 2>/dev/null | grep -qE '0\.0\.0\.0:3000|:::3000'; then
  fail "Port 3000 is listening on a public address"
fi
ok "Port 3000 is not on 0.0.0.0"

CONFS=""
for path in \
  /etc/nginx/conf.d/auth-gateway.conf \
  /etc/nginx/conf.d/caspa.conf \
  /etc/nginx/conf.d/caspa.ocrowley.com.conf \
  /etc/nginx/sites-enabled/caspa \
  /etc/nginx/sites-enabled/caspa.ocrowley.com
do
  if [[ -f "$path" ]]; then
    CONFS+="$path"$'\n'
  fi
done

if [[ -z "$CONFS" ]]; then
  fail "no live nginx Caspa conf found — refusing to approve an unverified identity path"
fi

while IFS= read -r conf; do
  [[ -z "$conf" ]] && continue
  evaluate_conf "$conf"
  ok "$(basename "$conf") satisfies the fail-closed identity policy"
done <<< "$CONFS"
