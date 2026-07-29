/**
 * PM2 ecosystem config for Hetzner production deploy
 * Usage: pm2 start ecosystem.config.cjs && pm2 save
 *
 * Loads /root/Caspa/.env into the process environment before Node boots so
 * route modules that read API keys at import time still see them.
 */
const fs = require('fs');
const path = require('path');

const cwd = '/root/Caspa';
const env = {
  NODE_ENV: 'production',
  PORT: '3000',
  CASPA_DATA_DIR: path.join(cwd, 'data'),
};

try {
  const envPath = path.join(cwd, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && env[key] === undefined) env[key] = value;
    }
  }
} catch (err) {
  console.warn('[ecosystem] could not load .env:', err.message || err);
}

module.exports = {
  apps: [
    {
      name: 'caspa-server',
      script: 'dist/server.cjs',
      cwd,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env,
    },
  ],
};
