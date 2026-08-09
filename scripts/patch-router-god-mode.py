from pathlib import Path

# ---------- server.ts ----------
p = Path('server.ts')
s = p.read_text()
anchor = """import {
  callOllamaModelHunt,
  callUnifiedModelHunt,
  discoverFreeModelPool,
} from './src/services/freeModelPool';
"""
addition = anchor + """import {
  callCloudProvider,
  classifyTask,
  isBillingFailure,
  normaliseMode,
  providerOrder,
  routerSnapshot,
  type CloudProvider,
} from './src/services/cloudModelRouter';
"""
if anchor not in s:
    raise SystemExit('server import anchor missing')
s = s.replace(anchor, addition, 1)

old_models_route = '''app.get("/api/ai/models", async (_req, res) => {
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
'''
new_models_route = '''app.get("/api/ai/models", async (_req, res) => {
  try {
    const [models, cloud] = await Promise.all([
      discoverFreeModelPool(process.env, true),
      routerSnapshot(),
    ]);
    return res.json({
      count: models.length,
      freeCount: models.filter((model) => model.likelyFree).length,
      models,
      cloud,
    });
  } catch (error: any) {
    return res.status(503).json({ count: 0, freeCount: 0, models: [], cloud: {}, error: error?.message || 'Model discovery failed' });
  }
});

app.get("/api/ai/router", async (_req, res) => {
  const cloud = await routerSnapshot().catch(() => ({}));
  const free = await discoverFreeModelPool(process.env).catch(() => []);
  return res.json({
    status: 'ok',
    modes: ['speed', 'balanced', 'god'],
    cloud,
    local: free.map((model) => ({ id: model.id, source: model.source, score: model.score, parameterSize: model.parameterSize })),
  });
});
'''
if old_models_route not in s:
    raise SystemExit('models route anchor missing')
s = s.replace(old_models_route, new_models_route, 1)

route_start = s.index('// API endpoint for AI queries\napp.post("/api/ai/call"')
route_end = s.index('\n// Venice Image generation API', route_start)
new_route = r'''// API endpoint for AI queries
app.post("/api/ai/call", async (req, res) => {
  const {
    prompt,
    model,
    json = false,
    maxTokens,
    providerOverride,
    strictProvider = false,
    useSearch = false,
    useWebSearch = false,
    primaryProvider = "grok",
    intelligenceMode = 'balanced',
    taskHint,
  } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ message: 'Prompt is required.' });
  }

  const mode = normaliseMode(intelligenceMode);
  const searchEnabled = Boolean(useSearch || useWebSearch);
  const task = taskHint || classifyTask(prompt, { json, maxTokens, useSearch: searchEnabled });
  const isSensitive = /chem\s*sex|chemsex|slamming|crystal\s*meth|methamphetamine|gbl|ghb|tina|harm\s*reduction|overdose|substance|drug|rehab|addiction|recovery\s*guide|survival\s*guide|unfiltered|explicit|transgressive|hardcore/i.test(prompt);

  const providers: string[] = [];
  if (strictProvider && providerOverride) {
    providers.push(providerOverride);
  } else {
    if (isProviderConfigured('unified')) providers.push('unified');
    providers.push(...providerOrder(primaryProvider, mode, task, isSensitive));
    if (providerOverride) providers.unshift(providerOverride);
  }

  const ordered = [...new Set(providers)];
  const { attempt, anyConfigured } = selectAttemptOrder(
    ordered,
    (provider) => isProviderConfigured(provider),
    (provider) => aiBreaker.isOpen(provider),
  );

  if (!anyConfigured) {
    return res.status(503).json({
      message: "No AI provider configured on the server. Configure a cloud provider or run Ollama.",
    });
  }

  let lastError: any = null;
  for (const provider of attempt) {
    try {
      let result: string | null = null;
      let selectedModel = '';
      console.log(`[Express Backend] ${mode}/${task}: trying ${provider}`);

      if (provider === 'unified') {
        const hunted = await callUnifiedModelHunt(prompt, {
          json,
          maxTokens,
          timeoutMs: aiCallTimeoutMs(maxTokens),
          maxAttempts: 3,
        });
        result = hunted.text;
        selectedModel = hunted.model;
      } else if (provider === 'ollama') {
        const hunted = await callOllamaModelHunt(prompt, {
          json,
          maxTokens,
          maxAttempts: mode === 'speed' ? 1 : 2,
          mode,
        });
        result = hunted.text;
        selectedModel = hunted.model;
      } else if (['grok', 'gemini', 'openai', 'claude', 'venice'].includes(provider)) {
        const routed = await callCloudProvider(provider as CloudProvider, prompt, {
          json,
          maxTokens,
          useSearch: searchEnabled,
          mode,
          task,
          requestedModel: model,
        });
        result = routed.text;
        selectedModel = routed.model;
      }

      if (result) {
        aiBreaker.recordSuccess(provider);
        console.log(`[Express Backend] ${provider}/${selectedModel || 'default'} succeeded.`);
        return res.json({ result, provider, model: selectedModel || null, mode, task });
      }
    } catch (error: any) {
      lastError = error;
      const billing = isBillingFailure(error);
      // Credit/billing failures cannot recover by retrying another model on the
      // same provider. Park that provider for six hours to remove repeat latency.
      aiBreaker.recordFailure(provider, billing ? 6 * 60 * 60_000 : undefined);
      console.warn(`[Express Backend] ${provider} failed${billing ? ' (billing cooldown)' : ''}:`, error?.message || error);
    }
  }

  return res.status(502).json({
    message: "AI Fallback Failure: all currently healthy providers failed.",
    error: lastError ? lastError.message : "Empty response",
    mode,
    task,
  });
});
'''
s = s[:route_start] + new_route + s[route_end:]
p.write_text(s)

