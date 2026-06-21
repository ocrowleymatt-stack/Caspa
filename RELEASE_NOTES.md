# Caspa Local Commercial — Production Orchestra Release

## Added

- New **Production** navigation module.
- New **Caspa Production Orchestra** data model.
- Theatre-agent production company:
  - Executive Producer
  - Showrunner
  - Book Writer
  - Lyricist
  - Composer
  - Arranger
  - Musical Director
  - Stage Director
  - Actor Table
  - Theatre Critics
  - Rights & Safety
  - QA Producer
- New job queue model for script, lyrics, Lyria audio, MusicXML stubs, QA and assembly.
- Dry-run job execution mode.
- Live-mode hooks for Gemini/Lyria using `GEMINI_API_KEY`.
- Gemini structured text payload builder.
- Lyria 3 Clip / Pro payload builders.
- Diagnostics for Gemini key, Google Cloud project, Python, MuseScore and FFmpeg.
- Production Orchestra ZIP export.
- Expanded virtual test suite.

## New endpoints

```text
GET  /api/show-orchestra/module
GET  /api/show-orchestra/services
GET  /api/show-orchestra/agents
POST /api/show-orchestra/create-plan
GET  /api/show-orchestra/jobs
POST /api/show-orchestra/jobs
GET  /api/show-orchestra/jobs/:jobId
POST /api/show-orchestra/jobs/:jobId/run
POST /api/show-orchestra/run-pipeline
GET  /api/show-orchestra/diagnostics
POST /api/show-orchestra/virtual-test
POST /api/show-orchestra/export-package
```

## Test result

- Virtual test: **35 / 35 checks passed**.
- Production Orchestra score: **100 / 100**.
- Build: passed.
- Typecheck: passed.
- Smoke tests: passed.

## Important limitation

The module can run without external credentials in dry-run mode. Real Gemini/Lyria text/audio generation requires `GEMINI_API_KEY` and should initially be tested with one job at a time.

## 0.1.3 — Overnight Music Lab

Added an Ollama-backed overnight music-cycling module.

New:

- Music Lab navigation item.
- `src/data/overnightMusicLabModule.ts`.
- Ollama `/api/chat` and `/api/generate` payloads.
- Dry-run and optional live Ollama execution mode.
- Music-specific agent room: composer, lyricist, arranger, musical director, actor singability panel, theatre critic, rights guardian and overnight producer.
- Morning Lyria shortlist handoff.
- MusicXML planning path.
- Diagnostics for `OLLAMA_HOST` and local worker commands.
- ZIP export for the overnight cycle.

Virtual test now covers 45 checks and passes 45/45.
