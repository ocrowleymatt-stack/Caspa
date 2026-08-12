#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

cloud = ROOT / 'src/services/cloudModelRouter.ts'
replace_once(cloud,
'''  venice: {
    speed: ['qwen3-6-27b', 'openai-gpt-oss-120b', 'mistral-small-2603'],
    balanced: ['openai-gpt-oss-120b', 'qwen3-6-27b', 'deepseek-v4-flash', 'llama-3.3-70b'],
    god: ['deepseek-v4-flash', 'openai-gpt-oss-120b', 'qwen3-6-27b', 'minimax-m27'],
  },''',
'''  venice: {
    // Venice changes its catalogue quickly. Prefer the strongest current reasoning
    // models first, while retaining cheaper fallbacks for latency/cost resilience.
    speed: ['qwen3-6-27b', 'deepseek-v4-flash', 'openai-gpt-oss-120b'],
    balanced: ['deepseek-v4-pro', 'qwen-3-6-plus', 'qwen3-5-397b-a17b', 'openai-gpt-oss-120b'],
    god: ['deepseek-v4-pro', 'qwen-3-6-plus', 'claude-opus-4-7-fast', 'openai-gpt-55-pro'],
  },''')

replace_once(cloud,
'''  if (provider === 'venice') {
    if (task === 'fast') return ['qwen3-6-27b'];
    if (task === 'factual') return mode === 'god' ? ['deepseek-v4-flash', 'openai-gpt-oss-120b'] : ['openai-gpt-oss-120b', 'qwen3-6-27b'];
    if (task === 'reasoning' || task === 'legal') return mode === 'god' ? ['deepseek-v4-flash', 'openai-gpt-oss-120b'] : ['openai-gpt-oss-120b', 'qwen3-6-27b'];
  }''',
'''  if (provider === 'venice') {
    if (task === 'fast') return ['qwen3-6-27b', 'deepseek-v4-flash'];
    if (task === 'council') return mode === 'god' ? ['deepseek-v4-pro'] : ['qwen-3-6-plus'];
    if (task === 'creative') return mode === 'god'
      ? ['qwen-3-6-plus', 'deepseek-v4-pro', 'e2ee-venice-uncensored-24b-p']
      : ['qwen-3-6-plus', 'qwen3-5-397b-a17b', 'e2ee-venice-uncensored-24b-p'];
    if (task === 'factual' || task === 'reasoning' || task === 'legal' || task === 'synthesis' || task === 'long') {
      return mode === 'god'
        ? ['deepseek-v4-pro', 'qwen-3-6-plus', 'claude-opus-4-7-fast']
        : ['deepseek-v4-pro', 'qwen-3-6-plus', 'qwen3-5-397b-a17b'];
    }
  }''')

replace_once(cloud,
'''  const data = await providerPost('https://api.venice.ai/api/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\\n\\nReturn ONLY valid JSON.` : prompt },
    ],
    max_tokens: opts.maxTokens || 4096,
  }, { Authorization: `Bearer ${key}` }, routedTimeoutMs(opts, mode));''',
'''  const data = await providerPost('https://api.venice.ai/api/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\\n\\nReturn ONLY valid JSON.` : prompt },
    ],
    max_tokens: opts.maxTokens || 4096,
    venice_parameters: {
      strip_thinking_response: true,
      ...(opts.useSearch ? {
        enable_web_search: 'on',
        enable_web_citations: true,
        return_search_results_as_documents: false,
      } : {}),
    },
  }, { Authorization: `Bearer ${key}` }, routedTimeoutMs(opts, mode));''')

# Make Venice the primary quality/synthesis lane. Speed remains Gemini-first.
replacements = {
"else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['grok', 'gemini', 'venice', 'openai', 'claude'];": "else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
"else if (task === 'factual') ordered = ['gemini', 'venice', 'grok', 'openai', 'claude'];": "else if (task === 'factual') ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
"else ordered = ['grok', 'venice', 'gemini', 'openai', 'claude'];": "else ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
"else if (task === 'factual') ordered = ['gemini', 'venice', 'grok', 'openai', 'claude'];": "else if (task === 'factual') ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
"else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['venice', 'gemini', 'grok', 'openai', 'claude'];": "else if (['reasoning', 'legal', 'synthesis', 'long'].includes(task)) ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];",
}
text = cloud.read_text(encoding='utf-8')
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
cloud.write_text(text, encoding='utf-8')

failover = ROOT / 'src/services/routerFailover.ts'
replace_once(failover,
"export const WEB_SEARCH_CAPABLE_PROVIDERS = ['gemini', 'grok'] as const;",
"export const WEB_SEARCH_CAPABLE_PROVIDERS = ['venice', 'gemini', 'grok'] as const;")

# Tests: Venice is now a real search lane and becomes the preferred quality provider.
tests = ROOT / 'tests/routerCostPolicy.test.ts'
t = tests.read_text(encoding='utf-8')
t = t.replace("['gemini', 'venice', 'grok', 'openai', 'claude'],\n  );\n});\n\ntest('balanced heavy reasoning", "['venice', 'grok', 'gemini', 'openai', 'claude'],\n  );\n});\n\ntest('balanced heavy reasoning", 1)
t = t.replace("['venice', 'gemini', 'grok', 'openai', 'claude'],\n  );\n});\n\ntest('god mode", "['venice', 'grok', 'gemini', 'openai', 'claude'],\n  );\n});\n\ntest('god mode", 1)
t = t.replace("['grok', 'gemini', 'venice', 'openai', 'claude'],\n  );\n});\n\ntest('explicit provider", "['venice', 'grok', 'gemini', 'openai', 'claude'],\n  );\n});\n\ntest('explicit provider", 1)
t = t.replace("assert.deepEqual([...WEB_SEARCH_CAPABLE_PROVIDERS], ['gemini', 'grok']);", "assert.deepEqual([...WEB_SEARCH_CAPABLE_PROVIDERS], ['venice', 'gemini', 'grok']);")
t = t.replace("assert.equal(providerSupportsWebSearch('venice'), false);", "assert.equal(providerSupportsWebSearch('venice'), true);")
t = t.replace("assert.deepEqual(factual, ['gemini', 'grok']);", "assert.deepEqual(factual, ['venice', 'grok', 'gemini']);")
t = t.replace("assert.deepEqual(grokFirst, ['grok', 'gemini']);", "assert.deepEqual(grokFirst, ['grok', 'venice', 'gemini']);")
tests.write_text(t, encoding='utf-8')

smoke = ROOT / 'scripts/final-router-smoke.mjs'
s = smoke.read_text(encoding='utf-8')
s = s.replace("if (!webRequired.ok || !['gemini', 'grok'].includes(webRequired.provider)) {", "if (!webRequired.ok || !['venice', 'gemini', 'grok'].includes(webRequired.provider)) {")
s = s.replace("providerOverride: 'venice',\n  strictProvider: true,", "providerOverride: 'claude',\n  strictProvider: true,", 1)
smoke.write_text(s, encoding='utf-8')

print('patched source routing for Venice-first multi-provider operation')
