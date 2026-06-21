/**
 * CreativeEngineCore_Production.ts
 * 
 * PRODUCTION-WIRED Creative Engine
 * Calls real APIs via /api/ai/call (Gemini backend)
 * 
 * All 6 engines now call the server backend for real AI analysis.
 */

import type { Character, ResearchEntry, Project } from './types';

// ============================================================================
// API CLIENT
// ============================================================================

interface AiCallOptions {
  prompt: string;
  model?: string;
  json?: boolean;
  maxTokens?: number;
  useSearch?: boolean;
}

async function callAI(options: AiCallOptions): Promise<string> {
  const response = await fetch('/api/ai/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.result || '';
}

// ============================================================================
// ENGINE 1: SEED LAB
// Transforms raw ideas into full story proposals
// ============================================================================

export interface SeedLabInput {
  idea: string;
  genre?: string;
  targetAudience?: string;
}

export interface SeedLabOutput {
  premise: string;
  mainCharacters: string[];
  thematicAnchors: string[];
  fiveActStructure: string[];
  prizePositioning: string;
  narrativeArc: string;
}

export async function seedToStory(input: SeedLabInput): Promise<SeedLabOutput> {
  const prompt = `You are a world-leading story architect for prize-worthy fiction. Transform this raw idea into a complete story proposal.

IDEA: "${input.idea}"
${input.genre ? `GENRE: ${input.genre}` : ''}
${input.targetAudience ? `AUDIENCE: ${input.targetAudience}` : ''}

Provide a JSON response with:
{
  "premise": "A 2-3 sentence story premise that hooks immediately",
  "mainCharacters": ["Character 1 with core wound/desire", "Character 2...", "Character 3..."],
  "thematicAnchors": ["Theme 1 that resonates emotionally", "Theme 2...", "Theme 3..."],
  "fiveActStructure": [
    "Act 1: Setup & inciting incident",
    "Act 2a: Rising action",
    "Act 2b: Midpoint revelation",
    "Act 3: Rising stakes & climax",
    "Act 4: Resolution & thematic closure"
  ],
  "prizePositioning": "How this story positions for literary prizes (Booker, Pulitzer, National Book Award, etc.)",
  "narrativeArc": "The emotional & character journey from beginning to end"
}

Be bold. Be specific. Show why this story matters.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 2000,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Seed Lab response: ${result}`);
  }
}

// ============================================================================
// ENGINE 2: LITERARY EXCELLENCE ENGINE
// Scores prose on 6 dimensions + prize-worthiness
// ============================================================================

export interface LiteraryAnalysisInput {
  excerpt: string;
  genre?: string;
}

export interface DimensionScore {
  score: number; // 0-10
  feedback: string;
}

export interface LiteraryExcellenceOutput {
  proseQuality: DimensionScore;
  narrativeArc: DimensionScore;
  characterDepth: DimensionScore;
  emotionalResonance: DimensionScore;
  originality: DimensionScore;
  overallComposite: number; // 0-100
  prizeCallibreTier: 'Prize Ready' | 'Strong Commercial' | 'Emerging' | 'Develop Further';
  keyStrengths: string[];
  edgeFeedback: string[];
  nextSteps: string[];
}

export async function analyzeLiteraryExcellence(
  input: LiteraryAnalysisInput
): Promise<LiteraryExcellenceOutput> {
  const prompt = `You are a Booker Prize judge and literary critic evaluating prose for prize-worthiness.

EXCERPT:
"${input.excerpt}"
${input.genre ? `GENRE: ${input.genre}` : ''}

Score this excerpt on 6 dimensions (0-10 each) with honest, specific feedback:

1. **Prose Quality** — Vocabulary, rhythm, sentence structure, language sophistication
2. **Narrative Arc** — Pacing, tension, momentum, structural clarity
3. **Character Depth** — Motivation, psychology, authenticity, growth potential
4. **Emotional Resonance** — Impact, vulnerability, stakes, reader connection
5. **Originality** — Fresh voice, perspective, ideas, departure from convention
6. **Overall Composite** — Holistic prize-worthiness (0-100 scale)

Respond in JSON:
{
  "proseQuality": { "score": 8, "feedback": "..." },
  "narrativeArc": { "score": 7, "feedback": "..." },
  "characterDepth": { "score": 9, "feedback": "..." },
  "emotionalResonance": { "score": 8, "feedback": "..." },
  "originality": { "score": 8, "feedback": "..." },
  "overallComposite": 81,
  "prizeCallibreTier": "Prize Ready",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "edgeFeedback": ["Area to develop 1", "Area to develop 2"],
  "nextSteps": ["Specific edit 1", "Specific edit 2", "Specific edit 3"]
}

Be rigorous. Be honest. Prize-ready means publishable at the highest tier.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 1500,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Literary Excellence response: ${result}`);
  }
}

