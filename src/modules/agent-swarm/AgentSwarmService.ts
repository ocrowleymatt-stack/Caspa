import { generateId } from '../../shared';
import { aiWithFallback, getProjectFullText } from '../../shared/elevationHelpers';
import {
  AGENT_SWARM_DISCLAIMER,
  defaultAgentIdsForWork,
  getAgentById,
  SWARM_AGENTS,
  type AgentReport,
  type AgentSwarmResult,
  type SwarmAgentDefinition,
  type SwarmConsensus,
  type SwarmMode,
} from '../../shared/agentSwarm';
import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import { standardOutputProvenance } from '../../shared/outputSemantics';
import { productionBriefService } from '../studio/ProductionBriefService';
import { hasStructuralPurpose } from '../../shared/pierBuilder';
import { awardsCatalog } from '../awards/AwardsCatalog';
import { ProjectService } from '../manuscript/ProjectService';
import { ResearchService } from '../manuscript/ResearchService';
import { outputRegistry } from '../outputs';

function parseAgentJson(text: string, agent: SwarmAgentDefinition): AgentReport {
  const fallback: AgentReport = {
    agentId: agent.id,
    agent: agent.name,
    findings: [`${agent.name} reviewed ${agent.focusAreas[0] ?? 'core scope'}.`],
    recommendations: [`Strengthen ${agent.focusAreas[0] ?? 'focus area'} in the next pass.`],
    score: 62,
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as Partial<AgentReport>;
    return {
      agentId: agent.id,
      agent: agent.name,
      findings: parsed.findings?.filter(Boolean)?.slice(0, 5) ?? fallback.findings,
      recommendations: parsed.recommendations?.filter(Boolean)?.slice(0, 5) ?? fallback.recommendations,
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : fallback.score,
    };
  } catch {
    return fallback;
  }
}

async function runAgentReport(
  agent: SwarmAgentDefinition,
  sourceText: string,
  contextBlock: string,
  projectId: string,
): Promise<AgentReport> {
  const prompt = [
    `You are the ${agent.name}. Scope: ${agent.scope}`,
    `Focus ONLY on: ${agent.focusAreas.join(', ')}.`,
    `Do NOT comment on: ${agent.avoidDuplicating.join(', ')}.`,
    'Return JSON only: { "findings": [], "recommendations": [], "score": 0-100 }',
    'Be specific and non-repetitive vs other agents.',
  ].join('\n');

  const { text } = await aiWithFallback(
    prompt,
    `${contextBlock}\n\n--- TEXT UNDER REVIEW ---\n${sourceText.slice(0, 3500)}`,
    JSON.stringify({
      findings: [`${agent.name} sees workable material with scope-specific gaps.`],
      recommendations: [`Address ${agent.focusAreas[0]} before expanding word count.`],
      score: 60,
    }),
    projectId,
  );

  return parseAgentJson(text, agent);
}

function buildConsensusFromReports(reports: AgentReport[]): SwarmConsensus {
  const antiFiller = reports.find((report) => report.agentId === 'anti-filler-inspector');
  return {
    topProblems: reports.flatMap((report) => report.findings).slice(0, 6),
    topOpportunities: reports.flatMap((report) => report.recommendations).slice(0, 6),
    revisionPlan: reports.flatMap((report) => report.recommendations).slice(0, 8),
    doNotChange: reports
      .filter((report) => report.agentId === 'voice-guardian')
      .flatMap((report) => report.findings)
      .slice(0, 4),
    fillerWarnings: antiFiller?.findings ?? [],
    summary: 'Consensus synthesized from distinct agent scopes — revise from the plan, not contradictory comments.',
  };
}

export class AgentSwarmService {
  private readonly projectService = new ProjectService();
  private readonly researchService = new ResearchService();

  listAgents() {
    return SWARM_AGENTS;
  }

