/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are the Central Orchestrator of a synthetic writer's room. 
      Project Type: ${type}
      Genre: ${genre}
      Tone: ${tone}
      Initial Premise: "${premise}"
      ${getMaturityDirectives(maturity)}
      
      Provide a multi-faceted expansion including structural milestones, character archetypes, and thematic escalation.`,
    });
    return response.text || "Failed to brainstorm.";
  },

  async generateCharacter(concept: string, type: ProjectType, maturity = 'standard'): Promise<Character> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
    const data = JSON.parse(response.text || "{}");
    return { ...data, id: crypto.randomUUID(), updatedAt: Date.now() };
  },

  async outlinePlotNodes(project: Project): Promise<PlotNode[]> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Outline a ${project.type} structure for "${project.title}". 8-10 major beats. ${getMaturityDirectives(project.maturity)} Return JSON array.`,
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
    const data = JSON.parse(response.text || "[]");
    return data.map((d: any, index: number) => ({ 
      ...d, 
      id: crypto.randomUUID(), 
      order: index, 
      status: 'active', 
      updatedAt: Date.now() 
    }));
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
        model: "gemini-2.0-flash",
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
      const data = JSON.parse(response.text || "{}");
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

    // Multi-Provider Bridge: If Grok is configured and mode is transgressive, we could proxy here.
    // For now, we use Gemini with a high-intensity prompt.
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are the ${personaMap[type || 'novel']} in a synthetic writer's room. 
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
      - Maintain the specific technical requirements of a ${type}.`,
    });
    return response.text || "";
  },

  async compileResearch(topic: string, context: string, type: ProjectType): Promise<ResearchNote> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
    const data = JSON.parse(response.text || "{}");
    return { ...data, id: crypto.randomUUID(), updatedAt: Date.now() };
  },

  async analyzeContinuity(nodes: PlotNode[], chapters: Chapter[]): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Analyze narrative continuity between the Plot Nodes and the current Chapter sequence.
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, nodes: c.plotNodeIds })))}
      
      Identify orphaned nodes and logic gaps. Format as Markdown.`,
    });
    return response.text || "";
  },

  async splitManuscript(fullText: string, type: ProjectType): Promise<{ title: string; summary: string; content: string }[]> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Narrative Architect: Analyze this raw manuscript of a ${type}. 
      Detect natural chapter breaks or logical scene boundaries. 
      Split the text into logical chapters. 
      For each chapter, provide:
      1. An evocative Title.
      2. A concise Summary of the sequence.
      3. The full raw Content from that section.
      
      RAW MANUSCRIPT:\n${fullText.slice(0, 50000)}
      
      Return as a JSON array of objects with "title", "summary", and "content".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "summary", "content"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  },

  async finishAndFix(chapters: Chapter[], type: ProjectType, sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const fullText = chapters.map(c => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content}`).join('\n\n');
    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 5000)}`).join('\n\n')}`
      : "";

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are the Master Editor. Analyze this full ${type} manuscript. 
      Identify every plot hole, character inconsistency, and pacing slump. 
      Then, provide a "Final Fix List" and a proposed "Climactic Resolution" to finish the book.
      
      MANUSCRIPT:\n${fullText.slice(0, 30000)}
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
      model: "gemini-2.0-flash",
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
    return JSON.parse(response.text || "[]");
  },

  async critique(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`,
    });
    return response.text || "";
  }
};