// ============================================================================
// ENGINE 3: CHARACTER PSYCHE ENGINE
// Deep character depth grounded in psychology
// ============================================================================

export interface CharacterInput {
  name: string;
  role: string;
  backgroundSummary?: string;
  currentChallenge?: string;
}

export interface PsychologicalDimension {
  dimension: string;
  depth: string;
  psychologicalBasis: string;
}

export interface CharacterPsycheOutput {
  attachmentStyle: string;
  traumaAndResilience: PsychologicalDimension;
  coreMotivation: string;
  internalConflict: string;
  growthArc: string[];
  emotionalVulnerabilities: string[];
  strengths: string[];
  psychologyResearch: string[];
  writingGuidance: string;
}

export async function analyzeCharacterPsyche(input: CharacterInput): Promise<CharacterPsycheOutput> {
  const prompt = `You are a clinical psychologist and character development expert. Build psychological depth for this character grounded in real attachment theory, trauma, and resilience science.

CHARACTER:
Name: ${input.name}
Role: ${input.role}
${input.backgroundSummary ? `Background: ${input.backgroundSummary}` : ''}
${input.currentChallenge ? `Current Challenge: ${input.currentChallenge}` : ''}

Provide deep psychological analysis in JSON:
{
  "attachmentStyle": "Secure/Anxious/Avoidant/Fearful-Avoidant (explain why)",
  "traumaAndResilience": {
    "dimension": "Core trauma or wound",
    "depth": "How it shapes behavior, decisions, relationships",
    "psychologicalBasis": "Psychological framework (e.g., Polyvagal Theory, Complex PTSD)"
  },
  "coreMotivation": "What drives this character at the deepest level (not plot-driven)",
  "internalConflict": "The want vs. need (what they think they want vs. what they actually need to heal)",
  "growthArc": [
    "Stage 1: Current state of wounding/denial",
    "Stage 2: First crack in defense",
    "Stage 3: Integration of difficult truth",
    "Stage 4: Behavioral shift rooted in psychology",
    "Stage 5: Earned wisdom (not toxic positivity)"
  ],
  "emotionalVulnerabilities": ["Vulnerability 1", "Vulnerability 2", "Vulnerability 3"],
  "strengths": ["Strength 1 (rooted in resilience)", "Strength 2", "Strength 3"],
  "psychologyResearch": [
    "Research paper or concept 1 that informs this character",
    "Research paper or concept 2",
    "Research paper or concept 3"
  ],
  "writingGuidance": "Specific instruction for how to write this character authentically (internal voice, behavior patterns, what triggers them)"
}

Ground this in real psychology. Avoid cliches. Make vulnerabilities feel earned and realistic.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 1500,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Character Psyche response: ${result}`);
  }
}

// ============================================================================
// ENGINE 4: MULTI-FORMAT DESIGNER
// Transforms manuscript into professional outputs
// ============================================================================

export type OutputFormat =
  | 'literary-novel'
  | 'illustrated-manual'
  | 'training-course'
  | 'subject-bible'
  | 'non-fiction';

export interface MultiFormatInput {
  manuscriptExcerpt: string;
  format: OutputFormat;
  targetAudience?: string;
}

export interface FormatStructure {
  format: OutputFormat;
  tone: string;
  structure: string[];
  audienceCalibration: string;
  designNotes: string[];
}

export async function designMultiFormat(input: MultiFormatInput): Promise<FormatStructure> {
  const formatDescriptions = {
    'literary-novel': 'A prose-first literary fiction publication. Emphasis: character, voice, emotional depth.',
    'illustrated-manual': 'A step-by-step procedural guide with visual integration. Emphasis: clarity, sequential logic, illustrations.',
    'training-course': 'A modular educational curriculum with objectives and assessments. Emphasis: learning outcomes, scaffolding.',
    'subject-bible': 'A comprehensive reference work. Emphasis: indexing, cross-referencing, quick-lookup, authority.',
    'non-fiction': 'A research-integrated narrative. Emphasis: evidence, citations, readability, authority.',
  };

  const prompt = `You are a book designer and publishing expert. Design a professional structure for transforming this manuscript excerpt into a ${input.format}.

MANUSCRIPT EXCERPT:
"${input.manuscriptExcerpt}"

${input.targetAudience ? `TARGET AUDIENCE: ${input.targetAudience}` : ''}

FORMAT BRIEF: ${formatDescriptions[input.format]}

Provide a JSON response with:
{
  "format": "${input.format}",
  "tone": "The voice/tone appropriate for this format (e.g., authoritative, intimate, instructional)",
  "structure": [
    "Section 1 name and purpose",
    "Section 2 name and purpose",
    "Section 3 name and purpose",
    "... (5-7 sections total)"
  ],
  "audienceCalibration": "How to pitch language, depth, and pacing for your target audience",
  "designNotes": [
    "Design principle 1 (layout, typography, visuals)",
    "Design principle 2",
    "Design principle 3",
    "Design principle 4"
  ]
}

Be specific. Show how the content structure changes based on format. Include design thinking.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 1200,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Multi-Format Designer response: ${result}`);
  }
}

