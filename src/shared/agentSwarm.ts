/** Agent Swarm — collaborative multi-agent critique (Phase 8). */

export type SwarmMode =
  | 'critique'
  | 'rewrite-plan'
  | 'collaborative-revision'
  | 'final-polish';

export interface SwarmAgentDefinition {
  id: string;
  name: string;
  scope: string;
  focusAreas: string[];
  avoidDuplicating: string[];
}

export interface AgentReport {
  agentId: string;
  agent: string;
  findings: string[];
  recommendations: string[];
  score: number;
}

export interface SwarmConsensus {
  topProblems: string[];
  topOpportunities: string[];
  revisionPlan: string[];
  doNotChange: string[];
  fillerWarnings: string[];
  summary: string;
}

export interface AgentSwarmResult {
  swarmId: string;
  outputId: string;
  projectId: string;
  mode: SwarmMode;
  agentReports: AgentReport[];
  consensus: SwarmConsensus;
  revisedText?: string;
  disclaimer: string;
  createdAt: string;
}

export const AGENT_SWARM_DISCLAIMER =
  'Agent Swarm reports are advisory lenses — apply changes explicitly via Outputs.';

export const SWARM_AGENTS: SwarmAgentDefinition[] = [
  {
    id: 'structural-editor',
    name: 'Structural Editor',
    scope: 'Macro structure, act/scene turns, and load-bearing beats.',
    focusAreas: ['structure', 'turns', 'pacing architecture'],
    avoidDuplicating: ['sentence-level prose'],
  },
  {
    id: 'line-editor',
    name: 'Line Editor',
    scope: 'Sentence clarity, rhythm, and line-level craft.',
    focusAreas: ['syntax', 'clarity', 'rhythm'],
    avoidDuplicating: ['plot architecture'],
  },
  {
    id: 'plot-architect',
    name: 'Plot Architect',
    scope: 'Cause-and-effect chain, escalation, and payoff setup.',
    focusAreas: ['plot logic', 'escalation', 'setup/payoff'],
    avoidDuplicating: ['market positioning'],
  },
  {
    id: 'character-psychologist',
    name: 'Character Psychologist',
    scope: 'Motivation, wound, desire, and behavioral truth.',
    focusAreas: ['interiority', 'motivation', 'relationship pressure'],
    avoidDuplicating: ['format/market'],
  },
  {
    id: 'continuity-editor',
    name: 'Continuity Editor',
    scope: 'Timeline, object tracking, and factual consistency within canon.',
    focusAreas: ['continuity', 'timeline', 'detail tracking'],
    avoidDuplicating: ['external research verification'],
  },
  {
    id: 'research-editor',
    name: 'Research Editor',
    scope: 'Factual claims vs confirmed research library.',
    focusAreas: ['accuracy', 'evidence', 'unsupported claims'],
    avoidDuplicating: ['purely stylistic notes'],
  },
  {
    id: 'prize-judge',
    name: 'Prize Judge',
    scope: 'Award shelf rubrics and submission readiness.',
    focusAreas: ['award fit', 'judge expectations', 'disqualification risks'],
    avoidDuplicating: ['generic line edits'],
  },
  {
    id: 'genre-specialist',
    name: 'Genre Specialist',
    scope: 'Genre contract, trope delivery, and reader expectations.',
    focusAreas: ['genre signals', 'contract', 'reader promise'],
    avoidDuplicating: ['sensitivity/context unless genre-relevant'],
  },
  {
    id: 'dramaturg',
    name: 'Dramaturg',
    scope: 'Stagecraft, scene pressure, and production-aware writing.',
    focusAreas: ['stageability', 'scene objectives', 'actor leverage'],
    avoidDuplicating: ['novelistic exposition habits'],
  },
  {
    id: 'script-editor',
    name: 'Script Editor',
    scope: 'Screen/stage script format, visual writing, and scene economy.',
    focusAreas: ['visual writing', 'scene headers', 'dialogue economy'],
    avoidDuplicating: ['long-form novel pacing'],
  },
  {
    id: 'market-reader',
    name: 'Market Reader',
    scope: 'Commercial readability, hook, and audience pull.',
    focusAreas: ['hook', 'readability', 'commercial momentum'],
    avoidDuplicating: ['experimental form unless requested'],
  },
  {
    id: 'sensitivity-reader',
    name: 'Sensitivity / Context Reader',
    scope: 'Representation, context, and avoidable harm/cliche risks.',
    focusAreas: ['representation', 'context', 'stereotype risk'],
    avoidDuplicating: ['plot mechanics'],
  },
  {
    id: 'gold-editor',
    name: 'Gold Editor',
    scope: 'Elevation pass alignment and premium finish.',
    focusAreas: ['elevation', 'signature moments', 'final polish readiness'],
    avoidDuplicating: ['first-draft structural rebuilds'],
  },
  {
    id: 'voice-guardian',
    name: 'Voice Guardian',
    scope: 'Protect distinctive authorial voice during revision pressure.',
    focusAreas: ['voice consistency', 'tone integrity', 'author fingerprint'],
    avoidDuplicating: ['generic prize pastiche'],
  },
  {
    id: 'anti-filler-inspector',
    name: 'Anti-Filler Inspector',
    scope: 'Detect padding, repetition, and structurally unjustified expansion.',
    focusAreas: ['filler', 'repetition', 'unmotivated description'],
    avoidDuplicating: ['positive craft praise without cause'],
  },
];

export function getAgentById(id: string): SwarmAgentDefinition | undefined {
  return SWARM_AGENTS.find((agent) => agent.id === id);
}

export function defaultAgentIdsForWork(form?: string): string[] {
  const base = ['structural-editor', 'line-editor', 'plot-architect', 'anti-filler-inspector', 'voice-guardian'];
  if (form === 'play' || form === 'musical') {
    return [...base, 'dramaturg'];
  }
  if (form === 'screenplay') {
    return [...base, 'script-editor'];
  }
  return [...base, 'prize-judge'];
}
