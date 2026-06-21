# Casper Show-in-a-Box + NemeSign Growth Engine

This build now includes the supplied commercial model as a first-class product/workflow module inside the Caspa local-first app.

## Added in this build

- A new **Show Box** navigation item in the Caspa redesign shell.
- Full `casperShowInABoxModel` source model at `src/data/casperShowInABoxModel.ts`.
- UI dashboard for:
  - objective and positioning;
  - primary systems;
  - revenue streams;
  - core modules;
  - P0 features;
  - quality gates;
  - data entities;
  - immediate next actions;
  - build phases **2, 3, 4 and 5**.
- Client-side exports:
  - full model as JSON;
  - phases 2–5 as Markdown.
- Server-side API routes:
  - `GET /api/show-in-a-box/model`
  - `GET /api/show-in-a-box/summary`
  - `GET /api/show-in-a-box/phases?ids=2,3,4,5`
  - `GET /api/show-in-a-box/export?format=json`
  - `GET /api/show-in-a-box/export?format=md`

## Included phases

### Phase 2 — NemeSign Sales Engine
Promotes Show-in-a-Box to groups using prospect database, CRM pipeline, email sequences, call tasks, lead scoring, sales reporting, quotes and testimonial capture.

### Phase 3 — Music and Arrangement Engine
Adds song map, lyrics, ElevenLabs Music, Stable Audio fallback, music21, MusicXML, MuseScore CLI rendering, piano-vocal score, arrangement presets, transposition, backing tracks and music QA checks.

### Phase 4 — Customer Campaign Engine
Adds customer campaign workspace, audience CRM, cast/star/Dame marketing, social content, email campaign generation, press outreach, sponsor campaigns, recommended actions and weekly reports.

### Phase 5 — Ticketing and Box Office
Adds external links/embeds, QR codes, sales dashboard, native general-admission box office MVP, ticket types, promo codes, comps, door-list export and weak-night recommendations.

## Build status

The app builds successfully with:

```bash
npm run build
```

The usual large bundle warning remains. It is not fatal. Next proper optimisation pass should code-split old legacy views.
