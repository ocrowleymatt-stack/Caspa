/**
 * Novel Write Pro literary engine — harvested from caspa-studio + Shakespeare.
 * Single source of prize-calibre writing prompts for Caspa.
 */

export type NovelWriteProMode =
  | 'novel'
  | 'nonfiction'
  | 'essay'
  | 'poetry'
  | 'script'
  | 'musical'
  | 'adaptation'
  | 'polish'
  | 'chaos';

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

${LITERARY_ENGINE_RULES}

${CRITIC_PERSONAS}

${AWARD_BAR}

${ARTEFACT_FIRST}

FORMAT RULES
- Novel / fiction: title, short logline, then Chapter One prose.
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

${LITERARY_ENGINE_RULES}

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
      return 'Fiction';
  }
}
