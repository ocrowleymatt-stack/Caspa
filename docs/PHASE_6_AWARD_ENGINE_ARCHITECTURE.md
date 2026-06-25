# Phase 6 — Award / Wonder / Elevation Engine Architecture

CASPA Studio Phase 6 adds eleven elevation modules (6A–6L) that sit above manuscript and show-factory work. Each module exposes REST JSON routes (`{ success, data?, error? }`), persists state in the shared JSON DB under `data/`, and optionally calls `AIOrchestrator` with deterministic fallbacks when no provider is available.

## Module map

| ID | Module | Path | Purpose |
|----|--------|------|---------|
| 6A | Wonder Engine | `src/modules/wonder/` | Emotional arc, critic panel, polish, motifs |
| 6B | Quality | `src/modules/quality/` | Multi-gate quality checks (PASS/REVISE/BLOCK) |
| 6C | Taste | `src/modules/taste/` | Style DNA, taste profiles, preference memory |
| 6D | Audience | `src/modules/audience/` | Persona simulation, market fit, reviews |
| 6E | Showstopper | `src/modules/showstopper/` | Signature moments, killer lines, finales |
| 6F | Rehearsal | `src/modules/rehearsal/` | Table read, blocking, pacing, castability |
| 6G | Producer | `src/modules/producer/` | Budget, venue, rights, schedule, revenue |
| 6H | Localise | `src/modules/localise/` | Regional jokes, cast/venue customisation |
| 6I | Visuals | `src/modules/visuals/` | Poster, palette, costume/set briefs |
| 6J | Awards | `src/modules/awards/` | Festival fit, submission packs, judges brief |
| 6K | Gold | `src/modules/gold/` | 12-step elevation pipeline + report |
| 6L | UI Integration | `caspa-ui/` | Sidebar ✨ ELEVATION section, routes, API clients |

## Shared infrastructure

- **DB**: `src/shared/db.ts` — JSON collections (`motifs`, `taste-profiles`, `gold-reports`, etc.)
- **AI**: `src/modules/ai/AIOrchestrator.ts` — provider chain with fallback
- **Helpers**: `src/shared/routeHelpers.ts`, `src/shared/elevationHelpers.ts`
- **Types**: `src/shared/types.ts` — MotifEntry, TasteProfile, GoldReport, etc.
- **UI config**: `caspa-ui/src/config.ts` — sole API base URL

## 6A — Wonder Engine

**Files**: `EmotionalArcEngine.ts`, `AwardReadinessScorer.ts`, `CriticPanel.ts`, `AudienceSimulator.ts`, `MotifLedger.ts`, `RevisionLadder.ts`, `FinalPolishEngine.ts`, `wonder-routes.ts`, `index.ts`

**Routes** (`/api/wonder/`):
- `POST analyse-project/:projectId` — full emotional arc analysis
- `POST analyse-chapter/:chapterId` — chapter-level arc
- `POST polish-text` — body: `{ text, projectId? }`
- `POST critic-panel` — 9 critic roles
- `POST revision-ladder` — staged revision plan
- `POST audience-sim` — 12 audience personas
- `GET/POST/PUT/DELETE motif-ledger` — CRUD motifs
- `GET score/:projectId` — award readiness score

**UI**: `caspa-ui/src/api/wonder.ts`, `pages/Wonder.tsx`

## 6B — Quality

**Files**: `OutputQualityGate.ts`, `ClicheDetector.ts`, `EmotionalTruthGate.ts`, `RightsAndSafetyGate.ts`, `CommercialClarityGate.ts`, `PerformancePracticalityGate.ts`, `quality-routes.ts`, `index.ts`

**Routes** (`/api/quality/`):
- `POST check-text` — run all gates on text
- `POST check-project/:projectId`
- `POST check-show/:showPackageId`
- `POST check-marketing` — body: `{ text }`
- `POST final-gate/:projectId` — aggregate final gate

**Statuses**: `PASS`, `PASS_WITH_WARNINGS`, `REVISE`, `BLOCK`

**UI**: `api/quality.ts`, `pages/Quality.tsx`

## 6C — Taste

**Files**: `TasteProfileService.ts`, `StyleDNAExtractor.ts`, `ReferenceLibrary.ts`, `PreferenceMemory.ts`, `taste-routes.ts`, `index.ts`

**Routes** (`/api/taste/`):
- CRUD `/profiles`, `/profiles/:id`
- `POST extract-style` — body: `{ text, projectId? }`
- `POST apply-profile` — body: `{ profileId, text }`
- `POST compare-output` — body: `{ profileId, textA, textB }`

**UI**: `api/taste.ts`, `pages/Taste.tsx`

