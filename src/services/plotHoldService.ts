/**
 * Plot Hold — silent story spine that auto-write must obey.
 * Plans are ingredients. The UI stays simple; the plot stays locked.
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
    nonNegotiables: ['Preserve authorial voice', 'Every scene must turn', 'Do not invent a new plot'],
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
  const next = { ...hold, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearPlotHold() {
  localStorage.removeItem(KEY);
}

/** Convert seed-to-story / structured plan JSON into a held plot. */
export function plotHoldFromProposal(proposal: Record<string, unknown>, fallbackTitle = ''): PlotHold {
  const chapters = Array.isArray(proposal.chapters) ? proposal.chapters : [];
  const scenePlan = Array.isArray(proposal.scenePlan) ? proposal.scenePlan : [];
  const characters = Array.isArray(proposal.characters) ? proposal.characters : [];

  const beatsFromChapters: PlotBeat[] = chapters.map((ch: any, i: number) => ({
    id: uid('ch'),
    title: String(ch?.title || `Chapter ${i + 1}`),
    turn: String(ch?.turn || ch?.endingImage || ''),
    endingImage: ch?.endingImage ? String(ch.endingImage) : undefined,
    status: 'pending',
  }));

  const beatsFromScenes: PlotBeat[] =
    beatsFromChapters.length > 0
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
      authorQuestions: Array.isArray(proposal.authorQuestions)
        ? proposal.authorQuestions.map(String)
        : [],
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

/** Compact block injected into every auto-write / continue / gold call. */
export function plotHoldPromptBlock(hold: PlotHold | null | undefined): string {
  if (!hold || (!hold.premise && hold.beats.length === 0)) return '';

  const beats = hold.beats
    .map((b, i) => `${i + 1}. [${b.status}] ${b.title} — TURN: ${b.turn}${b.endingImage ? ` · IMAGE: ${b.endingImage}` : ''}`)
    .join('\n');

  const cast = hold.characters
    .map((c) => `- ${c.name} (${c.role}): wound=${c.wound}; desire=${c.desire}${c.mask ? `; mask=${c.mask}` : ''}`)
    .join('\n');

  return `
PLOT HOLD — OBEY THIS SPINE (do not invent a rival plot)
Title: ${hold.title || '[untitled]'}
Premise: ${hold.premise}
Central wound: ${hold.centralWound || '[infer carefully from premise]'}
Immediate desire: ${hold.immediateDesire || '[infer]'}
Genre: ${hold.genre}
Tone: ${hold.tone || '[preserve source voice]'}
Prize target: ${hold.prizeTarget || '[literary excellence]'}
Opening image: ${hold.openingImage || '[earn one]'}

BEATS / CHAPTER TURNS
${beats || '[No beats locked yet — invent a clean spine then hold it]'}

CHARACTERS
${cast || '[Derive from premise; keep consistent]'}

NON-NEGOTIABLES
${(hold.nonNegotiables || []).map((n) => `- ${n}`).join('\n')}

RULES
- Consume this plot silently. Output artefact (prose/script), not a re-plan.
- Advance the next pending beat unless asked otherwise.
- Do not discard wound, desire, or established turns.
- Motifs may return only if transformed.
`.trim();
}

export function plotHoldSummary(hold: PlotHold | null): string {
  if (!hold) return 'No plot held yet.';
  const drafted = hold.beats.filter((b) => b.status === 'drafted').length;
  const total = hold.beats.length;
  return `${hold.title || 'Untitled'} · ${drafted}/${total || 0} beats drafted · wound: ${hold.centralWound || '—'}`;
}
