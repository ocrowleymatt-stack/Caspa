#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def patch(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if new in text:
        print(f'already patched: {path}')
        return
    if old not in text:
        raise SystemExit(f'patch anchor not found in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))
    print(f'patched: {path}')

# Mount authenticated knowledge routes.
patch(
    'server.ts',
    "import caspaStorageRoutes from './src/routes/caspa-storage-routes';\n",
    "import caspaStorageRoutes from './src/routes/caspa-storage-routes';\nimport caspaKnowledgeRoutes from './src/routes/caspa-knowledge-routes';\n",
)
patch(
    'server.ts',
    'app.use("/api/caspa/storage", caspaStorageRoutes);\n',
    'app.use("/api/caspa/storage", caspaStorageRoutes);\napp.use("/api/caspa/knowledge", caspaKnowledgeRoutes);\n',
)

# Full-corpus Drive inventory requires read-only access to existing files, not
# drive.file (which only covers files created/opened by the app).
patch(
    'src/lib/firebase.ts',
    "googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');\n",
    "googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');\n",
)

# Surface cloud ingestion + corpus search in the live SettingsStudio path.
patch(
    'src/components/SettingsStudio.tsx',
    "import { Download, Loader, RefreshCw, UploadCloud, Activity } from 'lucide-react';\n",
    "import { Download, Loader, RefreshCw, UploadCloud, Activity } from 'lucide-react';\nimport KnowledgeCloudPanel from './KnowledgeCloudPanel';\n",
)
patch(
    'src/components/SettingsStudio.tsx',
    "        <article style={{ ...card, marginTop: 18 }}>\n          <h2 style={sectionTitle}>Local-first backup</h2>\n",
    "        <KnowledgeCloudPanel />\n\n        <article style={{ ...card, marginTop: 18 }}>\n          <h2 style={sectionTitle}>Local-first backup</h2>\n",
)

# Fast Data Upload should feed the same shared corpus instead of creating a
# second, isolated pile of source text.
patch(
    'src/App.tsx',
    "import { clearShowBox, hasShowBoxContent } from './services/showBoxService';\n",
    "import { clearShowBox, hasShowBoxContent } from './services/showBoxService';\nimport { ingestKnowledgeText } from './services/knowledgeClient';\n",
)
patch(
    'src/App.tsx',
    "    const useful = parsed.filter((item) => item.text.trim());\n    if (!useful.length) throw new Error('The uploaded files contained no readable text.');\n\n    const combined = useful.length === 1\n",
    "    const useful = parsed.filter((item) => item.text.trim());\n    if (!useful.length) throw new Error('The uploaded files contained no readable text.');\n\n    const knowledgeWrites = await Promise.allSettled(\n      useful.map((item) => ingestKnowledgeText(item.name, item.text, 'text/plain', `fast-upload:${item.name}`))\n    );\n    const knowledgeFailures = knowledgeWrites.filter((result) => result.status === 'rejected');\n    if (knowledgeFailures.length) {\n      console.warn(`[Fast Data Upload] ${knowledgeFailures.length} source(s) loaded into the project but could not be added to the shared knowledge index.`);\n    }\n\n    const combined = useful.length === 1\n",
)

# Operational defaults/documentation.
env_path = ROOT / '.env.example'
env_text = env_path.read_text()
block = """# Atlas shared knowledge/corpus engine
# Local semantic embeddings via Ollama. Pull with: ollama pull embeddinggemma
KNOWLEDGE_EMBED_MODEL=embeddinggemma
# Set to off for lexical-only emergency mode.
KNOWLEDGE_EMBEDDINGS=on
# Maximum single cloud source temporarily downloaded for extraction (bytes).
KNOWLEDGE_MAX_FILE_BYTES=367001600
# Maximum provider inventory records per scan.
KNOWLEDGE_INVENTORY_LIMIT=25000
# Audio/video transcription model. whisper-1 is used for segment timecodes.
KNOWLEDGE_TRANSCRIBE_MODEL=whisper-1"""
if 'KNOWLEDGE_EMBED_MODEL=' not in env_text:
    env_path.write_text(env_text.rstrip() + '\n\n' + block.strip() + '\n')
    print('patched: .env.example')
else:
    print('already patched: .env.example')

trigger = ROOT / '.deploy-atlas-trigger'
now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
trigger.write_text(f'deploy requested {now}\nreason: restore cloud corpus ingestion, transcription, dedupe and semantic search\n')
print('updated: .deploy-atlas-trigger')