## 6D — Audience

**Files**: `AudiencePersonaService.ts`, `ReactionSimulator.ts`, `MarketFitScorer.ts`, `TicketBuyerPredictor.ts`, `ReaderReviewSimulator.ts`, `audience-routes.ts`, `index.ts`

**Routes** (`/api/audience/`):
- `POST simulate/:projectId`
- `POST test-text` — body: `{ text, persona? }`
- `GET market-fit/:projectId`
- `POST review-sim/:projectId`
- `GET ticket-buyer-fit/:projectId`

**Simulation fields**: loved, boredBy, confusedBy, emotionalReaction, buyingReaction, lineRemembered, commercialObjection, recommendation

**UI**: `api/audience.ts`, `pages/Audience.tsx`

## 6E — Showstopper

**Files**: `SignatureMomentFinder.ts`, `BigNumberGenerator.ts`, `ElevenOClockNumberEngine.ts`, `FinaleBuilder.ts`, `KillerLineGenerator.ts`, `TrailerMomentExtractor.ts`, `showstopper-routes.ts`, `index.ts`

**Routes** (`/api/showstopper/`):
- `POST find/:projectId`
- `POST killer-lines` — body: `{ text, projectId? }`
- `POST big-number/:projectId`
- `POST finale/:projectId`
- `POST trailer-moments/:projectId`
- `POST poster-quotes/:projectId`

**Output bundle**: 5 poster, 5 trailer, 3 final, 3 showstopper scenes, 3 song hooks, 1 risky option

**UI**: `api/showstopper.ts`, `pages/Showstopper.tsx`

## 6F — Rehearsal

**Routes** (`/api/rehearsal/`): table-read, dialogue-check, blocking, pacing, castability, notes (all keyed by showPackageId where noted)

**UI**: `api/rehearsal.ts`, `pages/Rehearsal.tsx`

## 6G — Producer

**Routes** (`/api/producer/`): budget, venue-fit, rights-risk, schedule, cast-crew, revenue

**UI**: `api/producer.ts`, `pages/Producer.tsx`

## 6H — Localise

**Routes** (`/api/localise/`): project, show, local-jokes, cast-size, venue, sponsor-safe

**UI**: `api/localise.ts`, `pages/Localise.tsx`

## 6I — Visuals

**Routes** (`/api/visuals/`): identity, poster, palette, set-brief, costume-brief, trailer-script

**UI**: `api/visuals.ts`, `pages/Visuals.tsx`

## 6J — Awards

**Routes** (`/api/awards/`): readiness, festival-pack, artist-statement, judges-brief, pull-quotes, category-fit

**UI**: `api/awards.ts`, `pages/Awards.tsx`

## 6K — Gold Pipeline

**Files**: `GoldPipeline.ts`, `GoldReport.ts`, `gold-routes.ts`, `index.ts`

**Routes**:
- `POST /api/gold/run/:projectId` — runs 12 steps
- `GET /api/gold/report/:projectId` — latest report

**12 steps**: wonder → quality → taste → audience → showstopper → rehearsal → producer → localise → visuals → awards → commercial (show-box) → final polish

**UI**: `api/gold.ts`, `pages/Gold.tsx`

## 6L — UI Integration

**Sidebar**: section `✨ ELEVATION` with links to all 11 pages

**Routes**: `/wonder`, `/quality`, `/taste`, `/audience`, `/showstopper`, `/rehearsal`, `/producer`, `/localise`, `/visuals`, `/awards`, `/gold`

**Server**: all routers mounted in `server.ts`

## Quality gates

1. TypeScript: `npx tsc --noEmit` — zero errors
2. Backend build: `npm run build`
3. UI build: `cd caspa-ui && npm run build`
4. Deploy UI: `npm run deploy:ui`
5. Smoke: `/health`, `POST /api/wonder/polish-text`, `POST /api/quality/check-text`, `GET /`

## Verification checklist

- [ ] All 11 elevation pages load in browser
- [ ] Each API returns `{ success: true, data: ... }` for valid input
- [ ] Motif CRUD persists to `data/motifs.json`
- [ ] Gold pipeline produces 12-step report
- [ ] No backend imports in UI except via `config.ts` + `api/*`

## Rollback

Restore pre-phase snapshot:

```bash
tar -xzf .caspa_snapshots/pre_phase6_YYYYMMDD_HHMMSS.tar.gz
npm install && cd caspa-ui && npm install && cd ..
npm run deploy:ui && npm run build
```

Or selectively remove `src/modules/{wonder,quality,taste,audience,showstopper,rehearsal,producer,localise,visuals,awards,gold}` and revert `server.ts`, `App.tsx`, `Sidebar.tsx`.
