# CASPA P0 Manuscript Workflow Failure Audit

**Branch:** `caspa-studio` @ `09f87c5`  
**Live:** https://caspa.ocrowley.com  
**Date:** 2026-06-27

## Executive summary

CASPA has partial manuscript-first UI (Current Work tab, Read mode, Writing History reframe) but **core trust failures remain**: outputs without readable text, Gold Pass using truncated/wrong source without fidelity lock, structure detection not automatic after workbench uploads, creative target stored but not consumed by generators, no cut engine, and long HTTP operations that 504 without resume.

---

## A. Manuscript / chapter failure

| Question | Current behaviour |
|----------|-------------------|
| Where does uploaded manuscript text go? | **New Project Wizard** → `ImportService.apply` creates chapters. **Workbench Sources** → `ProjectAsset` only (extracted text in asset record, **no chapters**). |
| Does upload trigger structure detection automatically? | **Only** on new-project wizard file pick (`analyseManuscriptImport` client-side) and manual **Analyse structure** on Current Work. **Not** on Sources upload. |
| Does CASPA create chapters/scenes/acts? | Yes via `POST /structure/apply` or wizard import — **manual** after analyse. |
| Chapter/scene rail? | Yes in `ChapterEditor`, partial on `ProjectManuscript`. |
| Book Map / Guide Me / NWP / Gold use units? | Partially — chapters exist in DB but Gold defaults to `getProjectFullText(8000)` not unit-aware source. |

**Root cause:** Two ingestion paths (wizard vs sources); structure is opt-in; generators don't require structure units.

---

## B. Finished / current work failure

| Question | Current behaviour |
|----------|-------------------|
| Where user reads current work? | `/projects/:id/manuscript` (dynamic label) + `/projects/:id/read`. |
| Canonical API? | **No** dedicated `GET /api/projects/:id/manuscript` — UI aggregates `listChapters`. |
| Generated drafts applied? | Via chapter editor, Ask Casper push, output detail apply — **not unified**. |
| Export from current work? | Export page exists; messaging updated; still mixes archive + manuscript. |

**Root cause:** Current Work is UI-only aggregation; no server manuscript model; Writing History still competes for attention on some flows.

---

## C. Output text failure

| Question | Current behaviour |
|----------|-------------------|
| Why "No text stored"? | `extractOutputText()` only reads `metadata.text` and `metadata.revisedText`. Many generators store `firstDraft`, `rewrite`, nested JSON, or **nothing**. |
| Generators without body text | Structure reports, Agent Swarm (report mode), Awards, Bible, Book Map, Research passes, Export packages. |
| Field inconsistency | No canonical `text`; `content` unused; prose scattered across metadata keys. |
| List excerpts | Raw records — **no** `excerpt` / `hasText` on API. |

**Root cause:** No output body contract at register time; narrow extractor in UI.

**Priority:** **P0**

---

## D. Gold wrong-story failure

| Question | Current behaviour |
|----------|-------------------|
| Default source | Request `source` OR `getProjectFullText(projectId, **8000**)` — **not full manuscript**. |
| Workbench selector | UI sends `useWorkbenchSourceText` — can diverge from server if stale. |
| Ownership verification | Project check only; **no** sourceLock; wrong chapter/output not rejected. |
| Fidelity prompt | Revision plan JSON focus; **no** Source Fidelity Contract; `improveText` rewrites 6000 chars without same-story guard. |
| Post-gen check | **None** — major drift can be saved as `text: improved`. |

**Root cause:** Truncated source + no lock + no drift detection.

**Priority:** **P0**

---

## E. Creative target failure

| Question | Current behaviour |
|----------|-------------------|
| Wizard asks length / reader effect? | **Yes** (Production Wizard step 3 — `creativeTarget` on brief). |
| Chapter count, avoid list, intensity? | **Yes** in wizard. |
| Generation uses answers? | **No** — Gold, NWP, Continue, Bible generate do not read `creativeTarget`. |
| Guide Me | Checks `creativeTarget` presence only. |

**Root cause:** Spec captured but not threaded into prompts.

**Priority:** **P1** (partial P0 for expansion toward target)

---

## F. Cut / tighten failure

| Question | Current behaviour |
|----------|-------------------|
| Cut map for scripts? | **None** |
| Target runtime / page count cut? | **None** |
| Preserve originals on cut? | N/A |

**Priority:** **P1**

---

## G. 504 / resume failure

| Question | Current behaviour |
|----------|-------------------|
| Long ops | Gold, NWP, Bible, Book Map — **synchronous HTTP** |
| Checkpoints | Orchestra queue exists for some modules; **not** Gold/NWP |
| UI recovery | Generic ApiError; **no** jobId poll after timeout |

**Priority:** **P0** for data loss perception; **P1** for full job unification

---

## Failure matrix

| Failure | Current cause | User harm | Correct architecture | Priority |
|---------|---------------|-----------|----------------------|----------|
| No chapters after Sources upload | Assets only, no analyse/apply | Manuscript stays blob | Auto-analyse on manuscript asset; prompt apply | P0 |
| "No text stored" | Narrow extract + generators skip `text` | Cannot review/apply | Canonical `metadata.text` at register | P0 |
| Gold different story | 8k source + no fidelity lock | Trust destroyed | sourceLock + fidelity contract + drift block | P0 |
| Can't find finished work | Outputs-first habit + weak wayfinding | Hunting | Manuscript tab + Read (partially fixed) | P1 |
| Creative target ignored | Not in prompts | Wrong length/tone | Thread spec into all generators | P1 |
| 504 loses work | Sync HTTP | Retry from scratch | jobId + checkpoints + resume UI | P0 |
| No cut engine | Not built | Overlong scripts | Cut analyse/apply with snapshot | P1 |

---

## Correct product model (target)

```
Sources → Structure (auto) → Creative Spec → Current Manuscript → Unit work → Improve/Cut → Safe Apply → Read → Export
Writing History = archive only
```

This audit precedes P0 correction commits on `caspa-studio`.
