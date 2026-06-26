#!/usr/bin/env bash
# Production deploy on Hetzner — pull from GitHub, build, restart pm2.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/Caspa}"
BRANCH="${1:-caspa-studio}"
PM2_NAME="${PM2_NAME:-caspa-server}"

cd "$APP_DIR"

echo "==> Stopping legacy /opt/caspa services if they are holding port 3000"
for legacy_unit in caspa.service novelwriter.service; do
  if systemctl is-active --quiet "$legacy_unit" 2>/dev/null; then
    systemctl stop "$legacy_unit"
    echo "==> Stopped $legacy_unit"
  fi
  if systemctl is-enabled --quiet "$legacy_unit" 2>/dev/null; then
    systemctl disable "$legacy_unit"
    echo "==> Disabled $legacy_unit"
  fi
done

echo "==> Fetching origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm install
(cd caspa-ui && npm install)

if ! grep -q '^AUTH_ENABLED=true' .env 2>/dev/null; then
  if grep -q '^AUTH_ENABLED=' .env 2>/dev/null; then
    sed -i 's/^AUTH_ENABLED=.*/AUTH_ENABLED=true/' .env
  else
    echo 'AUTH_ENABLED=true' >> .env
  fi
  echo "==> Enabled AUTH_ENABLED=true in .env"
fi

if ! grep -q '^OLLAMA_MODEL=' .env 2>/dev/null; then
  echo 'OLLAMA_MODEL=mistral:latest' >> .env
  echo "==> Set OLLAMA_MODEL=mistral:latest in .env"
fi

echo "==> Building UI + backend"
mkdir -p public
npm run deploy

echo "==> Ensuring port 3000 is free for $PM2_NAME"
pm2 stop "$PM2_NAME" >/dev/null 2>&1 || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp >/dev/null 2>&1 || true
elif command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :3000 2>/dev/null || true)
  if [[ -n "${PIDS}" ]]; then
    kill ${PIDS} >/dev/null 2>&1 || true
  fi
fi
sleep 2

echo "==> Restarting $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  NODE_ENV=production pm2 start dist/server.js --name "$PM2_NAME"
fi
pm2 save

echo "==> Deploy complete"
pm2 status "$PM2_NAME"

if [[ "${SKIP_SMOKE:-}" == "1" ]]; then
  echo "==> Skipping post-deploy smoke (SKIP_SMOKE=1)"
  exit 0
fi

echo "==> Waiting for API health"
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Post-deploy runtime smoke (expect ~8 min with AI workflows)"
if ! curl -sf http://127.0.0.1:3000/api/doctor | grep -q '"service":"CASPA Studio"'; then
  echo "==> ERROR: port 3000 is not serving CASPA Studio (legacy process may have reclaimed the port)"
  lsof -i :3000 2>/dev/null || true
  exit 1
fi
CASPA_SMOKE_STRICT=1 bash scripts/runtime-smoke.sh
