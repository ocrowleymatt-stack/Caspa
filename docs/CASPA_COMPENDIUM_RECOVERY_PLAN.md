# CASPA Compendium Recovery Plan

Imported from the June 2026 CASPA Studio master compendium and adapted for the current self-hosted Hetzner deployment.

## Operating rule

Do not perform a destructive mega-merge. CASPA is rebuilt as stable slices:

1. commit a small working module;
2. run `npm run deploy` / `npm run build` on the server;
3. verify routes and UI;
4. only then continue.

## Current target architecture

CASPA is now treated as a private self-hosted creative production studio:

- Hetzner-hosted, not public SaaS;
- single-user/private by default;
- Ollama bound to localhost as local inference;
- cloud providers optional for premium/heavy drafting;
- SQLite-backed data where available;
- UI build served from `public/` by the production Node server.

## Recovery layers

### Layer 1 — Casper / Novel Write Pro

Purpose: immediate creation.

Already harvested:

- Novel Write Pro literary engine;
- critic room;
- award-target prompt builder;
- Open WebUI handoff prompt builder.

Next work:

- add server-side Novel Write Pro endpoints;
- save draft/revision lineage;
- expose quality scoring and critic passes.

### Layer 2 — Gold Pipeline

Purpose: refinement and quality lift.

Target API:

```txt
POST /api/gold/run
GET  /api/gold/progress/:jobId
```

Target 12-pass sequence:

1. Structural scan
2. Scene-turn check
3. Character wound check
4. Dialogue/subtext pass
5. Place/atmosphere pass
6. Prose quality pass
7. Repetition detector
8. Continuity check
9. Commercial hook check
10. Literary/prize calibration
11. Final rewrite
12. Save/export result

### Layer 3 — Production Studio

Purpose: turn manuscripts/scripts into production and publishing assets.

Modules:

- Show Factory
- Production Orchestra
- Music Lab
- Show In A Box
- Publishing Engine
- Documents / Derivatives
- Outputs Registry
- Taste Profiles
- Audience Personas

## P0 foundation queue

1. `GET /api/doctor` module/status endpoint.
2. Confirm SQLite migration path and data safety.
3. Confirm plot point canonical collection name is `plot-points`.
4. Confirm Gold Pipeline SSE status.
5. Confirm deploy script builds UI into `public/` and restarts PM2.
6. Add a unified persistent job queue if current queues remain split.

## P1 intelligence queue

1. First-class Ollama route checks:
   - health;
   - models;
   - generate;
   - stream-generate.
2. Novel Write Pro quality pass endpoint.
3. Critic-room endpoint.
4. Revision endpoint.
5. Style DNA / Voice Lock from sample text.
6. RAG context retrieval from project notes and previous chapters.

## P2 production queue

1. Music Lab overnight cycle.
2. Show Factory pack generation.
3. Documents derivative generator.
4. Publishing/prize calibration.
5. Export bundles.
6. Marketing/submission packs.

## Definition of done per slice

A slice is not done until:

- TypeScript builds;
- UI builds to `public/`;
- route returns expected response shape;
- no dead primary button is introduced;
- deployed production is verified with cache-busting URL or bundle grep.

## Production commands

```bash
cd /root/Caspa
git fetch origin caspa-studio
git checkout caspa-studio
git reset --hard origin/caspa-studio
npm run deploy
pm2 restart caspa-server --update-env
```

## Verification commands

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/doctor
curl -s http://127.0.0.1:3000/api/assist/providers
curl -s http://127.0.0.1:3000/api/ollama/health
```

## Non-negotiables

- Do not break current Casper/Novel Write Pro.
- Do not expose Ollama publicly.
- Do not store raw secrets in repo.
- Do not make a public multi-user SaaS unless explicitly requested.
- Do not replace working modules with old speculative code.
