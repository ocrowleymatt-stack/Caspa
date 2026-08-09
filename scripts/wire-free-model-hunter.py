from pathlib import Path

# --- aiRouterPolicy: add Ollama as a routable provider without requiring an env var ---
policy_path = Path('src/services/aiRouterPolicy.ts')
policy = policy_path.read_text()
policy = policy.replace(
    "export const AI_PROVIDERS = ['unified', 'grok', 'openai', 'claude', 'gemini', 'venice'] as const;",
    "export const AI_PROVIDERS = ['unified', 'ollama', 'grok', 'openai', 'claude', 'gemini', 'venice'] as const;",
    1,
)
policy = policy.replace(
    "  unified: ['UNIFIED_ROUTER_URL'],\n  grok:",
    "  unified: ['UNIFIED_ROUTER_URL'],\n  ollama: ['OLLAMA_URL'],\n  grok:",
    1,
)
old_config = """  const names = AI_PROVIDER_ENV_KEYS[provider] || [];
  return names.some((name) => Boolean(env[name] && String(env[name]).trim()));
}"""
new_config = """  if (provider === 'ollama') {
    // Ollama defaults to localhost, so it can be usable with no explicit env var.
    // Runtime reachability is handled by the provider call + circuit breaker.
    return String(env.OLLAMA_DISABLED || '').toLowerCase() !== 'true' && env.OLLAMA_DISABLED !== '1';
  }
  const names = AI_PROVIDER_ENV_KEYS[provider] || [];
  return names.some((name) => Boolean(env[name] && String(env[name]).trim()));
}"""
if old_config not in policy:
    raise SystemExit('aiRouterPolicy configuration anchor not found')
policy = policy.replace(old_config, new_config, 1)
policy_path.write_text(policy)

# --- server: dynamic model pool, catalogue endpoint, and Ollama/unified hunting ---
server_path = Path('server.ts')
server = server_path.read_text()
old_import = "import { callUnifiedRouterChat } from './src/services/unifiedRouter';"
new_import = """import { callUnifiedRouterChat } from './src/services/unifiedRouter';
import {
  callOllamaModelHunt,
  callUnifiedModelHunt,
  discoverFreeModelPool,
} from './src/services/freeModelPool';"""
if old_import not in server:
    raise SystemExit('server import anchor not found')
server = server.replace(old_import, new_import, 1)

health_anchor = """// API endpoint for AI queries
app.post(\"/api/ai/call\", async (req, res) => {"""
models_route = """// Safe catalogue of models Atlas can discover without asking the user for new credentials.
app.get(\"/api/ai/models\", async (_req, res) => {
  try {
    const models = await discoverFreeModelPool(process.env, true);
    return res.json({
      count: models.length,
      freeCount: models.filter((model) => model.likelyFree).length,
      models,
    });
  } catch (error: any) {
    return res.status(503).json({ count: 0, freeCount: 0, models: [], error: error?.message || 'Model discovery failed' });
  }
});

// API endpoint for AI queries
app.post(\"/api/ai/call\", async (req, res) => {"""
if health_anchor not in server:
    raise SystemExit('AI route anchor not found')
server = server.replace(health_anchor, models_route, 1)

old_unified = """        case 'unified':
          result = await callUnifiedRouterChat(prompt, {
            json,
            maxTokens,
            timeoutMs: aiCallTimeoutMs(maxTokens),
          });
          break;
        case 'gemini':"""
new_unified = """        case 'unified': {
          const hunted = await callUnifiedModelHunt(prompt, {
            json,
            maxTokens,
            timeoutMs: aiCallTimeoutMs(maxTokens),
            maxAttempts: 4,
          });
          result = hunted.text;
          console.log(`[Express Backend] Unified model selected: ${hunted.model}`);
          break;
        }
        case 'ollama': {
          const hunted = await callOllamaModelHunt(prompt, {
            json,
            maxTokens,
            maxAttempts: 3,
          });
          result = hunted.text;
          console.log(`[Express Backend] Ollama model selected: ${hunted.model}`);
          break;
        }
        case 'gemini':"""
if old_unified not in server:
    raise SystemExit('server unified switch anchor not found')
server = server.replace(old_unified, new_unified, 1)
server_path.write_text(server)

# --- client Council: add discovered free-capacity seats while keeping the existing direct providers ---
ai_path = Path('src/services/ai.ts')
ai = ai_path.read_text()
ai = ai.replace(
    '  providerOverride?: IntelligenceProvider;\n',
    "  providerOverride?: IntelligenceProvider | 'unified' | 'ollama';\n",
    1,
)
old_rotation = """    const roles = customRoles || defaultRoles;
    const providerRotation: IntelligenceProvider[] = ['grok', 'gemini', 'claude', 'openai', 'venice'];
    const providerLabels: Record<IntelligenceProvider, string> = {
      grok: 'Grok',
      gemini: 'Gemini',
      claude: 'Claude',
      openai: 'OpenAI',
      venice: 'Venice'
    };"""
new_rotation = """    const roles = customRoles || defaultRoles;
    type CouncilProvider = IntelligenceProvider | 'unified' | 'ollama';
    const providerRotation: CouncilProvider[] = ['ollama', 'grok', 'gemini', 'unified', 'openai', 'venice', 'claude'];
    const providerLabels: Record<CouncilProvider, string> = {
      ollama: 'Local Model Pool',
      unified: 'Open WebUI Pool',
      grok: 'Grok',
      gemini: 'Gemini',
      claude: 'Claude',
      openai: 'OpenAI',
      venice: 'Venice'
    };"""
if old_rotation not in ai:
    raise SystemExit('Council provider rotation anchor not found')
ai = ai.replace(old_rotation, new_rotation, 1)
ai_path.write_text(ai)
