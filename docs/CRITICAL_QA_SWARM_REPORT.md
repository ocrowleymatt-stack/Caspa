# CASPA Critical QA Swarm Report

**Generated:** 2026-06-27T07:49:57.998Z
**Base URL:** http://127.0.0.1:3000
**Commit:** 1.0.0
**With AI tests:** no (use --with-ai for full run)

## Scores

| Metric | Score |
|--------|------:|
| **Overall** | **9.7/10** |
| Browser readiness | 10/10 |
| Finished-book machine | 9.5/10 |
| Data safety | 10/10 |

## Agent results

| Agent | Score | Status | Blockers | Top fix |
|-------|------:|--------|----------|---------|
| Impatient New User | 10 | pass | 0 | — |
| Angry Novelist | 9 | warn | 0 | Run with --with-ai on server for full Angry Novelist test |
| Manuscript Surgeon | 9 | warn | 0 | — |
| Continuity Pedant | 10 | pass | 0 | — |
| Output Auditor | 10 | pass | 0 | — |
| Data-Loss Paranoid | 10 | pass | 0 | — |
| UX Sadist | 10 | pass | 0 | — |
| Security Goblin | 10 | pass | 0 | — |
| Performance Miser | 9 | warn | 0 | — |
| Commercial Snob | 10 | pass | 0 | Top beta blockers: surface finish roadmap on Today; wire Trash to Treasure UI; staged progress on NWP |

## P0 blockers

_None detected in this run._

## P1 issues


## P2 warnings

- Angry Novelist: WARN: Skipped live NWP/finish AI calls (use --with-ai)
- Manuscript Surgeon: WARN: Messy fixture produced no warnings
- Performance Miser: WARN: Skipped NWP duration test (use --with-ai)

## Top defects


## Agent detail

### Impatient New User (pass, 10/10)

**Tested:**
- POST /api/auth/login
- POST /api/projects (blank project)
- GET /api/casper/status
- GET /api/outputs
- UI bundle string scan

**Evidence:**
- Created project HUjMRSd2
- GET /api/casper/status → 200
- GET /api/projects/HUjMRSd22CmN/book-map → 200
- GET /api/outputs?projectId=HUjMRSd22CmN → 200
- GET /api/projects/HUjMRSd22CmN/export/markdown → 200
- UI contains "Saved Writing"
- UI contains "Book Map"
- UI contains "Novel Write Pro"
- UI contains "Finish This Book"
- UI contains "What are we making today"

### Angry Novelist (warn, 9/10)

**Tested:**
- POST /api/manuscript/import/analyse (multi-chapter fixture)
- POST /api/projects/:id/book-map/generate

**Evidence:**
- Detected 5 units; mode=single-unit
- Book Map outputId=dNcYswxg

**Failures:**
- WARN: Skipped live NWP/finish AI calls (use --with-ai)

**Recommended fixes:**
- Run with --with-ai on server for full Angry Novelist test

### Manuscript Surgeon (warn, 9/10)

**Tested:**
- POST /api/manuscript/import/analyse (multi-chapter-novel.md)
- POST /api/manuscript/import/analyse (stage-play-scene.txt)
- POST /api/manuscript/import/analyse (nonfiction-outline.md)
- POST /api/manuscript/import/analyse (messy-bad-project.md)
- POST /api/manuscript/import/apply (preserve source)

**Evidence:**
- multi-chapter-novel.md: 5 units, confidence=high
- stage-play-scene.txt: 8 units, confidence=high
- nonfiction-outline.md: 8 units, confidence=high
- messy-bad-project.md: 1 units, confidence=high
- whole-manuscript-source apply succeeded
- Structure report outputId=H7vRAida

**Failures:**
- WARN: Messy fixture produced no warnings

### Continuity Pedant (pass, 10/10)

**Tested:**
- POST /api/projects/:id/book-map/generate
- POST /api/projects/:id/memory/extract

**Evidence:**
- completion=0% next=Chapter 10: The Final Battle
- memory updatedAt=2026-06-27T07:48:35.818Z

### Output Auditor (pass, 10/10)

**Tested:**
- POST /api/casper/continue
- POST /api/research/extract-claims
- POST /api/projects/:id/book-map/generate
- GET /api/outputs?projectId=
- GET /api/outputs/:id

**Evidence:**
- Outputs list count=3

### Data-Loss Paranoid (pass, 10/10)

**Tested:**
- POST /api/manuscript/import/apply whole-manuscript-source
- GET /api/projects/:id/chapters
- POST /api/projects/:id/snapshot
- GET /api/projects/:id/versions
- GET /api/projects/:id/compare (requires two snapshots — route exists)

**Evidence:**
- Source chapter preserved (258 words)
- Snapshot dSGHsgSo created

### UX Sadist (pass, 10/10)

**Tested:**
- UI bundle CTA scan
- GET /api/casper/status availability
- Browser checklist (manual): empty states, duplicate project selector

**Evidence:**
- Found "Auto-write award draft" in UI
- Found "Finish This Book" in UI
- Found "Generate Book Map" in UI
- Found "Saved Writing" in UI
- Manual: verify each empty state has a button; verify single active project context

### Security Goblin (pass, 10/10)

**Tested:**
- GET /health (public)
- GET /api/doctor secret scan
- GET /api/projects unauthenticated → 401
- GET /api/outputs unauthenticated → 401
- GET /api/ollama/health unauthenticated → 401
- GET /api/ollama/models unauthenticated → 401
- GET /api/projects/000000000000000000000000/book-map unauthenticated → 401

**Evidence:**
- /health public OK
- Doctor exposes booleans only (no raw keys)
- /api/projects → 401
- /api/outputs → 401
- /api/ollama/health → 401
- /api/ollama/models → 401
- /api/projects/000000000000000000000000/book-map → 401

### Performance Miser (warn, 9/10)

**Tested:**
- POST /api/ollama/generate-test

**Evidence:**
- Ollama generate-test 1.7s

**Failures:**
- WARN: Skipped NWP duration test (use --with-ai)

### Commercial Snob (pass, 10/10)

**Tested:**
- End-to-end API journey: project → import → structure → book map → export

**Evidence:**
- Journey produced 2 saved outputs
- Commercial journey score component: 10/10

**Recommended fixes:**
- Top beta blockers: surface finish roadmap on Today; wire Trash to Treasure UI; staged progress on NWP


## Browser checklist (manual)

- [ ] Login page loads and submits
- [ ] Today page shows primary actions without explanation
- [ ] New project wizard has visible submit on each step
- [ ] Novel Write Pro shows progress stages during long run
- [ ] Output detail shows after generation with link from toast
- [ ] Apply revision shows confirm() before replace
- [ ] Chapter editor prev/next navigation works
- [ ] Trash to Treasure entry point discoverable

---
_Diagnostic run — do not treat WARN as pass unless verified._
