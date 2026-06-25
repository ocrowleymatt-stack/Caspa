# CASPA Master Consolidation Audit

**Date:** 2026-06-23  
**Scope:** Phase 1 audit before master consolidation + final polish

## Existing Modules (Preserved)

| Module | Path | Key Routes | Status |
|--------|------|------------|--------|
| Storage | `src/modules/storage` | `/stats`, `/backup`, `/export` | ✅ Working |
| Manuscript | `src/modules/manuscript` | `/api/projects/*`, chapters, characters, plot, research | ✅ Working |
| AI | `src/modules/ai` | `/api/assist/*`, `/api/ai/*` | ✅ Working |
| Show Factory | `src/modules/show-factory` | `/api/show-factory/*` | ✅ Working |
| Music Lab | `src/modules/music-lab` | `/api/music-lab/*` | ✅ Working |
| Orchestra | `src/modules/orchestra` | `/api/jobs/*` | ✅ Working |
| Publishing | `src/modules/publishing` | `/api/publish/*` | ✅ Working |
| Show Box | `src/modules/show-box` | `/api/show-box/*` | ✅ Working |
| Wonder | `src/modules/wonder` | `/api/wonder/*` | ✅ Phase 6 elevation |
| Quality | `src/modules/quality` | `/api/quality/check-*`, `/api/quality/final-gate/*` | ✅ Phase 6 elevation |
| Taste | `src/modules/taste` | `/api/taste/*` | ✅ Phase 6 elevation |
| Audience | `src/modules/audience` | `/api/audience/*` | ✅ Phase 6 elevation |
| Showstopper–Gold | elevation suite | `/api/showstopper/*` … `/api/gold/*` | ✅ Phase 6 elevation |
| Auth | `src/modules/auth` | `/api/auth/*` | ✅ Working |

## New Modules (Added)

| Module | Routes | Delegates To |
|--------|--------|--------------|
| command-orchestrator | `/api/command/*` | ToolRegistry maps to all modules |
| casper-freestyle | `/api/casper/*` | command-orchestrator, ToolRegistry |
| intake | `/api/intake/*` | — |
| product-forge | `/api/product-forge/*` | manuscript projects |
| quality-core | `/api/quality/ai-smell`, `/human-voice`, `/consolidated-gate` | quality, wonder |
| research | `/api/research/*` | StubWebResearchProvider (stub) |
| verification | `/api/verification/*` | research ClaimExtractor |
| illustration | `/api/illustration/*` | — |
| music-prompt-lab | `/api/music-prompt/*` | distinct from music-lab |
| document-renderer | `/api/document-render/*` | pdf-lib |
| publish-confidence | `/api/publish-confidence/*` | quality-core, verification |
| outputs | `/api/outputs/*` | data/outputs/ registry |

## Route Conflict Resolution

- **Quality:** Existing Phase 6 routes unchanged. New quality-core routes added to `quality-routes.ts` under `/api/quality/ai-smell`, `/human-voice`, `/consolidated-gate/:projectId`.
- **Research:** Manuscript has `/api/projects/:id/research` (notes). New module uses `/api/research/*` (planning/verification) — no conflict.
- **Music:** Music Lab stays at `/api/music-lab/*`. Music Prompt Lab at `/api/music-prompt/*`.

## UI Pages

### New (Simple Mode)
- CommandCentre (`/home`) — home entry
- NaturalCommand (`/command`)
- CasperFreestyle (`/casper`)
- ForgeIntake (`/forge`), ProductPlan, Sources
- MusicPromptLab (`/music-prompt`)
- DocumentStudio (`/documents`)
- PublishConfidence (`/confidence`)
- Outputs (`/outputs`)

### Preserved (Expert Mode + Elevation)
All existing pages retained: Dashboard/Projects, Show Factory, Music Lab, Production/Jobs, Publish, Wonder–Gold, Settings, Admin.

## Gaps Identified & Addressed

| Gap | Resolution |
|-----|------------|
| No unified command layer | command-orchestrator + Casper |
| No intake/source ledger | intake module + Sources page |
| AI smell / human voice separate from gates | quality-core wraps quality + wonder |
| Web research unavailable | StubWebResearchProvider with clear message |
| No publish readiness certificate | publish-confidence module |
| No output registry | outputs module |
| No Simple/Expert UI toggle | store.simpleMode + Sidebar |

## Duplicates Avoided

- quality-core does NOT reimplement gates — delegates to `qualityOrchestrator`, `ClicheDetector`, `AudienceSimulator`
- music-prompt-lab extends concepts, does not replace music-lab
- Frontend Research page (manuscript notes) kept; new `/api/research/*` is planning/verification

## Data Directories

`data/commands/`, `freestyle-sessions/`, `sources/`, `product-plans/`, `claim-ledgers/`, `music-prompts/`, `document-renders/`, `confidence-certificates/`, `outputs/`

## Demo Data

Empty project store seeds **The Grey Lady of Bridgnorth** on first boot via `ensureDemoProject()`.

## Implementation Order (Completed)

1. Safety snapshot  
2. Shared fileStore helper  
3. command-orchestrator → casper-freestyle  
4. intake → product-forge  
5. quality-core (extend quality routes)  
6. research → verification  
7. illustration → music-prompt-lab → document-renderer  
8. publish-confidence → outputs  
9. server.ts mount + demo seed  
10. Frontend pages + API clients + Sidebar  
11. Polish docs + verification  
