# Casper Show Factory Module

## Scope

This module gets the show on the road before website/ticketing/customer campaign work begins. It creates a local production pack for a flagship show and defines the API/service adapters required for full commercial generation.

## Built now

- Show Factory navigation screen in the Caspa UI.
- Theatre-agent production line:
  - showrunner
  - book writer
  - joke doctor
  - lyricist
  - composer
  - arranger
  - musical director
  - stage director
  - choreographer
  - actor representative
  - theatre critic
  - rights/safety reviewer
  - family audience reviewer
  - producer
- Show-road pack generator.
- Show bible.
- Cast map.
- Scene list.
- Script sample.
- Eight-song map.
- Draft lyrics pack.
- Gemini/Lyria prompt pack.
- Score/MusicXML plan.
- Soundtrack plan.
- Guide vocal/backing track/demo track manifest.
- Agent reviews.
- Rights, script, music and production readiness gates.
- Asset manifest.
- ZIP package export.
- Virtual test endpoint.

## Intentionally not included yet

- Website builder.
- Ticketing.
- Native box office.
- Customer campaign workspace.
- Payment/licence checkout fulfilment.

Those stay parked until the core show-production engine is stronger.

## API endpoints

```text
GET  /api/show-factory/module
GET  /api/show-factory/apis
GET  /api/show-factory/agents
POST /api/show-factory/create-pack
POST /api/show-factory/lyria-payload
POST /api/show-factory/virtual-test
POST /api/show-factory/export-package
```

## Required external services for the next hardening pass

| Service | Use |
|---|---|
| Gemini API | Text agents, script expansion, lyric rewrite, theatre critic and rights-review passes |
| Lyria 3 Clip | 30-second previews and motifs |
| Lyria 3 Pro | longer demo songs and fuller arrangements |
| Gemini-TTS / Cloud TTS | guide vocals, spoken cues and rehearsal narration |
| music21 | symbolic score generation, transposition and vocal range checks |
| MuseScore CLI | render MusicXML to PDF score and MIDI |
| FFmpeg | convert, normalise and assemble audio files |

## Test status

`npm run verify` passes.

Latest virtual test: 25 / 25 checks passed.
