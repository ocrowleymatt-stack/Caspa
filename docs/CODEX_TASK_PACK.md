# Caspa Codex Task Pack

Small, safe recovery slices for stabilising Caspa in production.

## Completed tasks

| # | Task | Status |
|---|------|--------|
| 1 | `/api/doctor` | ✓ |
| 2 | Ollama audit + smoke | ✓ |
| 3 | Library ProjectShelf | ✓ |
| 4 | Gold Pipeline SSE | ✓ |
| 5 | Novel Write Pro quality pass | ✓ |
| 6 | Persistent JSON job store | ✓ |
| 7 | Local backup/list/restore API | ✓ |
| 8 | Deploy smoke script | ✓ |
| 9 | Red Pen + Settings wired | ✓ |

## Verify (Hetzner / local)

```bash
npm install
npm run deploy
npm start   # or PM2 restart caspa-server
npm run deploy:smoke
# or full verify:
npm run verify
```

## Key endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/doctor` | Safe deployment diagnostics |
| `GET /api/ollama/smoke` | Ollama availability |
| `POST /api/caspa/gold/pipeline` | Gold refinement (SSE with `stream: true`) |
| `POST /api/caspa/novel-write-pro/quality-pass` | Heuristic quality gates |
| `GET /api/caspa/storage/backups` | List local JSON backups |
| `POST /api/caspa/storage/backup` | Save browser `caspa.*` snapshot |
| `GET /api/caspa/storage/restore/:id` | Restore snapshot |

## Data directory

- Default: `./data/` (override with `CASPA_DATA_DIR`)
- Jobs: `data/caspa-jobs.json`
- Backups: `data/backups/*.json`

## Follow-up

- Merge PR #7 to main
- Hetzner: `git pull && npm run verify && pm2 restart caspa-server`
- Full Caspa1 Show Factory stack (Issue #1) — separate migration branch