# ---------- types.ts ----------
p = Path('src/types.ts')
s = p.read_text()
old = "export type IntelligenceProvider = 'gemini' | 'claude' | 'openai' | 'grok' | 'venice';\n"
new = old + "export type IntelligenceMode = 'speed' | 'balanced' | 'god';\n"
if old not in s:
    raise SystemExit('types intelligence anchor missing')
s = s.replace(old, new, 1)
old = "  primaryProvider?: IntelligenceProvider; \n"
new = "  primaryProvider?: IntelligenceProvider;\n  intelligenceMode?: IntelligenceMode;\n"
if old not in s:
    raise SystemExit('project primaryProvider anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

# ---------- ai.ts ----------
p = Path('src/services/ai.ts')
s = p.read_text()
s = s.replace(
    'import { IntelligenceProvider, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview, SourceMaterial } from "../types";',
    'import { IntelligenceProvider, IntelligenceMode, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview, SourceMaterial } from "../types";',
    1,
)
old = """  providerOverride?: IntelligenceProvider | 'unified' | 'ollama';
  strictProvider?: boolean;
  useWebSearch?: boolean;
}) {
  try {
    const response = await fetchWithTimeout("""
new = """  providerOverride?: IntelligenceProvider | 'unified' | 'ollama';
  strictProvider?: boolean;
  useWebSearch?: boolean;
  intelligenceMode?: IntelligenceMode;
  taskHint?: string;
}) {
  try {
    const storedMode = options.intelligenceMode || (
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('caspa_intelligence_mode') as IntelligenceMode | null)
        : null
    ) || 'balanced';
    const response = await fetchWithTimeout("""
if old not in s:
    raise SystemExit('callAI options anchor missing')
s = s.replace(old, new, 1)
s = s.replace(
    """        body: JSON.stringify({
          ...options,
          primaryProvider: globalPrimaryProvider
        })""",
    """        body: JSON.stringify({
          ...options,
          intelligenceMode: storedMode,
          primaryProvider: globalPrimaryProvider
        })""",
    1,
)

sig_old = "async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[]): Promise<Critique[]> {"
sig_new = "async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[], onProgress?: (partial: Critique[], completed: number, total: number) => void): Promise<Critique[]> {"
if sig_old not in s:
    raise SystemExit('swarm signature anchor missing')
s = s.replace(sig_old, sig_new, 1)
old_rotation = """    const roles = customRoles || defaultRoles;
    type CouncilProvider = IntelligenceProvider | 'unified' | 'ollama';
    const providerRotation: CouncilProvider[] = ['ollama', 'grok', 'gemini', 'unified', 'openai', 'venice', 'claude'];
"""
new_rotation = """    const roles = customRoles || defaultRoles;
    type CouncilProvider = IntelligenceProvider | 'unified' | 'ollama';
    const intelligenceMode = (typeof window !== 'undefined' ? window.localStorage.getItem('caspa_intelligence_mode') : null) || 'balanced';
    const providerRotation: CouncilProvider[] = intelligenceMode === 'god'
      ? ['grok', 'venice', 'gemini', 'grok', 'venice', 'gemini', 'ollama', 'openai', 'claude']
      : intelligenceMode === 'speed'
        ? ['grok', 'gemini', 'venice', 'grok', 'gemini', 'venice']
        : ['grok', 'gemini', 'venice', 'ollama', 'grok', 'gemini', 'openai', 'claude'];
"""
if old_rotation not in s:
    raise SystemExit('swarm rotation anchor missing')
s = s.replace(old_rotation, new_rotation, 1)
s = s.replace(
    """        providerOverride: provider,
        strictProvider: strict
      });""",
    """        providerOverride: provider,
        strictProvider: strict,
        taskHint: 'council'
      });""",
    1,
)
s = s.replace(
    """    const critiques: Critique[] = [];
    const failedSeats: { role: string; index: number; error: any }[] = [];
    const concurrency = 3;
""",
    """    const critiques: Critique[] = [];
    const failedSeats: { role: string; index: number; error: any }[] = [];
    const concurrency = intelligenceMode === 'god' || intelligenceMode === 'speed' ? 4 : 3;
""",
    1,
)
settled_anchor = """      settled.forEach((result, batchIndex) => {
        const role = batch[batchIndex];
        const index = offset + batchIndex;
        if (result.status === 'fulfilled') {
          critiques.push(result.value);
        } else {
          console.warn(`[Council] Seat ${role} failed on pinned provider ${providerRotation[index % providerRotation.length]}:`, result.reason);
          failedSeats.push({ role, index, error: result.reason });
        }
      });
    }
"""
settled_new = settled_anchor.replace("      });\n    }\n", "      });\n      onProgress?.([...critiques], Math.min(offset + batch.length, roles.length), roles.length);\n    }\n")
if settled_anchor not in s:
    raise SystemExit('swarm settled anchor missing')
s = s.replace(settled_anchor, settled_new, 1)
s = s.replace(
    """        const recovered = await runSeat(failed.role, failed.index, false);
        critiques.push(recovered);
""",
    """        const recovered = await runSeat(failed.role, failed.index, false);
        critiques.push(recovered);
        onProgress?.([...critiques], Math.min(critiques.length, roles.length), roles.length);
""",
    1,
)
p.write_text(s)

# ---------- CriticSwarm progressive seats ----------
p = Path('src/components/CriticSwarm.tsx')
s = p.read_text()
s = s.replace(
    "  const [loading, setLoading] = useState(false);\n",
    "  const [loading, setLoading] = useState(false);\n  const [progress, setProgress] = useState({ done: 0, total: 0 });\n",
    1,
)
s = s.replace(
    """      const results = await AIService.getSwarmCritique(textToAnalyze, projectType, maturity, sourceMaterials, roles);
      
      // Accumulate!
      const cid = selectedChapId || 'all';
      const updated = [...results, ...localCritiques].slice(0, 30);
""",
    """      const baseline = [...localCritiques];
      setProgress({ done: 0, total: roles.length });
      const results = await AIService.getSwarmCritique(
        textToAnalyze,
        projectType,
        maturity,
        sourceMaterials,
        roles,
        (partial, done, total) => {
          setProgress({ done, total });
          setLocalCritiques([...partial, ...baseline].slice(0, 30));
        }
      );
      
      // Accumulate!
      const cid = selectedChapId || 'all';
      const updated = [...results, ...baseline].slice(0, 30);
""",
    1,
)
s = s.replace(
    """    } finally {
      setLoading(false);
    }
""",
    """    } finally {
      setLoading(false);
      setProgress({ done: 0, total: 0 });
    }
""",
    1,
)
s = s.replace(
    "{loading ? 'Analyzing...' : 'Trigger Swarm'}",
    "{loading ? (progress.total ? `Council ${progress.done}/${progress.total}` : 'Starting Council...') : 'Trigger Swarm'}",
    1,
)
p.write_text(s)

# ---------- SettingsView: mode controls and current provider labels ----------
p = Path('src/components/SettingsView.tsx')
s = p.read_text()
s = s.replace(
    "import { Project, ProjectType, MaturityLevel } from '../types';",
    "import { Project, ProjectType, MaturityLevel, IntelligenceMode } from '../types';",
    1,
)
state_anchor = """  const [localPremise, setLocalPremise] = useState(project.premise);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
"""
state_new = """  const [localPremise, setLocalPremise] = useState(project.premise);
  const [intelligenceMode, setIntelligenceMode] = useState<IntelligenceMode>(() => {
    const stored = localStorage.getItem('caspa_intelligence_mode') as IntelligenceMode | null;
    return project.intelligenceMode || stored || 'balanced';
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
"""
if state_anchor not in s:
    raise SystemExit('Settings state anchor missing')
s = s.replace(state_anchor, state_new, 1)
handler_anchor = """  const handleStyleUpdate = (updates: Partial<NonNullable<Project['styleDNA']>>) => {
"""
handler_new = """  const handleIntelligenceMode = (mode: IntelligenceMode) => {
    setIntelligenceMode(mode);
    localStorage.setItem('caspa_intelligence_mode', mode);
    updateProject({ intelligenceMode: mode });
    onNotify?.(
      mode === 'god' ? 'God Mode armed: maximum-capability routing enabled.' : mode === 'speed' ? 'Speed Mode armed: low-latency routing enabled.' : 'Balanced routing restored.',
      'info'
    );
  };

  const handleStyleUpdate = (updates: Partial<NonNullable<Project['styleDNA']>>) => {
"""
if handler_anchor not in s:
    raise SystemExit('Settings handler anchor missing')
s = s.replace(handler_anchor, handler_new, 1)
providers_anchor = """          <div className=\"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pb-8\">
            {[
              { id: 'gemini', label: 'Gemini', brief: 'Deep Prose' },
              { id: 'claude', label: 'Claude', brief: 'Logic/Structure' },
              { id: 'openai', label: 'GPT-4o', brief: 'Synthesis' },
              { id: 'grok', label: 'Grok-3', brief: 'Raw/Agency' },
              { id: 'venice', label: 'Venice', brief: 'Private' }
            ].map((provider) => (
"""
mode_panel = """          <div className=\"grid grid-cols-3 gap-2 mb-3\">
            {([
              { id: 'speed', label: 'Speed', brief: 'Fastest healthy route', icon: Zap },
              { id: 'balanced', label: 'Balanced', brief: 'Quality + latency', icon: Shield },
              { id: 'god', label: 'God Mode', brief: 'Maximum capability / raw', icon: Flame },
            ] as const).map((mode) => {
              const ModeIcon = mode.icon;
              const active = intelligenceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => handleIntelligenceMode(mode.id)}
                  className={`p-3 rounded border transition-all text-left ${active ? 'bg-brand-primary border-brand-primary text-white shadow-xl shadow-brand-primary/20' : 'ethereal-panel border-border-subtle text-text-secondary hover:border-brand-primary/40'}`}
                >
                  <div className=\"flex items-center gap-2 mb-1\"><ModeIcon size={14} /><span className=\"text-[11px] font-semibold uppercase tracking-widest\">{mode.label}</span></div>
                  <div className=\"text-[10px] uppercase tracking-widest opacity-50\">{mode.brief}</div>
                </button>
              );
            })}
          </div>

          <div className=\"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pb-8\">
            {[
              { id: 'gemini', label: 'Gemini 3.x', brief: 'Flash / Pro pool' },
              { id: 'claude', label: 'Claude 5', brief: 'Sonnet / Opus pool' },
              { id: 'openai', label: 'GPT 5.x', brief: 'Dynamic model pool' },
              { id: 'grok', label: 'Grok 4.x', brief: 'Fast / Reasoning' },
              { id: 'venice', label: 'Venice Pool', brief: 'Private / raw' }
            ].map((provider) => (
"""
if providers_anchor not in s:
    raise SystemExit('Settings providers anchor missing')
s = s.replace(providers_anchor, mode_panel, 1)
p.write_text(s)
