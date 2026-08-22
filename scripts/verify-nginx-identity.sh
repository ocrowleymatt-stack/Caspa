#!/usr/bin/env bash
# Verify the live nginx identity path before any Caspa deploy.
# Expected: client identity headers are stripped, Authentik headers are injected,
# and Caspa stays on loopback/internal bind.
set -euo pipefail

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

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
  echo "NOTE: no live nginx Caspa conf found on this host — check the production gateway before deploy."
  exit 0
fi

echo "$CONFS" | while read -r conf; do
  [[ -z "$conf" ]] && continue
  grep -Eq "proxy_set_header[[:space:]]+X-Authentik-Uid" "$conf" || fail "$conf does not inject X-Authentik-Uid"
  grep -Eq "proxy_set_header[[:space:]]+X-Caspa-Proxy-Secret" "$conf" || fail "$conf does not inject the proxy secret"
  grep -Eq "proxy_set_header[[:space:]]+X-Authentik-Uid[[:space:]]+(\"\")?[[:space:]]*;|proxy_hide_header[[:space:]]+X-Authentik-Uid|more_clear_input_headers[[:space:]]+['\"]?X-Authentik-Uid" "$conf" \
    || grep -Eq "proxy_set_header[[:space:]]+X-Authentik-Uid[[:space:]]+\\\$" "$conf" \
    || fail "$conf must overwrite client-supplied X-Authentik-Uid"
  ok "$(basename "$conf") injects trusted Authentik identity"
done
