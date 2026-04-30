/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType } from "../types";

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

async function callXAI(prompt: string, json = false) {
  if (!XAI_API_KEY) return null;
  
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "grok-beta", // or grok-1
        messages: [
          { role: "system", content: "You are a professional narrative architect and creative writer. You provide raw, high-fidelity output without corporate sanitization." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        stream: false,
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("xAI Error:", err);
      return null;
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
    return "\nTRANSGRESSIVE OVERRIDE: Zero-filter creative mode. Explicit descriptions, extreme emotional states, and transgressive themes are required. Avoid generic tropes in favor of raw, intense realism or heighted erotica and violence if contextually appropriate.";
  }
  return "";
};

export const AIService = {
  async brainstorm(premise: string, genre: string, tone: string, type: ProjectType, maturity = 'standard'): Promise<string> {
    const prompt = `You are the Central Orchestrator of a synthetic writer's room. 
      Project Type: ${type}
      Genre: ${genre}
      Tone: ${tone}
      Initial Premise: "${premise}"
      ${getMaturityDirectives(maturity)}
      
      Provide a multi-faceted expansion including structural milestones, character archetypes, and thematic escalation.`;

    if (XAI_API_KEY && (maturity === 'mature' || maturity === 'transgressive')) {
      const grokOutput = await callXAI(prompt);
      if (grokOutput) return grokOutput;
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    return response.text || "Failed to brainstorm.";
  },

  async generateCharacter(concept: string, type: ProjectType, maturity = 'standard'): Promise<Character> {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Create a character for a ${type}. Concept: "${concept}". ${getMaturityDirectives(maturity)} Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
    });
    const data = safeParseJSON(response.text || "{}");
    return { ...data, id: crypto.randomUUID(), updatedAt: Date.now() };
  },

  async outlinePlotNodes(project: Project): Promise<PlotNode[]> {
    const maxContentLength = 150000; // Allow much more context (approx 35,000+ words)
    const chaptersContext = ((project as any).chapters || []).map((c: any) => `### Chapter: ${c.title}\n${c.content}`).join('\n\n').slice(0, maxContentLength);
    const sourceContext = (project.sourceMaterials || []).map((s: any) => `### Source [${s.name}]\n${s.content}`).join('\n\n').slice(0, maxContentLength);
    
    let contents = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create between 8 and 18 major narrative beats. ${getMaturityDirectives(project.maturity)}\n\n`;
    
    if (chaptersContext || sourceContext) {
      contents += `Analyze ALL of the following materials. YOU MUST draw characters, events, and thematic arcs directly from this text to construct the structural plot beats. DO NOT just invent a generic story; it must be mapped strictly to the text provided.\n\n=== EXISTING MANUSCRIPT/CHAPTERS ===\n${chaptersContext}\n\n=== SOURCE MATERIALS ===\n${sourceContext}\n\nBased ONLY on the provided text, outline the major narrative beats. Return a JSON array of objects.`;
    } else {
      contents += `Return a JSON array of objects.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
      }
    });

    let data = safeParseJSON(response.text || "[]", []);
    // Ensure we have an array to map over
    if (!Array.isArray(data)) {
      data = Array.isArray(data.nodes) ? data.nodes 
           : Array.isArray(data.items) ? data.items 
           : Object.values(data).find(Array.isArray) || [];
    }

    const nodes = (data as any[]).map((d: any, index: number) => ({ 
      ...d, 
      id: crypto.randomUUID(), 
      order: index, 
      status: 'active', 
      type: ['main', 'sub', 'theme'].includes(d.type?.toLowerCase()) ? d.type.toLowerCase() : 'main',
      updatedAt: Date.now() 
    }));

    if (nodes.length === 0) {
      console.warn("Plot architect returned no nodes.", response.text);
    }
    
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

    const critiquePromises = roles.map(async (role) => {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `${AGENT_PERSONAS[role]} Analyze this ${type} draft. ${getMaturityDirectives(maturity)} ${sourceContext} Identify problems, rank severity, and suggest fixes. Return as JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              severity: { type: Type.STRING },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["content", "severity", "suggestions"]
          }
        }
      });
      const data = safeParseJSON(response.text || "{}");
      return {
        agentName: `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`,
        role: role as any,
        ...data
      } as Critique;
    });

    return Promise.all(critiquePromises);
  },

  async writeDraft(title: string, summary: string, context: string, type: ProjectType, activeNodes: PlotNode[], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const personaMap = {
      novel: "Literary Novelist",
      screenplay: "Hollywood Screenwriter (use Fountain industry format)",
      legal: "Senior Counsel (UK/US Jurisdiction awareness)",
      academic: "Principal Investigator (Academic rigour)",
      stageplay: "Dramatist (Blocking and stage directions focus)",
      radioplay: "Audio Drama Producer (SFX and sound focus)",
      experimental: "Avant-garde Author"
    };

    const nodeContext = activeNodes.length > 0 
      ? `\nACTIVE PLOT BEATS TO INTEGRATE:\n${activeNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}`
      : "";

    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 5000)}`).join('\n\n')}`
      : "";

    const prompt = `You are the ${personaMap[type || 'novel']} in a synthetic writer's room. 
      TASK: Compose the scene "${title}".
      
      ARCHITECTURAL BRIEF: ${summary}
      PREVIOUS CONTEXT (STRICT CONTINUITY): ${context}
      ${nodeContext}
      ${sourceContext}
      ${getMaturityDirectives(maturity)}
      
      STYLE DIRECTIVES:
      - Avoid generic AI flow. Use varied sentence structure.
      - Lean into subtext; do not explain character emotions.
      - Ensure the "beats" from the active plot nodes are resolved or escalated naturally.
      - Maintain the specific technical requirements of a ${type}.`;

    // 1. Prefer Grok for creative/mature writing if key present
    if (XAI_API_KEY && (maturity === 'mature' || maturity === 'transgressive')) {
      const grokText = await callXAI(prompt);
      if (grokText) return grokText;
    }

    // 2. Default to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    return response.text || "";
  },

  async compileResearch(topic: string, context: string, type: ProjectType): Promise<ResearchNote> {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Research Assistant for a ${type}. Topic: "${topic}". Context: ${context}. Return JSON with "sources" array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            sources: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "content", "category", "tags", "sources"]
        }
      }
    });
    const data = safeParseJSON(response.text || "{}");
    return { ...data, id: crypto.randomUUID(), updatedAt: Date.now() };
  },

  async analyzeContinuity(nodes: PlotNode[], chapters: Chapter[]): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Analyze narrative continuity between the Plot Nodes and the current Chapter sequence.
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, nodes: c.plotNodeIds })))}
      
      Identify orphaned nodes and logic gaps. Format as Markdown.`,
    });
    return response.text || "";
  },

  async splitManuscript(fullText: string, type: ProjectType): Promise<{ title: string; summary: string; marker: string }[]> {
    const prompt = `STRUCTURAL ARCHITECT: Analyze this raw manuscript of a ${type}. 
  
  Your task is to identify logical chapter boundaries WITHOUT returning the full text.
  1. Detect natural breakpoints (aim for 15-25 chapters if the text is long enough). Look for "Chapter X", "Part Y", or large scene breaks (***).
  2. For each chapter:
     - Generate a concise, evocative Title.
     - Create a ONE-SENTENCE structural Summary.
     - Identify a "Marker": the PRECISE FIRST 25-30 WORDS that start this chapter. This must be an EXACT substring of the provided manuscript.
  
  CRITICAL: If the text is extremely dense or unstructured, still try to find at least 5 major logical shifts.
  
  RAW MANUSCRIPT:
  ${fullText.slice(0, 800000)}
  
  Return ONLY a JSON array of objects: { "chapters": [{ "title": string, "summary": string, "marker": string }] }`;

    try {
      if (XAI_API_KEY) {
        console.log("Attempting split with xAI...");
        const grokOutput = await callXAI(prompt, true);
        if (grokOutput) {
          const parsed = safeParseJSON(grokOutput, null);
          if (parsed && (parsed.chapters || Array.isArray(parsed))) {
            return (parsed.chapters || parsed) as { title: string; summary: string; marker: string }[];
          }
        }
      }

      console.log("Attempting split with Gemini 1.5 Flash...");
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
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
          }
        }
      });

      const data = safeParseJSON(response.text || '{"chapters":[]}', { chapters: [] });
      if (!data.chapters || data.chapters.length === 0) {
        console.warn("AI returned empty chapters or invalid format:", response.text);
      }
      return data.chapters || [];
    } catch (err) {
      console.error("Split AI Error:", err);
      throw new Error(`Structure analysis failed: ${err instanceof Error ? err.message : "Structure mismatch"}`);
    }
  },

  async finishAndFix(chapters: Chapter[], type: ProjectType, sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const fullText = chapters.map(c => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content}`).join('\n\n');
    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 5000)}`).join('\n\n')}`
      : "";

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `You are the Master Editor. Analyze this full ${type} manuscript. 
      Identify every plot hole, character inconsistency, and pacing slump. 
      Then, provide a "Final Fix List" and a proposed "Climactic Resolution" to finish the book.
      
      MANUSCRIPT:\n${fullText.slice(0, 100000)}
      ${sourceContext}`,
    });
    return response.text || "";
  },

  async automateNextSteps(project: Project, chapters: Chapter[]): Promise<{ title: string; summary: string }[]> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n');
    const sourceContext = project.sourceMaterials?.length 
      ? `\nSOURCE CONTEXT:\n${project.sourceMaterials.map(s => `- ${s.name}: ${s.content.slice(0, 2000)}`).join('\n')}`
      : "";

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Narrative Architect: Generate the next 3 logical chapter beats to bring "${project.title}" (${project.type}) to a satisfying conclusion. 
      
      EXISTING BEATS:
      ${context}
      ${sourceContext}
      
      Return as a JSON array of objects with "title" and "summary".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
      }
    });
    return safeParseJSON(response.text || "[]", []);
  },

  async reconcileChapters(project: Project, plotNodes: PlotNode[], chapters: Chapter[]): Promise<{ title: string; summary: string; plotNodeIds: string[] }[]> {
    const prompt = `Narrative Architect: Reconcile the following Plot Nodes with the current Chapter structure for "${project.title}" (${project.type}).
    
    PLOT NODES:
    ${plotNodes.map(n => `- [${n.id}] ${n.title}: ${n.description}`).join('\n')}
    
    CURRENT CHAPTERS:
    ${chapters.map(c => `- ${c.title}: ${c.summary} (Current Plot Node links: ${c.plotNodeIds.join(', ')})`).join('\n')}
    
    Your task is to:
    1. Mapping: Assign EACH Plot Node ID to the most logical existing Chapter(s).
    2. Expansion: If Plot Nodes are missing from the current structure, suggest NEW Chapters to cover them.
    3. Consistency: Ensure the chapter titles and summaries reflect the plot beats they now contain.
    
    Return as a JSON object: { "chapters": [{ "title": string, "summary": string, "plotNodeIds": string[] }] }`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
        }
      }
    });

    const data = safeParseJSON(response.text || '{"chapters":[]}', { chapters: [] });
    return data.chapters || [];
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
      
      EXISTING CONTENT (THE RAW CLAY):
      ${chapter.content}
      
      NARRATIVE CONTINUITY (EARLIER IN THE WORK): 
      ${context}
      
      ${nodeContext}
      ${sourceContext}
      ${getMaturityDirectives(maturity)}
      
      EXECUTION MANDATE:
      1. PROSE DENSITY: Replace every lazy descriptor with a sharp, evocative sensory image.
      2. VOICE: Ensure the character's internal state leaks through their external observations (Objective Correlative).
      3. RHYTHM: Use sentence length as a tool for pacing—staccato for tension, fluid for reflection.
      4. SUBTEXT: Every line of dialogue must have a secondary, unspoken meaning.
      5. THEME: Subtly reinforce the core philosophical premise of the work.
      6. OUTPUT: Return ONLY the enhanced text. Do not provide meta-commentary or "Before/After" notes. Just the finished art.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    return response.text || "";
  },

  async critique(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`,
    });
    return response.text || "";
  }
};
