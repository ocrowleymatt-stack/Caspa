from pathlib import Path

ai_path = Path('src/services/ai.ts')
ai = ai_path.read_text()

old_opts = """  maxTokens?: number;
  providerOverride?: IntelligenceProvider;
  useWebSearch?: boolean;
}) {"""
new_opts = """  maxTokens?: number;
  providerOverride?: IntelligenceProvider;
  strictProvider?: boolean;
  useWebSearch?: boolean;
}) {"""
if old_opts not in ai:
    raise SystemExit('callAI options anchor not found')
ai = ai.replace(old_opts, new_opts, 1)

start = ai.index('  async getSwarmCritique(')
end = ai.index('\n  async writeDraft(', start)
new_func = '''  async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[]): Promise<Critique[]> {
    const defaultRoles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition'];
    if (type === 'legal') defaultRoles.push('legal');
    if (type === 'academic') defaultRoles.push('academic');
    if (type === 'experimental' || type === 'screenplay') defaultRoles.push('comedy');

    const roles = customRoles || defaultRoles;
    const providerRotation: IntelligenceProvider[] = ['grok', 'gemini', 'claude', 'openai', 'venice'];
    const providerLabels: Record<IntelligenceProvider, string> = {
      grok: 'Grok',
      gemini: 'Gemini',
      claude: 'Claude',
      openai: 'OpenAI',
      venice: 'Venice'
    };

    const sourceContext = sourceMaterials.length > 0
      ? `\\nSOURCE MATERIALS FOR REFERENCE:\\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\\n${s.content.slice(0, 3000)}`).join('\\n\\n')}`
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

    const makeSeatPrompt = (role: string) => `
      ${AGENT_PERSONAS[role as keyof typeof AGENT_PERSONAS]}

      TASK: Perform a high-fidelity, brutal critique of this ${type} draft.
      ${getMaturityDirectives(maturity)}
      ${sourceContext}

      TEXT TO ANALYZE:
      "${text.slice(0, 10000)}"

      CRITERIA:
      1. Identify exactly where the prose loses momentum or character voice falters.
      2. Rank severity objectively (low, medium, high, critical).
      3. Provide 3-5 specific, actionable suggestions for improvement.

      Return ONLY valid JSON according to the requested schema.
    `;

    const runSeat = async (role: string, index: number, strict: boolean): Promise<Critique> => {
      const provider = providerRotation[index % providerRotation.length];
      const responseText = await callAI({
        prompt: makeSeatPrompt(role),
        json: true,
        schema,
        model: 'gemini-2.0-flash',
        maxTokens: 1600,
        providerOverride: provider,
        strictProvider: strict
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
    const failedSeats: { role: string; index: number; error: any }[] = [];
    const concurrency = 3;

    for (let offset = 0; offset < roles.length; offset += concurrency) {
      const batch = roles.slice(offset, offset + concurrency);
      const settled = await Promise.allSettled(
        batch.map((role, batchIndex) => runSeat(role, offset + batchIndex, true))
      );

      settled.forEach((result, batchIndex) => {
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

    for (const failed of failedSeats) {
      try {
        const recovered = await runSeat(failed.role, failed.index, false);
        critiques.push(recovered);
      } catch (error) {
        console.warn(`[Council] Seat ${failed.role} remained unavailable after recovery:`, error);
      }
    }

    if (critiques.length === 0) {
      const recoveryPrompt = `You are the emergency chair of a literary editorial council. Review this ${type} draft from structural, voice, factual, sentence-level, thematic, commercial and repetition perspectives. Return JSON with content, severity and 3-5 suggestions.\\n\\nTEXT:\\n${text.slice(0, 10000)}`;
      const recoveryText = await callAI({ prompt: recoveryPrompt, json: true, schema, maxTokens: 1800 });
      const data = safeParseJSON(recoveryText || '{}');
      critiques.push({
        id: crypto.randomUUID(),
        agentName: 'Council Recovery Chair',
        role: 'structural' as any,
        content: data.content || 'Council recovery completed.',
        severity: data.severity || 'medium',
        suggestions: Array.isArray(data.suggestions) ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s) : [],
        timestamp: Date.now()
      } as Critique);
    }

    return critiques;
  },
'''
ai = ai[:start] + new_func + ai[end:]
ai_path.write_text(ai)

server_path = Path('server.ts')
server = server_path.read_text()
old_destructure = '  const { prompt, model = "gemini-2.0-flash", json = false, schema, maxTokens, providerOverride, useSearch, primaryProvider = "grok" } = req.body;'
new_destructure = '  const { prompt, model = "gemini-2.0-flash", json = false, schema, maxTokens, providerOverride, strictProvider = false, useSearch, primaryProvider = "grok" } = req.body;'
if old_destructure not in server:
    raise SystemExit('AI route destructure anchor not found')
server = server.replace(old_destructure, new_destructure, 1)

route_start = server.index('  // Host Unified Router (OpenAI-compatible) wins when UNIFIED_ROUTER_URL is set.')
route_end = server.index('  // Skip providers with no key', route_start)
route_block = '''  if (strictProvider && providerOverride) {
    // Council Mode: pin this seat to exactly one provider. Recovery is handled
    // deliberately by the caller instead of cascading every parallel request.
    providers.push(providerOverride);
  } else {
    // Host Unified Router (OpenAI-compatible) wins when UNIFIED_ROUTER_URL is set.
    if (isProviderConfigured('unified')) {
      providers.push('unified');
    }

    if (isSensitive && veniceKey) {
      if (!providers.includes('venice')) providers.push('venice');
      if (primaryProvider !== 'venice' && !providers.includes(primaryProvider)) providers.push(primaryProvider);
    } else if (!providers.includes(primaryProvider)) {
      providers.push(primaryProvider);
    }

    if (providerOverride && !providers.includes(providerOverride)) {
      providers.unshift(providerOverride);
    }

    AI_PROVIDERS.forEach(p => {
      if (!providers.includes(p)) {
        providers.push(p);
      }
    });
  }

'''
server = server[:route_start] + route_block + server[route_end:]
server_path.write_text(server)
