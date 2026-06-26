import { apiCall } from './client';

export interface SwarmAgent {
  id: string;
  name: string;
  scope: string;
  focusAreas: string[];
  avoidDuplicating: string[];
}

export type SwarmMode =
  | 'critique'
  | 'rewrite-plan'
  | 'collaborative-revision'
  | 'final-polish';

export interface AgentSwarmResult {
  swarmId: string;
  outputId: string;
  projectId: string;
  mode: SwarmMode;
  agentReports: Array<{
    agentId: string;
    agent: string;
    findings: string[];
    recommendations: string[];
    score: number;
  }>;
  consensus: {
    topProblems: string[];
    topOpportunities: string[];
    revisionPlan: string[];
    doNotChange: string[];
    fillerWarnings: string[];
    summary: string;
  };
  revisedText?: string;
  disclaimer: string;
  createdAt: string;
}

export async function listSwarmAgents(): Promise<SwarmAgent[]> {
  return apiCall<SwarmAgent[]>('/api/agents');
}

export async function runAgentSwarm(data: {
  projectId: string;
  sourceText?: string;
  workType?: string;
  agentIds?: string[];
  targetAwardIds?: string[];
  researchItemIds?: string[];
  mode?: SwarmMode;
}) {
  return apiCall<AgentSwarmResult>('/api/agents/swarm', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export const SWARM_MODE_LABELS: Record<SwarmMode, string> = {
  critique: 'Critique',
  'rewrite-plan': 'Rewrite plan',
  'collaborative-revision': 'Collaborative revision',
  'final-polish': 'Final polish',
};
