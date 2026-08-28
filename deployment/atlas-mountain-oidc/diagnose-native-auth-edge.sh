#!/usr/bin/env bash
set -u

# Read-only live diagnostic for Atlas native-auth/nginx routing.
probe() {
  local name="$1"; shift
  echo "--- $name ---"
  "$@" 2>&1 || true
}

echo "atlas_native_auth_edge_diagnostic_begin"
date -u +'%Y-%m-%dT%H:%M:%SZ'

probe service_status systemctl --no-pager --full status atlas-mountain-nexus.service
probe listeners ss -ltnp
probe nexus_health curl -i -sS --max-time 5 http://127.0.0.1:43101/health
probe auth_health curl -i -sS --max-time 5 http://127.0.0.1:43105/health
probe auth_check_anonymous curl -i -sS --max-time 5 http://127.0.0.1:43105/check
probe local_https_api curl -kisS --max-time 8 --resolve atlas.ocrowley.com:443:127.0.0.1 https://atlas.ocrowley.com/v12/api/models
probe local_https_root curl -kisS --max-time 8 --resolve atlas.ocrowley.com:443:127.0.0.1 https://atlas.ocrowley.com/v12/
probe public_https_api curl -kisS --max-time 8 https://atlas.ocrowley.com/v12/api/models

echo '--- active_release ---'
readlink -f /opt/atlas-mountain/current 2>&1 || true

echo '--- service_environment_contract ---'
systemctl cat atlas-mountain-nexus.service 2>&1 | grep -E 'NEXUS_(NATIVE_AUTH_ENABLED|AUTH_MODE)|ExecStart|EnvironmentFile' || true

echo '--- nginx_atlas_matches ---'
nginx -T 2>&1 | grep -n -E 'atlas\.ocrowley\.com|__atlas_mountain_auth|43105|location .*/v12/api|atlas-mountain-v12\.conf' | head -n 240 || true

echo '--- auth_gateway_atlas_section ---'
if [ -f /etc/nginx/conf.d/auth-gateway.conf ]; then
  grep -n -C 12 -E 'atlas\.ocrowley\.com|__atlas_mountain_auth|43105|/v12/api|atlas-mountain-v12\.conf' /etc/nginx/conf.d/auth-gateway.conf | head -n 320 || true
fi

echo '--- managed_snippet ---'
if [ -f /etc/nginx/snippets/atlas-mountain-v12.conf ]; then
  sed -n '1,360p' /etc/nginx/snippets/atlas-mountain-v12.conf
else
  echo 'missing /etc/nginx/snippets/atlas-mountain-v12.conf'
fi

echo '--- recent_nexus_journal ---'
journalctl -u atlas-mountain-nexus.service --since '-10 minutes' --no-pager -n 180 2>&1 || true

echo "atlas_native_auth_edge_diagnostic_end"
