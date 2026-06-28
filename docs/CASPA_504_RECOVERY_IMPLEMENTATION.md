# CASPA 504 Recovery Implementation

**Branch:** `caspa-studio` · **Date:** 2026-06-28

## Problem

Long creative routes blocked HTTP until AI finished → nginx 504 even when the server kept working.

## Solution (architecture, not timeout tuning)

1. **`CaspaJobWorker`** — background poller claims `queued` jobs from `data/caspa-jobs/*.json`
2. **`CaspaJobRunner`** — executes job types with staged progress + partial results
3. **Routes return `202` + `jobId` in <2s** — work continues in worker
4. **UI polls `GET /api/jobs/:id/progress`** — staged list + progress bar via `JobProgressPanel`
5. **Restart recovery** — `running` jobs → `partial` with retry message on boot

## Routes converted to async jobs

| Route | Job type | Sync escape hatch |
|-------|----------|-------------------|
| `POST /api/casper/novel-write-pro` | `novel-write-pro` | `?sync=1` |
| `POST /api/gold/run` | `gold-pass` | `?sync=1` |
| `POST /api/projects/:id/bible/generate` | `project-bible` | `?sync=1` |
| `POST /api/projects/:id/book-map/generate` | `book-map` | `?sync=1` |
| `POST /api/projects/:id/cut/analyse` | `cut-analyse` | `?sync=1` |
| `POST /api/projects/:id/structure/:unitId/cut/analyse` | `cut-analyse` | `?sync=1` |

## Job API (authenticated)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/jobs` | List (Caspa + Orchestra, or `?system=caspa`) |
| GET | `/api/jobs/:id` | Unified resolver (Caspa first) |
| GET | `/api/jobs/:id/progress` | Poll progress |
| GET | `/api/jobs/:id/stream` | SSE progress (Caspa poll stream) |
| POST | `/api/jobs/:id/cancel` | Cancel Caspa job |
| POST | `/api/jobs/:id/retry` | Re-queue failed/partial job |
| POST | `/api/jobs/:id/resume` | Retry alias for partial jobs |
| GET | `/api/projects/:id/jobs/latest` | Resume after refresh |

## UI

- `caspa-ui/src/api/caspaJobs.ts` — poll/wait helpers
- `caspa-ui/src/components/JobProgressPanel.tsx` — reusable progress UI
- `ImproveManuscriptPanel` — shows panel during NWP
- API clients (`casper`, `gold`, `bible`, `book`, `cut`) poll until complete

## Still sync (and why)

| Route | Reason |
|-------|--------|
| Publish PDF/EPUB | Already Orchestra async 202 |
| GET exports | Fast file assembly |
| Quality pass | Short assessment (phase 2 candidate) |
| Agent Swarm | Not yet jobbed (phase 2) |
| Minimal workflow internal calls | Calls services directly — should migrate to job APIs |

## Timeout mitigation (secondary)

Document only — nginx/proxy timeouts not raised as primary fix. Jobs return before proxy limit.

## Recovery flow

1. User clicks action → `jobId` returned
2. Worker runs stages, writes partial results per stage
3. UI polls progress; user may navigate away
4. `GET /api/projects/:id/jobs/latest` + `JobRecoveryBanner` on return
5. Failed → useful error + Retry (preserves partialResult)

## Tests

- `scripts/runtime-long-jobs-smoke.sh` — jobId within 5s, auth 401, doctor safe
- Critical QA agent: **504 Recovery Auditor**

## Rollback

Revert `CaspaJobWorker` start in `server.ts` and route `202` handlers; restore sync `await` blocks.
