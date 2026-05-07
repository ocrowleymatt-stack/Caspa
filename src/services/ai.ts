/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { IntelligenceProvider, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview, SourceMaterial } from "../types";

// Gemini client — reads key from Vite env at call time (never baked in as a literal)
let _geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  // VITE_GEMINI_API_KEY is injected by Vite at build time from the Secrets panel
  // process.env.GEMINI_API_KEY is also checked as a fallback for server-side builds
  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const procKey = (typeof process !== 'undefined') ? (process.env as any)['GEMINI' + '_API_KEY'] : undefined;
  const key = (viteKey && viteKey !== 'undefined' && viteKey.length > 10) ? viteKey
             : (procKey && procKey !== 'undefined' && procKey.length > 10) ? procKey
             : '';
  if (!key) throw new Error('Gemini API key not available — check VITE_GEMINI_API_KEY in Secrets');
  if (!_geminiClient) _geminiClient = new GoogleGenAI({ apiKey: key });
  return _geminiClient;
}
const XAI_API_KEY = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_GROK_API_KEY : undefined;
const CLAUDE_API_KEY = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_ANTHROPIC_API_KEY : undefined;
const OPENAI_API_KEY = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_OPENAI_API_KEY : undefined;

let globalPrimaryProvider: IntelligenceProvider = 'gemini';

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
19. WORD COUNT PRECISION: All generated drafts must respect the structural scale of the project. If a target word count is provided, you must NOT exceed it by more than 3%. Prioritize density, sensory precision, and "show, do not tell" over padding or generic descriptions.
20. PLAN PRIORITIZATION: If a "Structural Plan" or "Instructional Archetype" is provided (outline, beat sheet, specific chapter instructions), those instructions MANDATORY override any default word count targets or generic structural rules. Be subservient to the Plan's specific creative goals.
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
}) {
  const { prompt, model = "gemini-2.0-flash", json = false, schema, maxTokens, providerOverride } = options;
  
  const primary = providerOverride || globalPrimaryProvider;
  
  const providers: IntelligenceProvider[] = [primary];
  ['gemini', 'claude', 'openai', 'grok'].forEach(p => {
    if (p !== primary) providers.push(p as IntelligenceProvider);
  });

  for (const provider of providers) {
    try {
      let result: string | null = null;
      
      switch (provider) {
        case 'gemini':
          result = await callGemini(options);
          break;
        case 'claude':
          result = await callClaude(prompt, json);
          break;
        case 'openai':
          result = await callOpenAI(prompt, json);
          break;
        case 'grok':
          result = await callXAI(prompt, json);
          break;
      }
      
      if (result) return result;
    } catch (error: any) {
      console.warn(`Provider ${provider} failed:`, error.message || error);
      // Continue to next provider in fallback chain
    }
  }

  throw new Error("AI_ROUTING_FAILURE: All configured providers failed to resolve the narrative request.");
}

async function callGemini(options: { 
  prompt: string; 
  model?: string;
  json?: boolean; 
  schema?: any;
  maxTokens?: number;
  useSearch?: boolean;
}) {
  const { prompt, model = "gemini-2.0-flash", json = false, schema, maxTokens, useSearch = false } = options;

  // Resolve model: any model with 'pro' in name → 2.5 Pro, otherwise → 2.0 Flash
  const targetModel = model.includes('pro') ? 'gemini-2.5-pro-preview-05-06' : 'gemini-2.0-flash';

  // Get client lazily — throws immediately with a clear message if key is missing
  const client = getGeminiClient();

  const generationConfig: any = { temperature: 0.7 };

  if (json) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema || { 
      type: Type.OBJECT, 
      properties: { result: { type: Type.STRING } },
      required: ['result']
    };
  }

  if (maxTokens) generationConfig.maxOutputTokens = maxTokens;

  const tools = useSearch ? [{ googleSearch: {} }] : undefined;

  // Let ALL errors throw so callAI fallback chain can handle them properly
  const result = await client.models.generateContent({
    model: targetModel,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { ...generationConfig, tools }
  } as any);

  return result.text || null;
}

