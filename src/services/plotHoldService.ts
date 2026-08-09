/**
 * Plot Hold — the silent structural ledger every write pass must obey.
 * Holds spine, continuity debts, reader promises, research needs and visual opportunities.
 */

export interface PlotBeat {
  id: string;
  title: string;
  turn: string;
  endingImage?: string;
  status: 'pending' | 'drafted' | 'cut';
}

export interface HeldCharacter {
  name: string;
  role: string;
  wound: string;
  desire: string;
  mask?: string;
}

export interface HeldPromise {
  id: string;
  statement: string;
  dueBy?: string;
  type?: string;
  status: 'open' | 'developing' | 'due' | 'paid' | 'removed';
}

export interface HeldResearchNeed {
  topic: string;
  why?: string;
  priority?: 'high' | 'medium' | 'low' | string;
  status?: 'needed' | 'researched' | 'verified';
}

export interface HeldIllustration {
  id: string;
  type: string;
  purpose: string;
  placementAfter: string;
  contentBrief: string;
  sourceRequirement?: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'produced';
}

export interface PlotHold {
  title: string;
  premise: string;
  centralWound: string;
  immediateDesire: string;
  genre: string;
  tone: string;
  prizeTarget: string;
  openingImage: string;
  beats: PlotBeat[];
  characters: HeldCharacter[];
  authorQuestions: string[];
  readerPromises: HeldPromise[];
  researchNeeds: HeldResearchNeed[];
  illustrations: HeldIllustration[];
  nonNegotiables: string[];
  updatedAt: string;
}

const KEY = 'caspa.plotHold';

function uid(prefix = 'beat') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyPlotHold(partial: Partial<PlotHold> = {}): PlotHold {
  return {
    title: '',
    premise: '',
    centralWound: '',
    immediateDesire: '',
    genre: 'Literary fiction',
    tone: '',
    prizeTarget: '',
    openingImage: '',
    beats: [],
    characters: [],
    authorQuestions: [],
    readerPromises: [],
    researchNeeds: [],
    illustrations: [],
    nonNegotiables: [
      'Structure first; prose second',
      'Preserve continuity and established facts',
      'Do not lose live threads',
      'Pay reader promises when due',
      'Do not invent a rival plot or argument',
      'No AI filler, invented facts or invented citations',
    ],
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

export function loadPlotHold(): PlotHold | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? ({ ...emptyPlotHold(), ...JSON.parse(raw) } as PlotHold) : null;
  } catch {
    return null;
  }
}

