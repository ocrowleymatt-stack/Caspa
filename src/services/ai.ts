/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { IntelligenceProvider, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const XAI_API_KEY = (import.meta as any).env.VITE_GROK_API_KEY;
const CLAUDE_API_KEY = (import.meta as any).env.VITE_ANTHROPIC_API_KEY;
const OPENAI_API_KEY = (import.meta as any).env.VITE_OPENAI_API_KEY;

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
LITERARY ENGINE — STANDING RULES (CRITICAL):
1. Identify real dramatic engine (hidden wound/desire/fear).
2. Story first, style second. Cut 25-40% of first-pass drafts.
3. Spare imagery. One perfect image beats five.
4. Concrete objects/gestures/smells over abstract explanations.
5. Subtext over declaration. Let truth leak through behaviour.
6. Every scene must TURN (change power/danger/intimacy/status).
7. Characters must WANT something immediately.
8. Villains are heroes of their own stories; martyrs or saviours.
9. Dialogue must carry CONFLICT (threaten, evade, manipulate).
10. Avoid emotion labels. Show physical/behavioural evidence.
11. Escalate danger/moral cost/uncertainty every chapter.
12. Preserve mystery. Do not explain too early.
13. Cut repeated motifs unless transformed.
14. Make place a character that pressures the story.
15. First lines must create tension/disturbance.
16. CLARIFY GENRE: Maintain a single dominant narrative spine.
17. FICTIONALISE properly: Remove all real-world legal ambiguity.
18. Avoid TONE SATURATION. Dynamic range is mandatory.
19. No sludge. No padding. No cowardice. Authorize the AI to cut redundant or weak prose aggressively.
20. ENDINGS must be inevitable but surprising. End on an image that bites.
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
  const { prompt, model = "gemini-flash-latest", json = false, schema, maxTokens, providerOverride } = options;
  
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
  const { prompt, model = "gemini-flash-latest", json = false, schema, maxTokens, useSearch = false } = options;

  try {
    const targetModel = model.includes("pro") ? "gemini-3.1-pro-preview" : "gemini-flash-latest";
    const generationConfig: any = { temperature: 0.7 };

    if (json) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = schema || { 
        type: Type.OBJECT, 
        properties: { result: { type: Type.STRING } },
        required: ["result"]
      };
    }

    if (maxTokens) generationConfig.maxOutputTokens = maxTokens;

    const tools = useSearch ? [{ googleSearch: {} }] : undefined;

    const result = await ai.models.generateContent({
      model: targetModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        ...generationConfig,
        tools
      }
    } as any);

    return result.text || null;
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes("429") || errorMsg.includes("403") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("safety")) {
      throw error; // Re-throw to trigger fallback
    }
    console.error("Gemini Internal Error:", error);
    return null;
  }
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
  sensitivity: "You are a Diversity & Sensitivity Consultant. Focus on accurate representation of LGBT+ identities, women's experiences, socioeconomic nuances, and age-specific realism. Flag tropes and harmful biases."
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
  async brainstorm(premise: string, genre: string, tone: string, type: ProjectType, research: ResearchNote[] = [], maturity = 'standard', externalReviews: ExternalReview[] = []): Promise<string> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
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
      radioplay: "Focus on acoustic atmosphere, sound cues, vocal diversity, and narrative efficiency for audio."
    };

    const prompt = `You are the Central Orchestrator of a synthetic writer's room. 
      Project Type: ${type}
      Genre: ${genre}
      Tone: ${tone}
      Initial Premise: "${premise}"
      
      SPECIFIC DIRECTIVE: ${projectSpecificDirectives[type] || projectSpecificDirectives.novel}
      
      ${getMaturityDirectives(maturity)}
      ${researchContext}
      ${reviewContext}
      
      ${LITERARY_ENGINE_RULES}
      
      Provide a multi-faceted expansion including structural milestones, character/subject archetypes, and thematic escalation.`;

    return await callAI({ prompt, model: "gemini-flash-latest" });
  },

  async generateCharacter(concept: string, type: ProjectType, research: ResearchNote[] = [], maturity = 'standard'): Promise<Character> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH CONTEXT FOR CHARACTERS:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Create a character for a ${type}. Concept: "${concept}". ${getMaturityDirectives(maturity)} ${researchContext} Return as JSON.`;
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
        archetype: { type: Type.STRING }
      },
      required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-flash-latest" });
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
      ? `\n=== RESEARCH CONTEXT ===\n${research.map(r => `[${r.title}]: ${r.content}`).join('\n')}`
      : "";
    const reviewContext = (project.externalReviews || []).filter(r => !r.isImplemented).length > 0
      ? `\n=== EXTERNAL CRITICAL REVIEWS ===\n${(project.externalReviews || []).filter(r => !r.isImplemented).map(r => `[FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";
    
    let prompt = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create between 8 and 18 major narrative beats. ${getMaturityDirectives(project.maturity)}\n\n`;
    prompt += LITERARY_ENGINE_RULES;
    
    if (chaptersContext || sourceContext || researchContext || reviewContext) {
      prompt += `Analyze ALL of the following materials. YOU MUST draw characters, events, and thematic arcs directly from this text to construct the structural plot beats. Resolve any active critical reviews.

=== EXISTING MANUSCRIPT/CHAPTERS ===
${chaptersContext}

=== SOURCE MATERIALS ===
${sourceContext}
${researchContext}

=== EXTERNAL FEEDBACK ===
${reviewContext}

Based ONLY on the provided text, outline the major narrative beats. Return a JSON array of objects.`;
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview" });
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
    const defaultRoles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'medical', 'historical', 'sensitivity'];
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

      const responseText = await callAI({ prompt, json: true, schema, model: "gemini-flash-latest" });
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

  async writeDraft(title: string, summary: string, context: string, type: ProjectType, activeNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], directives: string[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = []): Promise<string> {
    const personaMap = {
      novel: "Literary Novelist",
      screenplay: "Hollywood Screenwriter (use Fountain industry format)",
      legal: "Senior Counsel (UK/US Jurisdiction awareness)",
      academic: "Principal Investigator (Academic rigour)",
      stageplay: "Dramatist (Blocking and stage directions focus)",
      radioplay: "Audio Drama Producer (SFX and sound focus)",
      experimental: "Avant-garde Author"
    };

    const targetContext = projectTargetWords 
      ? `\nPROJECT TARGET SCALE: This is part of a larger work aiming for ~${projectTargetWords.toLocaleString()} words. 
         CALCULATED CHAPTER DEPTH: Aim for approximately 2,000 - 3,500 words for this section to maintain the necessary structural density for the target scale. 
         Avoid compression; use sensory detail and dialogue to expand the momentum.`
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
      
      TASK: Write a full, immersive, and high-fidelity draft for Chapter: "${title}".
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
      - Maintain depth consistent with a ~${projectTargetWords ? projectTargetWords.toLocaleString() : '50,000'} word scale, but prioritize sharpening over padding.
      - CUT the sludge. If a scene doesn't turn, strike it.
      - Show, do not tell. Focus on sensory details and internal monologue.
    `;

    return await callAI({ prompt, model: "gemini-3.1-pro-preview" });
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
      model: deep ? "gemini-3.1-pro-preview" : "gemini-flash-latest",
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

    const response = await callAI({ prompt, json: true, schema, model: "gemini-flash-latest" });
    const data = safeParseJSON(response || "{}");
    return Array.isArray(data.topics) ? data.topics : [];
  },

  async generateArchitecture(title: string, genre: string, premise: string): Promise<any> {
    const prompt = `You are a World-Class Non-Fiction Structuring Agent. 
      Project: "${title}"
      Genre/Field: ${genre}
      Premise: ${premise}
      
      Generate a comprehensive Table of Contents and Research Roadmap for a definitive non-fiction work.
      Return JSON with "chapters" (title, focus) and "researchTracks" (topic, priority).`;
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        chapters: {
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
      required: ["chapters", "researchTracks"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-3.1-pro-preview" });
    return safeParseJSON(response || "{}");
  },

  async extractCharacters(chapters: Chapter[], project: Project): Promise<Character[]> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000); // 50k chars is enough for a deep scan
    const currentChars = (project.characters || []).map(c => c.name).join(', ');

    const prompt = `You are a Character Specialist for a ${project.type}. Analyze the provided manuscript text and identify all significant characters. 
      EXCLUDE characters already in the Forge: [${currentChars}].
      
      For each NEW character found, provide a full profile according to the requested JSON schema.
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
              archetype: { type: Type.STRING }
            },
            required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype"]
          }
        }
      },
      required: ["characters"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3.1-pro-preview" });
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

    const prompt = `Analyze narrative continuity between the Plot Nodes, the current Chapter sequence, and critical external feedback.
      ${researchContext}
      ${reviewContext}
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, nodes: c.plotNodeIds || [] })))}
      
      Identify orphaned nodes, logic gaps, and unresolved critical feedback. Format as Markdown.`;

    return await callAI({ prompt, model: "gemini-3.1-pro-preview" });
  },

  async splitManuscript(fullText: string, type: ProjectType): Promise<{ title: string; summary: string; marker: string }[]> {
    const prompt = `STRUCTURAL ARCHITECT: Analyze this raw manuscript of a ${type}. 
  
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
              marker: { type: Type.STRING }
            },
            required: ["title", "summary", "marker"]
          }
        }
      },
      required: ["chapters"]
    };

    const text = await callAI({ prompt, json: true, schema, maxTokens: 8192, model: "gemini-3.1-pro-preview" });
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

    return await callAI({ prompt, model: "gemini-3.1-pro-preview" });
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-flash-latest" });
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

    return await callAI({ prompt, model: "gemini-flash-latest" });
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
    
    return await callAI({ prompt, model: "gemini-flash-latest" });
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

    return await callAI({ prompt, model: "gemini-flash-latest" });
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-flash-latest" });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return (data.chapters || []).map((c: any) => ({
      ...c,
      plotNodeIds: Array.isArray(c.plotNodeIds) ? c.plotNodeIds : []
    }));
  },

  async deepSimmer(chapter: Chapter, context: string, type: ProjectType, plotNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = []): Promise<string> {
    const personaMap = {
      novel: "Literary Genius / Prize-Winning Novelist",
      screenplay: "A-List Script Doctor",
      legal: "Senior Partner at a Magic Circle Law Firm",
      academic: "Highly-Cited Research Fellow",
      stageplay: "Tony Award Winning Playwright",
      radioplay: "BBC Audio Drama Lead",
      experimental: "Post-Modernist Maverick"
    };

    const targetContext = projectTargetWords 
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
      TASK: Elevate the following scene to "Award-Winning" caliber.
      
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
      - Refine the prose for maximum emotional resonance and clarity.
      - Prioritize sharpening and tightening the manuscript.
      - Maintain depth appropriate for the project scale without artificial padding.
      - Ensure sensory immersion is absolute.
      - Return ONLY the enhanced text.`;

    return await callAI({ prompt, model: "gemini-3.1-pro-preview" });
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

    const response = await callAI({ prompt, json: true, schema, model: "gemini-3.1-pro-preview" });
    const data = safeParseJSON(response || "{}");
    return data.assessments || [];
  },
  
  async critique(text: string): Promise<string> {
    const prompt = `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`;
    return await callAI({ prompt, model: "gemini-flash-latest" });
  }
};

