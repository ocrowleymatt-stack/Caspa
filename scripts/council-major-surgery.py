#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected patch anchor missing in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# ── Cloud router: Council gets its own bounded fast path. ──────────────────────
router = Path('src/services/cloudModelRouter.ts')
text = router.read_text()

if 'function routedTimeoutMs(' not in text:
    anchor = """function timeoutMs(maxTokens?: number, mode: IntelligenceMode = 'balanced'): number {
  if (mode === 'speed') return maxTokens && maxTokens >= 1500 ? 75_000 : 45_000;
  if (mode === 'god') return maxTokens && maxTokens >= 4000 ? 240_000 : 150_000;
  return maxTokens && maxTokens >= 4000 ? 180_000 : maxTokens && maxTokens >= 1500 ? 120_000 : 90_000;
}
"""
    replacement = anchor + """
// Council is an ensemble workload: diversity comes from parallel providers, not from
// letting one chair burn minutes cycling models. Keep every seat tightly bounded.
function routedTimeoutMs(opts: RoutedCallOptions, mode: IntelligenceMode): number {
  if (opts.task === 'council') {
    if (mode === 'speed') return 10_000;
    if (mode === 'god') return 20_000;
    return 14_000;
  }
  return timeoutMs(opts.maxTokens, mode);
}

async function withHardDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} after ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
"""
    if anchor not in text:
        raise SystemExit('timeoutMs anchor missing')
    text = text.replace(anchor, replacement, 1)

old_candidates = """  if (!available.length) return unique.slice(0, 4);
  const filtered = unique.filter((id) => available.includes(id));
  return (filtered.length ? filtered : unique).slice(0, 4);
}"""
new_candidates = """  // One fast model per Council provider. If it is unhealthy, that seat fails fast
  // and the other providers still form a quorum; model-by-model retry chains are forbidden.
  const limit = task === 'council' ? 1 : 4;
  if (!available.length) return unique.slice(0, limit);
  const filtered = unique.filter((id) => available.includes(id));
  return (filtered.length ? filtered : unique).slice(0, limit);
}"""
if old_candidates in text:
    text = text.replace(old_candidates, new_candidates, 1)
elif "const limit = task === 'council' ? 1 : 4;" not in text:
    raise SystemExit('modelCandidates anchor missing')

old_effort = """  const effort = mode === 'god' ? (['reasoning', 'legal', 'synthesis', 'long'].includes(task) ? 'xhigh' : 'high') : mode === 'speed' ? 'none' : 'low';"""
new_effort = """  // Council seats are critics, not long-form solvers. Expensive hidden reasoning on
  // every seat destroys ensemble latency without improving diversity.
  const effort = task === 'council'
    ? 'none'
    : mode === 'god'
      ? (['reasoning', 'legal', 'synthesis', 'long'].includes(task) ? 'xhigh' : 'high')
      : mode === 'speed' ? 'none' : 'low';"""
if old_effort in text:
    text = text.replace(old_effort, new_effort, 1)
elif "const effort = task === 'council'" not in text:
    raise SystemExit('OpenAI effort anchor missing')

# Abort-capable HTTP providers inherit the Council-specific short network deadline.
text = text.replace("timeoutMs(opts.maxTokens, mode));", "routedTimeoutMs(opts, mode));")

old_gemini = """async function callGemini(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('gemini');
  if (!key) throw new Error('Gemini key unavailable');
  const mode = normaliseMode(opts.mode);
  const client = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'atlas-model-router' } } });
  const response = await client.models.generateContent({
    model,
    contents: opts.json ? `${prompt}\\n\\nReturn ONLY valid JSON.` : prompt,
    config: {
      systemInstruction: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : ''),
      ...(opts.json && !opts.useSearch ? { responseMimeType: 'application/json' } : {}),
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  return String(response.text || '').trim();
}"""
new_gemini = """async function callGemini(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('gemini');
  if (!key) throw new Error('Gemini key unavailable');
  const mode = normaliseMode(opts.mode);
  const client = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'atlas-model-router' } } });
  const deadline = routedTimeoutMs(opts, mode);
  const response = await withHardDeadline(
    client.models.generateContent({
      model,
      contents: opts.json ? `${prompt}\\n\\nReturn ONLY valid JSON.` : prompt,
      config: {
        systemInstruction: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : ''),
        ...(opts.json && !opts.useSearch ? { responseMimeType: 'application/json' } : {}),
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    }),
    deadline,
    `Gemini/${model} deadline`,
  );
  return String(response.text || '').trim();
}"""
if old_gemini in text:
    text = text.replace(old_gemini, new_gemini, 1)
elif 'const deadline = routedTimeoutMs(opts, mode);' not in text:
    raise SystemExit('Gemini function anchor missing')

router.write_text(text)


