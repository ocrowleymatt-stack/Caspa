# CASPA Deployment Checklist (Hetzner)

Production host: **116.202.24.63** · domain: **https://caspa.ocrowley.com**

GitHub repo: **https://github.com/ocrowleymatt-stack/Caspa** · deploy branch: **`caspa-studio`**

## Prerequisites

- SSH key: `~/.ssh/hetzner_key`
- Remote path: `/root/Caspa/`
- Process manager: `pm2` (app name: `caspa-server`, entry: `dist/server.js`)

## 1. Push to GitHub (local)

```bash
cd "/Users/mattocrowley/Dropbox/caspa with knobs on"
git add -A
git commit -m "Your change summary"
git push origin caspa-studio
```

## 2. Deploy on Production (GitHub pull + build)

```bash
ssh -i ~/.ssh/hetzner_key root@116.202.24.63 'bash /root/Caspa/scripts/deploy-production.sh caspa-studio'
```

Or step-by-step on the server:

```bash
ssh -i ~/.ssh/hetzner_key root@116.202.24.63 << 'EOF'
cd /root/Caspa
bash scripts/deploy-production.sh caspa-studio
EOF
```

The deploy script: fetches `origin/caspa-studio`, runs `npm install`, builds UI → `public/` + backend → `dist/`, then restarts `caspa-server`.

## 3. Verification

```bash
# Health
curl -s https://caspa.ocrowley.com/health | jq .

# UI shell (no-cache)
curl -sI https://caspa.ocrowley.com/ | grep -i cache

# Hashed assets (immutable cache)
curl -s https://caspa.ocrowley.com/ | grep -o 'assets/index-[^"]*'

# Gold Pipeline SSE endpoint (expect text/event-stream)
curl -sI -X POST https://caspa.ocrowley.com/api/goldpipeline/execute \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"test","config":{},"chapters":[]}' \
  | grep -i content-type
```

## 4. Rollback

```bash
ssh -i ~/.ssh/hetzner_key root@116.202.24.63
cd /root/Caspa
git log --oneline -5
git reset --hard <previous-sha>
bash scripts/deploy-production.sh caspa-studio
pm2 logs caspa-server --lines 50
```

## Notes

- Never commit `.env` — production secrets stay on server only.
- `data/` and `backups/` are gitignored; live manuscript DB is preserved across deploys.
- After UI deploy, confirm new asset hashes in `public/index.html` match files under `public/assets/`.
- Gold Pipeline page: https://caspa.ocrowley.com/gold
