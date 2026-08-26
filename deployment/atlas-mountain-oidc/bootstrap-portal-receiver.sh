#!/usr/bin/env bash
set -euo pipefail
SOURCE_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ROOT=/root/PortalDeploy
SERVICE=portal-deploy-receiver.service
[[ "$EUID" -eq 0 ]] || exit 2
command -v node >/dev/null
command -v nginx >/dev/null
command -v flock >/dev/null

# The deploy receiver runs with ProtectSystem=strict, so host identity creation
# belongs here in the SSH bootstrap phase rather than inside a signed deploy.
if ! id evidenceportal >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/ocrowley-evidence-portal --create-home --shell /usr/sbin/nologin evidenceportal
fi

install -d -o root -g root -m 0700 "$ROOT" "$ROOT/inbox" "$ROOT/logs" "$ROOT/work"
install -d -o root -g root -m 0755 /opt/ocrowley-evidence-portal /opt/ocrowley-evidence-portal/releases /etc/nginx/snippets
install -d -o root -g evidenceportal -m 0750 /etc/ocrowley-evidence-portal
install -d -o evidenceportal -g evidenceportal -m 0750 /var/lib/ocrowley-evidence-portal
install -o root -g root -m 0600 "$SOURCE_DIR/portal-receiver.mjs" "$ROOT/portal-receiver.mjs"
install -o root -g root -m 0700 "$SOURCE_DIR/portal-deploy-runner.sh" "$ROOT/portal-deploy-runner.sh"
install -o root -g root -m 0644 "$SOURCE_DIR/portal-deploy-receiver.service" "/etc/systemd/system/$SERVICE"
systemctl daemon-reload
systemctl reset-failed "$SERVICE" >/dev/null 2>&1 || true
systemctl enable --now "$SERVICE"
systemctl restart "$SERVICE"
for _ in $(seq 1 20); do
  curl -fsS --max-time 3 http://127.0.0.1:3017/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3017/health >/dev/null
nginx -t
systemctl reload nginx
status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 -X POST -H 'Content-Type: application/json' --data '{}' https://atlas.ocrowley.com/__portal_deploy/v1 || true)"
[[ "$status" == 401 ]] || { echo "unexpected portal receiver status: ${status:-000}" >&2; exit 2; }
echo 'portal_receiver_bootstrap=true'
echo "portal_receiver_public_unauthenticated=$status"
