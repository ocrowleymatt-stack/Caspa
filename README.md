# Caspa

Private creative OS for novels, picture books, scripts, and polish.

Simple front door: **Just write · Picture book · Polish**. Powerful engines underneath (plot hold, prize draft, design studio, publish pack).

## Quick start

```bash
npm install
cp .env.example .env
# Set at least GEMINI_API_KEY (or start Ollama)
npm run dev
```

Open http://localhost:3000 → **Continue locally** → pick a door.

## Production deploy

```bash
npm install
cp .env.example .env   # fill keys
npm run build
PORT=3000 CASPA_DATA_DIR=/root/Caspa/data NODE_ENV=production node dist/server.cjs
# or:
npm run start:pm2      # uses ecosystem.config.cjs
```

### Atlas (caspa.ocrowley.com) recovery

If production still shows the old seven-step “CASPA Studio” wizard or `/api/doctor` lacks `gitSha` / `service: Caspa`:

```bash
cd /root/Caspa
git fetch origin
git reset --hard origin/main
npm ci
npm run build
pm2 restart caspa-server --update-env
pm2 save
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/api/doctor
```

Then clear Safari website data for `caspa.ocrowley.com` and reload.

Manual GitHub Action (after adding SSH secret `HETZNER_SSH_KEY`): **Actions → Deploy Atlas → Run workflow** with `confirm=deploy`.

Verify:

```bash
npm run deploy:smoke   # server must already be listening on :3000
# or full path:
npm run verify         # build + smoke (start server between them if needed)
```

Doctor endpoint (safe, no secrets): `GET /api/doctor` — readiness score plus `gitSha` / `builtAt` fingerprint.

## Env

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Primary cloud model |
| `PORT` | No | Default `3000` |
| `CASPA_DATA_DIR` | Prod recommended | Jobs + backups persistence |
| `VITE_GROK_API_KEY` / `OPENAI` / `ANTHROPIC` / `VENICE` | Optional | Extra providers |
| `OLLAMA_URL` | Optional | Default `http://127.0.0.1:11434/api` |
| `UNIFIED_ROUTER_URL` | Optional | Host Unified Router base (`http://127.0.0.1:9999` or Docker `http://172.18.0.1:9999`). Preferred AI path via `/api/chat/completions`. |
| `UNIFIED_ROUTER_API_KEY` | Optional | Bearer token if the router requires auth |
| `UNIFIED_ROUTER_MODEL` | Optional | Model id sent to the router (default `llama3.2`) |

## How to use

1. **Continue locally** — no account needed; drafts live in the browser.
2. **Launchpad** — Fiction, Non-fiction, Picture book, Polish (more under “More”).
3. **Next step** — one highlighted action; advanced tools stay collapsed.
4. **Settings** — backup/restore + deploy readiness check (shows commit fingerprint).
5. Optional Google/email sign-in when you want a cloud account.

## Smoke checks

`/health`, `/api/doctor` (incl. `gitSha`), Cache-Control on `/`, Ollama smoke, Gold passes, backups list, Novel Write Pro quality pass, static UI, local-project persistence (no Firebase session).
