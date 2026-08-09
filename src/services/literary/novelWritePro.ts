/**
 * Caspa writing engine.
 * Structure, continuity, promises and factual integrity are hard constraints; prose is downstream.
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
  plotHoldBlock?: string;
  focusBeat?: string;
  targetWordCount?: number | null;
  sectionWordTarget?: number | null;
  sectionWordMin?: number | null;
  sectionWordMax?: number | null;
  currentManuscriptWords?: number | null;
  remainingBeats?: number | null;
}

export const STRUCTURE_FIRST_CONTRACT = `
CASPA HARD CONTRACT — STRUCTURE BEFORE PROSE
This contract outranks style, beauty, word count and model improvisation.
1. LOCK THE SPINE. Obey the supplied structure/plot hold/argument map. Do not invent a rival book because a new idea seems attractive.
2. PRESERVE CONTINUITY. Before writing, silently reconcile what is already established: chronology, identities, knowledge, causation, terminology, locations, objects, claims and section order.
3. KEEP THREADS ALIVE. Track every unresolved plot thread, argument, question, definition, case study, planted object, relationship, motif and cross-reference that the existing work has made materially relevant.
4. HONOUR PROMISES. Anything the text teaches the reader to expect becomes a debt. Pay it off, deliberately and visibly subvert it, or explicitly remove the setup. Never simply forget it.
5. DO NOT POLISH AROUND A STRUCTURAL FAILURE. Repair missing logic, missing evidence, broken continuity or an unpaid promise before improving sentences.
6. NO AI NONSENSE. Ban generic wisdom, fake profundity, semantic repetition, empty transitions, invented quotations, invented facts, invented citations, fabricated authorities and confident claims unsupported by supplied/verified material.
7. NO LOOPING. Do not repeat an earlier scene, argument, explanation or revelation merely in new wording. New words must add a new turn, consequence, evidence item, complication or payoff.
8. EARN LENGTH. Word-count growth must come from missing substance — scenes, evidence, examples, mechanisms, counterarguments, consequences or pay-offs — never padding.
9. STRUCTURE CHECK BEFORE EXIT. A section is not complete merely because it reads well. It must perform its assigned structural job and leave the manuscript in the correct state for the next section.
`.trim();

export const LITERARY_ENGINE_RULES = `
FICTION / NARRATIVE ENGINE
1. Identify the dramatic engine: wound, desire, betrayal, fear, irony or transformation.
2. Story first, style second. If a sentence is pretty but useless, cut it.
3. Every scene must turn: power, knowledge, danger, intimacy, belief, status or direction changes.
4. Concrete before abstract: behaviour, objects, place and consequence rather than emotion labels.
5. Subtext over declaration. Truth leaks through behaviour.
6. Characters want something immediately; silence still has pressure.
7. Dialogue carries conflict rather than exposition.
8. Endings pay what the chapter set up while opening the next pressure point.
9. Prose hierarchy: structural function → continuity → character truth → clarity → tension → rhythm → beauty → cleverness.
10. Ban filler, vague menace, lore dumps, repeated motifs without transformation and fake profundity.
`.trim();

export const NONFICTION_ENGINE_RULES = `
NON-FICTION ENGINE
1. Identify the intellectual engine: thesis, central question, reader need and the sequence of claims required to answer it.
2. Evidence is structural material. Every substantial factual claim needs support, qualification, an example, a mechanism, a source, or a clearly identified limit.
3. Every section must perform an explicit job: establish → evidence → test/counterpoint → consequence/application → hand-off. Do not write scenes merely because narrative prose sounds attractive.
4. Use narrative technique only where it serves truth: case studies, lived experience, chronology and human testimony. Do not novelise factual material.
5. Prefer plain authoritative exposition, useful headings, definitions, tables, lists, examples and precise cause/effect over cinematic atmosphere.
6. Distinguish fact, interpretation, testimony, inference and recommendation. Never blur them for rhetorical force.
7. Never invent a source, quotation, statistic, study, date, institution or author. If provenance is unavailable, flag the claim for verification rather than laundering it into prose.
8. Preserve the argument ledger: questions raised, claims made, terms defined, evidence promised, case studies opened and conclusions owed.
9. Pay reader promises: if the introduction says the book will explain, compare, demonstrate or provide something, the manuscript must actually do it.
10. Suggest a visual when a diagram, table, timeline, map, chart, decision tree, checklist or annotated figure communicates the material better than another paragraph. Do not add decorative illustration for its own sake.
11. Prose hierarchy: structural function → factual integrity → evidence → clarity → usefulness → rhythm → elegance.
12. Ban fake profundity, motivational padding, theatrical melodrama, unsupported certainty and repetitive summary.
`.trim();

export const POETRY_ENGINE_RULES = `
POETRY ENGINE
1. Compression beats explanation. Image before statement.
2. Every line must turn meaning, music or image — no ornamental drift.
3. Concrete before abstract.
4. Ban filler: if a line can disappear without loss, cut it.
5. Sound is structure: rhythm, silence and repetition as pressure.
6. Pay the poem's own formal and imagistic promises.
`.trim();

export function engineRulesForMode(mode: NovelWriteProMode): string {
  if (mode === 'nonfiction' || mode === 'essay') return NONFICTION_ENGINE_RULES;
  if (mode === 'poetry') return POETRY_ENGINE_RULES;
  return LITERARY_ENGINE_RULES;
}

export const CRITIC_PERSONAS = `
INTERNAL FICTION CRITIC ROOM (run silently before finalising)
- Continuity Editor: chronology, knowledge, causation, established facts and thread survival.
- Promise Auditor: setup/payoff, foreshadowing, planted objects, relationships and unresolved story debts.
- Structural Architect: pacing, arc, scene turns and whether this section performs its assigned job.
- Character Editor: motivation, voice and behavioural continuity.
- Repetition Detective: loops, duplicated revelations, unchanged motifs and semantic rephrasing.
- Sentence Stylist: only after the above pass; rhythm, clarity and decorative bloat.
`.trim();

export const NONFICTION_CRITIC_PERSONAS = `
INTERNAL NON-FICTION EDITORIAL BOARD (run silently before finalising)
- Structure Editor: thesis, section job, argument sequence and hand-off to the next section.
- Evidence Auditor: every important claim, source dependency, missing evidence and unsupported certainty.
- Promise Auditor: questions/explanations/examples/tools promised to the reader and whether they are delivered.
- Fact & Citation Sceptic: invented authorities, fake quotations, dubious dates/statistics and citations without provenance.
- Usefulness Editor: definitions, examples, mechanisms, practical application and whether a visual would explain better.
- Repetition Detective: recycled arguments, duplicate examples and paragraphs that merely restate.
- Copy Editor: only after all above pass; clarity, register and sentence quality.
`.trim();

export function criticRoomForMode(mode: NovelWriteProMode): string {
  return mode === 'nonfiction' || mode === 'essay' ? NONFICTION_CRITIC_PERSONAS : CRITIC_PERSONAS;
}

export const AWARD_BAR = `
QUALITY BAR
- Review-proof work, not fluent filler.
- Structural coherence and fulfilled reader expectations beat decorative cleverness.
- No generic AI fog, semantic looping, abstract ache or empty confidence.
- Beauty may improve good structure; it may never disguise bad structure.
`.trim();

export const NONFICTION_QUALITY_BAR = `
NON-FICTION QUALITY BAR
- Trustworthy enough to interrogate: claims are precise, provenance is visible, limitations are honest.
- Useful enough to publish: the reader can follow the argument and gets what the book promised.
- Designed, not merely narrated: use headings, examples, tables/figures/decision aids where they genuinely clarify.
- Never invent Harvard references. Source metadata must come from an actual source record; otherwise mark verification required.
- No novelistic atmosphere unless it is factual narrative material doing real explanatory work.
`.trim();

export function qualityBarForMode(mode: NovelWriteProMode): string {
  return mode === 'nonfiction' || mode === 'essay' ? NONFICTION_QUALITY_BAR : AWARD_BAR;
}

export const ARTEFACT_FIRST = `
ARTEFACT-FIRST CONTRACT
- Produce the requested artefact first.
- Plans are ingredients, not outputs, unless the user explicitly asked for a plan.
- If improving, return revised text first and notes second.
- If cutting, return cut text before any deletion log.
- No advice instead of artefact. No purple padding.
`.trim();

function truncateSource(sourceText = '', limit = 9000) {
  const clean = sourceText.trim();
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit)}\n\n[Source excerpt truncated for this pass.]` : clean;
}

function defaultBrief(input: NovelWriteProPromptInput) {
  if (input.premise.trim()) return input.premise.trim();
  if (input.uploadedName) return `Improve and develop the uploaded manuscript: ${input.uploadedName}`;
  return 'Invent a fresh original premise and begin immediately.';
}

export function buildAutoWritePrompt(input: NovelWriteProPromptInput): string {
  const sourceExcerpt = truncateSource(input.sourceText);
  const nonfiction = input.mode === 'nonfiction' || input.mode === 'essay';
  const styleProfile = input.styleProfile?.trim() ? `\nSTYLE PROFILE TO HONOUR\n${input.styleProfile.trim()}\n` : '';
  const researchContext = input.researchContext?.trim()
    ? `\nVERIFIED / SUPPLIED RESEARCH CONTEXT\n${input.researchContext.trim()}\n\nUse only facts actually supported here or already established. Never invent missing provenance.\n`
    : '';
  const prize = input.prizeLens?.trim() ? `\nQUALITY LENS\n${input.prizeLens.trim()}\n` : '';
  const plot = input.plotHoldBlock?.trim() ? `\nLOCKED STRUCTURE / CONTINUITY LEDGER\n${input.plotHoldBlock.trim()}\n` : '';
  const focus = input.focusBeat?.trim() ? `\nCURRENT STRUCTURAL JOB\n${input.focusBeat.trim()}\n` : '';
  const sectionTarget = typeof input.sectionWordTarget === 'number' && input.sectionWordTarget > 0 ? Math.round(input.sectionWordTarget) : null;
  const sectionMin = typeof input.sectionWordMin === 'number' && input.sectionWordMin > 0 ? Math.round(input.sectionWordMin) : sectionTarget ? Math.round(sectionTarget * 0.97) : null;
  const sectionMax = typeof input.sectionWordMax === 'number' && input.sectionWordMax > 0 ? Math.round(input.sectionWordMax) : sectionTarget ? Math.round(sectionTarget * 1.05) : null;
  const bookTarget = typeof input.targetWordCount === 'number' && input.targetWordCount > 0 ? Math.round(input.targetWordCount) : null;
  const currentWords = typeof input.currentManuscriptWords === 'number' && input.currentManuscriptWords >= 0 ? Math.round(input.currentManuscriptWords) : null;
  const remainingBeats = typeof input.remainingBeats === 'number' && input.remainingBeats > 0 ? Math.round(input.remainingBeats) : null;

  const lengthBlock = sectionTarget
    ? `\nWORD COUNT CONTRACT (HARD)
- THIS SECTION TARGET: ${sectionTarget.toLocaleString()} words (acceptable ${sectionMin!.toLocaleString()}–${sectionMax!.toLocaleString()}).
${bookTarget ? `- BOOK ASPIRE-TO: ${bookTarget.toLocaleString()} words.` : ''}
${currentWords != null ? `- MANUSCRIPT SO FAR: ${currentWords.toLocaleString()} words.` : ''}
${remainingBeats != null ? `- STRUCTURAL UNITS REMAINING (including this): ${remainingBeats}.` : ''}
- Earn length through missing substance, not repetition or padding.
- Do not stop at a stub, synopsis or partial argument.\n`
    : bookTarget
      ? `\nASPIRE-TO LENGTH\nFinished work target: ~${bookTarget.toLocaleString()} words. Earn the required length through substantive completion.\n`
      : '';

  return `You are Caspa's ${nonfiction ? 'non-fiction editorial and drafting engine' : 'writing engine'}.

${STRUCTURE_FIRST_CONTRACT}

PROJECT TYPE
${input.modeTitle} / ${input.genre}

USER BRIEF
${defaultBrief(input)}

TARGET OUTPUT
${input.output}

TONE / REGISTER
${input.tone || (nonfiction ? 'Authoritative, clear, humane and useful; literary only where it serves truth.' : 'Clear, vivid, emotionally precise and controlled.')}
${styleProfile}${researchContext}${prize}${plot}${focus}${lengthBlock}
SOURCE PAGE OR MANUSCRIPT
${sourceExcerpt || '[No source text supplied.]'}

${engineRulesForMode(input.mode)}

${criticRoomForMode(input.mode)}

${qualityBarForMode(input.mode)}

${ARTEFACT_FIRST}

FORMAT RULES
- Obey the locked structure, current structural job and word-count contract.
- Fiction: write the assigned chapter/scene only; preserve chronology, knowledge, threads and pay-offs.
- Non-fiction: write the assigned section as non-fiction, not disguised fiction. Use factual narrative only when warranted by supplied facts/testimony.
- Non-fiction may include production markers such as [FIGURE SUGGESTION: type | purpose | placement] when a visual materially improves comprehension; do not invent the underlying data.
- Essay/article: argument first; evidence, counterargument and limitation before flourish.
- Script/musical: preserve stageable continuity, dramatic promises and setup/payoff.
- Polish/adaptation: preserve structural intent and continuity; repair before beautifying.

FINAL SILENT GATE — DO NOT SKIP
1. Did this section perform the job assigned by the locked spine?
2. Did I contradict or forget anything already established?
3. Did I abandon a thread or reader promise that becomes due here?
4. Did I invent a fact, quotation, citation, authority, statistic or causal claim?
5. Did I repeat earlier material instead of advancing it?
6. Is any paragraph fluent but structurally useless?
If any answer is bad, repair the section BEFORE returning it.

OUTPUT NOW
Return only the usable artefact. Do not explain the process.`;
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
    ? 'Compression beats explanation.'
    : nonfiction
      ? 'Structure and evidence before prose. The book must make promises it can actually fulfil.'
      : 'Structure and promises before prose. Ambition never excuses continuity failure.';

  return `You are Caspa planning a project. STRUCTURE ONLY — do not write full prose.

${STRUCTURE_FIRST_CONTRACT}

SEED
${seed.trim() || invent}

MODE
${mode}

${philosophy}

${nonfiction ? `NON-FICTION PLANNING RULES
- Build thesis/question → claims → evidence needs → counterarguments → consequences/application.
- Do not use fiction concepts as the organising model merely for drama.
- Identify reader promises explicitly: what the book says it will explain, demonstrate, compare, provide or resolve.
- Identify research/evidence gaps before drafting.
- Propose useful visuals with placement: table, diagram, timeline, map, chart, decision tree, checklist, photograph/annotated image only when justified.
- Each proposed visual needs type, purpose, placementAfter, contentBrief and sourceRequirement.
` : ''}

${engineRulesForMode(mode)}

Return JSON only:
{
  "title": "...",
  "premise": "2-4 sentences",
  "centralWound": "fiction: dramatic wound; nonfiction: central problem/contradiction",
  "immediateDesire": "fiction: desire; nonfiction: reader's immediate question/payoff",
  "genre": "...",
  "tone": "...",
  "prizeTarget": "quality lens",
  "chapters": [{"title":"...","turn":"the structural job/turn","endingImage":"fiction only or blank"}],
  "characters": [{"name":"fiction character OR nonfiction real voice/actor","role":"...","wound":"fiction only or blank","desire":"purpose/interest","mask":"fiction only or blank"}],
  "authorQuestions": ["unresolved structural/research questions"],
  "openingImage": "fiction opening image OR nonfiction opening device",
  "readerPromises": [{"statement":"what the reader is taught to expect","dueBy":"section/chapter or end","type":"plot|character|theme|revelation|evidence|explanation|tool"}],
  "researchNeeds": [{"topic":"...","why":"...","priority":"high|medium|low"}],
  "illustrations": [{"type":"diagram|table|timeline|map|chart|decision-tree|checklist|photo|annotated-image","purpose":"...","placementAfter":"section/heading","contentBrief":"...","sourceRequirement":"..."}]
}

Provide 8–12 structural units unless the requested form clearly needs another number. Do not write full prose.`;
}

export type CutPromptOptions = {
  mode?: NovelWriteProMode;
  targetWordCount?: number | null;
  suggestedReduction?: number;
  cutBrief?: string;
};

export function buildCutPrompt(excerpt: string, opts: CutPromptOptions | number = {}): string {
  const options: CutPromptOptions = typeof opts === 'number' ? { suggestedReduction: opts } : opts || {};
  const mode = options.mode || 'novel';
  const softPct = typeof options.suggestedReduction === 'number' && options.suggestedReduction > 0 ? Math.round(options.suggestedReduction * 100) : null;
  const nonfiction = mode === 'nonfiction' || mode === 'essay';

  return [
    STRUCTURE_FIRST_CONTRACT,
    engineRulesForMode(mode),
    qualityBarForMode(mode),
    ARTEFACT_FIRST,
    options.cutBrief || (softPct
      ? `Strengthen the text. Soft length guide only (~${softPct}% leaner if useful); never cut a structural necessity or promised payoff to hit a percentage.`
      : 'Strengthen the text. Cut only what weakens the product.'),
    nonfiction
      ? 'Keep thesis turns, evidence, counterpoints, definitions, useful examples, honest limits and reader promises. Remove novel-style melodrama and ornamental explanation.'
      : 'Keep structural turns, continuity, character causation and promised pay-offs. Remove repetition, ornament and explanation that does not turn the story.',
    options.targetWordCount ? `Aspire-to finished length: ~${Math.round(options.targetWordCount).toLocaleString()} words.` : '',
    'Return revised text only.',
    '',
    excerpt,
  ].filter(Boolean).join('\n');
}

export function modeTitle(mode: NovelWriteProMode): string {
  switch (mode) {
    case 'nonfiction': return 'Non-fiction';
    case 'essay': return 'Essay / article';
    case 'poetry': return 'Poetry';
    case 'script': return 'Script';
    case 'musical': return 'Musical / Show';
    case 'adaptation': return 'Adaptation';
    case 'polish': return 'Polish';
    case 'chaos': return 'Surprise Me';
    default: return 'Fiction';
  }
}
