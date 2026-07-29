/**
 * Novel Write Pro literary engine — harvested from caspa-studio + Shakespeare.
 * Single source of prize-calibre writing prompts for Caspa.
 */

export type NovelWriteProMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'polish' | 'chaos';

export interface NovelWriteProPromptInput {
  mode: NovelWriteProMode;
  modeTitle: string;
  genre: string;
  premise: string;
  tone: string;
  output: string;
  sourceText?: string;
  uploadedName?: string | null;
  styleProfile?: string;
  researchContext?: string;
  prizeLens?: string;
  /** Silent spine the model must obey without re-planning. */
  plotHoldBlock?: string;
  /** Which beat to write next (title + turn). */
  focusBeat?: string;
}

export const LITERARY_ENGINE_RULES = `
LITERARY ENGINE — STANDING RULES
1. Identify the real dramatic engine: hidden wound, desire, betrayal, fear, irony, or transformation.
2. Story first, style second. If a sentence is pretty but useless, cut it.
3. Every scene must turn: power, knowledge, danger, intimacy, belief, status or direction must change.
4. Concrete before abstract: objects, gestures, rooms, weather, silence, behaviour — not emotion labels.
5. Subtext over declaration. Truth leaks through behaviour.
6. Cut pretty sludge. Aim for 25–40% reduction on polish passes.
7. Characters want something immediately. Even silence needs a mask and a pressure point.
8. Dialogue carries conflict: conceal, threaten, seduce, evade, expose, manipulate, wound, bargain.
9. Endings inevitable but surprising. Land on an image that bites.
10. Prose hierarchy: clarity → tension → character truth → rhythm → beauty → cleverness.
11. Ban filler: no vague menace, repeated adjectives, lore dumps, fake profundity.
12. Artefact first. Plans are inputs. Prose/script/play text is the meal unless a plan was asked for.
`.trim();

export const NONFICTION_ENGINE_RULES = `
NON-FICTION ENGINE — STANDING RULES
1. Identify the real intellectual engine: the thesis/claim, the central question, and the pressure point where the text turns.
2. Evidence is the plot. Every paragraph must add, test, or tighten a claim with specific support (examples, quotes, numbers, method, observations).
3. Every section must turn: claim → evidence → counterpoint → consequence (or the next step) — nothing should just rephrase.
4. Concrete before abstract: names, dates, artifacts, instruments, precise cause/effect. Avoid generic wisdom.
5. Be explicit about what the text asserts — then earn it with details.
6. Cut pretty sludge. Replace vague statements with specific claims and concrete limits.
7. Voices want something immediately: the author, witnesses, experts, and sources each carry a purpose for the argument.
8. Ban filler: no fake profundity, no grand motivation speeches, no lore dumps, no melodrama posing as insight.
9. Endings inevitable but surprising: land on a concrete implication, an honest limit, and a next question or action.
10. Prose hierarchy: clarity → tension → claim precision → rhythm → beauty (only when it serves the evidence) → cleverness.
11. Artefact first. Plans are inputs; drafts are outputs unless the user explicitly asked for a plan.
`.trim();

export const POETRY_ENGINE_RULES = `
POETRY ENGINE — STANDING RULES
1. Compression beats explanation. Image before statement.
2. Every line must turn the meaning, the music, or the image — no ornamental drift.
3. Concrete before abstract: smell, texture, weather, objects, the body’s timing.
4. Ban filler: if a line could be removed without breaking the turn, cut it.
5. Sound is craft: rhythm, silence, repetition as pressure, not decoration.
6. Endings inevitable but surprising: land on an image that bites, not a moral.
7. Artefact first. Return the poem/sequence — no process notes.
`.trim();

export function engineRulesForMode(mode: NovelWriteProMode): string {
  if (mode === 'nonfiction' || mode === 'essay') return NONFICTION_ENGINE_RULES;
  if (mode === 'poetry') return POETRY_ENGINE_RULES;
  return LITERARY_ENGINE_RULES;
}

