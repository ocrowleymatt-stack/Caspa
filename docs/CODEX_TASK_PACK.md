# Caspa Codex Task Pack

Small, safe recovery slices for stabilising Caspa in production.

## Task 1 — `/api/doctor` ✓

- `GET /api/doctor` before auth
- Safe booleans only
- `npm run deploy` succeeds

## Task 2 — Ollama audit ✓

- `GET /api/ollama/health`
- `GET /api/ollama/smoke`
- `llmRouter` for cheap tasks

## Task 3 — Library shelf ✓

- `ProjectShelf` replaces Library stub

## Task 4 — Gold Pipeline + SSE ✓

- `POST /api/caspa/gold/pipeline` with `stream: true` for SSE progress
- `GET /api/caspa/gold/passes` — pass definitions
- `GET /api/caspa/gold/jobs/audit` — queue audit (counts only)
- `GET /api/caspa/gold/jobs/:jobId` — job status
- Gold Refinery UI wired with live pass tracking

## Task 5 — Novel Write Pro quality pass ✓

- `POST /api/caspa/novel-write-pro/quality-pass`
- Heuristic gates + AI rewrite prompt recommendation

## Verify

```bash
npm run deploy
curl -s http://127.0.0.1:3000/api/doctor
curl -s http://127.0.0.1:3000/api/caspa/gold/passes
curl -s http://127.0.0.1:3000/api/caspa/gold/jobs/audit
curl -s -X POST http://127.0.0.1:3000/api/caspa/novel-write-pro/quality-pass \
  -H 'Content-Type: application/json' \
  -d '{"content":"She felt very sad suddenly. The room was quiet.","mode":"novel","title":"Test"}'
```

## Follow-up

- Persistent job queue (SQLite) for long-running Gold runs
- Hetzner deploy verification
- Firestore ↔ local-first sync (Issue #1)