  async swarm(input: {
    projectId: string;
    sourceText?: string;
    workType?: string;
    agentIds?: string[];
    targetAwardIds?: string[];
    researchItemIds?: string[];
    mode?: SwarmMode;
    user?: import('../auth/types').UserPublic;
  }): Promise<AgentSwarmResult> {
    const project = await this.projectService.getProject(input.projectId, input.user);
    const mode = input.mode ?? 'critique';
    const sourceText = input.sourceText?.trim()
      || (await getProjectFullText(input.projectId, 8000));

    const agentIds = (input.agentIds?.length
      ? input.agentIds
      : defaultAgentIdsForWork(project.form)).filter((id) => getAgentById(id));
    if (agentIds.length === 0) {
      throw new Error('At least one valid agentId is required');
    }

    const agents = agentIds.map((id) => getAgentById(id)!);

    const [notes, awardLenses, brief] = await Promise.all([
      this.researchService.listNotes(input.projectId),
      awardsCatalog.resolveByIds(input.targetAwardIds?.length
        ? input.targetAwardIds
        : project.targetPrizeIds ?? []),
      productionBriefService.get(input.projectId, input.user),
    ]);

    const researchNotes = notes.filter((note) =>
      !input.researchItemIds?.length || input.researchItemIds.includes(note.id),
    );
    const confirmedResearch = researchNotes.filter((note) => note.verificationStatus === 'confirmed');

    const creativeSpec = buildCreativeSpecPrompt(brief);
    const contextBlock = [
      `Project: ${project.title}`,
      `Work type: ${input.workType ?? project.workType ?? project.genre}`,
      `Form: ${project.form ?? 'book'}`,
      creativeSpec,
      awardLenses.length
        ? `Award lenses: ${awardLenses.map((lens) => lens.name).join('; ')}`
        : 'Award lenses: none selected',
      confirmedResearch.length
        ? `Confirmed research:\n${confirmedResearch.map((note) => `- ${note.title}: ${note.content.slice(0, 200)}`).join('\n')}`
        : 'Confirmed research: none — flag unsupported factual claims.',
    ].filter(Boolean).join('\n');

    const agentReports = await Promise.all(
      agents.map((agent) => runAgentReport(agent, sourceText, contextBlock, input.projectId)),
    );

    const deterministicConsensus = buildConsensusFromReports(agentReports);

    const { text: consensusText } = await aiWithFallback(
      [
        'Synthesize a single consensus from these agent reports.',
        'Return JSON: { "topProblems": [], "topOpportunities": [], "revisionPlan": [], "doNotChange": [], "fillerWarnings": [], "summary": "..." }',
        'Agents must not repeat each other. Produce one unified revision plan.',
      ].join('\n'),
      JSON.stringify(agentReports),
      JSON.stringify(deterministicConsensus),
      input.projectId,
    );

    let consensus = deterministicConsensus;
    try {
      const match = consensusText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<SwarmConsensus>;
        consensus = {
          topProblems: parsed.topProblems?.length ? parsed.topProblems : deterministicConsensus.topProblems,
          topOpportunities: parsed.topOpportunities?.length ? parsed.topOpportunities : deterministicConsensus.topOpportunities,
          revisionPlan: parsed.revisionPlan?.length ? parsed.revisionPlan : deterministicConsensus.revisionPlan,
          doNotChange: parsed.doNotChange?.length ? parsed.doNotChange : deterministicConsensus.doNotChange,
          fillerWarnings: parsed.fillerWarnings?.length ? parsed.fillerWarnings : deterministicConsensus.fillerWarnings,
          summary: parsed.summary?.trim() || deterministicConsensus.summary,
        };
      }
    } catch {
      consensus = deterministicConsensus;
    }

    if (!hasStructuralPurpose(consensus.revisionPlan.join(' ')) && consensus.fillerWarnings.length === 0) {
      consensus.fillerWarnings = [
        'Revision plan lacks structural purpose — place a new pier pole before expanding prose.',
      ];
    }

    let revisedText: string | undefined;
    if (mode === 'collaborative-revision' || mode === 'final-polish') {
      const { text } = await aiWithFallback(
        [
          `Mode: ${mode}. Rewrite from the consensus plan only — do not follow contradictory agent comments individually.`,
          'Preserve voice-guardian "do not change" notes.',
          consensus.summary,
          `Revision plan:\n${consensus.revisionPlan.join('\n')}`,
          mode === 'final-polish' ? 'Apply a final polish pass.' : 'Apply a collaborative revision pass.',
          'Return the full revised text only.',
        ].join('\n'),
        sourceText.slice(0, 6000),
        sourceText,
        input.projectId,
      );
      revisedText = text.trim() || undefined;
    }

    const swarmId = generateId();
    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'agent-swarm',
      title: `Agent Swarm — ${mode} (${agents.length} agents)`,
      path: '',
      metadata: {
        kind: revisedText ? 'agent-swarm-revision' : 'agent-swarm-report',
        ...standardOutputProvenance({
          workType: project.workType,
          researchItemIds: input.researchItemIds ?? [],
          targetAwardIds: input.targetAwardIds ?? project.targetPrizeIds ?? [],
          stage: mode,
        }),
        swarmId,
        mode,
        agentReports,
        consensus,
        revisedText,
        agentIds,
        targetAwardIds: input.targetAwardIds ?? project.targetPrizeIds ?? [],
        researchItemIds: input.researchItemIds ?? [],
        disclaimer: AGENT_SWARM_DISCLAIMER,
        destination: revisedText ? 'beside-unit' : 'writing-history',
      },
    });

    return {
      swarmId,
      outputId: record.id,
      projectId: input.projectId,
      mode,
      agentReports,
      consensus,
      revisedText,
      disclaimer: AGENT_SWARM_DISCLAIMER,
      createdAt: record.createdAt,
    };
  }
}

export const agentSwarmService = new AgentSwarmService();
