#!/usr/bin/env bash
set -euo pipefail
SOURCE_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ROOT=/root/PortalDeploy
SERVICE=portal-deploy-receiver.service
HESTOR_SNIPPET=/etc/nginx/snippets/hestor-preview-location.conf
[[ "$EUID" -eq 0 ]] || exit 2
command -v node >/dev/null
command -v nginx >/dev/null
command -v flock >/dev/null
command -v python3 >/dev/null

# The deploy receiver runs with ProtectSystem=strict, so host identity creation
# belongs here in the SSH bootstrap phase rather than inside a signed deploy.
if ! id evidenceportal >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/ocrowley-evidence-portal --create-home --shell /usr/sbin/nologin evidenceportal
fi

install -d -o root -g root -m 0700 "$ROOT" "$ROOT/inbox" "$ROOT/logs" "$ROOT/work"
install -d -o root -g root -m 0755 /opt/ocrowley-evidence-portal /opt/ocrowley-evidence-portal/releases /etc/nginx/snippets
install -d -o root -g evidenceportal -m 0750 /etc/ocrowley-evidence-portal
install -d -o evidenceportal -g evidenceportal -m 0750 /var/lib/ocrowley-evidence-portal
install -d -o root -g root -m 0755 /var/lib/atlas-mountain/workspace/sites /var/lib/atlas-mountain/workspace/sites/hestor
install -o root -g root -m 0600 "$SOURCE_DIR/portal-receiver.mjs" "$ROOT/portal-receiver.mjs"
install -o root -g root -m 0700 "$SOURCE_DIR/portal-deploy-runner.sh" "$ROOT/portal-deploy-runner.sh"
install -o root -g root -m 0644 "$SOURCE_DIR/portal-deploy-receiver.service" "/etc/systemd/system/$SERVICE"
install -o root -g root -m 0644 "$SOURCE_DIR/hestor-preview-location.conf" "$HESTOR_SNIPPET"

# Hard-route portal.ocrowley.com/hestor/ before any Portal catch-all proxy.
# Patch the real enabled config target(s), backing each one up and rolling back
# automatically if nginx validation fails.
mapfile -t portal_configs < <(
  grep -RlE 'server_name[[:space:]]+portal\.ocrowley\.com([[:space:];]|$)' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | while read -r path; do readlink -f "$path"; done \
    | sort -u
)
if [[ "${#portal_configs[@]}" -eq 0 ]]; then
  echo 'No active nginx vhost for portal.ocrowley.com was found.' >&2
  exit 2
fi

backups=()
for config in "${portal_configs[@]}"; do
  backup="${config}.pre-hestor"
  cp -a "$config" "$backup"
  backups+=("$backup:$config")
  if ! grep -Fq 'include /etc/nginx/snippets/hestor-preview-location.conf;' "$config"; then
    python3 - "$config" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
text = path.read_text()
needle = re.compile(r'(^\s*server_name\s+portal\.ocrowley\.com\s*;\s*$)', re.M)
replacement = r'\1\n    include /etc/nginx/snippets/hestor-preview-location.conf;'
next_text, count = needle.subn(replacement, text)
if count == 0:
    raise SystemExit('portal.ocrowley.com server_name not found in '+str(path))
path.write_text(next_text)
PY
  fi
done

if ! nginx -t; then
  for pair in "${backups[@]}"; do
    backup="${pair%%:*}"
    config="${pair#*:}"
    cp -a "$backup" "$config"
  done
  nginx -t || true
  echo 'Hestor nginx patch failed validation and was rolled back.' >&2
  exit 2
fi
for pair in "${backups[@]}"; do rm -f "${pair%%:*}"; done
systemctl reload nginx

systemctl daemon-reload
systemctl reset-failed "$SERVICE" >/dev/null 2>&1 || true
systemctl enable --now "$SERVICE"
systemctl restart "$SERVICE"
for _ in $(seq 1 20); do
  curl -fsS --max-time 3 http://127.0.0.1:3017/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3017/health >/dev/null

status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 -X POST -H 'Content-Type: application/json' --data '{}' https://atlas.ocrowley.com/__portal_deploy/v1 || true)"
[[ "$status" == 401 ]] || { echo "unexpected portal receiver status: ${status:-000}" >&2; exit 2; }

# Hestor may not have an index yet, but the edge must identify itself and must
# never redirect into Atlas or Portal auth/SPAs.
hestor_headers="$(curl -ksSI --max-time 8 https://portal.ocrowley.com/hestor/ || true)"
if printf '%s\n' "$hestor_headers" | grep -qiE '^location: .*atlas\.ocrowley\.com|^location: .*/v12/|^location: .*/login'; then
  echo 'Hestor preview still redirects into an application/auth route.' >&2
  exit 2
fi

echo 'portal_receiver_bootstrap=true'
echo "portal_receiver_public_unauthenticated=$status"
echo 'hestor_static_route_installed=true'
