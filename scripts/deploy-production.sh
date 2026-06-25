#!/usr/bin/env bash
# Production deploy on Hetzner — pull from GitHub, build, restart pm2.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/Caspa}"
BRANCH="${1:-caspa-studio}"
PM2_NAME="${PM2_NAME:-caspa-server}"

cd "$APP_DIR"

echo "==> Fetching origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm install
(cd caspa-ui && npm install)

echo "==> Building UI + backend"
mkdir -p public
npm run deploy

echo "==> Restarting $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  NODE_ENV=production pm2 start dist/server.js --name "$PM2_NAME"
fi
pm2 save

echo "==> Deploy complete"
pm2 status "$PM2_NAME"
