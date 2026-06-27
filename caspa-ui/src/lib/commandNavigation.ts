export interface CommandRoute {
  label: string;
  path: string;
  hint?: string;
}

export const QUICK_COMMANDS: Array<{ text: string; label: string }> = [
  { text: 'What should I do next?', label: 'Next step' },
  { text: 'Run Gold against the Awards Shelf', label: 'Gold + awards' },
  { text: 'Swarm this chapter', label: 'Agent swarm' },
  { text: 'Check research accuracy', label: 'Research check' },
  { text: 'Add the next structural pole', label: 'Pier pole' },
  { text: 'Finish this without padding', label: 'Anti-filler' },
];

const INTENT_ROUTES: Record<string, (projectId: string) => CommandRoute> = {
  research: (projectId) => ({
    label: 'Open Research Desk',
    path: `/projects/${projectId}/research`,
    hint: 'Verify claims and add confirmed notes before drafting.',
  }),
  pier: (projectId) => ({
    label: 'Open Pier Builder',
    path: `/projects/${projectId}/pier`,
    hint: 'Place poles and lay boards — filler stretches are refused without structural purpose.',
  }),
  gold_pass: (projectId) => ({
    label: 'Run Gold Pass',
    path: `/projects/${projectId}/gold`,
  }),
  swarm: (projectId) => ({
    label: 'Open Agent Swarm',
    path: `/projects/${projectId}/swarm`,
  }),
  awards: (projectId) => ({
    label: 'Open Awards Shelf',
    path: `/projects/${projectId}/awards`,
  }),
  next_step: (projectId) => ({
    label: 'Project overview',
    path: `/projects/${projectId}`,
    hint: 'See room mode and the suggested next action.',
  }),
  quality_check: (projectId) => ({
    label: 'Run Gold Pass',
    path: `/projects/${projectId}/gold`,
    hint: 'Synthesise structure, research, swarm and awards into one revision plan.',
  }),
  publish: (projectId) => ({
    label: 'Open export',
    path: `/projects/${projectId}/export`,
    hint: 'Package manuscript and outputs for sharing.',
  }),
  product_plan: (projectId) => ({
    label: 'Open Project Bible',
    path: `/projects/${projectId}/bible`,
    hint: 'Shape premise, characters and plan before drafting.',
  }),
  intake: (projectId) => ({
    label: 'Import manuscript',
    path: `/projects/${projectId}/manuscript`,
    hint: 'Use New Project or Manuscript tab to bring material in safely.',
  }),
  document: () => ({
    label: 'Open Documents',
    path: '/documents',
    hint: 'Render and preview formatted exports.',
  }),
  music: () => ({
    label: 'Open Music Lab',
    path: '/music-prompt',
    hint: 'Lyrics, prompts and show-number sketches.',
  }),
  workflow: (projectId) => ({
    label: 'Open Outputs',
    path: `/projects/${projectId}/outputs`,
    hint: 'Review saved AI work before applying anything.',
  }),
};

export function routeForIntent(intent: string, projectId?: string | null): CommandRoute | null {
  if (!projectId) return null;
  const builder = INTENT_ROUTES[intent];
  return builder ? builder(projectId) : null;
}

export function routeForText(text: string, projectId?: string | null): CommandRoute | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (/what should i do next|next step|where do i go/.test(t)) {
    return projectId
      ? { label: 'Project overview', path: `/projects/${projectId}`, hint: 'See room mode and suggested next actions.' }
      : { label: 'Open Projects', path: '/projects', hint: 'Select or create a project first.' };
  }

  if (!projectId) {
    if (/auto-write|write from scratch|new novel|blank project/.test(t)) {
      return { label: 'Novel Write Pro', path: '/casper', hint: 'Start a blank room or upload a manuscript.' };
    }
    if (/new project|create project/.test(t)) {
      return { label: 'Projects', path: '/projects', hint: 'Use New Project to set work type and starting point.' };
    }
    return null;
  }

  if (/pier|pole|lay board|structural pole|stretch.*conflict/.test(t)) {
    return { label: 'Pier Builder', path: `/projects/${projectId}/pier`, hint: 'Survey, place poles, lay boards — no filler without purpose.' };
  }

  if (/gold|award shelf|award pass|run gold/.test(t)) {
    return { label: 'Gold Pass', path: `/projects/${projectId}/gold` };
  }

  if (/swarm|multi-agent|critique agents/.test(t)) {
    return { label: 'Agent Swarm', path: `/projects/${projectId}/swarm` };
  }

  if (/award|judge|prize|booker|shelf/.test(t)) {
    return { label: 'Awards Shelf', path: `/projects/${projectId}/awards` };
  }

  if (/research|accuracy|claim|verify|depth pass/.test(t)) {
    return { label: 'Research Desk', path: `/projects/${projectId}/research` };
  }

  if (/output|apply|saved draft|archive/.test(t)) {
    return { label: 'Outputs', path: `/projects/${projectId}/outputs`, hint: 'Apply only after explicit confirmation.' };
  }

  if (/bible|premise|logline|character plan/.test(t)) {
    return { label: 'Project Bible', path: `/projects/${projectId}/bible` };
  }

  if (/improve|polish|rewrite|award pass rewrite/.test(t)) {
    return {
      label: 'Improve manuscript',
      path: `/casper?projectId=${projectId}&improve=1`,
      hint: 'Original upload stays preserved; revision saves as output.',
    };
  }

  if (/continue|keep writing|next scene/.test(t)) {
    return { label: 'Continue writing', path: `/projects/${projectId}/manuscript`, hint: 'Open the latest unit or continue from Outputs.' };
  }

  if (/export|publish|epub|pdf/.test(t)) {
    return { label: 'Export', path: `/projects/${projectId}/export` };
  }

  if (/structure|chapter|manuscript unit/.test(t)) {
    return { label: 'Structure', path: `/projects/${projectId}/structure` };
  }

  if (/without padding|no filler|anti-filler/.test(t)) {
    return { label: 'Pier Builder', path: `/projects/${projectId}/pier`, hint: 'Stretch only with structural purpose — filler is refused.' };
  }

  if (/import|upload manuscript/.test(t)) {
    return { label: 'Manuscript', path: `/projects/${projectId}/manuscript` };
  }

  return null;
}

export interface FormattedCommandView {
  summary: string;
  intent?: string;
  confidence?: number;
  suggestedActions?: string[];
  route?: CommandRoute | null;
}

export function parseCommandResponse(data: unknown, text: string, projectId?: string | null): FormattedCommandView {
  const payload = data as {
    summary?: string;
    intent?: string;
    confidence?: number;
    suggestedActions?: string[];
  };

  const textRoute = routeForText(text, projectId);
  const intentRoute = payload.intent ? routeForIntent(payload.intent, projectId) : null;
  const route = textRoute ?? intentRoute;

  return {
    summary: payload.summary ?? (route ? `Open ${route.label} to continue.` : 'Command understood — pick a suggested action or rephrase with a project selected.'),
    intent: payload.intent,
    confidence: payload.confidence,
    suggestedActions: payload.suggestedActions,
    route,
  };
}