export const CRITIC_PERSONAS = `
INTERNAL CRITIC ROOM (run silently before finalising)
- Structural Architect: pacing, arc, scene turns, justification of each scene.
- Vocal Stylist: character voice, on-the-nose speech, prosody.
- Literary Agent: hook strength, voice clarity, pace, commercial/literary fit.
- Beta Reader: boredom points, cognitive load, emotional momentum.
- Sentence Stylist: rhythm, decorative adjective bloat, echo.
- Repetition Detective: unchanged motifs, repeated phrases, thematic static.
`.trim();

export const AWARD_BAR = `
AWARD-TARGET QUALITY BAR
- Aim for prize-list, review-proof work — not competent filler.
- Immediate pressure, a memorable image, and a reason to keep reading.
- Every paragraph reveals character, increases pressure, complicates desire, sharpens place, or delivers rhythm.
- No generic AI fog. No abstract ache. No empty cleverness.
`.trim();

export const ARTEFACT_FIRST = `
ARTEFACT-FIRST CONTRACT
- Produce the requested artefact first.
- Plans are ingredients, not outputs, unless the user explicitly asked for a plan.
- If given a plan and asked to write, consume the plan silently and output prose/dialogue/script.
- If improving, return revised text first and notes second.
- If cutting, return cut text before any deletion log.
- No advice instead of artefact. No purple padding.
`.trim();

function truncateSource(sourceText = '', limit = 9000) {
  const clean = sourceText.trim();
  if (!clean) return '';
  return clean.length > limit
    ? `${clean.slice(0, limit)}\n\n[Source excerpt truncated for this pass.]`
    : clean;
}

function defaultBrief(input: NovelWriteProPromptInput) {
  if (input.premise.trim()) return input.premise.trim();
  if (input.uploadedName) return `Improve and develop the uploaded manuscript: ${input.uploadedName}`;
  return 'Invent a fresh original premise and begin immediately.';
}

export function buildAutoWritePrompt(input: NovelWriteProPromptInput): string {
  const sourceExcerpt = truncateSource(input.sourceText);
  const styleProfile = input.styleProfile?.trim()
    ? `\nSTYLE PROFILE TO HONOUR\n${input.styleProfile.trim()}\n`
    : '';
  const researchContext = input.researchContext?.trim()
    ? `\nRESEARCH CONTEXT TO WEAVE NATURALLY\n${input.researchContext.trim()}\n`
    : '';
  const prize = input.prizeLens?.trim()
    ? `\nPRIZE LENS\nWrite toward this quality target: ${input.prizeLens.trim()}\n`
    : '';
  const plot = input.plotHoldBlock?.trim() ? `\n${input.plotHoldBlock.trim()}\n` : '';
  const focus = input.focusBeat?.trim()
    ? `\nFOCUS BEAT (write this now)\n${input.focusBeat.trim()}\n`
    : '';

  return `You are Caspa running Novel Write Pro: an elite creative-writing engine.

Your job is to write usable, ambitious, award-target draft material immediately — not a placeholder.
If a PLOT HOLD is present, obey it silently. Do not output a new outline.

PROJECT TYPE
${input.modeTitle} / ${input.genre}

USER BRIEF
${defaultBrief(input)}

TARGET OUTPUT
${input.output}

TONE / TASTE
${input.tone || 'Clear, vivid, witty, emotionally precise, production-minded.'}
${styleProfile}${researchContext}${prize}${plot}${focus}
SOURCE PAGE OR MANUSCRIPT
${sourceExcerpt || '[No source text supplied. Create original material.]'}

${engineRulesForMode(input.mode)}

${CRITIC_PERSONAS}

${AWARD_BAR}

${ARTEFACT_FIRST}

FORMAT RULES
- Novel: title, short logline, then Chapter One prose.
- Non-fiction: title, angle/promise, then opening chapter or section with evidence-led clarity.
- Essay / article: title, hook, then a complete short draft with a clear turn and landing.
- Poetry: title (optional), then the poem or short sequence — compressed, musical, no padding.
- Script: title, premise note, then a properly formatted opening scene.
- Musical/show: title, premise, opening scene, first song title + lyric draft, staging.
- Polish/adaptation: preserve source intent, then produce a stronger award-pass draft.
- Chaos: bold, strange, coherent, and readable.

SELF-CHECK
Silently improve against: hook, scene turn, hidden wound, specificity, pace, subtext, originality, sentence cleanliness.

OUTPUT NOW
Return only the creative material. Do not explain the process.`;
}

