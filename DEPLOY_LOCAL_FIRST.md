# Caspa Studio — Local-First Commercial Build

This package is the polished self-hostable build of Caspa Studio with:

- Firestore removed from the release path
- local-first browser state plus server JSON mirror
- manual local backups, listing and restore
- optional Dropbox backup endpoints
- Document Derivatives export: Markdown, TXT, JSON and DOCX
- Casper Show-in-a-Box + NemeSign model dashboard
- server-side Show-in-a-Box readiness and virtual workflow test
- release typecheck, build and virtual-test scripts

## Install

```bash
mkdir caspa
cd caspa
tar -xzf caspa-local-commercial-polished.tar.gz
npm install
cp .env.example .env
nano .env
npm run build
npm start
```

Default URL:

```text
http://your-server:3000
```

## Recommended `.env`

```bash
NODE_ENV=production
PORT=3000
CASPA_DATA_DIR=/opt/caspa/data
DROPBOX_ACCESS_TOKEN=
```

`DROPBOX_ACCESS_TOKEN` is optional. Leave it blank until you want off-site backups.

## Verify before going live

```bash
npm run verify
```

This runs:

1. release typecheck
2. production build
3. virtual server test

The virtual test starts the built server, writes/reads local storage, creates a backup, restores it, tests Show-in-a-Box endpoints, runs the virtual workflow test, and exports derivative documents in MD/TXT/JSON/DOCX.

## Useful endpoints

```text
GET  /health
GET  /api/doctor
GET  /api/local/status
GET  /api/local/db
PUT  /api/local/db
POST /api/local/backup
GET  /api/local/backups
POST /api/local/restore
POST /api/local/dropbox/backup

GET  /api/show-in-a-box/model
GET  /api/show-in-a-box/summary
GET  /api/show-in-a-box/phases?ids=2,3,4,5
GET  /api/show-in-a-box/readiness
POST /api/show-in-a-box/virtual-test
GET  /api/show-in-a-box/export?format=json
GET  /api/show-in-a-box/export?format=md

POST /api/documents/export
POST /api/documents/dropbox-backup
```

## Server deployment with pm2

```bash
npm install -g pm2
pm2 start dist/server.cjs --name caspa --update-env
pm2 save
```

With env:

```bash
PORT=3000 CASPA_DATA_DIR=/opt/caspa/data pm2 start dist/server.cjs --name caspa
```

## Nginx reverse proxy sketch

```nginx
server {
  server_name novel.ocrowley.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## What changed in the polish pass

- Replaced the old massive legacy `App.tsx` route path with a clean release app shell.
- Replaced the legacy server with a clean commercial server focused on local-first storage, derivatives, Show-in-a-Box, backup and health checks.
- Reduced production JS from roughly 2.1MB to about 290KB.
- Added `npm run typecheck:release` so the deployable release path is checked without dragging in old experimental files.
- Added `npm run test:virtual` and `npm run verify`.
- Added backup listing and restore endpoints.
- Added `/api/show-in-a-box/readiness` and `/api/show-in-a-box/virtual-test`.
- Added a clearer Show Box UI readiness panel.

## Known limits

- Dropbox backup is endpoint-driven, not yet a polished button in every screen.
- The old experimental files are still in the repository but are no longer on the release path.
- Native ticketing, music rendering and payment processing are modelled, not implemented. Correct: those should be separate services, not jammed into the first upload.

## Show Factory module

The current build includes the next production module: **Casper Show Factory**.

Use it from the UI via **Show Factory**, or call the endpoints directly:

```bash
curl http://localhost:3000/api/show-factory/module
curl -X POST http://localhost:3000/api/show-factory/create-pack \
  -H 'Content-Type: application/json' \
  -d '{"brief":{"title":"The Haunted Dame","songCount":8}}'
curl -X POST http://localhost:3000/api/show-factory/virtual-test
```

To export a ZIP show-road pack:

```bash
curl -X POST http://localhost:3000/api/show-factory/export-package \
  -H 'Content-Type: application/json' \
  -d '{"brief":{"title":"The Haunted Dame","songCount":8}}' \
  --output show-road-pack.zip
```

Gemini/Lyria, Gemini-TTS, music21, MuseScore CLI and FFmpeg are catalogued for the next worker pass. This build creates prompts, plans, manifests, QA and MusicXML stubs locally; it does not call paid external generation services without credentials.


## Production Orchestra module

This release adds the next Show Factory execution module: **Production Orchestra**.

It is designed to get the show itself moving before website/ticketing modules are added.

### Test locally

```bash
npm install
npm run verify
npm start
```

### Optional live Gemini/Lyria setup

```bash
GEMINI_API_KEY=your_google_ai_key_here
GOOGLE_API_KEY=your_google_ai_key_here
PYTHON_BIN=python3
MUSESCORE_BIN=musescore
FFMPEG_BIN=ffmpeg
```

Use dry-run first:

```bash
curl -X POST http://localhost:3000/api/show-orchestra/run-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"mode":"dry-run","maxJobs":6}'
```

Then try one live job only after credentials are configured:

```bash
curl -X POST http://localhost:3000/api/show-orchestra/run-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"mode":"live","maxJobs":1}'
```

### Diagnostics

```bash
curl http://localhost:3000/api/show-orchestra/diagnostics
```

This reports whether Gemini is configured and whether Python, MuseScore and FFmpeg are visible to the server.

## Overnight Music Lab / Ollama

The build includes an optional local Ollama cycle for overnight music iteration.

```bash
# Install and run Ollama separately, then pull a model, for example:
ollama pull llama3.1:8b

# In .env:
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_MS=120000
```

Endpoints:

```text
GET  /api/music-lab/module
GET  /api/music-lab/services
GET  /api/music-lab/agents
POST /api/music-lab/create-cycle
GET  /api/music-lab/jobs
POST /api/music-lab/jobs/:jobId/run
POST /api/music-lab/run-overnight
GET  /api/music-lab/diagnostics
POST /api/music-lab/virtual-test
POST /api/music-lab/export-package
```

Run Ollama mode cautiously:

```bash
curl -X POST http://localhost:3000/api/music-lab/run-overnight \
  -H 'Content-Type: application/json' \
  -d '{"mode":"ollama","maxJobs":3}'
```

Use dry-run first. Overnight live cycles can be long-running and should be capped with `maxJobs` until the model and host are stable.
