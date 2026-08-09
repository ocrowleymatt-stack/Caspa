#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected patch anchor missing in {path}: {old[:120]!r}")
    text = text.replace(old, new, 1)
    p.write_text(text)


# ── Server: start cloud autopilot and keep Council recovery out of slow local pools.
replace_once(
    'server.ts',
    "import { getBuildInfo } from './src/services/buildInfoService';\n",
    "import { getBuildInfo } from './src/services/buildInfoService';\nimport { startCloudKnowledgeAutopilot } from './src/services/cloudKnowledgeAutopilotService';\n",
)

replace_once(
    'server.ts',
    "    taskHint,\n  } = req.body;",
    "    taskHint,\n    skipLocalFallback = false,\n  } = req.body;",
)

replace_once(
    'server.ts',
    "  const providers: string[] = [];\n  if (strictProvider && providerOverride) {\n    providers.push(providerOverride);\n  } else {\n    if (isProviderConfigured('unified')) providers.push('unified');\n    providers.push(...providerOrder(primaryProvider, mode, task, isSensitive));\n    if (providerOverride) providers.unshift(providerOverride);\n  }\n\n  const ordered = [...new Set(providers)];",
    "  const providers: string[] = [];\n  // Council recovery is latency-sensitive. A local/unified timeout must never\n  // consume another 30-120 seconds before healthy cloud providers are tried.\n  const avoidLocalFallback = Boolean(skipLocalFallback) || task === 'council';\n  if (strictProvider && providerOverride) {\n    providers.push(providerOverride);\n  } else {\n    if (!avoidLocalFallback && isProviderConfigured('unified')) providers.push('unified');\n    providers.push(...providerOrder(primaryProvider, mode, task, isSensitive));\n    if (providerOverride) providers.unshift(providerOverride);\n  }\n\n  const ordered = [...new Set(providers)].filter((provider) =>\n    !avoidLocalFallback || (provider !== 'unified' && provider !== 'ollama')\n  );",
)

replace_once(
    'server.ts',
    "\n\n  // Listen — long AI/research calls need node HTTP timeouts > nginx default.\n  const httpServer = app.listen(PORT, \"0.0.0.0\", () => {",
    "\n\n  // Durable provider-refresh credentials and cursors live under CASPA_DATA_DIR.\n  // The worker is restart-safe and no-op when no users have connected a cloud.\n  startCloudKnowledgeAutopilot();\n\n  // Listen — long AI/research calls need node HTTP timeouts > nginx default.\n  const httpServer = app.listen(PORT, \"0.0.0.0\", () => {",
)

# ── Browser AI service: never retry a failed Council seat through local inference.
replace_once(
    'src/services/ai.ts',
    "  taskHint?: string;\n}) {",
    "  taskHint?: string;\n  skipLocalFallback?: boolean;\n}) {",
)

replace_once(
    'src/services/ai.ts',
    "        taskHint: 'council'\n      });",
    "        taskHint: 'council',\n        skipLocalFallback: !strict\n      });",
)

replace_once(
    'src/services/ai.ts',
    "      const recoveryText = await callAI({ prompt: recoveryPrompt, json: true, schema, maxTokens: 1800 });",
    "      const recoveryText = await callAI({\n        prompt: recoveryPrompt,\n        json: true,\n        schema,\n        maxTokens: 1400,\n        taskHint: 'council',\n        skipLocalFallback: true,\n      });",
)

# If a local model timed out elsewhere, do not immediately hammer the same model again.
replace_once(
    'src/services/freeModelPool.ts',
    "const DISCOVERY_CACHE_MS = 60_000;\nlet discoveryCache: { at: number; models: DiscoveredModel[] } | null = null;",
    "const DISCOVERY_CACHE_MS = 60_000;\nconst LOCAL_TIMEOUT_COOLDOWN_MS = 10 * 60_000;\nlet discoveryCache: { at: number; models: DiscoveredModel[] } | null = null;\nconst localModelCooldownUntil = new Map<string, number>();",
)

replace_once(
    'src/services/freeModelPool.ts',
    "    .filter((model) => !/(27b|26\\.9b|27\\.8b)/i.test(`${model.id} ${model.parameterSize || ''}`))\n    .sort((a, b) => b.runScore - a.runScore)",
    "    .filter((model) => !/(27b|26\\.9b|27\\.8b)/i.test(`${model.id} ${model.parameterSize || ''}`))\n    .filter((model) => (localModelCooldownUntil.get(model.id) || 0) <= Date.now())\n    .sort((a, b) => b.runScore - a.runScore)",
)

replace_once(
    'src/services/freeModelPool.ts',
    "    } catch (error: any) {\n      lastError = error instanceof Error ? error : new Error(String(error));\n    }\n  }\n  throw lastError || new Error('Interactive local model pool exhausted');",
    "    } catch (error: any) {\n      lastError = error instanceof Error ? error : new Error(String(error));\n      if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /timeout/i.test(String(error?.message || error))) {\n        localModelCooldownUntil.set(candidate.id, Date.now() + LOCAL_TIMEOUT_COOLDOWN_MS);\n        console.warn(`[Ollama] ${candidate.id} timed out; cooling it down for 10 minutes.`);\n      }\n    }\n  }\n  throw lastError || new Error('Interactive local model pool exhausted');",
)

# ── Environment contract.
p = Path('.env.example')
text = p.read_text()
block = """

# Unattended cloud knowledge ingestion
# Generate a high-entropy server-only value (production deploy creates one if absent).
CLOUD_TOKEN_ENCRYPTION_KEY=
ATLAS_PUBLIC_URL=https://caspa.ocrowley.com
KNOWLEDGE_SYNC_INTERVAL_MS=300000
KNOWLEDGE_SYNC_BATCH=8
# Dropbox platform OAuth app (offline PKCE refresh tokens).
DROPBOX_APP_KEY=
# Google OAuth Web Application credentials for Drive offline access.
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
"""
if 'CLOUD_TOKEN_ENCRYPTION_KEY=' not in text:
    p.write_text(text.rstrip() + block.rstrip() + '\n')

# ── Deploy: ensure token encryption exists on the host without storing the key in GitHub.
replace_once(
    '.github/workflows/deploy-atlas.yml',
    "             export CASPA_DATA_DIR=/root/Caspa/data\n             npm run build",
    "             export CASPA_DATA_DIR=/root/Caspa/data\n             if ! grep -q '^CLOUD_TOKEN_ENCRYPTION_KEY=' .env 2>/dev/null; then\n               umask 077\n               printf '\\nCLOUD_TOKEN_ENCRYPTION_KEY=%s\\n' \"\\$(openssl rand -hex 32)\" >> .env\n             fi\n             grep -q '^ATLAS_PUBLIC_URL=' .env 2>/dev/null || printf 'ATLAS_PUBLIC_URL=https://caspa.ocrowley.com\\n' >> .env\n             npm run build",
)

# Trigger is changed by the verified integration workflow, then explicitly again by caller.
p = Path('.deploy-atlas-trigger')
p.write_text('deploy requested 2026-08-09T17:20:00Z\nreason: autonomous cloud ingestion and Council timeout resilience\n')

print('autopilot + Council integration patch applied')
