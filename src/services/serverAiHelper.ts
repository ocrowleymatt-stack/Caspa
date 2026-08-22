/**
 * Server-side AI helper for Caspa routes.
 *
 * This is intentionally a thin adapter over the canonical Atlas router. Provider
 * selection, quota handling, circuit breaking and Ollama survival all belong in
 * one place; feature routes must not maintain their own provider chains.
 */

import { callUnifiedRouterChat } from './unifiedRouter';
import { buildOrganicStimulusBlock } from './literary/organicStimulusService';
import fictionMaster from '../prompts/ocrowley-fiction-master.json';
import nonfictionMaster from '../prompts/ocrowley-nonfiction-master.json';

export type AuthorialVoice = 'fiction' | 'nonfiction' | 'none';

export const OCROWLEY_VOICE_MARKERS = {
  fiction: '[O’CROWLEY FICTION MASTER CONTROL — ALWAYS ACTIVE]',
  nonfiction: '[O’CROWLEY NON-FICTION MASTER CONTROL — ALWAYS ACTIVE]',
} as const;

const FICTION_HUMANITY_CONTRACT = `
CASPA FICTION HUMANITY CONTRACT — APPLY UNLESS THE USER EXPLICITLY REQUESTS AN ESSAY-COLLECTION, FRAGMENTARY, ANTHOLOGY OR LINKED-STORIES FORM
- WRITE ONE ACTUAL NOVEL. Chapters are successive movements of the same causal, emotional and temporal organism — not self-contained essays sharing a theme.
- Every chapter inherits live state from the previous one: who knows what, what has changed, what remains physically present, what has been promised, who is avoiding whom, and what consequence is already in motion.
- Do not restart the premise, reintroduce the cast, re-explain the theme, or manufacture a fresh thesis at each chapter boundary. A chapter boundary is a cut in the flow, not amnesia.
- Let scenes continue across chapter boundaries when that is the strongest form. Chapters need not have mini-introductions or mini-conclusions.
- Trust the reader. Omit explanations that the reader can infer from action, juxtaposition, image, silence or prior knowledge. Do not translate every gesture into its emotional meaning.
- Silence is content. Characters may not answer, may answer sideways, may leave a thought unfinished, may misunderstand, may avoid the obvious subject. Do not fill every gap with explanatory dialogue or narration.
- Human memory is reconstructive, selective and state-dependent. Unless the story establishes otherwise, recollection may lose detail, shift emphasis, fuse adjacent moments, preserve a sensory shard while losing sequence, or become more certain than it deserves. Never use memory degradation as a continuity excuse: distinguish character uncertainty from authorial contradiction.
- Psychological response has latency and displacement. Shock may produce practical behaviour before feeling; grief may arrive through irritation or routine; fear may narrow attention; shame may create concealment; attachment can produce contradictory action. Do not make every character react on cue in the same emotional register.
- Preserve private interiority. The narrator does not have to explain what a character cannot yet formulate.
- Vary duration honestly: a consequential minute may occupy pages; six uneventful months may pass in a sentence. Do not give every beat equal textual weight.
- Permit negative space: withheld scene, off-stage consequence, ellipsis, jump cut, object residue, changed routine, absence. Use these only where causality remains legible.
- Recurring images must transform with context. Never deploy motifs at regular intervals like scheduled decorations.
- Literary influence means craft abstraction, never imitation: focal distance, omission, compression, syntactic pressure, duration, scene architecture, comic timing, restraint, image logic. Do not copy or closely mimic an author's recognisable prose.
- Surprise must emerge from character, world and consequence. Never pick a stock 'random twist', phrase, metaphor or emotional beat from a hidden list.
`.trim();

function looksLikeCaspaWriting(prompt: string) {
  return /(draft|write|rewrite|manuscript|novel|fiction|chapter|scene|story|spine|prose|literary|poetry|script|musical|seed|line edit|quality final cut|editor)/i.test(prompt);
}

function looksNonfiction(prompt: string) {
  return /(NON-FICTION|nonfiction|Essay \/ article|MODE\s*:?\s*(?:nonfiction|essay)|PROJECT TYPE[^\n]*(?:Non-fiction|Essay)|argument spine|claim→evidence)/i.test(prompt);
}

export function authorialVoiceForMode(mode?: string | null): Exclude<AuthorialVoice, 'none'> {
  return /^(nonfiction|non-fiction|essay)$/i.test(String(mode || '').trim()) ? 'nonfiction' : 'fiction';
}

function inferAuthorialVoice(prompt: string): AuthorialVoice {
  if (!looksLikeCaspaWriting(prompt)) return 'none';
  return looksNonfiction(prompt) ? 'nonfiction' : 'fiction';
}

/**
 * Places the stable master control before the variable task. Keeping this prefix
 * byte-for-byte stable allows compatible providers to cache it across calls.
 */
export function applyAuthorialVoice(prompt: string, requested: AuthorialVoice | 'auto' = 'auto') {
  const voice = requested === 'auto' ? inferAuthorialVoice(prompt) : requested;
  if (voice === 'none') return prompt;

  const marker = OCROWLEY_VOICE_MARKERS[voice];
  if (prompt.includes(marker)) return prompt;
  const master = voice === 'nonfiction' ? nonfictionMaster.prompt : fictionMaster.prompt;
  return `${marker}\n${master.trim()}\n[END O’CROWLEY MASTER CONTROL]\n\n[CURRENT CASPA TASK]\n${prompt}`;
}

async function enrichCreativePrompt(prompt: string, requested: AuthorialVoice | 'auto' = 'auto') {
  const voice = requested === 'auto' ? inferAuthorialVoice(prompt) : requested;
  const controlledPrompt = applyAuthorialVoice(prompt, voice);
  if (voice !== 'fiction') return controlledPrompt;
  let stimulus = '';
  try {
    stimulus = await buildOrganicStimulusBlock();
  } catch {
    // Optional anti-pattern stimulus must never block writing.
  }
  return `${controlledPrompt}\n\n${FICTION_HUMANITY_CONTRACT}${stimulus ? `\n\n${stimulus}` : ''}`;
}

export async function callServerAi(
  prompt: string,
  json = false,
  opts?: { maxTokens?: number; timeoutMs?: number; authorialVoice?: AuthorialVoice | 'auto' },
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? (json ? 4096 : 8192);
  const routedPrompt = await enrichCreativePrompt(prompt, opts?.authorialVoice ?? 'auto');

  // The unified entry point owns the full route:
  // host router -> healthy cloud provider -> next provider -> Ollama survival.
  return callUnifiedRouterChat(routedPrompt, {
    json,
    maxTokens,
    timeoutMs: opts?.timeoutMs,
  });
}