# ── Browser orchestrator: parallel quorum, bounded seats, no serial recovery. ─
ai = Path('src/services/ai.ts')
text = ai.read_text()

if 'clientTimeoutMs?: number;' not in text:
    old = """  taskHint?: string;
  skipLocalFallback?: boolean;
}) {
  try {
    const storedMode"""
    new = """  taskHint?: string;
  skipLocalFallback?: boolean;
  clientTimeoutMs?: number;
}) {
  try {
    const { clientTimeoutMs, ...requestOptions } = options;
    const storedMode"""
    if old not in text:
        raise SystemExit('callAI option anchor missing')
    text = text.replace(old, new, 1)

    old = """        body: JSON.stringify({
          ...options,
          intelligenceMode: storedMode,
          primaryProvider: globalPrimaryProvider
        })
      },
      AI_LONG_FETCH_TIMEOUT_MS
"""
    new = """        body: JSON.stringify({
          ...requestOptions,
          intelligenceMode: storedMode,
          primaryProvider: globalPrimaryProvider
        })
      },
      clientTimeoutMs || AI_LONG_FETCH_TIMEOUT_MS
"""
    if old not in text:
        raise SystemExit('callAI fetch anchor missing')
    text = text.replace(old, new, 1)

start = text.find("  async getSwarmCritique(")
end = text.find("\n  async writeDraft(", start)
if start < 0 or end < 0:
    raise SystemExit('getSwarmCritique function boundaries missing')

