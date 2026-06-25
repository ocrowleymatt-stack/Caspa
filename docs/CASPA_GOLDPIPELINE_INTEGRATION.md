# CASPA Gold Pipeline Integration

Integration guide for the Gold Pipeline SSE handoff in the **caspa-ui** + Express architecture.

## Architecture Overview

```
caspa-ui/src/pages/GoldPipeline.tsx     → thin page wrapper (route /gold)
caspa-ui/src/components/gold/
  ├── GoldPipeline.tsx                  → 2-column layout (controls + output | StatusStream)
  ├── StatusStream.tsx                  → right rail: pulsing amber dots, SSE badge
  └── types.ts                          → step definitions, output builders

caspa-ui/src/api/
  ├── gold.ts                           → sync REST: run + report
  └── goldPipeline.ts                   → SSE POST stream via apiPostStream

src/modules/gold/
  ├── GoldPipeline.ts                   → 12-step elevation engine (real run)
  ├── gold-routes.ts                    → POST /api/gold/run/:projectId (sync, preserved)
  └── goldpipeline-routes.ts            → POST /api/goldpipeline/execute (SSE)
```

## Routing

| Path | Component | Auth |
|------|-----------|------|
| `/gold` | `pages/GoldPipeline.tsx` | AuthGuard (via `App.tsx` Layout) |

Sidebar link: **Gold** → `/gold` (amber accent in `.cursorrules` nav matrix).

Legacy page `pages/Gold.tsx` remains for the simpler elevation report view.

## SSE Flow

1. User clicks **Execute Gold Pipeline Pass** in `GoldPipelinePanel`.
2. Frontend calls `executeGoldPipelineStream()` → `POST /api/goldpipeline/execute`.
3. Backend streams `step_update` events for 12 UI stages (~750ms each), then runs `goldPipeline.run(projectId)`.
4. Final `complete` event carries the `GoldReport` JSON.
5. UI populates output tabs via `buildOutputFromReport()`.
6. On SSE failure, UI falls back to `runGoldPipeline()` → `POST /api/gold/run/:projectId`.

### Request body

```json
{
  "projectId": "proj_abc",
  "config": {
    "depth": "structural",
    "route": "hybrid",
    "runMode": "controlled",
    "biases": ["literary", "rawer"],
    "chapterIds": ["ch_1", "ch_2"]
  },
  "chapters": ["ch_1", "ch_2"]
}
```

### SSE event shapes

**step_update** (during progression):

```json
{
  "type": "step_update",
  "run_id": "…",
  "stage": "prose_quality_pass",
  "status": "running",
  "message": "Analysing syntax variance…",
  "progress": 33,
  "current_chapter": "Chapter 1: Opening",
  "warnings": []
}
```

**complete** (pipeline finished):

```json
{
  "type": "complete",
  "run_id": "…",
  "report": { /* GoldReport */ }
}
```

**error**:

```json
{
  "type": "error",
  "message": "Gold pipeline failed"
}
```

Client parsing uses `apiPostStream` in `caspa-ui/src/api/client.ts` (reads `data:` lines; no raw fetch in components).

## Pass Depth Mapping

| UI Label | API value | Notes |
|----------|-----------|-------|
| Surface Polish | `surface` | Light touch |
| Structural Gold | `structural` | Default |
| Deep Synthesis | `deep` | Heavy mastering |

Handoff aliases `quick/standard/deep` map to `surface/structural/deep`.

## Visual Spec (Midnight Velvet)

- **Layout:** `lg:grid-cols-3` — left 2/3 controls + output, right 1/3 `StatusStream`
- **Pass depth selected:** amber glow (`shadow-[0_0_12px_rgba(217,119,6,0.15)]`)
- **Chapter multi-select:** emerald highlights
- **Running step:** `animate-ping` dot + `animate-pulse` subtext
- **SSE badge:** `SSE LIVE` / `SSE IDLE` in StatusStream header
- **Scrollbars:** `custom-scrollbar` utility in `index.css`
- **Page enter:** `animate-fadeIn`

## Local Development

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — UI (optional hot reload)
cd caspa-ui && npm run dev

# Full production bundle into /public
npm run deploy
```

Verify SSE:

```bash
curl -N -X POST http://localhost:3000/api/goldpipeline/execute \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"<id>","config":{},"chapters":["book"]}'
```

## Build Checklist

```bash
cd caspa-ui && npm run build && npx tsc --noEmit
cd .. && npm run build
```

See [CASPA_DEPLOYMENT_CHECKLIST.md](./CASPA_DEPLOYMENT_CHECKLIST.md) for Hetzner production deploy.
