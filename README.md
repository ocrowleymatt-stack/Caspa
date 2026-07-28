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

Verify:

```bash
npm run deploy:smoke   # server must already be listening on :3000
# or full path:
npm run verify         # build + smoke (start server between them if needed)
```

Doctor endpoint (safe, no secrets): `GET /api/doctor` — includes a readiness score, blockers, and warnings.

## Env

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Primary cloud model |
| `PORT` | No | Default `3000` |
| `CASPA_DATA_DIR` | Prod recommended | Jobs + backups persistence |
| `VITE_GROK_API_KEY` / `OPENAI` / `ANTHROPIC` / `VENICE` | Optional | Extra providers |
| `OLLAMA_URL` | Optional | Default `http://127.0.0.1:11434/api` |

## How to use

1. **Continue locally** — no account needed; drafts live in the browser.
2. **Launchpad** — three doors (more formats under “More”).
3. **Next step** — one highlighted action; advanced tools stay collapsed.
4. **Settings** — backup/restore + deploy readiness check.
5. Optional Google/email sign-in when you want a cloud account.

## Smoke checks

`/health`, `/api/doctor`, Ollama smoke, Gold passes, backups list, Novel Write Pro quality pass, static UI.
