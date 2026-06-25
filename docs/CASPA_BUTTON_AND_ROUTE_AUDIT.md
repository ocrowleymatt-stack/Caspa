# CASPA Button and Route Audit

**Date:** 2026-06-23  
**Purpose:** Verify all primary buttons and navigation routes are functional

## Primary Button Audit

| Page | Button | Action | Status |
|------|--------|--------|--------|
| Command Centre | Quick link cards | Navigate to module pages | ✅ |
| Natural Command | Interpret | POST `/api/command/interpret` | ✅ |
| Natural Command | Plan Workflow | POST `/api/command/plan` | ✅ |
| Natural Command | Execute | POST `/api/command/execute` | ✅ |
| Casper Freestyle | Send | POST `/api/casper/freestyle` | ✅ |
| Forge & Intake | Analyse Source | POST `/api/intake/analyse` | ✅ |
| Forge & Intake | Recommend Products | POST `/api/product-forge/recommend` | ✅ |
| Product Plan | Generate Product Plan | POST `/api/product-forge/recommend` | ✅ |
| Music Prompt Lab | Interpret Prompt | POST `/api/music-prompt/interpret` | ✅ |
| Music Prompt Lab | Start Jam Session | POST `/api/music-prompt/jam/start` | ✅ |
| Document Studio | Render Preview | POST `/api/document-render/preview` | ✅ |
| Publish Confidence | Run Confidence Check | POST `/api/publish-confidence/check` | ✅ |
| Settings | Switch Mode | Toggles simpleMode in store | ✅ |
| Dashboard | New Project | createProject mutation | ✅ (preserved) |
| Quality | Check Text/Project/Final | Existing quality API | ✅ (preserved) |

## Route Audit

| Route | Component | AuthGuard | Status |
|-------|-----------|-----------|--------|
| `/home` | CommandCentre | ✅ | ✅ |
| `/command` | NaturalCommand | ✅ | ✅ |
| `/casper` | CasperFreestyle | ✅ | ✅ |
| `/projects` | Dashboard | ✅ | ✅ |
| `/forge` | ForgeIntake | ✅ | ✅ |
| `/product-plan` | ProductPlan | ✅ | ✅ |
| `/sources` | Sources | ✅ | ✅ |
| `/music-prompt` | MusicPromptLab | ✅ | ✅ |
| `/documents` | DocumentStudio | ✅ | ✅ |
| `/confidence` | PublishConfidence | ✅ | ✅ |
| `/outputs` | Outputs | ✅ | ✅ |
| `/production` | Production (Jobs) | ✅ | ✅ |
| `/settings` | Settings | ✅ | ✅ |
| All elevation routes | Wonder–Gold | ✅ | ✅ (preserved) |
| `/login`, `/register` | Public | — | ✅ |

## Fixes Applied

- Index route redirects to `/home` (Command Centre) instead of Dashboard
- Sidebar Simple Mode lists all required nav items with working routes
- Forge page links to Sources and Product Plan (no dead links)
- All new primary buttons wired to real API clients — no TODO placeholders

## Known Non-Issues

- Outputs Hub empty until artefacts registered — intentional empty state message
- Sources empty until intake analyse run — intentional
- Expert-only routes hidden in Simple Mode but still accessible via URL