async function callOpenAI(prompt: string, json = false) {
  if (!OPENAI_API_KEY) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an elite narrative architect and world-class author." },
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ],
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("OpenAI Error:", err);
      return null;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    console.error("OpenAI Fetch Failure:", e);
    return null;
  }
}

async function callClaude(prompt: string, json = false) {
  if (!CLAUDE_API_KEY) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 4096,
        messages: [
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ],
        ...(json ? {
          system: "You are a world-class author and narrative architect. You only output valid JSON when requested."
        } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Claude Error:", err);
      return null;
    }

    const data = await response.json();
    let content = data.content[0].text;

    if (json && content.startsWith("```")) {
      content = content.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
    }

    return content;
  } catch (e) {
    console.error("Claude Fetch Failure:", e);
    return null;
  }
}

async function callXAI(prompt: string, json = false) {
  if (!XAI_API_KEY) return null;
  
  try {
    // If JSON is requested, ensure the prompt explicitly asks for it
    const enhancedPrompt = json 
      ? `${prompt}\n\nGREAT IMPORTANCE: Your response must be valid JSON ONLY. No markdown wrappers. Just the JSON object/array.`
      : prompt;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { 
            role: "system", 
            content: "You are a professional narrative architect and creative writer. You provide raw, high-fidelity output. You strictly follow formatting instructions, especially JSON requests." 
          },
          { role: "user", content: enhancedPrompt }
        ],
        temperature: 0.8,
        stream: false,
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown fetch error" }));
      console.error("xAI Error:", err);
      return null;
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Clean up markdown wrappers if Grok included them despite instructions
    if (content.startsWith("```")) {
      content = content.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
    }

    return content;
  } catch (e) {
    console.error("xAI Fetch Failure:", e);
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
      
      ${LITERARY_ENGINE_RULES}
      
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
      name: data.name || 'Unknown Character',
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
    
    let prompt = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create between 8 and 18 major narrative beats. ${getMaturityDirectives(project.maturity)}\n\n`;
    prompt += LITERARY_ENGINE_RULES;
    
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

    const critiquePromises = roles.map(async (role) => {
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

      const responseText = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
      const data = safeParseJSON(responseText || "{}");
      
      const suggestions = Array.isArray(data.suggestions) 
        ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
        : [];

      return {
        id: crypto.randomUUID(),
        agentName: personaNames[role] || `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`,
        role: role as any,
        content: data.content || "No major issues identified.",
        severity: data.severity || "low",
        suggestions,
        timestamp: Date.now() // Add timestamp for versioning
      } as Critique;
    });

    return Promise.all(critiquePromises);
  },

  async writeDraft(
    title: string,
    summary: string,
    context: string,
    type: ProjectType,
    activeNodes: PlotNode[],
    research: ResearchNote[] = [],
    maturity = 'standard',
    sourceMaterials: { name: string, content: string }[] = [],
    directives: string[] = [],
    projectTargetWords?: number,
    externalReviews: ExternalReview[] = [],
    draftStage?: 1 | 2 | 3 | 4,
    chapterCount?: number
  ): Promise<string> {
    const personaMap = {
      novel: "Literary Novelist",
      screenplay: "Hollywood Screenwriter (use Fountain industry format)",
      legal: "Senior Counsel (UK/US Jurisdiction awareness)",
      academic: "Principal Investigator (Academic rigour)",
      stageplay: "Dramatist (Blocking and stage directions focus)",
      radioplay: "Audio Drama Producer (SFX and sound focus)",
      experimental: "Avant-garde Author"
    };

    // ── Staged drafting: compute per-chapter word count target ────────────────
    // Pass percentages: 1=10%, 2=25%, 3=75%, 4=100%
    const PASS_PERCENTAGES: Record<number, number> = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const PASS_LABELS: Record<number, string> = {
      1: "FIRST PASS (10% — skeletal prose, scene beats, key dialogue only)",
      2: "SECOND PASS (25% — expanded scenes, richer description, subtext)",
      3: "THIRD PASS (75% — near-final prose, full sensory depth, pacing refined)",
      4: "FOURTH PASS (100% — final polish, every sentence prize-ready)"
    };
    const PASS_INSTRUCTIONS: Record<number, string> = {
      1: "FIRST PASS RULES: Write skeletal prose only. Hit every scene beat. Include key dialogue. No padding. Leave deliberate room for expansion in later passes. Aim for clarity of structure over beauty.",
      2: "SECOND PASS RULES: Expand scenes from the skeletal first pass. Add subtext, interiority, and sensory grounding. Reassess chapter pacing against the overall arc. Strengthen character voice.",
      3: "THIRD PASS RULES: Near-final prose. Full sensory depth. Tighten pacing. Ensure every scene turns. Reassess chapter structure and cut anything that doesn't serve the arc.",
      4: "FOURTH PASS RULES: Final polish. Every sentence must be prize-ready. Cut all sludge. Perfect rhythm and voice. This is the version that goes to the publisher."
    };
    const passPercent = draftStage ? PASS_PERCENTAGES[draftStage] : 1.0;
    const passLabel   = draftStage ? PASS_LABELS[draftStage]    : null;
    const passInstr   = draftStage ? PASS_INSTRUCTIONS[draftStage] : null;
    const effectiveChapterCount = chapterCount && chapterCount > 0 ? chapterCount : 25;
    const perChapterTarget = (projectTargetWords && draftStage)
      ? Math.round((projectTargetWords * passPercent) / effectiveChapterCount)
      : null;

    const isPlanDriven = directives.length > 0;

    const targetContext = (perChapterTarget && !isPlanDriven)
      ? `
         DRAFT STAGE: ${passLabel}
         PROJECT TARGET SCALE: This is part of a larger work aiming for ~${projectTargetWords!.toLocaleString()} words total across ${effectiveChapterCount} chapters.
         STRICT DEPTH DIRECTIVE FOR THIS PASS: You MUST draft this chapter at approximately ${perChapterTarget.toLocaleString()} words.
         WORD LIMIT: Do NOT exceed this target by more than 3%.
         ${passInstr}
         DO NOT rush. Maintain strict word count discipline.`
      : (projectTargetWords && !isPlanDriven)
        ? `\nPROJECT TARGET SCALE: This is part of a larger work aiming for ~${projectTargetWords.toLocaleString()} words. 
           STRICT DEPTH DIRECTIVE: You MUST draft this chapter at approximately ${Math.round(projectTargetWords / 25).toLocaleString()} words. 
           WORD LIMIT: Do NOT exceed this target by more than 3%.
           DO NOT rush. Expand scenes, utilize dialogue, and provide dense sensory descriptions to meet this specific structural volume, but maintain strict word count discipline.
           If the draft is too short, the structural integrity of the project will fail.`
        : isPlanDriven 
          ? `\nPLAN-DRIVEN DRAFTING: Specific chapter directives have been provided. 
             BYPASS generic word count targets. Follow the density and structural instructions within the "CRITICAL AUTHOR DIRECTIVES" section below. 
             Prioritize implementing every beat in the plan over meeting a specific word count.`
          : "";

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
      
      ${LITERARY_ENGINE_RULES}
      
      TASK: Write a full, immersive, and high-fidelity "Prize-Winning" draft for Chapter: "${title}".
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
      - Maintain depth consistent with a ~${projectTargetWords ? projectTargetWords.toLocaleString() : '50,000'} word scale, but prioritize sharpening over padding.
      - CUT the sludge. If a scene doesn't turn, strike it.
      - Show, do not tell. Focus on sensory details, internal monologue, and subtext.
      - Find the "winding" of the scene—where the power shifts or the secret leaks.
    `;

    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
  },

  async compileResearch(topic: string, context: string, type: ProjectType, deep = false): Promise<ResearchNote> {
    const prompt = deep ? 
      `You are a high-fidelity Deep Research Agent for a ${type}. 
       Your goal is to provide granular, visceral research details for the topic: "${topic}".
       Context of the work: ${context}
       
       STRICT REQUIREMENT: Provide detailed sensory information (sounds, smells, textures, visuals) and niche technical/historical facts.
       Use your search tool to find real-world high-fidelity references.
       
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
      model: deep ? "gemini-2.5-pro-preview-05-06" : "gemini-2.0-flash",
      // @ts-ignore - support passing useSearch hiddenly or through options
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

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    return safeParseJSON(response || "{}");
  },

  async extractCharacters(chapters: Chapter[], project: Project): Promise<Character[]> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000); // 50k chars is enough for a deep scan
    const currentChars = (project.characters || []).map(c => c.name).join(', ');

    const prompt = `You are a Character Specialist for a ${project.type}. Analyze the provided manuscript text and identify all significant characters. 
      EXCLUDE characters already in the Forge: [${currentChars}].
      
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
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

     return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
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

    const text = await callAI({ prompt, json: true, schema, maxTokens: 8192, model: "gemini-2.5-pro-preview-05-06" });
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

    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
  },

  async automateNextSteps(project: Project, chapters: Chapter[]): Promise<{ title: string; summary: string }[]> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n');
    const sourceContext = project.sourceMaterials?.length 
      ? `\nSOURCE CONTEXT:\n${project.sourceMaterials.map(s => `- ${s.name}: ${s.content.slice(0, 2000)}`).join('\n')}`
      : "";

    const prompt = `Narrative Architect: Generate the next 3 logical chapter beats to bring "${project.title}" (${project.type}) to a satisfying conclusion. 
      
      EXISTING BEATS:
      ${context}
      ${sourceContext}
      
      Return as a JSON array of objects with "title" and "summary".`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        beats: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING }
            },
            required: ["title", "summary"]
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
      Generate a HIGH-FIDELITY, PRODUCTION-READY prompt for an image generator (DALL-E 3) for "${project.title}".
      
      CONTEXT:
      AUTHOR: ${author}
      SUBTITLE: ${subtitle}
      USER CONCEPT: ${basePrompt}
      GENRE: ${project.genre}
      
      PROMPT ARCHITECTURE:
      - VIBE: Cinematic, moody, hyper-detailed.
      - TEXT ENFORCEMENT: Instruction: "The text on the cover must be perfectly legible. The title '${project.title}' is the hero element. The author name '${author}' should be present at the base. No spelling errors."
      - STYLE: Avoid 'stock photo' looks. Prefer stylized digital painting, conceptual photography, or brutalist graphic design based on the genre.
      - COMPOSITION: Law of thirds, strong focal points, atmospheric lighting.
      
      OUTPUT ONLY THE FINAL CONCATENATED PROMPT.`;
    
    return await callAI({ prompt, model: "gemini-2.0-flash" });
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

    const prompt = `Narrative Architect: Reconcile the following Plot Nodes with the current Chapter structure for "${project.title}" (${project.type}).
    ${researchContext}
    ${reviewContext}
    
    PLOT NODES:
    ${plotNodes.map(n => `- [${n.id}] ${n.title}: ${n.description}`).join('\n')}
    
    CURRENT CHAPTERS:
    ${chapters.map(c => `- ${c.title}: ${c.summary} (Current Plot Node links: ${(c.plotNodeIds || []).join(', ')})`).join('\n')}
    
    TASK: Harmonize these beats into a tight, non-repetitive manuscript structure. 
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

  async deepSimmer(chapter: Chapter, context: string, type: ProjectType, plotNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = [], draftStage?: 1 | 2 | 3 | 4, chapterCount?: number): Promise<string> {
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

    // Stage-aware depth target for Deep Simmer
    const PASS_PERCENTAGES: Record<number, number> = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const PASS_SIMMER_LABELS: Record<number, string> = {
      1: "PASS 1 SIMMER (10%): Tighten skeletal prose. Do NOT expand beyond the pass target. Preserve deliberate gaps.",
      2: "PASS 2 SIMMER (25%): Deepen subtext and sensory grounding. Reassess chapter pacing. Stay within 25% of total target.",
      3: "PASS 3 SIMMER (75%): Near-final polish. Full sensory depth. Tighten pacing. Ensure every scene turns.",
      4: "PASS 4 SIMMER (100%): Final prize-ready polish. Every sentence must earn its place."
    };
    const effectiveChapCount = chapterCount && chapterCount > 0 ? chapterCount : 25;
    const passPercent = draftStage ? PASS_PERCENTAGES[draftStage] : 1.0;
    const perChapterTarget = (projectTargetWords && draftStage)
      ? Math.round((projectTargetWords * passPercent) / effectiveChapCount)
      : null;
    const targetContext = perChapterTarget
      ? `\nDEEP SIMMER STAGE: ${PASS_SIMMER_LABELS[draftStage!]}\nSTRICT DEPTH: Refine to approximately ${perChapterTarget.toLocaleString()} words for this chapter. Do NOT exceed by more than 3%.`
      : projectTargetWords
        ? `\nPROJECT TARGET SCALE: ~${projectTargetWords.toLocaleString()} words total. Maintain depth and pacing accordingly.`
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
      TASK: Elevate the following scene to "Prize-Winning" caliber.
      
      ${LITERARY_ENGINE_RULES}
      ${getMaturityDirectives(maturity)}
      ${targetContext}
      
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

    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
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

    const relevantPrizes = prizesByProject[project.type] || prizesByProject.novel;
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
    
    Format as JSON: { "assessments": [{ "prizeName": string, "eligibilityScore": number, "pros": string[], "cons": string[], "recommendation": string, "targetWordCount": number }] }
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

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    const data = safeParseJSON(response || "{}");
    return data.assessments || [];
  },
  
  async critique(text: string): Promise<string> {
    const prompt = `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`;
    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async analyzeProse(text: string, type: ProjectType, previousContext: string = "", externalReviews: { source: string; content: string; isImplemented?: boolean }[] = []): Promise<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }[]> {
    const prompt = `
      You are a brutal Sentence Stylist and Literary Agent. Analyze the following ${type} segment based on these STRICT STANDING RULES:
      
      ${LITERARY_ENGINE_RULES}
      
      TASK: Identify exactly where these rules are violated. 
      
      CRITICAL FOCUS ON REPETITION:
      - Look for "Echoes": Words or sentence structures repeated close together.
      - Narrative Static: Ideas and motifs that have been said before in the provided context but add no new energy.
      - "Pretty Sludge": Recursive adjectives, fake profundity, decorative filler.
      - Abstract over Concrete: Vague descriptions of emotions instead of specific gestures/images.
      
      PREVIOUS CONTEXT (SUMMARY OF PRIOR BEATS):
      ${previousContext.slice(-2000)}
      ${externalReviews.filter(r => !r.isImplemented).length > 0 ? `\n      UNRESOLVED EXTERNAL REVIEWS (CHECK IF PROSE STILL VIOLATES THESE):\n      ${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}` : ""}
      
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
    const prompt = `A highly detailed cinematic character portrait. 
      Subject: ${description}
      Vibe: ${archetype || 'Dramatic, noir lighting, elite literature quality'}
      Style: Professional character photography, shallow depth of field, realistic textures.`;
    
    //@ts-ignore
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Visual DNA synthesis failed: No image data returned.");
  },

  async checkSceneTurn(text: string, externalReviews: { source: string; content: string; isImplemented?: boolean }[] = []): Promise<{ turned: boolean; score: number; reasoning: string; missing: string }> {
    const prompt = `
      Rule 6: EVERY SCENE MUST TURN.
      Analyze this narrative segment. A scene "turns" when something fundamental changes: power, knowledge, danger, intimacy, belief, status, or direction.
      
      TEXT:
      "${text.slice(0, 5000)}"
      ${externalReviews.filter(r => !r.isImplemented).length > 0 ? `\n      EXTERNAL REVIEW CONTEXT (CHECK IF THESE CONCERNS RELATE TO THE SCENE TURN):\n      ${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}` : ""}
      
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

    const data = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
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