// ============================================================================
// ENGINE 5: NON-FICTION ARCHITECT
// Weaves research into compelling narrative
// ============================================================================

export interface NonFictionInput {
  topic: string;
  manuscriptExcerpt?: string;
  researchNotes?: string[];
  authorVoice?: string;
}

export interface NonFictionOutput {
  thesisStatement: string;
  narrativeFramework: string[];
  researchWeaving: string;
  citationArchitecture: string;
  readabilityGuidance: string;
  authorityBuilding: string[];
  nextChapters: string[];
}

export async function architectNonFiction(input: NonFictionInput): Promise<NonFictionOutput> {
  const prompt = `You are a non-fiction architect. Design a research-woven narrative that is both academically rigorous and beautifully readable.

TOPIC: ${input.topic}
${input.manuscriptExcerpt ? `MANUSCRIPT EXCERPT: "${input.manuscriptExcerpt}"` : ''}
${input.researchNotes && input.researchNotes.length > 0 ? `RESEARCH NOTES:\n${input.researchNotes.join('\n')}` : ''}
${input.authorVoice ? `AUTHOR VOICE: ${input.authorVoice}` : ''}

Design a non-fiction architecture in JSON:
{
  "thesisStatement": "A clear, compelling thesis that anchors the entire work",
  "narrativeFramework": [
    "Chapter 1: Hook with story/observation that leads to the question",
    "Chapter 2: Historical/contextual foundation",
    "Chapter 3: Research deep-dive (integrated, not lectured)",
    "Chapter 4: Apply research to reader's life/world",
    "Chapter 5: Counter-arguments and nuance",
    "Chapter 6: Synthesis and implications",
    "Conclusion: Why this matters now"
  ],
  "researchWeaving": "How to integrate citations/evidence into narrative prose without it feeling like a textbook",
  "citationArchitecture": "Recommend endnotes, footnotes, or bibliography? How to structure for credibility and readability?",
  "readabilityGuidance": "Tone, sentence structure, metaphors, pacing for general educated readers",
  "authorityBuilding": [
    "Credibility strategy 1",
    "Credibility strategy 2",
    "Credibility strategy 3"
  ],
  "nextChapters": [
    "Suggested next chapter title & focus",
    "Suggested next chapter title & focus"
  ]
}

Make it practical. Show how to be rigorous without being dry.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 1500,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Non-Fiction Architect response: ${result}`);
  }
}

// ============================================================================
// ENGINE 6: RESEARCH INTEGRATION HUB
// Connects research to all engines
// ============================================================================

export interface ResearchContextInput {
  topic: string;
  researchEntries: ResearchEntry[];
  characters?: Character[];
  useCase: 'character-enrichment' | 'plot-grounding' | 'thematic-depth';
}

export interface ResearchContext {
  relevantSources: Array<{
    source: string;
    relevance: string;
    application: string;
  }>;
  characterResearchLinks: Record<string, string[]>;
  plotElements: string[];
  thematicConnections: string[];
}

export async function integrateResearch(input: ResearchContextInput): Promise<ResearchContext> {
  const researchSummary = input.researchEntries
    .map(
      (r) =>
        `- "${r.title}" (${r.source}): ${r.summary || r.content.substring(0, 200)}`
    )
    .join('\n');

  const characterNames = input.characters?.map((c) => c.name).join(', ') || 'N/A';

  const prompt = `You are a research architect integrating sources into creative writing. Map research to narrative elements.

TOPIC: ${input.topic}
USE CASE: ${input.useCase}
CHARACTERS: ${characterNames}

RESEARCH SOURCES:
${researchSummary}

Respond in JSON:
{
  "relevantSources": [
    { "source": "Source Title", "relevance": "Why this matters for the narrative", "application": "How to use it in the story" },
    ...
  ],
  "characterResearchLinks": {
    "CharacterName": ["Research insight 1", "Research insight 2"]
  },
  "plotElements": [
    "Plot point grounded in research",
    "Plot point grounded in research"
  ],
  "thematicConnections": [
    "Theme connected to research",
    "Theme connected to research"
  ]
}

Be creative. Show how research informs story, not just decorates it.`;

  const result = await callAI({
    prompt,
    model: 'gemini-2.0-flash',
    json: true,
    maxTokens: 1200,
  });

  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse Research Integration response: ${result}`);
  }
}

// ============================================================================
// EXPORT FOR UI
// ============================================================================

export const creativeEngineServices = {
  seedToStory,
  analyzeLiteraryExcellence,
  analyzeCharacterPsyche,
  designMultiFormat,
  architectNonFiction,
  integrateResearch,
};
