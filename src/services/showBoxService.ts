/**
 * Show in a Box — shared pack state for shelf, export, writing engines, Story Bible
 */

export const SHOW_BOX_KEY = 'caspa.showBox';

export type ShowBoxState = {
  songList: string;
  runningOrder: string;
  castNotes: string;
  productionPack: string;
  musicSketch: string;
  updatedAt?: string;
};

export type ShowBoxBriefLike = {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
};

export const emptyShowBox = (): ShowBoxState => ({
  songList: '',
  runningOrder: '',
  castNotes: '',
  productionPack: '',
  musicSketch: '',
});

export function loadShowBox(): ShowBoxState {
  try {
    const raw = localStorage.getItem(SHOW_BOX_KEY);
    if (!raw) return emptyShowBox();
    const parsed = JSON.parse(raw);
    return { ...emptyShowBox(), ...parsed };
  } catch {
    return emptyShowBox();
  }
}

export function saveShowBox(state: ShowBoxState): void {
  localStorage.setItem(
    SHOW_BOX_KEY,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  );
}

export function clearShowBox(): void {
  localStorage.removeItem(SHOW_BOX_KEY);
}

export function showBoxPieceCount(state: ShowBoxState = loadShowBox()): {
  done: number;
  total: number;
  pieces: { id: string; label: string; done: boolean }[];
} {
  const pieces = [
    { id: 'songs', label: 'Song list', done: Boolean(state.songList.trim()) },
    { id: 'order', label: 'Running order', done: Boolean(state.runningOrder.trim()) },
    { id: 'music', label: 'Music sketch', done: Boolean(state.musicSketch.trim()) },
    { id: 'cast', label: 'Cast & doubles', done: Boolean(state.castNotes.trim()) },
    { id: 'pack', label: 'Production pack', done: Boolean(state.productionPack.trim()) },
  ];
  return { done: pieces.filter((p) => p.done).length, total: pieces.length, pieces };
}

export function hasShowBoxContent(state: ShowBoxState = loadShowBox()): boolean {
  return showBoxPieceCount(state).done > 0;
}

export function assembleShowPack(
  brief: ShowBoxBriefLike,
  draftPage = '',
  state: ShowBoxState = loadShowBox()
): string {
  return [
    `# ${brief.title}`,
    '',
    `## Premise`,
    brief.idea,
    '',
    `## Tone`,
    brief.tone,
    '',
    `## Audience`,
    brief.audience,
    '',
    `## Required output`,
    brief.output,
    '',
    state.runningOrder.trim() && `## Running order\n\n${state.runningOrder.trim()}`,
    state.songList.trim() && `## Song list\n\n${state.songList.trim()}`,
    state.castNotes.trim() && `## Cast & doubles\n\n${state.castNotes.trim()}`,
    state.musicSketch.trim() && `## Music sketch\n\n${state.musicSketch.trim()}`,
    state.productionPack.trim() && `## Production pack\n\n${state.productionPack.trim()}`,
    draftPage.trim() && `## Book / working draft\n\n${draftPage.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Compact context block for writing engines, commission, and prize draft. */
export function formatShowPackForWriting(state: ShowBoxState = loadShowBox()): string {
  if (!hasShowBoxContent(state)) return '';
  const parts: string[] = ['SHOW IN A BOX — LOCKED PACK CONTEXT'];
  if (state.runningOrder.trim()) {
    parts.push(`RUNNING ORDER:\n${state.runningOrder.trim().slice(0, 4000)}`);
  }
  if (state.songList.trim()) {
    parts.push(`SONG LIST:\n${state.songList.trim().slice(0, 3000)}`);
  }
  if (state.castNotes.trim()) {
    parts.push(`CAST & DOUBLES:\n${state.castNotes.trim().slice(0, 2000)}`);
  }
  if (state.musicSketch.trim()) {
    parts.push(`MUSIC SKETCH:\n${state.musicSketch.trim().slice(0, 2500)}`);
  }
  if (state.productionPack.trim()) {
    parts.push(`PRODUCTION PACK:\n${state.productionPack.trim().slice(0, 3000)}`);
  }
  parts.push(
    'Honour this pack: do not invent conflicting song titles, cast, or running-order beats. Book scenes must turn into or out of these numbers.'
  );
  return parts.join('\n\n');
}

export function createMusicSketch(idea: string, tone: string, title: string): string {
  const working = (idea || title || 'Untitled show number').trim();
  const shortHook = working.length > 72 ? `${working.slice(0, 69)}…` : working;
  return `# Music Sketch — ${title || 'Untitled show number'}

Working title / premise: ${working}
Style: theatrical pop / panto-rock / comic patter song
Tempo: 126 BPM
Key: D minor moving to F major for the release
Tone: ${tone || 'Comic, theatrical, sharp, with a big chorus'}

## Structure
Intro: 4 bars — cheeky pizzicato strings and muted brass stab
Verse 1: 16 bars — patter delivery, comic exposition
Pre-chorus: 8 bars — rising panic / pressure
Chorus: 16 bars — big hook, ensemble response
Middle 8: 8 bars — villain/hero reversal
Final chorus: 24 bars — key lift, full company, button ending

## Chords
Intro: Dm | Bb | C | A7
Verse: Dm | Dm/C | Bb | A7
Pre: Gm | Bb | F | A7
Chorus: F | C/E | Dm | Bb | Gm | C | F | A7
Middle 8: Bb | C | Am | Dm | Gm | C | F | F

## Melody contour
Verse: fast repeated notes around A–C, with comic leaps on punchlines.
Pre-chorus: climb C–D–E–F–G to build theatrical panic.
Chorus hook: land strongly on F, then leap to A on the title phrase.

## First lyric hook (seed from premise — rewrite in voice)
${shortHook}
(Turn that into a singable couplet; keep the concrete place and pressure.)

## Arrangement
Drums: brushed snare into full kit by chorus.
Bass: bouncy quavers, comic swagger.
Keys: tack piano doubled with theatre organ.
Brass: short stabs after jokes.
Strings: pizzicato for sneaking, full tremolo for mock peril.

## Export prompt for Suno/Udio/DAW assistant
Theatrical British comedy patter song about: ${shortHook}. 126 BPM, D minor to F major, panto-rock energy, witty camp lyrics, brass stabs, tack piano, ensemble chorus, catchy chorus, West End demo style.`;
}

/** Sync pack into research library so Intelligence Lab / Workshop research can see it. */
export function syncShowPackToResearch(projectKey: string, brief: ShowBoxBriefLike): void {
  if (!hasShowBoxContent()) return;
  try {
    // Dynamic import avoided — use localStorage shape matching researchLibraryService
    const libKey = `caspa.research.${projectKey}`;
    const raw = localStorage.getItem(libKey);
    const notes = raw ? JSON.parse(raw) : [];
    const id = 'show-box-pack';
    const content = formatShowPackForWriting();
    const note = {
      id,
      title: `Show in a Box — ${brief.title}`,
      content,
      source: 'Show in a Box',
      category: 'production',
      tags: ['show-in-a-box', 'running-order', 'songs', brief.mode],
      updatedAt: Date.now(),
      isDeepResearch: false,
    };
    const next = Array.isArray(notes)
      ? [...notes.filter((n: { id?: string }) => n.id !== id), note]
      : [note];
    localStorage.setItem(libKey, JSON.stringify(next));
  } catch {
    /* research sync optional */
  }
}
