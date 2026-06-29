# Caspa Codex Task Pack

Small, safe recovery slices for stabilising Caspa in production.

## Task 1 — `/api/doctor` (complete)

**Acceptance**

- `GET /api/doctor` registered before any auth middleware
- Returns `{ success: true, data: { status: "ok", ... } }`
- Exposes only safe booleans/status fields (no secrets, keys, paths, or credentials)

**Verify**

```bash
npm run deploy
curl -s http://127.0.0.1:3000/api/doctor
```

## Task 2 — Ollama audit

- `GET /api/ollama/health` — availability probe
- `GET /api/ollama/smoke` — deployment smoke (no prompt)
- Cheap tasks (e.g. ingestion type detection) route through `llmRouter` → Ollama first

## Task 3 — Library shelf

- Replace Library stub with `ProjectShelf` reading local commission/research/promise state

## Follow-up (not in this slice)

- Gold Pipeline SSE audit
- Novel Write Pro quality-pass endpoint
- Persistent job queue audit
