/**
 * PM2 ecosystem config for Hetzner production deploy
 * Usage: pm2 start ecosystem.config.cjs && pm2 save
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