new_swarm = r'''  async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[], onProgress?: (partial: Critique[], completed: number, total: number) => void): Promise<Critique[]> {
    const defaultRoles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition'];
    if (type === 'legal') defaultRoles.unshift('legal');
    if (type === 'academic') defaultRoles.unshift('academic');
    if (type === 'experimental' || type === 'screenplay') defaultRoles.push('comedy');

    const intelligenceMode = ((typeof window !== 'undefined' ? window.localStorage.getItem('caspa_intelligence_mode') : null) || 'balanced') as IntelligenceMode;
    type CouncilProvider = 'grok' | 'gemini' | 'venice' | 'openai' | 'claude';

    // Council 2.0: cap the number of seats by mode. The old UI could request 14-17
    // critics, which multiplied identical 10k-token prompts and made one review behave
    // like a batch job. Keep the strongest, most relevant perspectives instead.
    const requestedRoles = [...new Set((customRoles?.length ? customRoles : defaultRoles) as string[])];
    const domainFirst = type === 'legal' ? ['legal'] : type === 'academic' ? ['academic'] : [];
    const priority = [
      ...domainFirst,
      'structural', 'factual', 'vocal', 'sentence', 'agent', 'writer', 'thematic',
      'publisher', 'reader', 'market', 'repetition', 'historical', 'medical',
      'sensitivity', 'buyer', 'comedy', 'legal', 'academic'
    ];
    const rank = (role: string) => {
      const index = priority.indexOf(role);
      return index === -1 ? priority.length + requestedRoles.indexOf(role) : index;
    };
    const maxSeats = intelligenceMode === 'speed' ? 6 : intelligenceMode === 'god' ? 12 : 9;
    const roles = [...requestedRoles].sort((a, b) => rank(a) - rank(b)).slice(0, maxSeats);

    const providerRotation: CouncilProvider[] = intelligenceMode === 'god'
      ? ['grok', 'gemini', 'venice', 'openai', 'claude']
      : ['grok', 'gemini', 'venice'];
    const providerLabels: Record<CouncilProvider, string> = {
      grok: 'Grok',
      gemini: 'Gemini',
      claude: 'Claude',
      openai: 'OpenAI',
      venice: 'Venice'
    };

    // Repeating a large evidence pack for every seat was a major hidden cost. Give
    // each critic enough source context to challenge the manuscript without cloning
    // an entire project into nine simultaneous requests.
    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials
          .slice(0, 6)
          .map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 1200)}`)
          .join('\n\n')
          .slice(0, 6000)}`
      : '';

    const schema = {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ['content', 'severity', 'suggestions']
    };

    const personaNames: Record<string, string> = {
      agent: 'Literary Agent',
      publisher: 'Acquisitions Editor',
      market: 'Book Marketeer',
      buyer: 'Retail Buyer',
      reader: 'Critical Beta Reader',
      vocal: 'Vocal Architect',
      structural: 'Structural Architect',
      factual: 'Fact Checker',
      legal: 'Legal Specialist',
      academic: 'Peer Reviewer',
      comedy: 'Comedy Doctor',
      sentence: 'Sentence Stylist',
      thematic: 'Thematic Analyst',
      writer: 'Seasoned Author',
      medical: 'General Practitioner',
      historical: 'Historian',
      sensitivity: 'Sensitivity Panel',
      repetition: 'Repetition Detective'
    };

    const manuscriptSample = text.slice(0, intelligenceMode === 'god' ? 10000 : 8000);
    const makeSeatPrompt = (role: string) => `
      ${AGENT_PERSONAS[role as keyof typeof AGENT_PERSONAS] || `You are the ${role} specialist on an editorial council.`}

      TASK: Perform a high-fidelity, decisive critique of this ${type} draft.
      ${getMaturityDirectives(maturity)}
      ${sourceContext}

      TEXT TO ANALYZE:
      "${manuscriptSample}"

      CRITERIA:
      1. Identify exactly where the work loses force, clarity, credibility or voice.
      2. Rank severity objectively (low, medium, high, critical).
      3. Provide 3-5 specific, actionable corrections. Do not pad the answer.

      Return ONLY valid JSON according to the requested schema.
    `;

    const seatClientTimeout = intelligenceMode === 'speed' ? 16_000 : intelligenceMode === 'god' ? 30_000 : 22_000;
    const seatTokens = intelligenceMode === 'god' ? 1100 : 900;

    const runSeat = async (role: string, index: number): Promise<Critique> => {
      const provider = providerRotation[index % providerRotation.length];
      const responseText = await callAI({
        prompt: makeSeatPrompt(role),
        json: true,
        schema,
        maxTokens: seatTokens,
        providerOverride: provider,
        strictProvider: true,
        taskHint: 'council',
        skipLocalFallback: true,
        clientTimeoutMs: seatClientTimeout,
      });
      const data = safeParseJSON(responseText || '{}');
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
        : [];

      return {
        id: crypto.randomUUID(),
        agentName: `${personaNames[role] || `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`} · ${providerLabels[provider]}`,
        role: role as any,
        content: data.content || 'No major issues identified.',
        severity: data.severity || 'low',
        suggestions,
        timestamp: Date.now()
      } as Critique;
    };

    const critiques: Critique[] = [];
    let settledCount = 0;

    // Launch the full bounded Council simultaneously. No serial batches and no
    // seat-by-seat retries: the ensemble is the redundancy mechanism.
    const seatPromises = roles.map((role, index) =>
      runSeat(role, index)
        .then((critique) => {
          critiques.push(critique);
          return critique;
        })
        .catch((error) => {
          console.warn(`[Council] ${role} seat failed fast:`, error);
          throw error;
        })
        .finally(() => {
          settledCount += 1;
          onProgress?.([...critiques], settledCount, roles.length);
        })
    );

    await Promise.allSettled(seatPromises);

    const quorum = Math.min(roles.length, Math.max(3, Math.ceil(roles.length / 2)));
    if (critiques.length >= quorum) return critiques;

    // Extreme degradation: race three independent emergency chairs. This is one
    // bounded recovery wave, never a sequential fallback chain.
    const recoveryPrompt = `You are the emergency chair of an editorial council. Review this ${type} draft from structural, voice, factual, sentence-level, thematic and commercial perspectives. Return JSON with content, severity and 3-5 concrete suggestions.\n\nTEXT:\n${manuscriptSample}`;
    const recoveryProviders: CouncilProvider[] = ['grok', 'gemini', 'venice'];
    const recoveryCalls = recoveryProviders.map(async (provider) => {
      const responseText = await callAI({
        prompt: recoveryPrompt,
        json: true,
        schema,
        maxTokens: 1000,
        providerOverride: provider,
        strictProvider: true,
        taskHint: 'council',
        skipLocalFallback: true,
        clientTimeoutMs: seatClientTimeout,
      });
      const data = safeParseJSON(responseText || '{}');
      return {
        id: crypto.randomUUID(),
        agentName: `Council Recovery Chair · ${providerLabels[provider]}`,
        role: 'structural' as any,
        content: data.content || 'Council recovery completed.',
        severity: data.severity || 'medium',
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
          : [],
        timestamp: Date.now()
      } as Critique;
    });

    try {
      const recovery = await Promise.any(recoveryCalls);
      critiques.push(recovery);
    } catch (error) {
      console.warn('[Council] Emergency recovery wave failed:', error);
    }

    // Partial Council is still useful and must not be discarded because a provider
    // was down. Only surface a hard failure when literally no independent critic spoke.
    if (critiques.length > 0) return critiques;
    throw new Error('Council could not reach any configured cloud critic within the hard deadline.');
  },
'''

text = text[:start] + new_swarm + text[end:]
ai.write_text(text)

# Trigger the normal verified production deployment after tests pass.
Path('.deploy-atlas-trigger').write_text(
    'deploy requested 2026-08-09T19:48:00Z\nreason: Council 2.0 parallel quorum and hard-deadline surgery\n'
)

print('Council 2.0 major surgery applied')
