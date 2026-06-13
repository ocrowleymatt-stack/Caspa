/**
 * CreativeEngineCore.ts
 * 
 * Comprehensive Creative Engine for Caspa
 * Transforms research & seeds into literary works, manuals, training materials, subject bibles
 * 
 * Core layers:
 * 1. SEED INGESTION: Raw input → prize-quality story/project proposal
 * 2. LITERARY EXCELLENCE: Prose quality + prize-worthiness scoring
 * 3. HUMANIZING ENGINE: Research → character psychology + emotional authenticity
 * 4. MULTI-FORMAT OUTPUT: Novel/manual/training material/subject bible generation
 * 5. NON-FICTION ARCHITECT: Research-backed structure + visual layout intelligence
 */

// ─────────────────────────────────────────────────────────────────────────────
// SEED INGESTION: Any idea → collaborative story proposal with prize ambition
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedProposal {
  title: string;
  premise: string;
  genre: string;
  tone: string;
  contentType: 'novel' | 'screenplay' | 'stageplay' | 'illustrated' | 'coursebook' | 'subject_bible' | 'cookbook' | 'non_fiction' | 'training_manual';
  targetWordCount: number;
  logline: string;
  centralWound: string;
  suggestedChapters: { title: string; summary: string }[];
  suggestedCharacters: { name: string; role: string; backstory: string }[];
  authorQuestions: string[];
  prizeTarget: {
    award: string;
    reasoning: string;
    comparableWorks: string[];
  };
}

export async function seedToStory(
  rawSeed: string,
  seedType: 'text' | 'image_ocr' | 'voice_transcript' | 'url' = 'text',
  callAI: (opts: any) => Promise<any>
): Promise<SeedProposal> {
  const prompt = `
YOU ARE A WORLD-CLASS LITERARY EDITOR AND CREATIVE VISIONARY.

A raw seed has been provided. Your job is to find the STORY/PROJECT INSIDE IT — the hidden wound, the dramatic engine, the human truth — and propose a full literary work from it.

SEED TYPE: ${seedType}
RAW SEED:
${rawSeed.slice(0, 8000)}

CRITICAL PHILOSOPHY:
- Every seed contains a story. A receipt on the floor contains a life. A voice note contains a confession. Find it.
- The ambition is ALWAYS literary prize quality or professional/academic excellence.
- Think: Booker Prize, Pulitzer, Costa, National Book Award, Hugo, Nebula.
- For non-fiction: think influential, field-defining, beautiful research design.
- For training materials: think transformative, pedagogically sound, visually compelling.
- Do NOT produce generic output. Find the SPECIFIC, STRANGE, HUMAN truth in this seed.
- The story/project should feel inevitable once revealed — but surprising when proposed.
- Suggest 5 AUTHOR/CREATOR QUESTIONS that unlock the work further.

Return JSON with:
- title: A working title (evocative, not generic)
- premise: 2-3 sentences. The dramatic/conceptual engine. What is at stake and why it matters.
- genre: The primary genre or category
- tone: The tonal register (e.g. "Dry wit, melancholic undertow, Carver-esque restraint" or "Authoritative, accessible, warm")
- contentType: One of: novel|screenplay|stageplay|illustrated|coursebook|subject_bible|cookbook|non_fiction|training_manual
- targetWordCount: Appropriate word count for the type and ambition
- logline: One sentence. The hook.
- centralWound: The hidden wound/central insight at the heart of the work.
- suggestedChapters: Array of 10-20 chapters/sections with title and summary (for all types)
- suggestedCharacters: Array of 3-6 key personas/contributors with name, role, backstory
- authorQuestions: Array of 5 questions to unlock the work further
- prizeTarget: Object with:
  - award: Which literary/professional prize this could realistically target
  - reasoning: Why it fits this award
  - comparableWorks: Array of 2-3 comparable works that target the same prize
`;

  const response = await callAI({
    prompt,
    json: true,
    model: 'gemini-2.5-pro-preview-05-06'
  });

  return typeof response === 'string' ? JSON.parse(response) : response;
}

// ─────────────────────────────────────────────────────────────────────────────
// LITERARY EXCELLENCE ENGINE: Prose quality + prize-worthiness scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface ProseMetrics {
  clarity: number; // 0-100: clarity of expression
  originality: number; // 0-100: uniqueness of voice/perspective
  emotionalResonance: number; // 0-100: impact on reader
  narrativeStrength: number; // 0-100: plot/structure coherence
  characterDepth: number; // 0-100: complexity of characters
  proseQuality: number; // 0-100: beauty of language, style maturity
  overallScore: number; // 0-100: composite literary quality
  prizeWorthinessLevel: 'debut' | 'shortlist' | 'finalist' | 'winner';
  strengthAreas: string[];
  developmentAreas: string[];
  recommendations: string[];
}