export function buildSeedToStoryPrompt(seed: string, mode: NovelWriteProMode): string {
  const nonfiction = mode === 'nonfiction' || mode === 'essay';
  const poetry = mode === 'poetry';
  const invent = poetry
    ? 'Invent a compressed image-led poem premise from a mundane object.'
    : nonfiction
      ? 'Invent a sharp non-fiction angle from a concrete real-world pressure.'
      : 'Invent something strange and literary from a mundane object.';
  const philosophy = poetry
    ? 'Philosophy: every seed contains a poem. Compression beats explanation. Ambition is prize-list clarity.'
    : nonfiction
      ? 'Philosophy: every seed contains an argument or lived investigation. Evidence over invention. Ambition is review-proof clarity.'
      : 'Philosophy: every seed contains a story. A receipt on the floor contains a life. Ambition is always literary prize quality.';

  return `You are Caspa. Turn this thin seed into a prize-ambition project proposal.

SEED
${seed.trim() || invent}

MODE
${mode}

${philosophy}

NONFICTION INTERPRETATION (${nonfiction ? 'ON' : 'OFF'}):
${nonfiction
  ? '- centralWound = the central problem/contradiction the text wrestles with\n- immediateDesire = the immediate question/payoff the reader gets by going on\n- characters = key voices/actors in the case study (author, witnesses, experts), not fictional people\n- chapters = ordered sections (claim blocks) — each must turn.'
  : '- centralWound/immediateDesire keep their fiction meanings; chapters are story beats.'}

GENRE CONSTRAINT:
${nonfiction
  ? '- For nonfiction/essay: set genre to a serious nonfiction label. Prefer one of: Creative Non-Fiction, True Crime, Educational, Manual/Guide, Reference, Memoir, Philosophical, Case Study, Field Guide, Religious Text. Avoid fantasy/sci-fi genre names.'
  : poetry
    ? '- For poetry: set genre to describe the form (e.g., Epic Poetry, Lyric, Sequence, Performance piece). Do not call it a novel.'
    : '- For fiction: set genre to a fiction label (e.g., Literary Fiction, Psychological Thriller, Noir, Speculative Fiction).'}

${engineRulesForMode(mode)}

Return JSON only:
{
  "title": "...",
  "premise": "2-4 sentences",
  "centralWound": "...",
  "immediateDesire": "...",
  "genre": "...",
  "tone": "...",
  "prizeTarget": "inspired-by lens name",
  "chapters": [{"title":"...","turn":"...","endingImage":"..."}],
  "characters": [{"name":"...","role":"...","wound":"...","desire":"...","mask":"..."}],
  "authorQuestions": ["..."],
  "openingImage": "..."
}

Provide 8–12 chapters. Do not write full prose.`;
}

export function buildCutPrompt(excerpt: string, targetReduction = 0.3): string {
  return [
    LITERARY_ENGINE_RULES,
    ARTEFACT_FIRST,
    `Cut ~${Math.round(targetReduction * 100)}% without losing meaning, voice, or scene turns.`,
    'Remove bloat, repetition, ornament, and explanation.',
    'Return revised text only.',
    '',
    excerpt,
  ].join('\n');
}

export function modeTitle(mode: NovelWriteProMode): string {
  switch (mode) {
    case 'nonfiction':
      return 'Non-fiction';
    case 'essay':
      return 'Essay / article';
    case 'poetry':
      return 'Poetry';
    case 'script':
      return 'Script';
    case 'musical':
      return 'Musical / Show';
    case 'adaptation':
      return 'Adaptation';
    case 'polish':
      return 'Polish';
    case 'chaos':
      return 'Surprise Me';
    default:
      return 'Novel';
  }
}
