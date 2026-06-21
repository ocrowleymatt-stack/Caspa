# Caspa Production Orchestra Module

## Purpose

The Production Orchestra is the next operational module after Show Factory. Show Factory creates the show-road pack blueprint; Production Orchestra turns it into a queued production workflow that can generate, review and assemble the core show assets.

This module deliberately excludes website building and ticketing. It focuses on getting the show itself produced.

## What it now includes

- Theatre-agent roster: producer, showrunner, book writer, lyricist, composer, arranger, musical director, stage director, actor table, critic panel, rights/safety and QA producer.
- File-backed production plan and job queue.
- Gemini structured-generation payloads for show bible, scenes, lyrics and agent review.
- Lyria 3 Clip / Lyria 3 Pro payloads for preview clips and longer demo tracks.
- Dry-run execution mode that produces placeholders without spending API credits.
- Live-mode hooks for Gemini/Lyria jobs when `GEMINI_API_KEY` is present.
- music21 / MuseScore / FFmpeg diagnostics for the future score/audio worker layer.
- ZIP export containing plan, jobs, agents, services, quality gates and README.
- Virtual tests covering the whole production-orchestra path.

## New routes

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

## Run modes

### Dry-run

Default. Validates the job graph and writes local placeholder outputs. No API spend.

```bash
curl -X POST http://localhost:3000/api/show-orchestra/run-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"mode":"dry-run","maxJobs":6}'
```

### Live

Requires `GEMINI_API_KEY`. Gemini/Lyria jobs call the Google Generative Language API and store returned text/audio artifacts locally.

```bash
GEMINI_API_KEY=your_key_here npm start
```

Then:

```bash
curl -X POST http://localhost:3000/api/show-orchestra/run-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"mode":"live","maxJobs":1}'
```

Use live mode cautiously. Start with one job, check output, then scale.

## Environment variables

```bash
GEMINI_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CLOUD_PROJECT=
PYTHON_BIN=python3
MUSESCORE_BIN=musescore
FFMPEG_BIN=ffmpeg
CASPA_DATA_DIR=/opt/caspa/data
```

## External services currently targeted

- Gemini API structured text generation.
- Gemini function calling / structured output for future schema-locked agent flows.
- Lyria 3 Clip for 30-second previews.
- Lyria 3 Pro for longer demo songs.
- Gemini TTS / Google Cloud TTS for future guide vocals.
- music21 Python worker for symbolic music / transposition.
- MuseScore CLI for score rendering.
- FFmpeg for audio processing.

## Virtual test

```bash
npm run verify
```

Current result at packaging: 35/35 checks passed.

## Honest status

Built now:

- job architecture
- dry-run production workflow
- live-mode Gemini/Lyria hooks
- diagnostics
- exports
- UI module
- virtual tests

Still next:

- true long-running worker queue
- real credentialed Gemini/Lyria production testing
- music21 score worker implementation
- MuseScore PDF/MIDI render worker
- FFmpeg preview reel assembly
- guide-vocal TTS worker
- downloadable customer show-vault packaging


## Overnight Music Lab add-on

The Production Orchestra now has a companion module: **Overnight Music Lab**.

Purpose: run cheap/private local iteration through Ollama overnight before spending Gemini/Lyria credits.

It creates:

- multiple music-prompt passes per song;
- lyric-polish passes;
- theatre critic / musical director scorecards;
- arrangement notes;
- morning Lyria shortlist payloads;
- MusicXML planning stubs;
- an overnight manifest and scorecard.

Recommended environment:

```bash
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_MS=120000
```

Useful local models to try first:

- llama3.1:8b for general prompt cycling;
- qwen2.5:14b or qwen3 if available for structured critique;
- mistral-nemo or similar for fast lyric variants.

Dry-run remains the default so the module can be tested without Ollama installed.
