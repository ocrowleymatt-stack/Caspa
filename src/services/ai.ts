/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type, GoogleGenAI } from "@google/genai";
import { IntelligenceProvider, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview, SourceMaterial } from "../types";

const GEMINI_API_KEY = 'configured_on_server';
const XAI_API_KEY = 'configured_on_server';
const VENICE_API_KEY = 'configured_on_server';
const CLAUDE_API_KEY = 'configured_on_server';
const OPENAI_API_KEY = 'configured_on_server';

let globalPrimaryProvider: IntelligenceProvider = 'grok';

function safeParseJSON(text: string, fallback: any = {}) {
  try {
    return JSON.parse(text);
  } catch (e) {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
      const startArr = text.indexOf('[');
      const endArr = text.lastIndexOf(']');
      if (startArr !== -1 && endArr !== -1) return JSON.parse(text.slice(startArr, endArr + 1));
    } catch (inner) {
      console.error("Critical JSON Parse Failure:", inner);
    }
    return fallback;
  }
}

const LITERARY_ENGINE_RULES = `
LITERARY ENGINE — STANDING RULES (MASTER COMMAND):
1. Identify real dramatic engine: Find the hidden wound, desire, betrayal, fear, irony, or transformation underneath it.
2. Story first, style second: Prose must serve plot, character, tension, rhythm, or revelation. If a sentence is pretty but useless, cut it.
3. Every scene must TURN: Each scene must change something: power, knowledge, danger, intimacy, belief, status, or direction. If nothing turns, strike it.
4. Concrete before abstract: Prefer objects, gestures, rooms, weather, smells, clothes, silence, and behaviour over explanation. 
5. Subtext is superior: Characters should rarely say exactly what they mean. Let truth leak through behavior.
6. Cut the "Pretty Sludge": Eliminate decorative adjectives and fake profundity. Aim for 40% reduction in first-pass drafts. Be brutal.
7. Tone Dynamics: Use valleys of calm to make the peaks of intensity feel higher. Avoid tone saturation.
8. Imagery of Precision: Use strong imagery sparingly. One perfect "image that bites" beats five decorative ones.
9. Dialogue is Conflict: It must conceal, threaten, seduce, evade, expose, manipulate, wound, bargain, or confess accidentally.
10. Characters must want something immediately: Even in silence, apply pressure through a mask and a pressure point.
11. Endings must be inevitable but surprising. Land on an image that resonates with the character's core wound.
12. Prose Hierarchy: 1. Clarity, 2. Tension, 3. Character truth, 4. Rhythm, 5. Beauty, 6. Cleverness.
13. Default Structural Arc: Hook -> Character under pressure -> Specific setting -> Hidden wound -> Immediate desire -> Obstacle -> Escalation -> Reversal -> Cost -> Image-led ending.
14. Cut Repeated Motifs: A motif is powerful when it returns transformed. If it returns unchanged, reduce or eliminate it. No thematic static.
15. Ban Filler: Avoid vague menace, repeated adjectives, lore dumps, or exposition disguised as dialogue.
16. Characters are Heroes of their own stories: Villains don't think they are evil; they think they are misunderstood or necessary.
17. Make Place a Character: Settings must pressure the story and shape behavior.
18. First lines create tension: Opening image must contain disturbance, threat, or mystery.
19. WORD COUNT PRECISION: All generated drafts must hit the STRICT WORD TARGET stated above. Do NOT exceed it by more than 3%. Do NOT fall below 90% of it. Word count discipline is non-negotiable.
20. PLAN PRIORITIZATION: If a "Structural Plan" or "Instructional Archetype" is provided, those instructions MANDATORY override generic structural rules.
21. STAGED GROWTH SUPREMACY: The DRAFT STAGE and STRICT WORD TARGET stated above OVERRIDE rules 1-20 where they conflict. At Pass 1, lean skeletal prose overrides all calls for sensory depth, imagery, or immersion. The manuscript grows across passes — do not pre-empt later passes by writing at full depth now.
22. NOVEL COHESION OVER EPISODE LOGIC: This is a single unified work, not a collection of short stories. Chapters are NOT self-contained episodes. Do not wrap up tension neatly at the end of a chapter. Carry tension, unresolved conflicts, and continuous action forward into the next beat. You MUST reconcile all narrative lines, character choices, and environmental details with the provided continuity context. If a chapter introduces a tone or fact that contradicts earlier depth, reconcile it immediately.
23. NO BUILD ARTIFACTS: Strike all meta-commentary, placeholders, "To be continued" markers, or formatting artifacts. The output should be ready for absolute publication.
24. RECONCILIATION & SMOOTHING: Actively bridge the gap between chapters. Ensure the "handshake" between the end of the previous chapter and the start of this one is seamless and meaningful.
25. BAN ALL AI GHOSTS & TROPES: STRICTLY FORBIDDEN to use clichés like "a testament to", "tapestry", "dance of", "symphony", "labyrinthine", "palpable", "delving", "intricate", or "navigating the complexities." Be stark, original, and grounded. DO NOT end scenes with summarizing moral philosophies. End scenes abruptly on actions or images, without neatly wrapping up the chapter's "meaning". 
26. NO "MIRRORING" OR "ECHOING": Do not start successive paragraphs with the same sentence structure or the same character name. If paragraph 1 starts with "The street was...", paragraph 2 MUST NOT start with "The sky was...". Rupture the AI's tendency for balanced, rhythmic repetition.
27. STRIP THE "SENTINELS": Delete all introductory phrases like "It was a...", "There were...", "He found himself...". Start with the action or the sensorium directly.
`;

const INSTRUCTIONAL_ENGINE_RULES = `
INSTRUCTIONAL ENGINE — STANDING RULES (MASTER COMMAND):
1. CLARITY & PEDAGOGY FIRST: Your primary goal is to teach, explain, and instruct. Use clear, formal, and accessible language. Do not mix narrative fiction prose into formal explanations.
2. STRUCTURAL LAYOUT: Structure the content logically with clear headings, bullet points, informative callouts, and modular progression.
3. SPACE FOR THE LEARNER: Explicitly design the text as an illustrated/course book. Include structured pauses, 'Notes' sections, exercises, and practical application prompts.
4. VISUAL INTEGRATION: Describe compelling illustrations, diagrams, or page design elements directly in the text (e.g., "[ILLUSTRATION: Diagram of...]") to aid instructional design and create leeway for page layout.
5. NO FICTIONAL NARRATIVE: Do NOT force fictional narrative tropes, "character wounds," subtext, or fictional scenes unless explicitly requested for a case study. Be instructional, authoritative, and direct.
6. TARGET PRECISION: Hit the stated word count. Do not pad with fluff. Keep the instructional momentum high.
`;

const getEngineRules = (type?: string) => {
  if (type && ['coursebook', 'academic', 'cookbook', 'subject_bible'].includes(type)) {
    return INSTRUCTIONAL_ENGINE_RULES;
  }
  return LITERARY_ENGINE_RULES;
};

const SCALPEL_RULES = `
THE SCALPEL — SURGICAL EDITING PROTOCOL (KITCHEN SINK MODE):

You are the "English Teacher from Hell" and a Senior Acquisitions Editor with a deadline and a sharp scalpel. Your goal is to transform "content" into "literature" through brutal excision.

1. REPETITION PURGE (THE ECHO CHAMBER):
   - Actively scan for word echoes: the same noun, adjective, or verb appearing within the same paragraph. Tweak or delete.
   - Look for recurring sentence structures (e.g., Starting 3 sentences in a row with "He..."). Rupture the rhythm.
   - Eliminate "Narrative Static": Ideas or character beats that have already been expressed in the continuity context.

2. WOOLLY PROSE & FILLER INCINERATION:
   - Excise filter words: "seemed to", "felt like", "began to", "realized that", "wondered if". 
   - Incinerate "Hedge Words": "very", "almost", "nearly", "sort of", "rather".
   - Replace abstract emotion labels (He was sad) with concrete behavior or imagery (He kept washing the same glass).

3. ARTIFACT & FORMATTING CLEANSING:
   - STRIKE all build artifacts: "Chapter X", "---", "Draft 1", meta-tags, AI notes, or preamble.
   - Ensure standard, clean Markdown. No decorative symbols.

4. NARRATIVE RECONCILIATION:
   - Smooth the "Handshake": Ensure the start of this text flows perfectly from the end of the previous chapter.
   - Reconcile storylines: If a character is described one way in context, they MUST remain consistent here.
   - This is a JOINED-UP NOVEL, not a short story collection. Link the imagery.

5. SERIES DECOMPRESSION (KITCHEN SINK ONLY):
   - If the ideas are too dense, simplify the prose to let the ideas breathe, or suggest a split point.

6. BAN ALL AI GHOSTS & TROPES:
   - Search and destroy LLM-isms like "a testament to", "tapestry", "dance of", "symphony", "palpable", "delving", "intricate", or "navigating the complexities."
   - DO NOT end scenes with summarizing moral philosophies. Let them bleed.

COMMAND: CUT THE SLUDGE. FIND THE WOUND. MAKE IT BLEED PROSE.
`;

