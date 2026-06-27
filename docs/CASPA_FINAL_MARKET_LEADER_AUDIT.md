# CASPA Final Market Leader Audit

**Generated:** 2026-06-25  
**Baseline:** `109c09f` → studio module + UI slice (in progress)  
**Standard:** Any material in → guided intelligence → production-ready product out.

## Journey scorecard

| Journey | Current state | Market-leader expectation | Gap | Severity | Fix |
| ------- | ------------- | ------------------------- | --- | -------- | --- |
| 1. Blank idea → finished project plan | Today + Production Wizard + Guide Me | One obvious path in under 30s | Wizard and guide now wired; bible step still manual | P2 | Today CTAs to `/start` and Guide Me |
| 2. Messy notes → coherent project | Trash to Treasure + Source Library | Rescue + classify without shame | Source Library added; classify heuristics basic | P2 | Richer AI classification pass |
| 3. Multi-document upload → source library | `GET/POST /api/projects/:id/assets` + UI tab | Many files, paste, tags, preserve originals | **Shipped this slice** | — | QA asset ingestion agent |
| 4. Receipt / tiny asset → creative seed | Heuristic receipt detection + classify actions | Receipt → prop/clue/world detail | **Shipped** (heuristic + UI actions) | P2 | Optional OCR later |
| 5. Multi-chapter → structure → Book Map | Import + structure analyse + book-map | Detect units, gaps, map | Strong at baseline | P2 | Surface split recommendation on import |
| 6. Book Map → missing chapter draft | Chapter rail + finish-book APIs | Click gap → draft saved | Shipped prior slice | — | — |
| 7. Rough project → Trash to Treasure | Wizard at `/casper/trash-to-treasure` | Diagnosis, plan, sample, saved output | Shipped prior slice | — | — |
| 8. Chapter → Swarm → Gold | Workbench tabs + staged progress | Critique improves work | Shipped prior slice | P2 | Intimacy critic notes in Gold UI |
| 9. Saved output → apply / export | Outputs archive + safe apply + DOCX | Filters, next actions, snapshot | Shipped prior slice | P2 | Compare UI polish |
| 10. Project → submission package | Export tab + DOCX + markdown | Full pack from one place | DOCX shipped; PDF disabled state | P2 | PDF when safe |
| 11. Failed AI provider → fallback | ProviderStatus + test-all route | Green only if canGenerate | test-all added; UI uses runtime status | P2 | Surface failure chain on each run |
| 12. First-time user → 30s clarity | Today + Help + Guide Me | Know what to do immediately | **Help + Guide Me shipped** | P2 | James manual test |
| 13. Adult fiction → intimacy settings | Wizard step 3 + PATCH intimacy | Heat levels, boundaries, ask-first | **Shipped this slice** | P2 | Tier 2 clarification pop-ups in editor |
| 14. Private manuscript → Ollama default | privacyMode on brief + orchestrator | local-first unless cloud allowed | Brief defaults local-first | P2 | Enforce in router per task |
| 15. Non-developer → useful output | Help Centre + wizard + guide | No Matthew required | **Shipped docs + UI** | P2 | James usability sign-off |

## Severity summary

| Priority | Count | Theme |
| -------- | ----: | ----- |
| P0 | 0 | None — auth, snapshots, source preservation intact |
| P1 | 0 | Core workflows present after this slice |
| P2 | 10 | AI classification polish, intimacy pop-ups, PDF, compare UI |
| P3 | 2 | OCR for images; Playwright E2E |

## What this build adds

1. **Universal Source Library** — project-scoped assets API + workbench tab  
2. **Production Wizard** — `/start`, `/wizard` with product types + intimacy question  
3. **Production Brief** — generate/patch aligned to product choice  
4. **Guide Me** — drawer + `GET /api/projects/:id/guide-state`  
5. **Intimacy settings** — stored per project, wizard integration  
6. **Help Centre** — `/help` practical sections  
7. **AI test-all** — `POST /api/providers/test-all`  
8. **Natural command** — routes for guide, wizard, assets, export, rescue  

## Acceptance vs final criteria

| # | Criterion | Status after slice |
| - | --------- | ------------------ |
| 12–16 | Assets, product choice, brief, bible, book map | Assets + brief + wizard ✅; bible/book-map existing ✅ |
| 19–21 | Guide Me, Help, wizard adult question | ✅ |
| 22–25 | Intimacy stored, router tests, Ollama fallback | ✅ API; UI partial on failures |
| 26–36 | NWP, continue, trash, gold, swarm, apply, export | Prior slices ✅ |
| 37–39 | James test, guided not slow, no demo defaults | Docs exist ✅ |

## Remaining before wider private beta

- Tier 2 intimacy clarification modals in chapter editor  
- AI-powered asset classification (optional batch job)  
- PDF export  
- Playwright smoke for wizard + source library  
- James sign-off on manual script  

## Build slices (this commit series)

1. Studio module: assets, production-brief, guide-state, intimacy, test-all  
2. Source Library UI + workbench tab  
3. Production Wizard + intimacy step  
4. Guide Me drawer + top bar  
5. Help Centre + sidebar/command routes  
6. Final market leader audit + extended QA swarm  
