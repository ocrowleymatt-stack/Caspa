# CASPA 504 Long Job Audit

**Branch:** `caspa-studio` · **Live:** https://caspa.ocrowley.com  
**Date:** 2026-06-28  
**Goal:** Eliminate 504 Gateway Timeout by jobbing long creative operations.

## Executive summary

CASPA has **two job stores**:

| System | Storage | Routes | Worker | Used for |
|--------|---------|--------|--------|----------|
| **Caspa Jobs** | `data/caspa-jobs/{id}.json` | `/api/jobs` (partial), `/api/projects/:id/jobs/*` | None (sync HTTP) | NWP, Gold Pass, Gold Pipeline metadata |
| **Orchestra** | `data/jobs.json` | `/api/jobs/*` (wins GET list/id) | `JobWorker` | Publish PDF/EPUB/KDP/Ingram |

Long creative routes **create Caspa job records** but still **`await` the full AI pipeline inside the HTTP handler**, so nginx/proxy timeouts occur even when the server eventually completes.

---

## Operation audit

| Operation | Current route | Current UI caller | Sync or jobbed? | Risk of 504 | Saves partial work? | Recommended fix |
| --------- | ------------- | ----------------- | --------------- | ----------- | ------------------- | --------------- |
| **Novel Write Pro** | `POST /api/casper/novel-write-pro` | `caspa.ts` → `ImproveManuscriptPanel`, `CasperFreestyle` | Sync (job metadata only) | **High** (4× AI calls) | Yes — stages in caspa-jobs if server finishes | Background worker; return `jobId` in <2s |
| **Continue Writing** | `POST /api/casper/continue` | `caspa.ts` | Sync | High | No | Job-backed |
| **Finish Book** | `POST /api/casper/finish-book` | `book.ts` | Sync | High | No | Job-backed |
| **Novel Quality Pass** | `POST /api/casper/quality-pass` | `ImproveManuscriptPanel` | Sync | Medium | No | Job if >30s |
| **Gold Pass** | `POST /api/gold/run` | `gold.ts` → `GoldPipeline`, `OutputDetail` | Sync (job metadata) | **High** | Yes — partial on fail | Lock source → create job → background run |
| **Gold Pipeline (12-step)** | `POST /api/goldpipeline/execute` | `goldPipeline.ts` SSE | SSE + sync tail | **High** at `goldPipeline.run()` | Partial job record | Job worker + poll/SSE progress |
| **Gold legacy run** | `POST /api/gold/run/:projectId` | `gold.ts` | Sync | High | No | Deprecate or job |
| **Project Bible generate** | `POST /api/projects/:id/bible/generate` | `bible.ts` → `ProjectBible` | Sync | Medium–High | No | Job-backed |
| **Book Map generate** | `POST /api/projects/:id/book-map/generate` | `book.ts` → `ProjectBookMap` | Sync | Medium–High | No | Job-backed |
| **Structure analyse (long)** | `POST /api/projects/:id/structure/analyse` | `book.ts` → `ProjectManuscript` | Sync (heuristic + save) | Medium on huge imports | Output saved | Job when rawText >50k |
| **Cut/Tighten analyse** | `POST /api/projects/:id/cut/analyse` | `cut.ts` → `CutTightenPanel` | Sync | Medium | No | Job-backed |
| **Cut unit analyse** | `POST /api/projects/:id/structure/:unitId/cut/analyse` | `cut.ts` | Sync | Medium | No | Job-backed |
| **Cut generate draft** | `POST /api/projects/:id/cut/generate-draft` | `cut.ts` | Sync | Medium | No | Job-backed |
| **Agent Swarm** | `POST /api/agents/swarm` | `agentSwarm.ts` | Sync | **High** (N agents) | No | Job-backed |
| **Export archive** | `POST /api/projects/:id/export/archive` | `book.ts` | Sync | Low–Medium | N/A | Job if expensive |
| **Markdown/DOCX export** | `GET /api/projects/:id/export/*` | `book.ts` | Sync | Low | N/A | Keep sync |
| **Publish PDF/EPUB** | `POST /api/publish/*` | `publishing.ts` | **Async 202** | Low | Orchestra queue | Keep (reference pattern) |
| **Minimal Auto Build/Write/Improve** | `POST /api/projects/:id/minimal/*` | `minimal.ts` | Sync | **High** | Partial flags only | Call jobbed services |
| **Provider test-all** | `POST /api/providers/test-all` | `studio.ts` | Sync multi-provider | Medium | N/A | Keep sync with timeout note |
| **Trash to Treasure** | `POST /api/casper/trash-to-treasure` | `casper.ts` | Sync | Medium | No | Job-backed (phase 2) |

---

## Route conflict (P0 blocker)

Both Orchestra and Caspa Jobs register:

- `GET /api/jobs`
- `GET /api/jobs/:id`

**Orchestra is mounted first** in `server.ts`, so frontend `getCaspaJob()` reads Orchestra `jobs.json` — Caspa creative jobs are invisible to generic job GET.

**Fix:** Unified job resolver on `GET /api/jobs/:id` (Caspa first, Orchestra fallback); mount creative job routes before param catch-all; preserve Orchestra `/api/jobs/stats` and `/api/jobs/stream`.

---

## Frontend gaps

| Gap | Impact |
|-----|--------|
| `apiCall()` has no timeout recovery | 504 → generic error, no poll |
| `caspaJobs.getCaspaJob` hits wrong store | Progress/resume broken |
| No reusable progress panel | Minutes of blank spinner |
| `JobRecoveryBanner` only on NWP/Gold pages | Refresh loses context elsewhere |

---

## Reference async pattern (Publish)

```
POST /api/publish/pdf → 202 { jobId }
JobWorker polls jobs.json
SSE /api/jobs/:id/stream
```

Target: replicate for Caspa Jobs with `CaspaJobWorker` + `GET /api/jobs/:id/progress` polling.

---

## Non-goals

- Increasing nginx timeout as primary fix
- Second parallel job store
- Removing auth or source-lock behaviour
- Breaking NWP output registration or Gold drift detection