/**
 * Robust AI Caller with prioritized routing
 */
async function callAI(options: { 
  prompt: string; 
  model?: string;
  json?: boolean; 
  schema?: any;
  maxTokens?: number;
  providerOverride?: IntelligenceProvider;
  useSearch?: boolean;
}) {
  try {
    const response = await fetch("/api/ai/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...options,
        primaryProvider: globalPrimaryProvider
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error: any) {
    console.error("AI Proxy Call failed:", error);
    throw error;
  }
}

async function callVeniceImage(prompt: string) {
  try {
    const response = await fetch("/api/ai/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Image API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error: any) {
    console.error("Venice Image Proxy Call failed:", error);
    return null;
  }
}

async function callGrokImage(prompt: string) {
  try {
    const response = await fetch("/api/ai/image-grok", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Grok Image API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error: any) {
    console.error("Grok Image Proxy Call failed:", error);
    return null;
  }
}

const AGENT_PERSONAS = {
  structural: "You are a Structural Architect focused on pacing, arc, narrative tension, and the 'turning' of scenes. Analyze whether every scene justifies its existence.",
  vocal: "You are a Vocal Stylist focused on character voice, distinct prosody, and the subtext of dialogue. Look for 'on-the-nose' speech that needs more shadow.",
  factual: "You are a Factual Critic focused on internal logic, world-building consistency, and anti-hallucination. Identify 'writer shortcuts' and logic gaps.",
  legal: "You are a Senior Legal Counsel. Focus on jurisdictional accuracy, evidence hierarchy, and the precision of claims.",
  academic: "You are a Distinguished Academic. Focus on thesis strength, citation integrity, and methodological rigour.",
  comedy: "You are a Comedy Script Doctor. Focus on setup/payoff, timing, and satirical edge.",
  agent: "You are a Top-Tier Literary Agent. Focus on hook strength, commercial viability, voice clarity, and eliminating 'pretty sludge'.",
  publisher: "You are an Acquisitions Editor. Focus on genre positioning, market fit, and the emotional 'wound' of the work.",
  market: "You are a Book Marketeer. Focus on target demographics and the 'image that bites' for the cover/messaging.",
  reader: "You are a Provocative Beta Reader. Focus on cognitive load, emotional resonance, and momentum. Flag where you get bored.",
  sentence: "You are a Sentence Stylist / Line Editor. Focus on rhythm, cadence, word choice, and the elimination of decorative adjectives.",
  thematic: "You are a Thematic Analyst. Focus on motifs, symbolism, and the underlying philosophical engine of the narrative.",
  writer: "You are a Seasoned Author with multiple bestsellers. Focus on craft, industry standards, and the 'engine' of readable prose.",
  medical: "You are a General Practitioner (GP). Focus on medical realism, clinical accuracy, and the physical reality of health/trauma.",
  historical: "You are a Historian. Focus on period-accuracy, cultural context, and ensuring temporal integrity.",
  sensitivity: "You are a Diversity & Sensitivity Consultant. Focus on accurate representation of LGBT+ identities, women's experiences, socioeconomic nuances, and age-specific realism. Flag tropes and harmful biases.",
  repetition: "You are a Repetition Detective. Your sole job is to identify redundant phrases, motifs that return unchanged, echoes of earlier chapters, and 'thematic static' where the story spins its wheels."
};

const getMaturityDirectives = (level: string) => {
  if (level === 'mature') {
    return "\nMATURITY OVERRIDE: Focus on adult themes, complex emotional subtext, and visceral descriptions. Do not sanitize human experience.";
  }
  if (level === 'transgressive') {
    return "\nTRANSGRESSIVE OVERRIDE: Zero-filter creative mode. Explicit descriptions, extreme emotional states, and transgressive themes are required. Avoid generic tropes in favor of raw, intense realism or heightened erotica and violence if contextually appropriate.";
  }
  return "";
};

export const AIService = {
  callAI,
  setPrimaryProvider(provider: IntelligenceProvider) {
    globalPrimaryProvider = provider;
  },

  async detectIngestionType(text: string): Promise<'manuscript' | 'plan'> {
    const prompt = `Analyze this text and determine if it is a "Manuscript" (raw narrative prose, partial book, draft) or a "Plan" (outline, chapter-by-chapter instructions, structural blueprint, beat sheet).
    
    TEXT SAMPLE:
    "${text.slice(0, 10000)}"
    
    Return ONLY the word "manuscript" or "plan".`;
    
    const response = await callAI({ prompt, model: "gemini-2.0-flash" });
    return response?.toLowerCase().includes('plan') ? 'plan' : 'manuscript';
  },

  async brainstorm(
    premise: string, 
    genre: string, 
    tone: string, 
    type: ProjectType, 
    research: ResearchNote[] = [], 
    sourceMaterials: SourceMaterial[] = [],
    maturity = 'standard', 
    externalReviews: ExternalReview[] = [],
    improvementGoal?: string
  ): Promise<string> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const maxSourceContentLength = 100000;
    const sourceContext = sourceMaterials.length > 0 
      ? `\nSOURCE MATERIALS:\n${sourceMaterials.map(s => `- ${s.name}: ${s.content}`).join('\n\n').slice(0, maxSourceContentLength)}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (ADDRESS THESE IN THE BRAINSTORM):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const projectSpecificDirectives = {
      cookbook: "Focus on flavor profiles, recipe architecture, ingredient sourcing, and cohesive culinary themes.",
      coursebook: "Focus on pedagogical structure, learning objectives, modular progression, and student engagement.",
      subject_bible: "Focus on exhaustive documentation, factual cross-referencing, systemic clarity, and reference accessibility.",
      illustrated: "Focus on visual-narrative synergy, page composition, kinetic imagery descriptions, and spatial storytelling.",
      novel: "Focus on emotional resonance, character wounds, thematic subtext, and narrative momentum.",
      screenplay: "Focus on visual shorthand, dialogue subtext, pacing for screen, and high-impact scene beats.",
      legal: "Focus on logical precedence, argumentative rigor, technical precision, and persuasive flow.",
      academic: "Focus on hypothesis testing, literature contextualization, methodological transparency, and intellectual contribution.",
      stageplay: "Focus on stagecraft, acoustic presence, spatial dynamics, and performative tension.",
      radioplay: "Focus on acoustic atmosphere, sound cues, vocal diversity, and narrative efficiency for audio.",
      experimental: "Focus on boundary-pushing structure and novel metaphors."
    };

    const improvementDirective = improvementGoal 
      ? `\nIMPROVEMENT FOCUS: The user specifically wants to improve the "${improvementGoal}" of this work. Prioritize suggestions that address this lens.`
      : "";

    const prompt = `You are a World-Class Story Architect and Intelligence Orchestrator. 
      Project Type: ${type}
      Genre: ${genre} (IMPORTANT: Anchor ALL suggestions strictly in this genre. Do NOT default to sci-fi unless explicit).
      Tone: ${tone}
      Context: "${premise}"
      
      CORE DIRECTIVE: ${projectSpecificDirectives[type] || projectSpecificDirectives.novel}
      ${improvementDirective}
      
      ${getMaturityDirectives(maturity)}
      ${researchContext}
      ${sourceContext}
      ${reviewContext}
      
      ${getEngineRules(type)}
      
      Provide a sophisticated narrative expansion. Include:
      1. Structural Pivot Points (specific scene ideas that "turn" the story).
      2. Character/Subject Deepening (internal wounds or hidden motivations).
      3. Atmospheric/Thematic Resonance (symbols or sensory motifs unique to the ${genre} setting).
      
      Output should be professional, insightful, and strictly relevant to the provided genre and goal.`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateCharacter(concept: string, type: ProjectType, research: ResearchNote[] = [], maturity = 'standard'): Promise<Character> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH CONTEXT FOR CHARACTERS:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Create a character for a ${type}. Concept: "${concept}". ${getMaturityDirectives(maturity)} ${researchContext}
    IMPORTANT: Always provide a real, appropriate name for this character — a name that fits the genre, setting, and maturity level of the work. Never return a placeholder like "Unknown" or "Character 1".
    Include a detailed 'physicalDescription' that can be used for biometric portrait synthesis. Return as JSON.`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING },
        backstory: { type: Type.STRING },
        traits: { type: Type.ARRAY, items: { type: Type.STRING } },
        goals: { type: Type.ARRAY, items: { type: Type.STRING } },
        fears: { type: Type.ARRAY, items: { type: Type.STRING } },
        motivations: { type: Type.ARRAY, items: { type: Type.STRING } },
        quirks: { type: Type.ARRAY, items: { type: Type.STRING } },
        archetype: { type: Type.STRING },
        physicalDescription: { type: Type.STRING }
      },
      required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype", "physicalDescription"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || "{}");
    return {
      name: (data.name && data.name !== 'Unknown' && data.name !== 'Unknown Character') ? data.name : `${concept.split(' ')[0] || 'Character'}_${Date.now().toString(36)}`,
      role: data.role || 'Supporting',
      backstory: data.backstory || '',
      traits: Array.isArray(data.traits) ? data.traits : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      fears: Array.isArray(data.fears) ? data.fears : [],
      motivations: Array.isArray(data.motivations) ? data.motivations : [],
      quirks: Array.isArray(data.quirks) ? data.quirks : [],
      archetype: data.archetype || 'Unknown',
      id: crypto.randomUUID(),
      updatedAt: Date.now()
    };
  },

  async outlinePlotNodes(project: Project, chapters: Chapter[] = [], research: ResearchNote[] = []): Promise<PlotNode[]> {
    const maxContentLength = 150000;
    const chaptersContext = chapters.map((c: any) => `### Chapter: ${c.title}\n${c.content}`).join('\n\n').slice(0, maxContentLength);
    const sourceContext = (project.sourceMaterials || []).map((s: any) => `### Source [${s.name}]\n${s.content}`).join('\n\n').slice(0, maxContentLength);
    const researchContext = research.length > 0 
      ? `\n=== RESEARCH CONTEXT ===\n${research.map(r => `[${r.title}] (Category: ${r.category || 'General'}): ${r.content}`).join('\n\n')}`
      : "";
    const reviewContext = (project.externalReviews || []).filter(r => !r.isImplemented).length > 0
      ? `\n=== EXTERNAL CRITICAL REVIEWS ===\n${(project.externalReviews || []).filter(r => !r.isImplemented).map(r => `[FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";
    
    const expectedBeats = project.targetWordCount ? Math.min(30, Math.max(5, Math.round(project.targetWordCount / 3000))) : 15;
    let prompt = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create approximately ${expectedBeats} major narrative beats (appropriate for a ~${project.targetWordCount || 75000} word work). ${getMaturityDirectives(project.maturity)}\n\n`;
    prompt += getEngineRules(project.type);
    
    if (chaptersContext || sourceContext || researchContext || reviewContext) {
      prompt += `Analyze ALL of the following materials. 

CRITICAL DIRECTIVE: If there are "AI Brainstorm" or "Structural Plan" notes in the RESEARCH CONTEXT, you MUST base your narrative beats and architecture directly on those specific ideas, structures, and character arcs. The Brainstorm/Research notes override standard defaults. Reconcile them with the existing chapters and source materials.

=== EXISTING MANUSCRIPT/CHAPTERS ===
${chaptersContext}

=== SOURCE MATERIALS ===
${sourceContext}

${researchContext}

=== EXTERNAL FEEDBACK ===
${reviewContext}

Based ONLY on the provided text and strictly following any structural plans found in the RESEARCH CONTEXT, outline the major narrative beats. Return a JSON array of objects.`;
    } else {
      prompt += `Return a JSON array of objects.`;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["title", "description", "type"]
          }
        }
      },
      required: ["nodes"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    let data = safeParseJSON(text || "[]", []);
    
    if (!Array.isArray(data)) {
      data = Array.isArray(data.nodes) ? data.nodes 
           : Array.isArray(data.items) ? data.items 
           : Object.values(data).find(Array.isArray) || [];
    }

    const nodes = (data as any[]).map((d: any, index: number) => ({ 
      id: crypto.randomUUID(),
      title: d.title || 'Untitled Beat',
      description: d.description || '',
      status: 'active' as const,
      type: (['main', 'sub', 'theme'].includes(d.type?.toLowerCase()) ? d.type.toLowerCase() : 'main') as any,
      order: index, 
      updatedAt: Date.now() 
    }));

    return nodes;
  },

  async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[]): Promise<Critique[]> {
    const defaultRoles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition'];
    if (type === 'legal') defaultRoles.push('legal');
    if (type === 'academic') defaultRoles.push('academic');
    if (type === 'experimental' || type === 'screenplay') defaultRoles.push('comedy');

    const roles = customRoles || defaultRoles;

    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const schema = {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["content", "severity", "suggestions"]
    };

    const critiques = [];
    for (const role of roles) {
      const personaNames: Record<string, string> = {
        agent: "Literary Agent",
        publisher: "Acquisitions Editor",
        market: "Book Marketeer",
        buyer: "Retail Buyer",
        reader: "Critical Beta Reader",
        vocal: "Vocal Architect",
        structural: "Structural Architect",
        factual: "Fact Checker",
        legal: "Legal Specialist",
        academic: "Peer Reviewer",
        comedy: "Comedy Doctor",
        sentence: "Sentence Stylist",
        thematic: "Thematic Analyst",
        writer: "Seasoned Author",
        medical: "General Practitioner",
        historical: "Historian",
        sensitivity: "Sensitivity Panel"
      };

      const prompt = `
        ${AGENT_PERSONAS[role as keyof typeof AGENT_PERSONAS]} 
        
        TASK: Perform a high-fidelity, brutal critique of this ${type} draft.
        ${getMaturityDirectives(maturity)} 
        ${sourceContext} 
        
        TEXT TO ANALYZE:
        "${text.slice(0, 10000)}"
        
        CRITERIA:
        1. Identify exactly where the prose loses momentum or character voice falters.
        2. Rank severity objectively (low, medium, high, critical).
        3. Provide 3-5 specific, actionable suggestions for improvement.
        
        Return ONLY valid JSON according to the requested schema.
      `;

      try {
        const responseText = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
        const data = safeParseJSON(responseText || "{}");
        
        const suggestions = Array.isArray(data.suggestions) 
          ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
          : [];

        critiques.push({
          id: crypto.randomUUID(),
          agentName: personaNames[role] || `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`,
          role: role as any,
          content: data.content || "No major issues identified.",
          severity: data.severity || "low",
          suggestions,
          timestamp: Date.now() // Add timestamp for versioning
        } as Critique);
      } catch (err) {
        console.error(`Critique failed for role: ${role}`, err);
      }
      
      // Delay for rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return critiques;
  },

  async writeDraft(title: string, summary: string, context: string, type: ProjectType, activeNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], directives: string[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = [], draftStage?: 1 | 2 | 3 | 4, chapterCount?: number, cutMode?: boolean): Promise<string> {
    const isPlanDriven = directives.length > 0;
    const cutModeDirective = cutMode ? `
      CRITICAL CUT & COMPRESS DIRECTIVE:
      - This is a "KILL YOUR DARLINGS" operation.
      - Actively cut content by 20-40%.
      - DELETE decorative adjectives and redundant descriptions.
      - COMPRESS dialogue for maximum impact and minimum word count.
      - MERGE redundant scenes or character beats.
      - Strike any scene that does not turn the story or reveal essential character wounds.
      - Your output MUST be significantly SHORTER than a standard draft.
    ` : "";

    // ── Staged drafting: Pass percentages 1=10%, 2=25%, 3=75%, 4=100% ──────────
    // If no draftStage is set, default to Pass 1 (lean skeleton) to prevent bloat.

    const PASS_PERCENTAGES = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const PASS_LABELS: Record<number, string> = {
      1: 'Pass 1: Lean Skeleton (Architecture)',
      2: 'Pass 2: Staged Expansion (Interiority)',
      3: 'Pass 3: Full Narrative (Immersion)',
      4: 'Pass 4: Final Polish (Voice)'
    };
    const PASS_INSTRUCTIONS: Record<number, string> = {
      1: 'Focus on scene architecture and skeletal prose. Do not over-expand.',
      2: 'Expand skeletal structure with subtext and character interiority. Add grounding sensory details.',
      3: 'Full narrative reconciliation. Ensure chapters connect seamlessly. Reconcile preceding character arcs. Eliminate narrative echoes.',
      4: 'Final literary polish. Eliminate all repetitive prose or redundant imagery. Smooth every transition. Ensure novel-wide cohesion.'
    };
    const PASS_TASK: Record<number, string> = {
      1: 'Write a SKELETAL FIRST DRAFT of Chapter: "' + title + '". STRICT RULES: Hit every scene beat. Essential dialogue only. No descriptive padding, no sensory flourishes, no internal monologue beyond one line per character. LEAN FUNCTIONAL PROSE only. DO NOT write purple prose. DO NOT write beautifully. Write clearly and structurally. Output must be approximately the STRICT WORD TARGET above.',
      2: 'Write a SECOND PASS EXPANSION of Chapter: "' + title + '". RULES: Expand skeletal structure with subtext and character interiority. Add ONE grounding sensory detail per scene maximum. Strengthen dialogue. Still lean. No decorative adjectives. No lush description. Output must be approximately the STRICT WORD TARGET above.',
      3: 'Write a THIRD PASS COHESIVE NOVEL DRAFT of Chapter: "' + title + '". RULES: Full narrative immersion. RECONCILE this chapter with all preceding context. Ensure character motivations align across the arc. Actively identify and REPLACE any motifs or descriptions that appear in the context. Ensure a seamless "handshake" with the surrounding chapters. Output must be approximately the STRICT WORD TARGET above.',
      4: 'Write the FINAL RECONCILED NOVEL DRAFT of Chapter: "' + title + '". RULES: Every sentence must earn its place. STRIKE all redundant prose, "echoed" descriptions, and formatting artifacts. Ensure absolute novel-wide cohesion. This is a unified book, not an episode. Smoothen all transitions. Output must be approximately the STRICT WORD TARGET above.'
    };

    const effectiveDraftStage: 1 | 2 | 3 | 4 = draftStage || 1;
    const passPercent = PASS_PERCENTAGES[effectiveDraftStage];
    const passLabel   = PASS_LABELS[effectiveDraftStage];
    const passInstr   = PASS_INSTRUCTIONS[effectiveDraftStage];
    const passTask = PASS_TASK[effectiveDraftStage];

    const effectiveChapterCount = chapterCount && chapterCount > 0 ? chapterCount : 25;
    // Always compute a per-chapter target — never fall back to full depth
    const perChapterTarget = projectTargetWords
      ? Math.round((projectTargetWords * passPercent) / effectiveChapterCount)
      : Math.round((50000 * passPercent) / effectiveChapterCount);

    const targetContext = isPlanDriven
      ? `DRAFT STAGE: ${passLabel}
PLAN-DRIVEN DRAFTING: Follow the CRITICAL AUTHOR DIRECTIVES below. Still respect the pass stage — do not write beyond ${passLabel} depth.`
      : `DRAFT STAGE: ${passLabel}
PROJECT SCALE: ${(projectTargetWords || 50000).toLocaleString()} words total across ${effectiveChapterCount} chapters.
STRICT WORD TARGET FOR THIS CHAPTER: ${perChapterTarget!.toLocaleString()} words.
CRITICAL ENFORCEMENT: You must output at least ${Math.round(perChapterTarget! * 0.9).toLocaleString()} words. Do NOT output a short summary.
HOW TO ACHIEVE WORD COUNT: Do not summarize. Unfold the scene beat by beat. Include full dialogue exchanges. Describe the micro-actions between lines of dialogue. Let characters process the moment internally. Slow the pacing down. SHOW, don't summarize.
${passInstr}
STAGED GROWTH ENFORCEMENT: You are writing at ${Math.round(passPercent * 100)}% manuscript depth. Writing beyond this depth is a failure. The manuscript will be expanded in later passes.`;

    const researchContext = research.length > 0 
      ? `\nRESEARCH ARCHIVE (INTEGRATE THESE SENSORY DETAILS):\n${research.map(r => `- ${r.title}: ${r.content} [Sensory: ${JSON.stringify(r.sensoryDetails)}]`).join('\n')}`
      : "";

    const maturityDirective = getMaturityDirectives(maturity);
    const sourceContext = sourceMaterials.map(s => `[SOURCE: ${s.name}]: ${s.content.slice(0, 5000)}`).join('\n\n');
    const authorDirectives = directives.length > 0 ? `\nCRITICAL AUTHOR DIRECTIVES (IMPLEMENT THESE FIXES):\n${directives.map(d => `- ${d}`).join('\n')}` : "";
    
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (IMPLEMENT THESE SPECIFIC SUGGESTIONS/FIXES):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `You are an elite ${type} writer. 
      ${maturityDirective}
      ${targetContext}
      
      ${getEngineRules(type)}
      ${cutModeDirective}
      
      TASK: ${cutMode ? `Redraft and COMPRESS the chapter "${title}" — cut bloat, delete what does not serve the story, and return a tighter, leaner version.` : passTask}
      SCENE OBJECTIVES: ${summary}
      ${authorDirectives}
      ${reviewContext}
      ${researchContext}
      
      STRICT CONTINUITY CONTEXT:
      ${context}

      PLOT BEATS TO INTEGRATE:
      ${activeNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}

      RESEARCH & SOURCE METERIALS:
      ${sourceContext}

      AUTHORIAL DIRECTIVE:
      - Use standard Markdown formatting.
      - Write only the prose. No notes, no meta-commentary.
      - AVOID ECHOES: Do not repeat motifs, imagery, or sentence rhythms present in the continuity text context unless they return transformed.
      - STAGED GROWTH: You are at ${passLabel}. Do NOT write beyond this depth. The manuscript grows across passes.
      - CUT the sludge. If a scene doesn't turn, strike it.
      - NO PURPLE PROSE: Do not write ornate, decorative, or flowery language. Clarity and function over beauty at all pass stages.
      - Find the "winding" of the scene — where the power shifts or the secret leaks — but express it in plain, direct prose.
      - WORD COUNT IS LAW: Output must land within 3% of the STRICT WORD TARGET. Too long = failure. Too short = failure.
      - CHARACTER NAMES IN PROSE: Character names are stored in the library for reference only. In prose, use a character's name only when the narrative naturally calls for it. Characters may be referred to by role, pronoun, relationship, or description throughout. Never force a name into prose as a rule.
    `;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async compileResearch(topic: string, context: string, type: ProjectType, deep = false): Promise<ResearchNote> {
    const prompt = deep ? 
      `You are a Senior Academic Research Assistant and Master Storyteller specialized in ${type}.
       Your objective: Conduct rigorous, search-grounded deep research to produce content suitable for an academic thesis, technical manual, or high-fidelity manuscript reference for the topic: "${topic}".
       
       Context of the work: ${context}
       
       STRICT REQUIREMENTS:
       1. VERIFIABILITY: Base findings on real-world, high-fidelity facts, historical precedent, and verifiable data.
       2. SUBSTANCE: Provide deep analytical insights, niche technical mechanisms, and comprehensive historical/cultural contexts. Do not provide superficial summaries.
       3. SENSORY GROUNDING: Where relevant, anchor these facts with visceral sensory details (sights, sounds, smells, tactile elements) to maintain narrative utility.
       4. GROUNDING: Use your search tool EXTENSIVELY to find real-world references and citations.
       
       Return JSON.` :
      `Research Assistant for a ${type}. Topic: "${topic}". Context: ${context}. Return JSON with "sources" array.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        category: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sources: { type: Type.ARRAY, items: { type: Type.STRING } },
        sensoryDetails: {
          type: Type.OBJECT,
          properties: {
            sounds: { type: Type.ARRAY, items: { type: Type.STRING } },
            smells: { type: Type.ARRAY, items: { type: Type.STRING } },
            textures: { type: Type.ARRAY, items: { type: Type.STRING } },
            visuals: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
      required: ["title", "content", "category", "tags", "sources"]
    };

    const text = await callAI({ 
      prompt, 
      json: true, 
      schema, 
      model: deep ? "gemini-2.0-flash" : "gemini-2.0-flash", // Increased capacity if needed in backend
      useSearch: deep 
    });

    const data = safeParseJSON(text || "{}");
    return { 
      title: data.title || 'Untitled Research',
      content: data.content || 'No content generated.',
      category: data.category || 'general',
      tags: Array.isArray(data.tags) ? data.tags : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      sensoryDetails: data.sensoryDetails,
      isDeepResearch: deep,
      id: crypto.randomUUID(), 
      updatedAt: Date.now() 
    };
  },

  async extractResearchNeeds(text: string, type: ProjectType): Promise<string[]> {
    const prompt = `Analyze this ${type} manuscript segment. 
      Identify 5-8 specific knowledge vectors that require deep research to ensure absolute authority and sensory immersion. 
      Focus on:
      - Technical mechanisms or processes mentioned.
      - Sensory artifacts (sounds, smells, textures of the setting).
      - Historical or cultural context relevant to the scene.
      - Factual assertions that need verification.
      
      PROSE:
      "${text.slice(0, 10000)}"
      
      Return a JSON array of strings (the research topics).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        topics: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["topics"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return Array.isArray(data.topics) ? data.topics : [];
  },

  async brainstormSequel(project: Project, chapters: Chapter[]): Promise<string> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n').slice(-5000);
    const endingContent = chapters[chapters.length - 1]?.content.slice(-2000) || "";

    const prompt = `You are a Top-Tier Publisher and Story Consultant. 
      The manuscript for "${project.title}" (${project.type}) is nearing completion.
      
      FINAL CHAPTER CONTEXT:
      ${endingContent}
      
      STORY ARC SO FAR:
      ${context}
      
      TASK: Suggest a high-concept sequel or the next logical volume in this universe.
      - Find the "open wound" or unresolved tension in the ending.
      - Suggest a sharp, commercial hook for Volume II.
      - Provide a "cliffhanger bridge" that makes the transition inevitable.
      
      Write 200 words of compelling, pitch-like prose.`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async scalpelRefineChunk(context: string, chunk: string, project?: Project): Promise<string> {
    const prompt = `
      ${SCALPEL_RULES}
      
      TASK: Perform a PROSE-LEVEL EDIT on the following text chunk.
      - CRITICAL: MAINTAIN THE EXACT SAME SCENE STRUCTURE AND OVERALL LENGTH. DO NOT SUMMARIZE.
      - DO NOT SKIP OR DELETE PARAGRAPHS. You must return approximately the same word count.
      - CATCH AND TWEAK overused or repetitive phrases (echoes).
      - REWRITE woolly prose and filler into sharp, compelling prose. 
      - STRIP all build artifacts and meta-tags.
      
      PROJECT TYPE: ${project?.type || 'novel'}
      PROJECT TITLE: ${project?.title || 'Unknown'}
      GENRE: ${project?.genre || 'Unknown'}
      
      CONTINUITY CONTEXT:
      ${context}
      
      TEXT TO EDIT:
      "${chunk}"
      
      OUTPUT: Only the refined, tightened, and polished prose. DO NOT summarize. Output the edited content directly. No preamble.
    `;

    const res = await callAI({ prompt, model: "gemini-2.0-flash" });
    return res || chunk; // fallback to original if null
  },

  async scalpelRefine(chapters: Chapter[], focusChapter?: Chapter, project?: Project): Promise<string> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n').slice(-5000);
    const contentToRefine = focusChapter ? focusChapter.content : chapters.map(c => c.content).join('\n\n');
    
    // Chunk content to prevent massive summarization
    const maxChunkSize = 8000; // ~1200 words
    const chunks: string[] = [];
    let currentChunk = "";
    
    const paragraphs = contentToRefine.split('\n');
    for (const p of paragraphs) {
      if (currentChunk.length + p.length > maxChunkSize) {
        if (currentChunk.trim().length > 0) chunks.push(currentChunk);
        currentChunk = p + '\n';
      } else {
        currentChunk += p + '\n';
      }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);

    let refinedContent = "";
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim().length < 50) {
            refinedContent += chunk + '\n';
            continue;
        }
        try {
            const out = await this.scalpelRefineChunk(context, chunk, project);
            // Safety check: if output is less than 50% of input length, it probably summarized. Reject it.
            if (out && out.length < chunk.length * 0.5) {
                console.warn("Scalpel chunk likely summarized (dropped >50%). Reverting to original.");
                refinedContent += chunk + '\n\n';
            } else {
                refinedContent += (out || chunk) + '\n\n';
            }
        } catch (e) {
            console.error("Scalpel refine chunk error", e);
            refinedContent += chunk + '\n\n'; // fallback to original if failed
        }
    }

    return refinedContent.trim();
  },

  async scalpelSeriesAnalysis(project: Project, chapters: Chapter[]): Promise<{ recommendation: string; volumes: { title: string; range: string; reasoning: string }[] }> {
    const context = chapters.map(c => `Chapter ${c.order + 1}: ${c.title}\n${c.summary}`).join('\n\n');
    
    const prompt = `
      ${SCALPEL_RULES}
      
      TASK: Analyze the manuscript structural integrity for "${project.title}".
      Determing if the work is "STUFFED" with too many ideas, arcs, or complexities that could confuse a single-volume reader.
      
      IF the work is too dense, propose "PEELING" it into 2 or 3 separate books/volumes.
      - Identify logical thematic or narrative break points.
      - Provide a "Series Roadmap" that turns this confusion into a trilogy or duology.
      
      MANUSCRIPT ARC:
      ${context}
      
      Return as JSON.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        recommendation: { type: Type.STRING },
        volumes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              range: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["title", "range", "reasoning"]
          }
        }
      },
      required: ["recommendation", "volumes"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    return safeParseJSON(response || "{}");
  },

  async generateNarrativeGraph(
    title: string, 
    genre: string, 
    premise: string, 
    type: ProjectType,
    research: ResearchNote[] = [],
    sourceMaterials: SourceMaterial[] = []
  ): Promise<any> {
    const isNonFiction = ['academic', 'cookbook', 'coursebook', 'essays', 'biography', 'memoir'].includes(type);
    
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const maxSourceContentLength = 100000;
    const sourceContext = sourceMaterials.length > 0 
      ? `\nSOURCE MATERIALS:\n${sourceMaterials.map(s => `- ${s.name}: ${s.content}`).join('\n\n').slice(0, maxSourceContentLength)}`
      : "";

    const prompt = `You are a World-Class ${isNonFiction ? 'Knowledge' : 'Narrative'} Architect. 
      Project: "${title}"
      Genre/Field: ${genre}
      Type: ${type}
      Premise: ${premise}

      ${researchContext}
      ${sourceContext}
      
      TASK: Generate a comprehensive ${isNonFiction ? 'Structural Roadmap' : 'World Intelligence Graph'} for this work.
      ${isNonFiction 
        ? 'Include a highly granular Table of Contents and Research Roadmap for definitive authority.' 
        : 'Include a set of "Foundation Nodes" (Setting/World Bible, Character Motifs, etc.) and specific "Narrative Tracks" (historical textures, cultural artifacts, technical jargon) to ground the fiction.'
      }
      
      Return JSON with "nodes" (title, focus) and "researchTracks" (topic, priority).`;
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              focus: { type: Type.STRING }
            },
            required: ["title", "focus"]
          }
        },
        researchTracks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
            },
            required: ["topic", "priority"]
          }
        }
      },
      required: ["nodes", "researchTracks"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    return safeParseJSON(response || "{}");
  },

  async extractCharacters(chapters: Chapter[], project: Project): Promise<Character[]> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000); // 50k chars is enough for a deep scan
    const currentChars = (project.characters || []).map(c => c.name).join(', ');

    const prompt = `You are a Character Specialist for a ${project.type}. Analyze the provided manuscript text and identify all significant characters. 
      EXCLUDE characters already in the Forge: [${currentChars}].
      
      IMPORTANT: Every character you return MUST have a real, appropriate name from the text. If a character has no name in the text, invent an appropriate one that fits the genre and setting. Never return 'Unknown' or placeholder names.

      For each NEW character found, provide a full profile according to the requested JSON schema.
      Include a 'physicalDescription' based on any textual evidence in the draft.
      Focus on their dramatic engine, role in the story, and sensory details mentioned in the text.

      MANUSCRIPT SAMPLE:
      ${fullText}

      Return as a JSON array within an object: { "characters": [...] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              backstory: { type: Type.STRING },
              traits: { type: Type.ARRAY, items: { type: Type.STRING } },
              goals: { type: Type.ARRAY, items: { type: Type.STRING } },
              fears: { type: Type.ARRAY, items: { type: Type.STRING } },
              motivations: { type: Type.ARRAY, items: { type: Type.STRING } },
              quirks: { type: Type.ARRAY, items: { type: Type.STRING } },
              archetype: { type: Type.STRING },
              physicalDescription: { type: Type.STRING }
            },
            required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype", "physicalDescription"]
          }
        }
      },
      required: ["characters"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || '{"characters":[]}', { characters: [] });
    
    return (data.characters || []).map((char: any) => ({
      ...char,
      id: crypto.randomUUID(),
      updatedAt: Date.now()
    }));
  },

  async analyzeContinuity(nodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] = [], externalReviews: ExternalReview[] = []): Promise<string> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `[${r.title}]: ${r.content}`).join('\n')}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0
      ? `\nEXTERNAL CRITICAL REVIEWS:\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Analyze narrative continuity and structural redundancy between the Plot Nodes, the current Chapter sequence, and critical external feedback.
      ${researchContext}
      ${reviewContext}
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, summary: c.summary, nodes: c.plotNodeIds || [] })))}
      
      TASK:
      1. Identify orphaned nodes and logic gaps.
      2. Identify REPETITION AND REDUNDANCY: Flag chapters that cover the same plot ground or repeat character realizations.
      3. Identify NARRATIVE LOOPING: Where the story spins its wheels without a significant turn.
      
      Format as a professional literary report in Markdown.`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async splitManuscript(fullText: string, type: ProjectType, isPlan = false): Promise<{ title: string; summary: string; marker: string; directives?: string[] }[]> {
    const prompt = isPlan ? 
    `PLAN ARCHITECT: Analyze this structural blueprint/plan for a ${type}.
     Identify the logical chapter divisions described in the plan.
     For each chapter identified in the plan:
     - Generate a Title.
     - Provide a "Directive": The EXACT instructions or beats from the plan that belong to this chapter.
     - Create a Summary of the chapter's intent.
     - Identify a "Marker": the unique phrase starting this section in the plan.
     
     PLAN TEXT:
     ${fullText}
     
     Return as a JSON array of objects: { "chapters": [{ "title": string, "summary": string, "marker": string, "directives": string[] }] }`
    : `STRUCTURAL ARCHITECT: Analyze this raw manuscript of a ${type}. 
  
  Your task is to identify logical chapter boundaries WITHOUT returning the full text.
  1. Detect natural breakpoints (aim for 15-25 chapters if the text is long enough).
  2. For each chapter:
     - Generate a concise, evocative Title.
     - Create a ONE-SENTENCE structural Summary.
     - Identify a "Marker": the PRECISE FIRST 25-30 WORDS that start this chapter. This must be an EXACT substring of the provided manuscript.
  
  RAW MANUSCRIPT:
  ${fullText.slice(0, 800000)}
  
  Return ONLY a JSON array of objects: { "chapters": [{ "title": string, "summary": string, "marker": string }] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              marker: { type: Type.STRING },
              directives: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "marker"]
          }
        }
      },
      required: ["chapters"]
    };

    const text = await callAI({ prompt, json: true, schema, maxTokens: 8192, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return data.chapters || [];
  },

  async finishAndFix(chapters: Chapter[], type: ProjectType, sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const fullText = chapters.map(c => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content}`).join('\n\n');
    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 5000)}`).join('\n\n')}`
      : "";

    const prompt = `You are the Master Editor. Analyze this full ${type} manuscript. 
      Identify every plot hole, character inconsistency, and pacing slump. 
      Then, provide a "Final Fix List" and a proposed "Climactic Resolution" to finish the book.
      
      MANUSCRIPT:\n${fullText.slice(0, 100000)}
      ${sourceContext}`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async automateNextSteps(project: Project, chapters: Chapter[], scanResult?: string): Promise<{ title: string; summary: string; directives: string[] }[]> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n');
    const sourceContext = project.sourceMaterials?.length 
      ? `\nSOURCE CONTEXT:\n${project.sourceMaterials.map(s => `- ${s.name}: ${s.content.slice(0, 2000)}`).join('\n')}`
      : "";

    const scanContext = scanResult ? `\nGLOBAL MANUSCRIPT SCAN FINDINGS (PRIORITY): \n${scanResult}\n` : "";

    const prompt = `Narrative Architect: Generate the next 3 logical chapter beats to bring "${project.title}" (${project.type}) to a satisfying conclusion. 
      
      EXISTING BEATS:
      ${context}
      ${sourceContext}
      ${scanContext}
      
      Return as a JSON array of objects with "title", "summary", and an array of 3-5 "directives" (specific prose instructions) for the author.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        beats: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              directives: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "directives"]
          }
        }
      },
      required: ["beats"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || "[]", []);
    return Array.isArray(data) ? data : (data.beats || data.items || []);
  },

  async transmuteToRadioPlay(project: Project, chapters: Chapter[]): Promise<string> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000);
    const prompt = `You are a BBC Radio 4 Drama Producer specializing in prestige audio drama.
      TASK: Convert the manuscript into a professional Radio Play script adhering to BBC Standard Scripting formats.
      
      CRITICAL FOCUS:
      1. ACOUSTIC WORLD-BUILDING: Every scene MUST begin with a "GRAMS" or "FX" cue that defines the physical space.
      2. ECONOMY OF SPEECH: Dialogue must be rhythmic, subtext-heavy, and stripped of clinical "he said/she said" patterns.
      3. CHARACTER DIFFERENTIATION: Give each voice a distinct acoustic profile (pitch, tempo, cadence).
      4. PACING: Ensure scene transitions are sharp and auditory "cross-fades" are used for narrative momentum.
      
      MANUSCRIPT SAMPLE:
      ${fullText}
      
      OUTPUT FORMAT:
      [SCENE NUMBER]
      [INT/EXT LOCATION - ACOUSTIC DESCRIPTION]
      [GRAMS/FX: Sound cues]
      [CHARACTER NAME]: [Dialogue with performance directions in brackets]`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateCoverPrompt(project: Project, author: string, subtitle: string, basePrompt: string): Promise<string> {
    const prompt = `You are a World-Class Book Cover Designer and Master Prompt Architect. 
      Generate a HIGH-FIDELITY, PRODUCTION-READY prompt for an image generator for "${project.title}".
      
      CONTEXT:
      AUTHOR: ${author}
      SUBTITLE: ${subtitle}
      USER CONCEPT: ${basePrompt}
      GENRE: ${project.genre}
      
      PROMPT ARCHITECTURE:
      - VIBE: Cinematic, moody, hyper-detailed, stunning book cover art.
      - NO TEXT RULE: The image MUST NOT contain any words, letters, text, titles, or author names. You are generating the background art ONLY. Leave negative space (empty areas like skies, dark shadows, or simple textures) where typography will be placed later.
      - STYLE: Avoid 'stock photo' looks. Prefer stylized digital painting, conceptual photography, or striking graphic design based on the genre.
      - COMPOSITION: Law of thirds, strong focal points, atmospheric lighting, clear empty areas for title placement.
      
      OUTPUT ONLY THE FINAL CONCATENATED PROMPT.`;
    
    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateCoverImage(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error("Gemini API key is missing");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          // @ts-ignore
          imageConfig: {
            aspectRatio: "3:4"
          }
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        // @ts-ignore
        if (part.inlineData && part.inlineData.data) {
          // @ts-ignore
          const base64EncodeString = part.inlineData.data;
          // @ts-ignore
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64EncodeString}`;
        }
      }
      
      throw new Error("No image data returned from generator");
    } catch (e: any) {
      console.error("Cover Art Synthesis Failed:", e);
      throw e;
    }
  },

  async generateAudiobookScript(project: Project, chapters: Chapter[]): Promise<string> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000);
    const prompt = `You are a Narrative Director for high-end Audiobook productions (Audible/Penguin Random House).
      TASK: Create an "Economy Mode" Performance Archive for narrators.
      
      ARCHIVE REQUIREMENTS:
      1. EXECUTIVE SUMMARY: A high-fidelity, spoiler-rich summary for the primary narrator to understand the core internal arc.
      2. VOICE MAP: Provide a breakdown of main characters including:
         - Archetype: (e.g., The Wounded Idealist)
         - Vocal Texture: (e.g., Gravelly, sibilant, breathy)
         - Accent/Region: (Specific geographic or class markers)
         - Emotional Baseline: (How they sound when resting)
      3. NARRATIVE BEATS: A condensed version of the story optimized for an "Abridged Classics" style reading.
      
      MANUSCRIPT SAMPLE:
      ${fullText}`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async reconcileChapters(project: Project, plotNodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] = []): Promise<{ title: string; summary: string; plotNodeIds: string[] }[]> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `[${r.title}]: ${r.content}`).join('\n')}`
      : "";

    const reviewContext = (project.externalReviews || []).filter(r => !r.isImplemented).length > 0
      ? `\nEXTERNAL CRITICAL REVIEWS TO RECONCILE:\n${(project.externalReviews || []).filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const expectedChapters = project.targetWordCount ? Math.round(project.targetWordCount / 3000) : 25;

    const prompt = `Narrative Architect: Reconcile the following Plot Nodes with the current Chapter structure for "${project.title}" (${project.type}).
    ${researchContext}
    ${reviewContext}
    
    PLOT NODES:
    ${plotNodes.map(n => `- [${n.id}] ${n.title}: ${n.description}`).join('\n')}
    
    CURRENT CHAPTERS:
    ${chapters.map(c => `- ${c.title}: ${c.summary} (Current Plot Node links: ${(c.plotNodeIds || []).join(', ')})`).join('\n')}
    
    TASK: Harmonize these beats into a tight, non-repetitive manuscript structure. 
    - The target length is ${project.targetWordCount || 75000} words, meaning you should divide this story into approximately ${Math.max(3, expectedChapters)} chapters to give the story enough breathing room.
    - Break scenes and plot nodes across multiple chapters if necessary to allow for deeper interiority and pacing.
    - AVOID DUPLICATION: If two chapters cover the same plot ground or repeat information, merge them immediately.
    - Ensure every chapter has a unique "turn" and contributes new information to the narrative engine.
    - Map each chapter to the most relevant Plot Nodes.

    Return as a JSON object: { "chapters": [{ "title": string, "summary": string, "plotNodeIds": string[] }] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              plotNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "plotNodeIds"]
          }
        }
      },
      required: ["chapters"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return (data.chapters || []).map((c: any) => ({
      ...c,
      plotNodeIds: Array.isArray(c.plotNodeIds) ? c.plotNodeIds : []
    }));
  },

  async deepSimmer(chapter: Chapter, context: string, type: ProjectType, plotNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = [], draftStage?: 1 | 2 | 3 | 4, chapterCount?: number, cutMode?: boolean): Promise<string> {
    const personaMap = {
      novel: "Literary Genius / Prize-Winning Novelist",
      screenplay: "A-List Script Doctor",
      legal: "Senior Partner at a Magic Circle Law Firm",
      academic: "Highly-Cited Research Fellow",
      stageplay: "Tony Award Winning Playwright",
      radioplay: "BBC Audio Drama Lead",
      experimental: "Post-Modernist Maverick",
      subject_bible: "World-Class Narrative Architect",
      cookbook: "Master Gastronome",
      illustrated: "Visual Narrative Specialist",
      coursebook: "Pedagogical Master"
    };

    const PASS_PERCENTAGES = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const currentPass = draftStage || 1;
    const passPercent = PASS_PERCENTAGES[currentPass as keyof typeof PASS_PERCENTAGES];
    const totalChapters = Math.max(1, chapterCount || 25);
    const perChapterTarget = projectTargetWords 
      ? Math.round((projectTargetWords * passPercent) / totalChapters)
      : currentPass === 1 ? 300 : currentPass === 2 ? 800 : currentPass === 3 ? 2000 : 3000;

    const draftStageInfo = draftStage ? `
    DRAFT STAGE: Pass ${currentPass} of 4 (${Math.round(passPercent * 100)}% target depth).
    PER-CHAPTER TARGET: ~${perChapterTarget.toLocaleString()} words.
    CRITICAL ENFORCEMENT: You must output at least ${Math.round(perChapterTarget * 0.9).toLocaleString()} words. Do NOT output a short summary.
    HOW TO ACHIEVE WORD COUNT: Do not summarize. Unfold the scene beat by beat. Include full dialogue exchanges. Describe the micro-actions between lines of dialogue. Let characters process the moment internally. Slow the pacing down. SHOW, don't summarize.
    ` : "";

    const targetContext = projectTargetWords 
      ? `\nPROJECT TARGET SCALE: ~${projectTargetWords.toLocaleString()} words total. 
         STRICT DEPTH DIRECTIVE: For this pass, prioritize a density level of ~${perChapterTarget.toLocaleString()} words.
         ${draftStageInfo}
         Maintain depth and pacing accordingly.`
      : draftStageInfo ? `\n${draftStageInfo}` : "";

    const cutModeDirective = cutMode ? `
      CRITICAL CUT & COMPRESS DIRECTIVE:
      - This is a "KILL YOUR DARLINGS" operation.
      - Actively cut content by 20-40%.
      - DELETE decorative adjectives and redundant descriptions.
      - COMPRESS dialogue for maximum impact and minimum word count.
      - MERGE redundant scenes or character beats.
      - Strike any scene that does not turn the story or reveal essential character wounds.
      - Your output MUST be significantly SHORTER than a standard draft.
    ` : "";

    const stageSpecificDirective = (currentPass === 1 || currentPass === 2)
      ? "\nSTAGED DRAFTING DIRECTIVE: You are in an early PASS. DO NOT over-expand scenes yet. Focus on architecture, skeletal sensory details, and core narrative turns. Keep the prose tight and architectural."
      : "";

    const researchContext = research.length > 0 
      ? `\nIMPACTFUL RESEARCH TO INTEGRATE:\n${research.map(r => `- ${r.title}: ${r.content} [Sensory: ${JSON.stringify(r.sensoryDetails)}]`).join('\n')}`
      : "";

    const nodeContext = plotNodes.length > 0 
      ? `\nINTEGRATE THESE PLOT BEATS WITH MASTERFUL SUBSERVIENCE TO THEME:\n${plotNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}`
      : "";

    const sourceContext = sourceMaterials.length > 0
      ? `\nANCHOR TO THESE SOURCE TRUTHS:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (RESOLVE THESE CONCERNS AND INTEGRATE SUGGESTIONS):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `You are a ${personaMap[type || 'novel']}. 
      TASK: ${cutMode ? 'Redraft and COMPRESS' : 'Elevate the following scene to "Prize-Winning" caliber'}.
      
      ${getEngineRules(type)}
      ${cutModeDirective}
      ${getMaturityDirectives(maturity)}
      ${targetContext}
      ${stageSpecificDirective}
      
      TITLE: "${chapter.title}"
      BRIEF: ${chapter.summary}
      EXISTING CONTENT: ${chapter.content}
      NARRATIVE CONTINUITY: ${context}
      ${researchContext}
      ${nodeContext}
      ${sourceContext}
      ${reviewContext}
      
      AUTHORIAL STANCE:
      - Refine the prose for maximum emotional resonance, clarity, and subtext.
      - Prioritize sharpening and tightening the manuscript.
      - AVOID ECHOES: Do not repeat motifs, imagery, or sentence rhythms present in the continuity text unless they return transformed.
      - Maintain depth appropriate for the project scale without artificial padding.
      - Ensure sensory immersion is absolute.
      - Find the "winding" of the scene—where the power shifts or the secret leaks.
      - Return ONLY the enhanced text. No preamble.`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async assessPrizeWorthiness(project: Project, chapters: Chapter[]): Promise<PrizeAssessment[]> {
    const prizesByProject: Record<string, string[]> = {
      novel: ["The Booker Prize", "The Pulitzer Prize for Fiction", "National Book Award", "Hugo Award", "Women's Prize for Fiction"],
      screenplay: ["Academy Award (Best Original Screenplay)", "Golden Globe for Best Screenplay", "BAFTA Award for Best Original Screenplay", "Sundance Grand Jury Prize"],
      stageplay: ["Tony Award for Best Play", "Pulitzer Prize for Drama", "Laurence Olivier Award"],
      academic: ["Nobel Prize in Literature", "MacArthur Fellowship Concept", "National Book Award for Nonfiction"],
      experimental: ["The Turner Prize (Conceptual)", "Goncourt Prize", "James Tait Black Memorial Prize"],
      legal: ["Grawemeyer Award", "Stockholm Prize in Criminology"],
      radioplay: ["Sony Radio Academy Award", "BBC Audio Drama Award"]
    };

    const relevantPrizes = [...(prizesByProject[project.type] || prizesByProject.novel), "Degree Thesis Classification (Oxon Standards: 1st, 2:1, 2:2, 3rd)"];
    const contentSample = chapters.map(c => `[${c.title}]\n${c.content.slice(0, 800)}`).join('\n\n').slice(0, 6000);

    const prompt = `You are a prestigious literary and cinematic judge. Analyze the following work and assess its potential for the following awards: ${relevantPrizes.join(', ')}.
    Also specify a "targetWordCount" based on industry standards for each prize and project type.

    PROJECT TITLE: ${project.title}
    TYPE: ${project.type}
    PREMISE: ${project.premise}
    TONE/GENRE: ${project.tone} / ${project.genre}

    CONTENT STRATA:
    ${contentSample}

    TASK: For EACH prize, evaluate the project's current trajectory.
    1. eligibilityScore: A number from 0 to 100. This should represent the structural and stylistic alignment with the prize. Be critical but encouraging, so scores in the 30-80% range are common for drafts with potential, avoiding overly pessimistic unattainable numbers.
    2. Format as JSON: { "assessments": [{ "prizeName": string, "eligibilityScore": number, "pros": string[], "cons": string[], "recommendation": string, "targetWordCount": number }] }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        assessments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              prizeName: { type: Type.STRING },
              eligibilityScore: { type: Type.NUMBER },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendation: { type: Type.STRING },
              targetWordCount: { type: Type.NUMBER }
            },
            required: ["prizeName", "eligibilityScore", "pros", "cons", "recommendation", "targetWordCount"]
          }
        }
      },
      required: ["assessments"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return data.assessments || [];
  },
  
  async critique(text: string): Promise<string> {
    const prompt = `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`;
    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async analyzeProse(text: string, type: ProjectType, previousContext: string = "", externalReviews: ExternalReview[] = []): Promise<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }[]> {
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nUNRESOLVED EXTERNAL REVIEWS (CHECK IF PROSE STILL VIOLATES THESE):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `
      You are a brutal Sentence Stylist and Literary Agent. Analyze the following ${type} segment based on these STRICT STANDING RULES:
      
      ${getEngineRules(type)}
      
      TASK: Identify exactly where these rules are violated. 
      ${reviewContext}
      
      CRITICAL FOCUS ON REPETITION & TROPES:
      - AI Ghosts: Flag any LLM-isms ("a testament to", "tapestry", "dance of", "navigating the complexities", "palpable").
      - Echoes: Look for words or sentence structures repeated close together.
      - Narrative Static: Ideas and motifs that have been said before in the provided context but add no new energy.
      - Pretty Sludge: Recursive adjectives, fake profundity, decorative filler.
      - Abstract over Concrete: Vague descriptions of emotions instead of specific gestures/images.
      
      PREVIOUS CONTEXT (SUMMARY OF PRIOR BEATS):
      ${previousContext.slice(-2000)}
      
      TEXT TO ANALYZE:
      "${text.slice(0, 10000)}"
      
      Return a JSON object with a "violations" array. Each violation needs:
      - "type": (e.g. "Echo", "Static", "Sludge", "Abstract", "Subtext")
      - "message": A specific, bitey explanation of the failure.
      - "severity": low, medium, or high.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        violations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              message: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["low", "medium", "high"] }
            },
            required: ["type", "message", "severity"]
          }
        }
      },
      required: ["violations"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return Array.isArray(data.violations) ? data.violations : [];
  },

  async synthesizePortrait(description: string, archetype: string): Promise<string> {
    const prompt = `A highly detailed cinematic character portrait. Subject: ${description}. Vibe: ${archetype || 'Dramatic, noir lighting'}. Style: Professional character photography, realistic textures.`;
    // Use Pollinations as a reliable fallback for on-the-fly image generation in SPA
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
  },

  async synthesizeManuscript(chapters: Chapter[], project: Project): Promise<{ id: string; content: string; illustrationPrompt?: string }[]> {
    // Parallelize synthesis for production speed
    const synthesisPromises = chapters.map(async (chapter) => {
      const prompt = `
        ${SCALPEL_RULES}
        
        PRODUCTION SYNTHESIS PROTOCOL (LITERARY ENGINE MODE):
        You are a Master Production Editor and Elite Art Director. Your task is to perform the FINAL "Synthesis" on this chapter.
        
        CRITICAL DIRECTIVES:
        1. TOTAL PURGE: Remove all drafting remnants, markup ([...], {...}), AI summaries ("In this chapter..."), technical headers (CRITIQUE, REVIEW), and conversational placeholder text.
        2. BOOK-LEADING PROSE: Elevate the language to professional trade publication standards. Lean, musical, and concrete.
        3. STRIP AI GHOSTS: Eliminate "a testament to", "the tapestry of", "shrouded in mystery", and standard AI structural signposts.
        4. UNIFIED NARRATIVE: Ensure the chapter flows without disjointed transitions often caused by iterative drafting.
        5. ART DIRECTION (GROK-STYLE HIGH FIDELITY): Provide a specific, 60-word art direction prompt for a professional book illustrator. It should be cinematic, symbolic, and atmospheric. Return as "illustrationPrompt".
        
        CHAPTER TITLE: "${chapter.title}"
        CHAPTER CONTENT:
        "${chapter.content}"
        
        OUTPUT FORMAT: Return ONLY a JSON object: { "content": string, "illustrationPrompt": string }
      `;
      
      const response = await callAI({ prompt, json: true, model: "gemini-2.0-flash" });
      const data = safeParseJSON(response || "{}");
      
      return { 
        id: chapter.id, 
        content: data.content || chapter.content,
        illustrationPrompt: data.illustrationPrompt
      };
    });
    
    return await Promise.all(synthesisPromises);
  },

  async generateProductionIllustration(prompt: string, style: 'noir' | 'classic' | 'abstract' | 'blueprint' | 'venice' | 'grok' = 'classic'): Promise<string> {
    const stylePrefixes = {
      noir: "Dramatic high-contrast film noir sketch, heavy shadows, gritty ink wash, professional book illustration.",
      classic: "Classical oil painting / lithograph style, rich textures, moody lighting, professional book plate.",
      abstract: "Conceptual abstract expressionist painting, symbolic forms, atmospheric colors, professional book art.",
      blueprint: "Precise technical blueprint sketch, architectural drafting style, clean lines on weathered paper.",
      venice: "Renaissance inspired oil painting, rich pigments, warm candlelight, dramatic chiaroscuro, Masterpiece.",
      grok: "Hyper-modern cybernetic art, clean futuristic lines, energetic composition, high-fidelity digital illustration."
    };

    const finalPrompt = `${stylePrefixes[style]} ${prompt}. Masterpiece, high fidelity, no text.`;
    
    // Check for specific API providers
    if (style === 'venice' && VENICE_API_KEY) {
      const res = await callVeniceImage(finalPrompt);
      if (res) return res;
    }
    
    if (style === 'grok' && XAI_API_KEY) {
      const res = await callGrokImage(finalPrompt);
      if (res) return res;
    }

    // Fallback to Pollinations
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
  },

  async checkSceneTurn(text: string, externalReviews: ExternalReview[] = []): Promise<{ turned: boolean; score: number; reasoning: string; missing: string }> {
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL REVIEW CONTEXT:\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `
      Rule 6: EVERY SCENE MUST TURN.
      Analyze this narrative segment. A scene "turns" when something fundamental changes: power, knowledge, danger, intimacy, belief, status, or direction.
      ${reviewContext}
      
      TEXT:
      "${text.slice(0, 5000)}"
      
      TASK: Determine if the scene turns. Provide a scoring (1-100), detailed reasoning, and what is missing if it doesn't turn.
      Return JSON: { "turned": boolean, "score": number, "reasoning": string, "missing": string }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        turned: { type: Type.BOOLEAN },
        score: { type: Type.NUMBER },
        reasoning: { type: Type.STRING },
        missing: { type: Type.STRING }
      },
      required: ["turned", "score", "reasoning", "missing"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return safeParseJSON(response || "{}");
  },

  async ripUpAndRestart(project: Project, chapters: Chapter[], research: ResearchNote[]): Promise<{ plotNodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] }> {
    const prompt = `
      EXECUTE PROTOCOL: RIP UP AND RESTART.
      
      The current manuscript for "${project.title}" is being liquidated. We are performing a full restructure.
      
      CORE ENGINE: ${project.type} / ${project.genre} / ${project.tone}
      TARGET SCALE: ${project.targetWordCount || 50000} words total.
      
      CURRENT ELEMENTS:
      ${chapters.map(c => `- ${c.title}: ${c.summary}`).join('\n')}
      
      TASK:
      1. Salvage the core dramatic wound and potential.
      2. Construct a high-momentum PLOT LATTICE (15-25 nodes).
      3. Propose a new CHAPTER STRUCTURE (exactly 20-30 chapters) designed to support the ${project.targetWordCount || 50000} word target.
      4. Generate 5 "CREATIVE SOURCES" (Research Notes) that provide deep technical, atmospheric, or philosophical grounding for this specific restructure.
      
      Return JSON: { 
        "plotNodes": [{ "id": string, "title": string, "description": string, "type": "beat"|"reversal"|"climax"|"pinch"|"hook", "order": number }],
        "chapters": [{ "title": string, "summary": string, "plotNodeIds": string[] }],
        "newResearch": [{ "title": string, "content": string, "tags": string[] }]
      }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        plotNodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING },
              order: { type: Type.NUMBER }
            },
            required: ["id", "title", "description", "type", "order"]
          }
        },
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              plotNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "plotNodeIds"]
          }
        },
        newResearch: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "content", "tags"]
          }
        }
      },
      required: ["plotNodes", "chapters", "newResearch"]
    };

    const data = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const result = safeParseJSON(data || "{}");

    return {
      plotNodes: (result.plotNodes || []).map((n: any) => ({ ...n, x: Math.random() * 800, y: Math.random() * 600 })),
      chapters: (result.chapters || []).map((c: any, i: number) => ({
        id: crypto.randomUUID(),
        title: c.title,
        summary: c.summary,
        content: "",
        order: i,
        plotNodeIds: c.plotNodeIds,
        updatedAt: Date.now()
      })),
      research: (result.newResearch || []).map((r: any) => ({
        id: crypto.randomUUID(),
        title: r.title,
        content: r.content,
        tags: r.tags,
        source: 'AI Restructure',
        createdAt: Date.now()
      }))
    };
  }
};

