# CASPA Market Leader Gap Audit

**Generated:** 2026-06-27  
**Baseline:** `dbbe8b0` · Critical QA 9.7/10 · Fast smoke PASS  
**Standard:** Secret weapon / trailblazer — a writer finishes books safely without developer help.

## Journey scorecard

| Journey | Current | Market-leader expectation | Gap | Severity | Fix |
| ------- | ------: | ------------------------- | --- | -------- | --- |
| 1. Blank idea → finished project plan | 7/10 | One obvious path: premise → project → bible → first chapter | Today links exist; plan scattered across Overview/Bible/NWP | P1 | Secret Weapon dashboard + clearer Today CTAs |
| 2. Messy draft → Trash to Treasure | 3/10 | Dedicated rescue wizard with diagnosis, plan, sample, saved output | Backend complete; UI routed to Casper/NWP instead | **P0→P1** | Trash to Treasure wizard page |
| 3. Multi-chapter → structure → Book Map | 8/10 | Import detects units, structure report, Book Map with gaps | Import mode sometimes `single-unit` despite chapters | P1 | Surface split-into-units recommendation |
| 4. Book Map → missing chapter → draft | 6/10 | Click missing chapter in rail → draft saved | Finish-book API exists; no chapter rail or gap CTA | P1 | Chapter rail + Write next missing chapter |
| 5. Chapter → Swarm → Gold rewrite | 7/10 | From chapter: swarm critique → gold pass → saved | Works via workbench; long runs feel frozen | P1 | StagedProgress on Swarm/Gold |
| 6. Saved output → apply / export safely | 8/10 | Archive filters, apply modes, snapshot before replace | Filters missing; compare UI thin | P1 | Saved Writing archive + compare polish |
| 7. Project → Markdown/DOCX/archive export | 6/10 | One export page: manuscript, bible, map, submission pack | Markdown/ZIP API; DOCX missing; export page PDF-only | P1 | DOCX + submission pack on export page |
| 8. Failed AI provider → useful fallback | 7/10 | Specific billing/model/key errors + fallback label | ProviderStatus good; some flows still vague | P2 | Wire failure messages from API |
| 9. Long Ollama run → progress not dead | 4/10 | Stage labels, elapsed time, engine name | Only Book Map uses StagedProgress | **P1** | StagedProgress on all long mutations |
| 10. First-time user → 30s clarity | 8/10 | Today answers “what do I do?” | Strong copy; rescue mislabeled | P2 | Fix rescue link + cockpit panels |

## Severity summary

| Priority | Count | Theme |
| -------- | ----: | ----- |
| P0 | 0 | None at baseline (snapshot fixed at dbbe8b0) |
| P1 | 7 | Staged progress, Trash wizard, chapter rail, exports, Saved Writing |
| P2 | 2 | Provider copy polish, import recommendation UX |
| P3 | 1 | Playwright E2E (manual script provided instead) |

## Market-leader definition (acceptance)

CASPA is market-leading when a writer can:

1. Paste bad material and get a **rescued plan + saved output** without overwriting source.
2. See **honest progress** during every long AI run.
3. Navigate chapters and **draft missing gaps** from Book Map.
4. Find every artifact in **Saved Writing** with filters and next actions.
5. **Export DOCX/Markdown/archive** from one place.
6. **Apply safely** with snapshot + compare.
7. Understand **AI failures** without Matthew explaining.

## Build slices (this phase)

1. StagedProgress wired across NWP, Continue, Gold, Swarm, Finish, Trash, Book Map
2. Trash to Treasure wizard (`/casper/trash-to-treasure`, project-scoped variant)
3. Chapter rail + write next missing chapter
4. DOCX export + export page upgrade
5. Safe apply / compare polish on OutputDetail
6. Saved Writing filters + archive cards
7. Provider clarity messages
8. Secret Weapon dashboard (Today)
9. Manual market-leader + James usability test docs
10. Full smoke extensions for Trash/DOCX
