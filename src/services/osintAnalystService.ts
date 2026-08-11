import { callServerAi } from './serverAiHelper';

export interface OsintEvidenceBundle {
  target: string;
  objective?: string;
  collectedText: string;
  sources?: string[];
}

export interface OsintAnalystOutput {
  findings: Array<{ claim: string; status: 'fact' | 'inference' | 'hypothesis'; confidence: number; support: string[] }>;
  entities: Array<{ name: string; type: string; aliases?: string[] }>;
  timeline: Array<{ date: string; event: string; support: string[] }>;
  contradictions: Array<{ issue: string; competingAccounts: string[]; nextCheck: string }>;
  pivots: Array<{ query: string; reason: string; priority: 'high' | 'medium' | 'low' }>;
  gaps: string[];
  summary: string;
}

export function buildOsintAnalystPrompt(bundle: OsintEvidenceBundle): string {
  const sources = (bundle.sources || []).slice(0, 100);
  return `You are Atlas OSINT Analyst. Treat the supplied collection as source material, not as automatically true.

TARGET: ${bundle.target}
OBJECTIVE: ${bundle.objective || 'Expand and test the collected intelligence.'}

SOURCE REFERENCES:\n${sources.map((s, i) => `[S${i + 1}] ${s}`).join('\n') || '[none supplied]'}

COLLECTED MATERIAL:\n${bundle.collectedText.slice(0, 120000)}

Do all of the following:
1. Extract entities and aliases.
2. Reconstruct a chronology where dates are available.
3. Separate FACT (directly supported), INFERENCE (reasoned from facts), and HYPOTHESIS (lead requiring corroboration).
4. Identify contradictions, unexplained overlaps and missing evidence.
5. Generate targeted second-pass search pivots that a separate OSINT engine can execute. Pivots must be specific searches, not conclusions.
6. Preserve provenance: support arrays must reference the supplied source labels where possible. Never invent a source.
7. Do not treat model-generated connections as evidence.

Return ONLY valid JSON matching:
{
  "findings":[{"claim":"...","status":"fact|inference|hypothesis","confidence":0.0,"support":["S1"]}],
  "entities":[{"name":"...","type":"person|organisation|location|account|domain|phone|email|other","aliases":["..."]}],
  "timeline":[{"date":"YYYY-MM-DD or approximate","event":"...","support":["S1"]}],
  "contradictions":[{"issue":"...","competingAccounts":["..."],"nextCheck":"..."}],
  "pivots":[{"query":"...","reason":"...","priority":"high|medium|low"}],
  "gaps":["..."],
  "summary":"..."
}`;
}

export function normaliseOsintAnalystOutput(raw: string): OsintAnalystOutput {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const body = fenced?.[1] || raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    parsed = JSON.parse(body);
  }
  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
    contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
    pivots: Array.isArray(parsed.pivots) ? parsed.pivots : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    summary: String(parsed.summary || ''),
  };
}

export async function expandOsintEvidence(bundle: OsintEvidenceBundle): Promise<OsintAnalystOutput> {
  const raw = await callServerAi(buildOsintAnalystPrompt(bundle), true, { maxTokens: 8192 });
  return normaliseOsintAnalystOutput(raw);
}
