/**
 * PM2 ecosystem config for Hetzner production deploy
 * Usage: pm2 start ecosystem.config.cjs && pm2 save
 *
 * Optional fingerprint env (set by Deploy Atlas workflow / manual redeploy):
 *   CASPA_GIT_SHA, CASPA_GIT_BRANCH, CASPA_BUILD_TIME
 * Prefer dist/build-info.json written by `npm run build`.
 */
module.exports = {
  apps: [
    {
      name: 'caspa-server',
      script: 'dist/server.cjs',
      cwd: '/root/Caspa',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CASPA_DATA_DIR: '/root/Caspa/data',
      },
    },
  ],
};
