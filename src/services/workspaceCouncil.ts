export type WorkshopCritic = {
  name: string;
  role: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  finding: string;
  evidence: string;
  fix: string;
};

export type WorkshopCouncil = {
  summary: string;
  critics: WorkshopCritic[];
};

export type WorkshopDiagnosisFinding = {
  category: string;
  severity: string;
  confidence: number;
  evidence: string;
  rationale: string;
  recommendation: string;
};

export type WorkshopDiagnosis = {
  summary: string;
  findings: WorkshopDiagnosisFinding[];
};

const SEVERITIES = new Set(['low', 'medium', 'high', 'critical', 'major', 'minor']);

const ROLE_NAMES: Record<string, string> = {
  structural: 'Structural Architect',
  vocal: 'Vocal Architect',
  sentence: 'Sentence Stylist',
  agent: 'Literary Agent',
};

const LITERARY_RULES = `Rules:
- Find the wound under the desire. Do not expand the premise.
- Prefer objects, gestures, rooms, weather, clothes, silence, and behaviour over labels.
- Do not praise. Do not hedge. Do not invent plot that is not on the page.
- If the page is short, judge what is there, not the missing novel.
- Every note must quote or locate evidence from the page.
- Fixes must be specific and bounded — something the author can do today.
- Ban "add more tension", "develop the character", "show don't tell", "raise the stakes", "make it more cinematic".
- Severity is critical, high, medium, or low.`;

export function extractJsonObject(text: string): unknown {
  const raw = String(text || '').trim();
  const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```[\s\S]*$/i, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(fenced.slice(start, end + 1));
  }
  return JSON.parse(fenced);
}

function asRecord(raw: unknown): Record<string, any> {
  if (typeof raw === 'string') {
    try { return asRecord(extractJsonObject(raw)); } catch { return {}; }
  }
  return raw && typeof raw === 'object' ? raw as Record<string, any> : {};
}

export function buildWorkshopCouncilPrompt(input: { title: string; mode: string; manuscript: string }): string {
  const page = String(input.manuscript || '').slice(0, 24_000);
  return `You are Caspa's editorial council. Four specialists read the same pages and disagree in public. You are critics, not ghostwriters. Do not continue the story.

Return ONLY valid JSON with this exact shape:
{"summary":"What the council agrees is holding the work. One short paragraph. Concrete. No slogans.","critics":[{"name":"Structural Architect","role":"structural","severity":"high","finding":"Where power, knowledge, intimacy or danger fails to turn.","evidence":"A short quotation or exact location from the page.","fix":"One bounded repair the author can do today."},{"name":"Vocal Architect","role":"vocal","severity":"medium","finding":"...","evidence":"...","fix":"..."},{"name":"Sentence Stylist","role":"sentence","severity":"medium","finding":"...","evidence":"...","fix":"..."},{"name":"Literary Agent","role":"agent","severity":"high","finding":"...","evidence":"...","fix":"..."}]}

${LITERARY_RULES}
- The four critics must disagree about priority. Do not write four versions of the same note.

PROJECT: ${input.title}
MODE: ${input.mode}
PAGE:
${page}`;
}

export function buildWorkshopDiagnosisPrompt(input: { title: string; mode: string; manuscript: string }): string {
  const page = String(input.manuscript || '').slice(0, 80_000);
  return `You are a rigorous developmental editor. One pass. Find what is holding the visible page. Do not rewrite it.

Return ONLY valid JSON with this shape:
{"summary":"What is stuck, in one concrete paragraph.","findings":[{"category":"structure|continuity|character|pacing|voice|clarity","severity":"critical|major|minor","confidence":0.0,"evidence":"quotation or exact location","rationale":"why it matters to the turn","recommendation":"one bounded repair"}]}

${LITERARY_RULES}
- Prefer 3-8 high-value findings. Cut anything generic.

PROJECT: ${input.title}
MODE: ${input.mode}
PAGE:
${page}`;
}

function normalizeSeverity(value: unknown, fallback: WorkshopCritic['severity'] = 'medium'): WorkshopCritic['severity'] {
  const raw = String(value || '').toLowerCase();
  if (raw === 'major') return 'high';
  if (raw === 'minor') return 'low';
  return SEVERITIES.has(raw) ? raw as WorkshopCritic['severity'] : fallback;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

export function normalizeWorkshopCouncil(raw: unknown): WorkshopCouncil {
  const data = asRecord(raw);
  const rows = Array.isArray(data.critics)
    ? data.critics
    : Array.isArray(data.findings)
      ? data.findings
      : [];
  const critics = rows.slice(0, 6).map((row: any, index: number): WorkshopCritic => {
    const role = String(row?.role || ['structural', 'vocal', 'sentence', 'agent'][index] || 'structural').toLowerCase();
    return {
      name: String(row?.name || ROLE_NAMES[role] || `Critic ${index + 1}`),
      role,
      severity: normalizeSeverity(row?.severity),
      finding: firstText(row?.finding, row?.content, row?.rationale, row?.holding, row?.recommendation),
      evidence: firstText(row?.evidence, row?.excerpt),
      fix: firstText(row?.fix, row?.recommendation, row?.next_move, Array.isArray(row?.suggestions) ? row.suggestions[0]?.text || row.suggestions[0] : ''),
    };
  }).filter((critic: WorkshopCritic) => critic.finding || critic.fix);

  if (!critics.length) {
    const holding = firstText(data.holding, data.summary, data.verdict);
    const evidence = firstText(data.evidence, data.excerpt);
    const fix = firstText(data.next_move, data.recommendation, data.fix);
    if (holding || evidence || fix) {
      critics.push({
        name: ROLE_NAMES.structural,
        role: 'structural',
        severity: 'high',
        finding: holding,
        evidence,
        fix,
      });
    }
  }

  const summary = firstText(data.summary, data.holding, critics[0]?.finding);
  return { summary, critics };
}

export function normalizeWorkshopDiagnosis(raw: unknown): WorkshopDiagnosis {
  const data = asRecord(raw);
  const rows = Array.isArray(data.findings)
    ? data.findings
    : Array.isArray(data.critics)
      ? data.critics
      : [];
  const findings = rows.slice(0, 20).map((row: any): WorkshopDiagnosisFinding => ({
    category: firstText(row?.category, row?.role, 'structure'),
    severity: firstText(row?.severity, 'major'),
    confidence: Number.isFinite(Number(row?.confidence)) ? Number(row.confidence) : 0.7,
    evidence: firstText(row?.evidence, row?.excerpt),
    rationale: firstText(row?.rationale, row?.finding, row?.content, row?.holding),
    recommendation: firstText(row?.recommendation, row?.fix, row?.next_move),
  })).filter((finding) => finding.rationale || finding.recommendation || finding.evidence);

  if (!findings.length) {
    const holding = firstText(data.holding, data.summary, data.verdict);
    const evidence = firstText(data.evidence, data.excerpt);
    const recommendation = firstText(data.next_move, data.recommendation);
    if (holding || evidence || recommendation) {
      findings.push({
        category: 'structure',
        severity: 'major',
        confidence: 0.7,
        evidence,
        rationale: holding,
        recommendation,
      });
    }
  }

  return {
    summary: firstText(data.summary, data.holding, findings[0]?.rationale, 'Diagnosis completed.'),
    findings,
  };
}
