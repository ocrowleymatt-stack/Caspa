# Codex Task Pack — CASPA Recovery

Repo: `ocrowleymatt-stack/Caspa`

Primary branch: `caspa-studio`

Production target: private self-hosted Hetzner deployment at `/root/Caspa`.

## Operating rule

Do not perform a destructive mega-merge. Work in small, testable slices. Each task must preserve the current working Casper / Novel Write Pro UI and production build.

## Current known state

- Production server builds with `npm run deploy`.
- UI is built by `caspa-ui && npm run build` and copied into `public/`.
- Production server is managed by PM2 as `caspa-server`.
- Health route exists at `GET /health`.
- Safe doctor route should exist at `GET /api/doctor` before auth middleware.
- SQLite service exists via `better-sqlite3` and `src/services/db.ts`.
- Casper / Novel Write Pro UI strings are present in the built bundle.

## Task 1 — Verify and harden `/api/doctor`

Objective: make `/api/doctor` a safe smoke-test endpoint for deployment checks.

Requirements:

1. Confirm `GET /api/doctor` is registered before `requireAuth`.
2. Return only safe booleans/status fields.
3. Do not expose:
   - secrets;
   - API keys;
   - raw env values;
   - usernames;
   - passwords;
   - tokens;
   - full filesystem paths.
4. Response shape must be:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

5. Include at minimum:
   - service name;
   - timestamp;
   - authEnabled boolean;
   - publicUiPresent boolean;
   - sqliteConfigured boolean;
   - sqliteFilePresent boolean;
   - provider configured booleans;
   - mounted module names.

Acceptance commands:

```bash
npm run deploy
curl -s http://127.0.0.1:3000/api/doctor
```

Expected result:

```json
{"success":true,"data":{"status":"ok"}}
```

## Task 2 — Audit AI and Ollama endpoints

Objective: confirm local inference is wired as a first-class capability.

Find all existing routes related to:

- `/api/assist`
- `/api/ollama`
- provider status;
- generation;
- streaming generation;
- fallback routing.

Produce a short Markdown report listing:

- existing endpoints;
- missing endpoints;
- whether endpoints require auth;
- whether they return the standard `{ success, data/error }` envelope;
- whether they expose secrets.

Do not change behaviour unless the issue is a clear bug.

## Task 3 — Add safe Ollama smoke endpoints if missing

Only after Task 2.

Target endpoints:

```txt
GET /api/ollama/health
GET /api/ollama/models
```

Requirements:

- use configured Ollama URL from shared config;
- do not expose raw internal URL in public responses;
- health should report configured/reachable/model count if possible;
- failure should return a safe, diagnostic error;
- preserve existing generate behaviour.

## Task 4 — Audit Gold Pipeline endpoints

Objective: compare implementation against target design.

Target design:

```txt
POST /api/gold/run
GET  /api/gold/progress/:jobId
```

Audit:

- existing gold routes;
- whether SSE is implemented;
- whether jobs are persistent;
- whether results are stored;
- whether UI buttons point at live routes;
- whether errors are visible.

Produce report first. Do not rewrite the Gold Pipeline until the report is complete.

## Task 5 — Novel Write Pro server-side quality pass

Objective: move beyond prompt-only Novel Write Pro by adding a server-side endpoint.

Target route:

```txt
POST /api/casper/quality-pass
```

Input:

```json
{
  "projectId": "optional",
  "chapterId": "optional",
  "content": "text to assess",
  "mode": "novel|script|musical|adaptation|polish|chaos"
}
```

Output:

```json
{
  "success": true,
  "data": {
    "overallScore": 0,
    "status": "PASS|PASS_WITH_WARNINGS|REVISE|BLOCK",
    "findings": [],
    "recommendedRewritePrompt": ""
  }
}
```

Requirements:

- use existing AI orchestrator if available;
- fallback gracefully if provider unavailable;
- do not block existing auto-write flow;
- no frontend changes unless route is stable.

## Task 6 — Persistent job queue audit

Objective: determine whether job queues are split and fragile.

Audit modules:

- orchestra;
- gold;
- music lab;
- command orchestrator;
- outputs;
- publishing.

Report:

- where jobs are stored;
- whether jobs survive restart;
- whether running jobs are marked failed on startup;
- whether progress is exposed;
- whether a shared queue should replace module-local queues.

## Hard constraints

- Do not modify `.env`.
- Do not commit secrets.
- Do not expose Ollama publicly.
- Do not remove auth globally.
- Do not break `npm run deploy`.
- Do not remove Casper / Novel Write Pro UI strings.
- Do not replace working modules with old speculative code from previous repos.

## Deployment commands

```bash
cd /root/Caspa
git fetch origin caspa-studio
git checkout caspa-studio
git reset --hard origin/caspa-studio
npm run deploy
pm2 restart caspa-server --update-env
```

## Verification commands

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/doctor
pm2 status
```
