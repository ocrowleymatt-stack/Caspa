from pathlib import Path

# Keep local inference explicitly available, but never let this CPU/swap-bound host
# enter the automatic interactive provider path.
p = Path('src/services/cloudModelRouter.ts')
s = p.read_text()
s = s.replace("['grok', 'gemini', 'venice', 'openai', 'claude', 'ollama']", "['grok', 'gemini', 'venice', 'openai', 'claude']")
s = s.replace("['venice', 'grok', 'gemini', 'openai', 'claude', 'ollama']", "['venice', 'grok', 'gemini', 'openai', 'claude']")
s = s.replace("['grok', 'venice', 'gemini', 'openai', 'claude', 'ollama']", "['grok', 'venice', 'gemini', 'openai', 'claude']")
p.write_text(s)

# Council seats must never wait on local inference. Local/Ollama remains manually
# addressable through providerOverride for background/specialist jobs.
p = Path('src/services/ai.ts')
s = p.read_text()
s = s.replace(
    "? ['grok', 'venice', 'gemini', 'grok', 'venice', 'gemini', 'ollama', 'openai', 'claude']",
    "? ['grok', 'venice', 'gemini', 'grok', 'venice', 'gemini', 'openai', 'claude']",
    1,
)
s = s.replace(
    ": ['grok', 'gemini', 'venice', 'ollama', 'grok', 'gemini', 'openai', 'claude'];",
    ": ['grok', 'gemini', 'venice', 'grok', 'gemini', 'venice', 'openai', 'claude'];",
    1,
)
p.write_text(s)
