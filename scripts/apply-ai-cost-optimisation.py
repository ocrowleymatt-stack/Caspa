#!/usr/bin/env python3
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        print(f'{label}=already_applied')
        return text
    raise SystemExit(f'Missing expected pattern for {label}: {old[:120]!r}')

# Front-end default provider and stale model pins.
ai = Path('src/services/ai.ts')
s = ai.read_text()
s = replace_once(s,
    "let globalPrimaryProvider: IntelligenceProvider = 'grok';",
    "let globalPrimaryProvider: IntelligenceProvider = 'gemini';",
    'default_provider')
ai.write_text(s)

changed = 0
for p in list(Path('src').rglob('*.ts')) + list(Path('src').rglob('*.tsx')):
    t = p.read_text()
    u = t.replace('gemini-2.0-flash', 'gemini-2.5-flash-lite')
    if u != t:
        p.write_text(u)
        changed += 1
print(f'deprecated_model_files_updated={changed}')

# Server defaults + economical image model.
server = Path('server.ts')
s = server.read_text()
s = replace_once(s, 'primaryProvider = "grok"', 'primaryProvider = "gemini"', 'server_default_provider')
s = replace_once(s, 'model: "flux-pro",', 'model: process.env.CASPA_IMAGE_MODEL || "z-image-turbo",', 'image_model')
server.write_text(s)

# Critic Swarm overview: preserve both ends of each chapter with less repeated context.
swarm = Path('src/components/CriticSwarm.tsx')
s = swarm.read_text()
s = replace_once(
    s,
    "textToAnalyze = chapters.map(c => `[${c.title}]\\n${c.content.slice(0, 3000)}`).join('\\n\\n');",
    "textToAnalyze = chapters.map(c => `[${c.title}]\\n${c.content.slice(0, 1400)}${c.content.length > 2000 ? `\\n…\\n${c.content.slice(-600)}` : ''}`).join('\\n\\n');",
    'critic_swarm_context',
)
swarm.write_text(s)

# Cloud router: cheap models first, expensive multi-agent only on explicit deep work,
# stable cache keys on OpenAI/xAI.
router = Path('src/services/cloudModelRouter.ts')
s = router.read_text()
repls = [
    ("speed: ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],\n    balanced: ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash'],",
     "speed: ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],\n    balanced: ['gemini-2.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'],", 'gemini_preferences'),
    ("speed: ['qwen3-6-27b', 'deepseek-v4-flash', 'openai-gpt-oss-120b'],\n    balanced: ['deepseek-v4-pro', 'qwen-3-6-plus', 'qwen3-5-397b-a17b', 'openai-gpt-oss-120b'],",
     "speed: ['deepseek-v4-flash', 'e2ee-gpt-oss-20b-p', 'openai-gpt-oss-120b'],\n    balanced: ['deepseek-v4-flash', 'deepseek-v4-pro', 'qwen-3-6-plus', 'openai-gpt-oss-120b'],", 'venice_preferences'),
    ("if (provider === 'gemini') return ['gemini-3.6-flash', 'gemini-3.5-flash'];",
     "if (provider === 'gemini') return ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];", 'gemini_council'),
    ("if (provider === 'venice') return mode === 'god' ? ['deepseek-v4-pro', 'qwen-3-6-plus'] : ['qwen-3-6-plus', 'deepseek-v4-pro'];",
     "if (provider === 'venice') return mode === 'god' ? ['deepseek-v4-pro', 'qwen-3-6-plus'] : ['deepseek-v4-flash', 'deepseek-v4-pro'];", 'venice_council'),
    ("if (task === 'fast') return ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];",
     "if (task === 'fast') return ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];", 'gemini_fast'),
    ("if (task === 'fast') return ['qwen3-6-27b', 'deepseek-v4-flash'];",
     "if (task === 'fast') return ['deepseek-v4-flash', 'e2ee-gpt-oss-20b-p'];", 'venice_fast'),
    ("if (task === 'creative') return mode === 'god'\n      ? ['qwen-3-6-plus', 'deepseek-v4-pro', 'e2ee-venice-uncensored-24b-p']\n      : ['qwen-3-6-plus', 'qwen3-5-397b-a17b', 'e2ee-venice-uncensored-24b-p'];",
     "if (task === 'creative') return mode === 'god'\n      ? ['qwen-3-6-plus', 'deepseek-v4-pro', 'e2ee-venice-uncensored-24b-p']\n      : ['deepseek-v4-flash', 'qwen-3-6-plus', 'e2ee-venice-uncensored-24b-p'];", 'venice_creative'),
    ("return mode === 'god'\n        ? ['deepseek-v4-pro', 'qwen-3-6-plus', 'claude-opus-4-7-fast']\n        : ['deepseek-v4-pro', 'qwen-3-6-plus', 'qwen3-5-397b-a17b'];",
     "return mode === 'god'\n        ? ['deepseek-v4-pro', 'qwen-3-6-plus', 'claude-opus-4-7-fast']\n        : ['deepseek-v4-flash', 'deepseek-v4-pro', 'qwen-3-6-plus'];", 'venice_reasoning'),
    ("&& (mode === 'god' || task === 'long' || task === 'synthesis' || explicitDeepSearch);",
     "&& (mode === 'god' || explicitDeepSearch);", 'multi_agent_gate'),
    (": ['gemini', 'venice', 'grok', 'openai', 'claude'];\n    else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
     ": ['venice', 'gemini', 'grok', 'openai', 'claude'];\n    else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];", 'creative_provider_order'),
]
for old, new, label in repls:
    s = replace_once(s, old, new, label)

