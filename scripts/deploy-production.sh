#!/usr/bin/env bash
# Production deploy on Hetzner — pull from GitHub, build, restart pm2.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/Caspa}"
BRANCH="${1:-caspa-studio}"
PM2_NAME="${PM2_NAME:-caspa-server}"

cd "$APP_DIR"

echo "==> Stopping legacy /opt/caspa service if it is holding port 3000"
if systemctl is-active --quiet caspa.service 2>/dev/null; then
  systemctl stop caspa.service
  systemctl disable caspa.service
fi

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

echo "==> Restarting $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  NODE_ENV=production pm2 start dist/server.js --name "$PM2_NAME"
fi
pm2 save

echo "==> Deploy complete"
pm2 status "$PM2_NAME"