export function savePlotHold(hold: PlotHold): PlotHold {
  const next = { ...emptyPlotHold(), ...hold, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearPlotHold() {
  localStorage.removeItem(KEY);
}

/** Convert seed/structured-plan JSON into a durable structural ledger. */
export function plotHoldFromProposal(proposal: Record<string, unknown>, fallbackTitle = ''): PlotHold {
  const chapters = Array.isArray(proposal.chapters) ? proposal.chapters : [];
  const scenePlan = Array.isArray(proposal.scenePlan) ? proposal.scenePlan : [];
  const characters = Array.isArray(proposal.characters) ? proposal.characters : [];
  const promises = Array.isArray(proposal.readerPromises) ? proposal.readerPromises : [];
  const researchNeeds = Array.isArray(proposal.researchNeeds) ? proposal.researchNeeds : [];
  const illustrations = Array.isArray(proposal.illustrations) ? proposal.illustrations : [];

  const beatsFromChapters: PlotBeat[] = chapters.map((ch: any, i: number) => ({
    id: uid('ch'),
    title: String(ch?.title || `Chapter ${i + 1}`),
    turn: String(ch?.turn || ch?.endingImage || ''),
    endingImage: ch?.endingImage ? String(ch.endingImage) : undefined,
    status: 'pending',
  }));

  const beatsFromScenes: PlotBeat[] = beatsFromChapters.length > 0
    ? beatsFromChapters
    : scenePlan.map((s: any, i: number) => ({
        id: uid('sc'),
        title: typeof s === 'string' ? `Beat ${i + 1}` : String(s?.title || `Beat ${i + 1}`),
        turn: typeof s === 'string' ? s : String(s?.turn || s || ''),
        status: 'pending' as const,
      }));

  return savePlotHold(
    emptyPlotHold({
      title: String(proposal.title || fallbackTitle || ''),
      premise: String(proposal.premise || ''),
      centralWound: String(proposal.centralWound || proposal.characterWoundMap || ''),
      immediateDesire: String(proposal.immediateDesire || ''),
      genre: String(proposal.genre || 'Literary fiction'),
      tone: String(proposal.tone || ''),
      prizeTarget: String(proposal.prizeTarget || ''),
      openingImage: String(proposal.openingImage || ''),
      beats: beatsFromScenes,
      characters: characters
        .map((c: any) => ({
          name: String(c?.name || ''),
          role: String(c?.role || ''),
          wound: String(c?.wound || ''),
          desire: String(c?.desire || ''),
          mask: c?.mask ? String(c.mask) : undefined,
        }))
        .filter((c: HeldCharacter) => c.name),
      authorQuestions: Array.isArray(proposal.authorQuestions) ? proposal.authorQuestions.map(String) : [],
      readerPromises: promises
        .map((p: any) => ({
          id: String(p?.id || uid('promise')),
          statement: String(p?.statement || ''),
          dueBy: p?.dueBy ? String(p.dueBy) : undefined,
          type: p?.type ? String(p.type) : undefined,
          status: 'open' as const,
        }))
        .filter((p: HeldPromise) => p.statement),
      researchNeeds: researchNeeds
        .map((r: any) => ({
          topic: String(r?.topic || r || ''),
          why: r?.why ? String(r.why) : undefined,
          priority: r?.priority ? String(r.priority) : undefined,
          status: 'needed' as const,
        }))
        .filter((r: HeldResearchNeed) => r.topic),
      illustrations: illustrations
        .map((v: any) => ({
          id: String(v?.id || uid('fig')),
          type: String(v?.type || 'figure'),
          purpose: String(v?.purpose || ''),
          placementAfter: String(v?.placementAfter || ''),
          contentBrief: String(v?.contentBrief || ''),
          sourceRequirement: v?.sourceRequirement ? String(v.sourceRequirement) : undefined,
          status: 'proposed' as const,
        }))
        .filter((v: HeldIllustration) => v.purpose || v.contentBrief),
    })
  );
}

export function markBeatDrafted(beatId: string) {
  const hold = loadPlotHold();
  if (!hold) return null;
  hold.beats = hold.beats.map((b) => (b.id === beatId ? { ...b, status: 'drafted' } : b));
  return savePlotHold(hold);
}

export function nextPendingBeat(hold: PlotHold | null): PlotBeat | null {
  if (!hold?.beats?.length) return null;
  return hold.beats.find((b) => b.status === 'pending') || null;
}

/** Compact block injected into every auto-write / continue call. */
export function plotHoldPromptBlock(hold: PlotHold | null | undefined): string {
  if (!hold || (!hold.premise && hold.beats.length === 0)) return '';

  const beats = hold.beats
    .map((b, i) => `${i + 1}. [${b.status}] ${b.title} — JOB/TURN: ${b.turn}${b.endingImage ? ` · IMAGE: ${b.endingImage}` : ''}`)
    .join('\n');

  const cast = hold.characters
    .map((c) => `- ${c.name} (${c.role}): ${c.wound ? `wound=${c.wound}; ` : ''}purpose/desire=${c.desire}${c.mask ? `; mask=${c.mask}` : ''}`)
    .join('\n');

  const promises = (hold.readerPromises || [])
    .filter((p) => p.status !== 'removed')
    .map((p) => `- [${p.status}] ${p.statement}${p.dueBy ? ` · due: ${p.dueBy}` : ''}${p.type ? ` · ${p.type}` : ''}`)
    .join('\n');

  const research = (hold.researchNeeds || [])
    .filter((r) => r.status !== 'verified')
    .map((r) => `- [${r.status || 'needed'}] ${r.topic}${r.why ? ` — ${r.why}` : ''}${r.priority ? ` · ${r.priority}` : ''}`)
    .join('\n');

  const visuals = (hold.illustrations || [])
    .filter((v) => v.status !== 'rejected')
    .map((v) => `- [${v.status}] ${v.type}: ${v.purpose || v.contentBrief}${v.placementAfter ? ` · after: ${v.placementAfter}` : ''}${v.sourceRequirement ? ` · source: ${v.sourceRequirement}` : ''}`)
    .join('\n');

  return `
STRUCTURAL HOLD — OBEY THIS LEDGER
Title: ${hold.title || '[untitled]'}
Premise/thesis: ${hold.premise}
Central wound/problem: ${hold.centralWound || '[held by premise]'}
Immediate desire/reader need: ${hold.immediateDesire || '[infer carefully]'}
Genre: ${hold.genre}
Tone/register: ${hold.tone || '[preserve source voice]'}
Quality target: ${hold.prizeTarget || '[review-proof quality]'}
Opening device/image: ${hold.openingImage || '[none locked]'}

LOCKED STRUCTURAL UNITS
${beats || '[No units locked]'}

PEOPLE / VOICES / ACTORS
${cast || '[None required]'}

READER / STORY PROMISE LEDGER
${promises || '[No explicit promises recorded yet — still preserve implicit setup/payoff.]'}

RESEARCH / EVIDENCE DEBTS
${research || '[No unresolved research needs recorded.]'}

VISUAL / PRODUCTION PLAN
${visuals || '[No visuals currently proposed.]'}

AUTHOR QUESTIONS / OPEN THREADS
${(hold.authorQuestions || []).map((q) => `- ${q}`).join('\n') || '[None recorded]'}

NON-NEGOTIABLES
${(hold.nonNegotiables || []).map((n) => `- ${n}`).join('\n')}

RULES
- Advance only the assigned structural unit.
- Do not lose established threads or silently cancel a reader promise.
- A promise due in this unit must be paid, deliberately subverted, or explicitly preserved for a later stated point.
- Do not fabricate missing research, evidence or citations.
- Proposed visuals are production guidance, not permission to invent data.
- Structure and integrity outrank prose polish.
`.trim();
}

export function plotHoldSummary(hold: PlotHold | null): string {
  if (!hold) return 'No structural hold yet.';
  const drafted = hold.beats.filter((b) => b.status === 'drafted').length;
  const total = hold.beats.length;
  const openPromises = (hold.readerPromises || []).filter((p) => !['paid', 'removed'].includes(p.status)).length;
  const researchOpen = (hold.researchNeeds || []).filter((r) => r.status !== 'verified').length;
  return `${hold.title || 'Untitled'} · ${drafted}/${total || 0} units drafted · ${openPromises} promises open · ${researchOpen} research needs`;
}
