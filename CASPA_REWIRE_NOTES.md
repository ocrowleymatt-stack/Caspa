# Caspa output/research rewire

This branch adds the first safe rewire layer for Caspa without deleting the existing UI or disturbing Firebase auth.

## Added

- `src/services/output-contract.ts`
- `src/services/intent-router.ts`
- `src/services/review-ingest.ts`
- `src/services/caspa-orchestrator.ts`
- `src/routes/caspa-rewire-routes.ts`

## What this fixes

### 1. Plan/input confusion

Caspa now has a strict input/action/output router.

A book plan plus “write chapter one” routes to chapter prose.
A manuscript plus “polish this” routes to manuscript improvement.
A manuscript plus “cut hard” routes to a cut pass, not expansion.
A plan is only returned when the user explicitly asks for a plan.

### 2. Improvement intake

Manuscript improvement now supports an improvement brief:

- user intent
- selected improvement modes
- user diagnosis
- external reviews
- review analysis
- priority mode
- non-negotiables
- forbidden changes

Reviews are parsed into:

- praised elements
- criticised elements
- requested changes
- contradictions between reviews
- non-negotiables
- suggested improvement priorities

### 3. Research desk restoration

A research route scaffold is added. It returns a clear `web_search_unavailable` status when live search cannot be performed, rather than pretending research happened.

The research result contract supports:

- findings
- sources
- confidence
- relevance
- writing use
- suggested next searches
- contradictions
- gaps

### 4. Artefact-first output

The orchestrator prompt enforces:

- artefact first
- notes second
- no purple prose
- no padding
- no advice instead of output
- cutting as a first-class creative action

## Still to wire

The new route file must be connected in `server.ts`:

```ts
import caspaRewireRoutes from './src/routes/caspa-rewire-routes';
```

Then after middleware and before the front-end catch-all/static handler:

```ts
app.use('/api/caspa', caspaRewireRoutes);
```

Do this as a narrow patch to avoid disturbing the existing 1,200+ line server file.

## Suggested UI wiring

White Page / Gold / Red Pen / Outputs buttons should call:

- `POST /api/caspa/intent/route` before deciding whether to show intake
- `POST /api/caspa/improvement-brief` after intake
- `POST /api/caspa/write` for actual generation
- `POST /api/caspa/research/run` from Research Desk
- `POST /api/caspa/research/convert-to-writing` when sending findings to White Page

## Acceptance checks

- Manuscript + Gold Pass -> intake first, polished text second.
- Manuscript + Cut Hard -> cut text plus deletion log.
- Book plan + Write Chapter One -> chapter prose.
- Research question + Deep Research -> visible research result or explicit search unavailable.
- Outputs + Pitch Pack -> actual pitch pack, not advice.

## Product rule

Plans are ingredients. The finished book, play, script or export is the meal.