s = replace_once(
    s,
    "    max_output_tokens: opts.maxTokens || 4096,\n  }, { Authorization: `Bearer ${key}` }, routedTimeoutMs(opts, mode));",
    "    max_output_tokens: opts.maxTokens || 4096,\n    prompt_cache_key: `caspa:${opts.task || 'general'}:${mode}`,\n    store: false,\n  }, { Authorization: `Bearer ${key}` }, routedTimeoutMs(opts, mode));",
    'openai_cache_key',
)
s = replace_once(
    s,
    "    max_output_tokens: opts.maxTokens || 4096,\n    ...(opts.useSearch ? { tools: [{ type: 'web_search' }, { type: 'x_search' }] } : {}),",
    "    max_output_tokens: opts.maxTokens || 4096,\n    prompt_cache_key: `caspa:${opts.task || 'general'}:${mode}`,\n    ...(opts.useSearch ? { tools: [{ type: 'web_search' }, { type: 'x_search' }] } : {}),",
    'grok_cache_key',
)
router.write_text(s)

# Zero-marginal-cost Ollama first for routine, non-web work.
fail = Path('src/services/routerFailover.ts')
s = fail.read_text()
s = replace_once(
    s,
    "  const attempts: RouterFailoverAttempt[] = [];\n  const webRequired = Boolean(opts.useSearch);",
    "  const attempts: RouterFailoverAttempt[] = [];\n  const webRequired = Boolean(opts.useSearch);\n  let localAttempted = false;",
    'local_attempt_flag',
)
insert_after = "  if (webRequired && opts.strictProvider && primary && !providerSupportsWebSearch(primary)) {\n    throw new Error(\n      `Atlas web retrieval unavailable — strict provider \"${primary}\" has no wired web-search capability.`,\n    );\n  }\n"
local_block = """

  const localFirst = !webRequired
    && !opts.disableLocalFallback
    && !opts.strictProvider
    && process.env.AI_LOCAL_FIRST !== 'false'
    && (mode === 'speed' || task === 'fast' || task === 'council');

  if (localFirst) {
    localAttempted = true;
    try {
      const local = await callOllamaModelHunt(prompt, {
        json: opts.json,
        maxTokens: opts.maxTokens,
        mode,
      });
      return { text: local.text, model: local.model, provider: 'ollama', attempts };
    } catch (error: any) {
      attempts.push({
        provider: 'ollama',
        error: String(error?.message || error || 'Local model pool failure'),
        billingFailure: false,
      });
    }
  }
"""
if local_block.strip() not in s:
    if insert_after not in s:
        raise SystemExit('Missing local-first insertion anchor')
    s = s.replace(insert_after, insert_after + local_block, 1)
else:
    print('local_first_block=already_applied')
s = replace_once(
    s,
    "if (!webRequired && !opts.disableLocalFallback && !opts.strictProvider) {",
    "if (!webRequired && !opts.disableLocalFallback && !opts.strictProvider && !localAttempted) {",
    'avoid_double_local',
)
fail.write_text(s)

Path('.deploy-atlas-trigger').write_text('ai-cost-optimised-2026-08-16\n')
print('ai_cost_optimisation=ready')
