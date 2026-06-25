# CASPA Studio

CASPA Studio (Creative Authoring & Show Production Application) is a modular Node.js backend and React UI for novel writing, AI-assisted drafting, music composition, show packaging, publishing exports, command orchestration, and commercial readiness tooling.

## Quick start

```bash
npm install
cd caspa-ui && npm install && cd ..
cp .env.example .env
npm run deploy   # build UI → public/ + compile backend
npm start
```

Open `http://localhost:3000` — login with bootstrap admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, default `admin@caspa.local` / `changeme`).

Verify API:

```bash
curl http://localhost:3000/health
```

## UI — Command Centre

The UI opens to **Command Centre** (`/home`) in **Simple Mode**:

- Natural Command, Casper Freestyle, Forge & Intake, Music Prompt Lab, Document Studio, Publish Confidence, Outputs Hub

Toggle **Expert Mode** in the sidebar or Settings for Show Factory, Music Lab, and the full Phase 6 Elevation suite (Wonder, Quality, Taste, Audience, Showstopper, Producer, Awards, Gold, etc.).

Demo project **The Grey Lady of Bridgnorth** is seeded automatically when no projects exist.

## Casper CLI

```bash
export CASPA_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@caspa.local","password":"changeme"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

npm run casper -- "check quality and prepare for publishing"
```

See [docs/CASPER_FREESTYLE_TERMINAL.md](docs/CASPER_FREESTYLE_TERMINAL.md).

## Docker quick start

```bash
docker-compose up
```

## API base URL

- **Backend:** `http://localhost:3000`
- **UI API config:** `caspa-ui/src/config.ts` only (`VITE_API_URL` optional for cross-origin)
- **Health:** `GET /health` (public)
- **Auth:** `POST /api/auth/login`, `POST /api/auth/register` (public); all other `/api/*` require Bearer token

## Modules

### Core

| Module | Routes |
|--------|--------|
| Storage | `/stats`, `/backup`, `/export`, … |
| Manuscript | `/api/projects/*`, chapters, characters, plot, research notes |
| AI Assistant | `/api/assist/*`, `/api/ai/*` |
| Show Factory | `/api/show-factory/*` |
| Music Lab | `/api/music-lab/*` |
| Orchestra (jobs) | `/api/jobs/*` |
| Publishing | `/api/publish/*` |
| Show In A Box | `/api/show-box/*` |
| Auth | `/api/auth/*` |

### Command & Intake (New)

| Module | Routes |
|--------|--------|
| Command Orchestrator | `/api/command/*` |
| Casper Freestyle | `/api/casper/*` |
| Intake | `/api/intake/*` |
| Product Forge | `/api/product-forge/*` |
| Research | `/api/research/*` (web search stub) |
| Verification | `/api/verification/*` |
| Illustration | `/api/illustration/*` |
| Music Prompt Lab | `/api/music-prompt/*` |
| Document Renderer | `/api/document-render/*` |
| Publish Confidence | `/api/publish-confidence/*` |
| Outputs | `/api/outputs/*` |

### Phase 6 Elevation

Wonder, Quality (+ quality-core: `/api/quality/ai-smell`, `/human-voice`), Taste, Audience, Showstopper, Rehearsal, Producer, Localise, Visuals, Awards, Gold.

## Documentation

| Doc | Purpose |
|-----|---------|
| [CASPA_MASTER_CONSOLIDATION_AUDIT.md](docs/CASPA_MASTER_CONSOLIDATION_AUDIT.md) | Module inventory and gaps |
| [CASPA_EXPANSION_IMPLEMENTATION_REPORT.md](docs/CASPA_EXPANSION_IMPLEMENTATION_REPORT.md) | What was built |
| [CASPA_FINAL_TEST_REPORT.md](docs/CASPA_FINAL_TEST_REPORT.md) | Build and smoke test results |
| [CASPA_FINAL_POLISH_AND_QA_REPORT.md](docs/CASPA_FINAL_POLISH_AND_QA_REPORT.md) | QA and limitations |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `DATA_DIR` | `./data` | JSON data store directory |
| `AUTH_SECRET` | — | JWT signing secret |
| `ADMIN_EMAIL` | — | Bootstrap admin email |
| `ADMIN_PASSWORD` | — | Bootstrap admin password |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama API URL |
| `OLLAMA_MODEL` | `llama3.2` | Default Ollama model |
| `GEMINI_API_KEY` | — | Google Gemini (optional) |
| `OPENAI_API_KEY` | — | OpenAI (optional) |
| `ANTHROPIC_API_KEY` | — | Anthropic (optional) |
| `GROK_API_KEY` | — | xAI Grok (optional) |
| `DROPBOX_TOKEN` | — | Dropbox sync (optional) |
| `BACKUP_DIR` | `./backups` | Backup output directory |
| `LOG_LEVEL` | `info` | Log level |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (`tsx watch server.ts`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm run deploy:ui` | Build caspa-ui → `public/` |
| `npm run deploy` | deploy:ui + build |
| `npm run casper` | Casper Freestyle CLI |
