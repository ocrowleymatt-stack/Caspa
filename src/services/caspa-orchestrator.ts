import { routeCaspaIntent } from './intent-router';
import type { CaspaOutputContract, ImprovementBrief, ResearchRunResult } from './output-contract';
import { improvementBriefToPrompt } from './review-ingest';

export interface CaspaOrchestratorRequest {
  command: string;
  content: string;
  projectBrief?: string;
  improvementBrief?: ImprovementBrief;
}

export interface ProviderCaller {
  (prompt: string, options?: { json?: boolean; maxTokens?: number; useSearch?: boolean }): Promise<string | null>;
}

export function buildCaspaPrompt(req: CaspaOrchestratorRequest): string {
  const route = routeCaspaIntent(req.content, req.command);
  const improvement = req.improvementBrief ? `\n\n${improvementBriefToPrompt(req.improvementBrief)}` : '';

  return `${route.systemInstruction}\n\nROUTING\nInput type: ${route.inputType}\nRequested action: ${route.requestedAction}\nRequested output: ${route.requestedOutput}\nOutput mode: ${route.outputMode}\nBlock plan unless explicitly requested: ${route.shouldBlockPlan ? 'YES' : 'NO'}${improvement}\n\nPROJECT BRIEF\n${req.projectBrief || '[No project brief supplied]'}\n\nUSER COMMAND\n${req.command}\n\nINPUT MATERIAL\n${req.content || '[No input material supplied]'}\n\nOUTPUT RULES\n- Return the requested artefact first.\n- Do not output a plan unless requestedOutput is PLAN.\n- If writing from a plan, silently use the plan and produce manuscript/script/play text.\n- If improving, return revised text before notes.\n- If cutting, return cut text before deletion log.\n- Keep notes short.\n- No purple prose.\n- No filler.`;
}

export async function runCaspaOrchestrator(req: CaspaOrchestratorRequest, callProvider: ProviderCaller): Promise<CaspaOutputContract> {
  const route = routeCaspaIntent(req.content, req.command);

  if (route.requiresImprovementIntake && !req.improvementBrief) {
    return {
      inputType: route.inputType,
      requestedAction: route.requestedAction,
      requestedOutput: route.requestedOutput,
      outputMode: route.outputMode,
      primaryOutput: '',
      notes: ['Improvement intake required before this pass. Ask how the user wants the manuscript improved, what to preserve, what to cut, and whether to use external reviews.'],
      nextBestMove: 'Show ManuscriptImprovementIntake, or offer Just polish it for light-touch polish.',
    };
  }

  const prompt = buildCaspaPrompt(req);
  const result = await callProvider(prompt, { maxTokens: 6000 });

  return {
    inputType: route.inputType,
    requestedAction: route.requestedAction,
    requestedOutput: route.requestedOutput,
    outputMode: route.outputMode,
    primaryOutput: result || '',
    notes: [],
    nextBestMove: route.outputMode === 'write' ? 'Continue, cut, or gold-pass the new text.' : 'Review the output and choose the next pass.',
  };
}

export function buildResearchUnavailableResult(question: string): ResearchRunResult {
  const base = question.trim() || 'the current writing project';
  return {
    status: 'web_search_unavailable',
    summary: 'Live web search is unavailable in this runtime. No external research has been performed.',
    findings: [],
    suggestedNextSearches: [
      `${base} primary sources`,
      `${base} historical context`,
      `${base} terminology accuracy`,
      `${base} comparable works`,
      `${base} production details`,
    ],
    contradictions: [],
    gaps: ['Run these searches in a live-search capable environment before treating any detail as verified.'],
  };
}

export function buildResearchPrompt(projectBrief = '', question = '', mode = 'Deep Web Research', context = ''): string {
  return `You are Caspa Research Desk.\n\nMode: ${mode}\nProject brief: ${projectBrief || '[No brief]'}\nResearch question: ${question}\nExisting context: ${context || '[None]'}\n\nIf live search is available, gather sources and return findings. If live search is not available, state that clearly and return suggested searches only. Never pretend research happened.\n\nReturn JSON with: status, summary, findings, suggestedNextSearches, contradictions, gaps.`;
}