export async function scoreProseQuality(
  text: string,
  genre: string,
  callAI: (opts: any) => Promise<any>
): Promise<ProseMetrics> {
  const prompt = `
YOU ARE A LITERARY PRIZE JUDGE WITH 20+ YEARS EXPERIENCE.

You are evaluating prose quality and prize-worthiness. Genre: ${genre}

TEXT TO EVALUATE (first 5000 chars):
${text.slice(0, 5000)}

Rate the following on 0-100 scales:
- clarity: Does the prose express ideas clearly without unnecessary obscuration?
- originality: Is the voice/perspective unique and distinctive?
- emotionalResonance: Does this text move the reader? Does it land emotionally?
- narrativeStrength: Does the story/argument structure feel cohesive and compelling?
- characterDepth: Are characters (human or conceptual) complex and memorable?
- proseQuality: Is the language beautiful, mature, crafted with care?

Provide:
- Individual scores for each dimension
- overallScore: Composite 0-100
- prizeWorthinessLevel: One of: debut|shortlist|finalist|winner
- strengthAreas: Array of 2-3 areas where this text excels
- developmentAreas: Array of 2-3 areas for growth
- recommendations: Array of 3-4 specific craft improvements

Return JSON.
`;

  const response = await callAI({
    prompt,
    json: true,
    model: 'gemini-2.5-pro-preview-05-06'
  });

  return typeof response === 'string' ? JSON.parse(response) : response;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMANIZING ENGINE: Research → Character psychology + emotional authenticity
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterPsychology {
  name: string;
  archetype: string;
  primaryWound: string; // The deepest hurt/fear driving behavior
  defenseMechanism: string; // How they protect themselves
  desireVsNeed: {
    surfaceDesire: string; // What they think they want
    deepNeed: string; // What they actually need
  };
  psychologicalMotivations: string[]; // 3-5 deep psychological drivers
  emotionalArc: {
    startingState: string;
    keyTurningPoints: string[];
    transformationAtEnd: string;
  };
  researchConnections: {
    psychologyPrinciple: string;
    academicSource: string;
    applicationToCharacter: string;
  }[];
  dialogueVoice: {
    speechPatterns: string;
    vocabularyRange: string;
    emotionalTellsAndTics: string;
  };
  actionableInsights: string[]; // Specific ways to write this character authentically
}

export async function humanizeCharacter(
  characterName: string,
  characterBrief: string,
  researchContext: string[], // Array of relevant research findings
  genre: string,
  callAI: (opts: any) => Promise<any>
): Promise<CharacterPsychology> {
  const prompt = `
YOU ARE A PSYCHOLOGIST, CHARACTER COACH, AND MASTER STORYTELLER.

Your job: Take a character concept and deepen it through real psychology, research, and emotional authenticity.

CHARACTER: ${characterName}
BRIEF: ${characterBrief}
GENRE: ${genre}

RELEVANT RESEARCH CONTEXT:
${researchContext.slice(0, 3).join('\n')}

TASK:
Create a deeply human, psychologically authentic character grounded in real psychology research.

Think about:
- What is this character's PRIMARY WOUND? (The deepest hurt/fear from their past)
- What DEFENSE MECHANISMS do they use to protect themselves?
- What do they DESIRE vs. what do they NEED? (Often in conflict)
- What PSYCHOLOGICAL PRINCIPLES apply? (attachment theory, trauma, resilience, etc.)
- How do they TALK? What's their voice? Speech patterns? Verbal tics?
- What's their EMOTIONAL ARC? How do they transform?
- How does RESEARCH context make them more real and specific?

Return JSON with:
- name: Character name
- archetype: Their archetypal role (the Hero, the Mentor, the Shadow, etc.)
- primaryWound: The deepest hurt/fear driving behavior
- defenseMechanism: How they protect themselves psychologically
- desireVsNeed:
  - surfaceDesire: What they think they want
  - deepNeed: What they actually need (often opposite)
- psychologicalMotivations: Array of 3-5 deep psychological drivers
- emotionalArc:
  - startingState: Where they begin emotionally
  - keyTurningPoints: Array of 3-4 moments that shift their psychology
  - transformationAtEnd: How they've changed
- researchConnections: Array of:
  - psychologyPrinciple: e.g., "Attachment Theory" or "Trauma Recovery"
  - academicSource: e.g., "Bessel van der Kolk, The Body Keeps the Score"
  - applicationToCharacter: How this applies specifically
- dialogueVoice:
  - speechPatterns: e.g., "Fragmented, interrupted, trailing off"
  - vocabularyRange: e.g., "High education, but speaks colloquially under stress"
  - emotionalTellsAndTics: e.g., "Says 'actually' when defensive; touches face when lying"
- actionableInsights: Array of 5+ specific, concrete ways to write this character authentically

This character should feel like a real person, grounded in psychology.
`;

  const response = await callAI({
    prompt,
    json: true,
    model: 'gemini-2.5-pro-preview-05-06'
  });

  return typeof response === 'string' ? JSON.parse(response) : response;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-FORMAT OUTPUT ENGINE: Generate novels, manuals, training materials, subject bibles
// ─────────────────────────────────────────────────────────────────────────────

export interface FormatSpecification {
  format: 'novel' | 'illustrated_manual' | 'training_course' | 'subject_bible' | 'cookbook' | 'academic';
  title: string;
  description: string;
  structure: {
    frontMatter: string[];
    mainSections: {
      title: string;
      purpose: string;
      recommendedPageCount: number;
      designElements: string[]; // e.g., "sidebars", "callout boxes", "visual diagrams"
    }[];
    backMatter: string[];
  };
  designRecommendations: {
    interior: 'black_and_white' | 'color' | 'mixed';
    visualDensity: 'text_heavy' | 'moderate' | 'illustration_rich';
    readingLevel: string;
    targetAudience: string;
  };
  outputDeliverables: {
    format: 'pdf' | 'epub' | 'markdown' | 'html' | 'print';
    filename: string;
    description: string;
  }[];
}

export async function generateFormatSpecification(
  title: string,
  contentType: string,
  targetAudience: string,
  sourceResearch: string[],
  callAI: (opts: any) => Promise<any>
): Promise<FormatSpecification> {
  const prompt = `
YOU ARE A PUBLISHING PROFESSIONAL AND INSTRUCTIONAL DESIGNER.

A creative work needs to be structured and designed for its intended format.

TITLE: ${title}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${targetAudience}

KEY RESEARCH CONTEXT:
${sourceResearch.slice(0, 3).join('\n')}

TASK:
Design the complete structure, layout, and production specifications for this work.

For NOVELS: narrative structure, pacing, chapter breaks, emotional beats
For ILLUSTRATED MANUALS: instructional flow, visual support, callout boxes, sidebars
For TRAINING COURSES: learning objectives, module structure, assessment points, interactive elements
For SUBJECT BIBLES: organizational logic, reference sections, index systems, cross-referencing
For COOKBOOKS: recipe organization, ingredient standards, visual styling, tips integration
For ACADEMIC: research structure, citations, methodology sections, appendices

Return JSON with:
- format: The primary output format (novel, illustrated_manual, training_course, subject_bible, cookbook, academic)
- title: The work title
- description: Brief description of the work and its purpose
- structure:
  - frontMatter: Array of front matter sections (title page, preface, TOC, etc.)
  - mainSections: Array of:
    - title: Section name
    - purpose: What this section accomplishes
    - recommendedPageCount: Estimated page count
    - designElements: Array of visual/structural elements to include
  - backMatter: Array of back matter sections (appendix, index, etc.)
- designRecommendations:
  - interior: black_and_white | color | mixed
  - visualDensity: text_heavy | moderate | illustration_rich
  - readingLevel: e.g., "high school" or "graduate level"
  - targetAudience: Demographics and needs
- outputDeliverables: Array of:
  - format: pdf | epub | markdown | html | print
  - filename: Suggested filename
  - description: What this deliverable is

Think about the READER. Make this beautiful and functional.
`;

  const response = await callAI({
    prompt,
    json: true,
    model: 'gemini-2.5-pro-preview-05-06'
  });

  return typeof response === 'string' ? JSON.parse(response) : response;
}

// ─────────────────────────────────────────────────────────────────────────────
// NON-FICTION ARCHITECT: Research-backed structure + visual layout intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface NonFictionArchitecture {
  workingTitle: string;
  thesis: string; // The central argument/insight
  researchFoundation: string; // Why this research matters
  structure: {
    act: number;
    title: string;
    chapters: {
      number: number;
      title: string;
      keyResearchPoints: string[];
      emotionalThrough: string;
      narrativeDevices: string[];
      estimatedWordCount: number;
    }[];
  }[];
  researchIntegration: {
    academicSource: string;
    keyFinding: string;
    chapterApplication: string;
    narrativizationMethod: string; // How to make research feel alive
  }[];
  visualStrategy: {
    element: string; // e.g., "timeline", "map", "infographic"
    purpose: string;
    chapters: number[]; // Which chapters need this
  }[];
  readabilityEnhancements: {
    technique: string; // e.g., "anecdotes", "dialogue", "scene setting"
    frequency: string; // e.g., "once per chapter"
    purpose: string;
  }[];
}

export async function architectNonFiction(
  workingTitle: string,
  topic: string,
  thesis: string,
  researchSources: string[],
  intendedAudience: string,
  callAI: (opts: any) => Promise<any>
): Promise<NonFictionArchitecture> {
  const prompt = `
YOU ARE A NON-FICTION ARCHITECT AND RESEARCH SYNTHESIS MASTER.

Create a comprehensive structure for a non-fiction work that is:
- Research-backed and academically sound
- Beautifully written and narratively compelling
- Visually intelligent (uses diagrams, maps, timelines effectively)
- Deeply engaging for the intended audience

WORKING TITLE: ${workingTitle}
TOPIC: ${topic}
THESIS: ${thesis}
INTENDED AUDIENCE: ${intendedAudience}

KEY RESEARCH SOURCES:
${researchSources.slice(0, 5).join('\n')}

TASK:
Design a 3-act non-fiction structure that:
1. Builds an argument progressively (Act 1: Foundation, Act 2: Complexity, Act 3: Implications)
2. Integrates research seamlessly (not dumped, but woven into narrative)
3. Uses visual elements strategically (timelines, maps, diagrams where they illuminate)
4. Maintains narrative momentum (anecdotes, scene-setting, dialogue where appropriate)
5. Makes complex ideas accessible without dumbing them down

Return JSON with:
- workingTitle: The title
- thesis: The central argument/insight in 1-2 sentences
- researchFoundation: Why this research matters and is urgent now
- structure: Array of acts (1-3) with:
  - act: Act number
  - title: Act title
  - chapters: Array of chapters with:
    - number: Chapter number
    - title: Chapter title
    - keyResearchPoints: Array of 3-5 research findings this chapter conveys
    - emotionalThrough: What emotional journey happens here?
    - narrativeDevices: Array of techniques to use (anecdote, dialogue, scene-setting, etc.)
    - estimatedWordCount: Target word count
- researchIntegration: Array of how key research sources are used:
  - academicSource: The source
  - keyFinding: The specific finding
  - chapterApplication: Which chapter uses this
  - narrativizationMethod: How is it made compelling? (example: story, metaphor, lived experience)
- visualStrategy: Array of visual elements:
  - element: Type (timeline, map, infographic, diagram, etc.)
  - purpose: What does this help the reader understand?
  - chapters: Array of chapter numbers where this appears
- readabilityEnhancements: Array of techniques:
  - technique: The device (anecdotes, dialogue, scene-setting, etc.)
  - frequency: How often (once per chapter, once per section, etc.)
  - purpose: Why this helps readers stay engaged

Make the reader think AND feel. Make complex research come alive.
`;

  const response = await callAI({
    prompt,
    json: true,
    model: 'gemini-2.5-pro-preview-05-06'
  });

  return typeof response === 'string' ? JSON.parse(response) : response;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION HELPER: Combine multiple layers into a comprehensive project brief
// ─────────────────────────────────────────────────────────────────────────────

export interface ComprehensiveProjectBrief {
  seedProposal: SeedProposal;
  literaryMetrics?: ProseMetrics;
  characters: CharacterPsychology[];
  formatSpecification: FormatSpecification;
  nonFictionArchitecture?: NonFictionArchitecture;
  integratedResearch: {
    sources: string[];
    psychologyConnections: string[];
    narrativeApplications: string[];
  };
}

export async function generateComprehensiveProjectBrief(
  seed: SeedProposal,
  researchFindings: string[],
  callAI: (opts: any) => Promise<any>
): Promise<ComprehensiveProjectBrief> {
  // Step 1: Humanize key characters
  const characters: CharacterPsychology[] = [];
  for (const char of seed.suggestedCharacters.slice(0, 3)) {
    const psychology = await humanizeCharacter(
      char.name,
      char.backstory,
      researchFindings,
      seed.genre,
      callAI
    );
    characters.push(psychology);
  }

  // Step 2: Generate format specification
  const formatSpec = await generateFormatSpecification(
    seed.title,
    seed.contentType,
    'Writers & creative professionals',
    researchFindings,
    callAI
  );

  // Step 3: If non-fiction, architect the research structure
  let architecture: NonFictionArchitecture | undefined;
  if (['non_fiction', 'subject_bible', 'coursebook'].includes(seed.contentType)) {
    architecture = await architectNonFiction(
      seed.title,
      seed.genre,
      seed.premise,
      researchFindings,
      'Academic & professional audience',
      callAI
    );
  }

  return {
    seedProposal: seed,
    characters,
    formatSpecification: formatSpec,
    nonFictionArchitecture: architecture,
    integratedResearch: {
      sources: researchFindings,
      psychologyConnections: characters.flatMap(c =>
        c.researchConnections.map(r => r.academicSource)
      ),
      narrativeApplications: characters.flatMap(c => c.actionableInsights)
    }
  };
}
