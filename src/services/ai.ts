/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const XAI_API_KEY = (import.meta as any).env?.VITE_GROK_API_KEY;

function safeParseJSON(text: string, fallback: any = {}) {
  try {
    // Attempt simple parse first
    return JSON.parse(text);
  } catch (e) {
    try {
      // Handle markdown code blocks
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      
      // Attempt to find first { or [ and last } or ]
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(text.slice(start, end + 1));
      }
      const startArr = text.indexOf('[');
      const endArr = text.lastIndexOf(']');
      if (startArr !== -1 && endArr !== -1) {
        return JSON.parse(text.slice(startArr, endArr + 1));
      }
    } catch (inner) {
      console.error("Critical JSON Parse Failure:", inner, "on text:", text.slice(0, 500));
    }
    return fallback;
  }
}

/**
 * Robust AI Caller with fallback from Gemini to xAI (Grok)
 */
async function callAI(options: { 
  prompt: string; 
  model?: string;
  json?: boolean; 
  schema?: any;
  maxTokens?: number;
  useWebSearch?: boolean;
}) {
  const { prompt, model = "gemini-3-flash-preview", json = false, schema, maxTokens, useWebSearch = false } = options;

  // Primary Attempt: Gemini
  try {
    const config: any = {};
    if (json) {
      config.responseMimeType = "application/json";
      if (schema) config.responseSchema = schema;
    }
    if (maxTokens) config.maxOutputTokens = maxTokens;
    if (useWebSearch) config.tools = [{ googleSearch: {} }];

  // Use correct model for task type per skill
    const targetModel = model === "gemini-3-flash-preview" ? "gemini-3-flash-preview" : 
                        model === "gemini-3.1-pro-preview" ? "gemini-3.1-pro-preview" : 
                        model === "gemini-1.5-flash" ? "gemini-3-flash-preview" :
                        model === "gemini-1.5-pro" ? "gemini-3.1-pro-preview" :
                        model;

    console.log(`AI Calling: ${targetModel} | Prompt length: ${prompt.length}`);
    const result = await (ai as any).models.generateContent({
      model: targetModel,
      contents: prompt,
      config: config
    });

    const responseText = result.text;

    if (responseText) {
      console.log(`AI Success: ${targetModel} | Response length: ${responseText.length}`);
      return responseText;
    }
    
    throw new Error("AI returned an empty response.");
  } catch (error: any) {
    console.error("AI Failure:", error);
    const errorMsg = error.message || String(error);
    
    const isQuota = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota");
    const isSafety = errorMsg.toLowerCase().includes("safety");

    if (XAI_API_KEY && (isQuota || isSafety)) {
      console.warn(`Gemini restricted. Falling back to xAI Grok...`);
      const fallback = await callXAI(prompt, json);
      if (fallback) return fallback;
    }
    
    if (isQuota) {
      throw new Error("QUOTA_EXCEEDED: Gemini quota has been reached.");
    }
    
    if (isSafety) {
       throw new Error("SAFETY_RESTRICTION: The AI declined this request due to safety filters.");
    }

    throw new Error(`AI_FAILURE: ${errorMsg}`);
  }

  // If Gemini didn't return text (but didn't throw) or we fell through
  if (XAI_API_KEY) {
    return await callXAI(prompt, json);
  }

  return "";
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
  structural: "You are a Structural Critic focused on pacing, arc, and narrative tension.",
  vocal: "You are a Vocal/Dialogue Critic focused on character voice, subtext, and prosody.",
  factual: "You are a Factual Critic focused on logic, accuracy, and anti-hallucination.",
  legal: "You are a Legal Drafting Specialist. Focus on jurisdiction, evidence hierarchy, and grounds of claim.",
  academic: "You are an Academic Peer Reviewer. Focus on citation integrity, methodology, and thesis scaffold.",
  comedy: "You are a Comedy Editor. Focus on timing, setup/payoff, and satirical bite."
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
  async brainstorm(premise: string, genre: string, tone: string, type: ProjectType, maturity = 'standard'): Promise<string> {
    const prompt = `You are the Central Orchestrator of a synthetic writer's room. 
      Project Type: ${type}
      Genre: ${genre}
      Tone: ${tone}
      Initial Premise: "${premise}"
      ${getMaturityDirectives(maturity)}
      
      Provide a multi-faceted expansion including structural milestones, character archetypes, and thematic escalation.`;

    return await callAI({ prompt, model: "gemini-1.5-flash" });
  },

  async generateCharacter(concept: string, type: ProjectType, maturity = 'standard'): Promise<Character> {
    const prompt = `Create a character for a ${type}. Concept: "${concept}". ${getMaturityDirectives(maturity)} Return as JSON.`;
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview", useWebSearch: true });
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

  async outlinePlotNodes(project: Project, chapters: Chapter[] = []): Promise<PlotNode[]> {
    const maxContentLength = 150000;
    const chaptersContext = chapters.map((c: any) => `### Chapter: ${c.title}\n${c.content}`).join('\n\n').slice(0, maxContentLength);
    const sourceContext = (project.sourceMaterials || []).map((s: any) => `### Source [${s.name}]\n${s.content}`).join('\n\n').slice(0, maxContentLength);
    
    let prompt = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create between 8 and 18 major narrative beats. ${getMaturityDirectives(project.maturity)}\n\n`;
    
    if (chaptersContext || sourceContext) {
      prompt += `Analyze ALL of the following materials. YOU MUST draw characters, events, and thematic arcs directly from this text to construct the structural plot beats.\n\n=== EXISTING MANUSCRIPT/CHAPTERS ===\n${chaptersContext}\n\n=== SOURCE MATERIALS ===\n${sourceContext}\n\nBased ONLY on the provided text, outline the major narrative beats. Return a JSON array of objects.`;
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview", useWebSearch: true });
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

  async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = []): Promise<Critique[]> {
    const roles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual'];
    if (type === 'legal') roles.push('legal');
    if (type === 'academic') roles.push('academic');
    if (type === 'experimental' || type === 'screenplay') roles.push('comedy');

    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const schema = {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        severity: { type: Type.STRING },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["content", "severity", "suggestions"]
    };

    const critiquePromises = roles.map(async (role) => {
      const prompt = `${AGENT_PERSONAS[role]} Analyze this ${type} draft. ${getMaturityDirectives(maturity)} ${sourceContext} Identify problems, rank severity, and suggest fixes. Return as JSON.`;
      const responseText = await callAI({ prompt, json: true, schema });
      const data = safeParseJSON(responseText || "{}");
      
      const suggestions = Array.isArray(data.suggestions) 
        ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
        : [];

      return {
        id: crypto.randomUUID(),
        agentName: `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`,
        role: role as any,
        content: data.content || "No major issues identified.",
        severity: data.severity || "low",
        suggestions
      } as Critique;
    });

    return Promise.all(critiquePromises);
  },

  async writeDraft(title: string, summary: string, context: string, type: ProjectType, activeNodes: PlotNode[], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], directives: string[] = []): Promise<string> {
    const personaMap = {
      novel: "Literary Novelist",
      screenplay: "Hollywood Screenwriter (use Fountain industry format)",
      legal: "Senior Counsel (UK/US Jurisdiction awareness)",
      academic: "Principal Investigator (Academic rigour)",
      stageplay: "Dramatist (Blocking and stage directions focus)",
      radioplay: "Audio Drama Producer (SFX and sound focus)",
      experimental: "Avant-garde Author"
    };

    const maturityDirective = getMaturityDirectives(maturity);
    const sourceContext = sourceMaterials.map(s => `[SOURCE: ${s.name}]: ${s.content.slice(0, 5000)}`).join('\n\n');
    const authorDirectives = directives.length > 0 ? `\nCRITICAL AUTHOR DIRECTIVES (IMPLEMENT THESE FIXES):\n${directives.map(d => `- ${d}`).join('\n')}` : "";

    const prompt = `You are an elite ${type} writer. 
      ${maturityDirective}
      
      TASK: Write a full, immersive, and high-fidelity draft for Chapter: "${title}".
      SCENE OBJECTIVES: ${summary}
      ${authorDirectives}
      
      STRICT CONTINUITY CONTEXT:
      ${context}

      PLOT BEATS TO INTEGRATE:
      ${activeNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}

      RESEARCH & SOURCE METERIALS:
      ${sourceContext}

      AUTHORIAL DIRECTIVE:
      - Use standard Markdown formatting.
      - Write only the prose. No notes, no meta-commentary.
      - Aim for a length and density appropriate for a $50,000 word project.
      - Show, do not tell. Focus on sensory details and internal monologue.
    `;

    return await callAI({ prompt, model: "gemini-1.5-pro" });
  },

  async compileResearch(topic: string, context: string, type: ProjectType): Promise<ResearchNote> {
    const prompt = `You are a research assistant for a ${type}.\nTopic: "${topic}"\nContext: ${context}\n\nUse live web search to gather current, verifiable sources and synthesize findings.\nReturn JSON with keys: title, content, category, tags, sources.\nFor sources, include concrete citations (publication or site names with URLs when available).`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        category: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sources: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["title", "content", "category", "tags", "sources"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview", useWebSearch: true });
    const data = safeParseJSON(text || "{}");
    return { 
      title: data.title || 'Untitled Research',
      content: data.content || 'No content generated.',
      category: data.category || 'general',
      tags: Array.isArray(data.tags) ? data.tags : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      id: crypto.randomUUID(), 
      updatedAt: Date.now() 
    };
  },

  async analyzeContinuity(nodes: PlotNode[], chapters: Chapter[]): Promise<string> {
    const prompt = `Analyze narrative continuity between the Plot Nodes and the current Chapter sequence.
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, nodes: c.plotNodeIds || [] })))}
      
      Identify orphaned nodes and logic gaps. Format as Markdown.`;

    return await callAI({ prompt, model: "gemini-1.5-pro" });
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

    return await callAI({ prompt, model: "gemini-1.5-pro" });
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview", useWebSearch: true });
    const data = safeParseJSON(text || "[]", []);
    return Array.isArray(data) ? data : (data.beats || data.items || []);
  },

  async reconcileChapters(project: Project, plotNodes: PlotNode[], chapters: Chapter[]): Promise<{ title: string; summary: string; plotNodeIds: string[] }[]> {
    const prompt = `Narrative Architect: Reconcile the following Plot Nodes with the current Chapter structure for "${project.title}" (${project.type}).
    
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

    const text = await callAI({ prompt, json: true, schema, model: "gemini-3-flash-preview", useWebSearch: true });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return (data.chapters || []).map((c: any) => ({
      ...c,
      plotNodeIds: Array.isArray(c.plotNodeIds) ? c.plotNodeIds : []
    }));
  },

  async deepSimmer(chapter: Chapter, context: string, type: ProjectType, plotNodes: PlotNode[], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const personaMap = {
      novel: "Literary Genius / Prize-Winning Novelist",
      screenplay: "A-List Script Doctor",
      legal: "Senior Partner at a Magic Circle Law Firm",
      academic: "Highly-Cited Research Fellow",
      stageplay: "Tony Award Winning Playwright",
      radioplay: "BBC Audio Drama Lead",
      experimental: "Post-Modernist Maverick"
    };

    const nodeContext = plotNodes.length > 0 
      ? `\nINTEGRATE THESE PLOT BEATS WITH MASTERFUL SUBSERVIENCE TO THEME:\n${plotNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}`
      : "";

    const sourceContext = sourceMaterials.length > 0
      ? `\nANCHOR TO THESE SOURCE TRUTHS:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const prompt = `You are a ${personaMap[type || 'novel']}. 
      TASK: Elevate the following scene to "Award-Winning" caliber.
      
      TITLE: "${chapter.title}"
      BRIEF: ${chapter.summary}
      EXISTING CONTENT: ${chapter.content}
      NARRATIVE CONTINUITY: ${context}
      ${nodeContext}
      ${sourceContext}
      ${getMaturityDirectives(maturity)}
      
      Return ONLY the enhanced text.`;

    return await callAI({ prompt, model: "gemini-1.5-pro" });
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

    PROJECT TITLE: ${project.title}
    TYPE: ${project.type}
    PREMISE: ${project.premise}
    TONE/GENRE: ${project.tone} / ${project.genre}

    CONTENT STRATA:
    ${contentSample}

    TASK: For EACH prize, evaluate the project's current trajectory.
    
    Format as JSON: { "assessments": [{ "prizeName": string, "eligibilityScore": number, "pros": string[], "cons": string[], "recommendation": string }] }
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
              recommendation: { type: Type.STRING }
            },
            required: ["prizeName", "eligibilityScore", "pros", "cons", "recommendation"]
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
    return await callAI({ prompt, model: "gemini-3-flash-preview" });
  }
};

