/**
 * Caspa guided workflow — one clear next step with rationale
 */

import type { CommissionState } from '../types/commission';
import type { ProjectBriefLike } from './commissionService';
import { evaluateExportGate, loadExportContext } from './exportService';
import { getProjectKey } from './researchLibraryService';

export type WorkflowView =
  | 'launchpad'
  | 'project'
  | 'write'
  | 'workshop'
  | 'publish'
  | 'library'
  | 'bible'
  | 'gold'
  | 'psychology'
  | 'redpen'
  | 'research'
  | 'canvas'
  | 'openwebui'
  | 'settings';

export type WorkflowStepId =
  | 'start_brief'
  | 'draft_or_paste'
  | 'workshop_diagnose'
  | 'workshop_write'
  | 'review_draft'
  | 'polish_optional'
  | 'export'
  | 'complete_to_library'
  | 'rest_in_library';

export interface WorkflowStep {
  id: WorkflowStepId;
  title: string;
  why: string;
  action: string;
  view: WorkflowView;
  optional?: boolean;
  done: boolean;
}

const COMMISSION_KEY = 'caspa.commission';

function loadCommission(): CommissionState | null {
  try {
    const raw = localStorage.getItem(COMMISSION_KEY);
    return raw ? (JSON.parse(raw) as CommissionState) : null;
  } catch {
    return null;
  }
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isGoldMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'gold';
}

export function getWorkflowSteps(
  brief: ProjectBriefLike,
  draftPage: string,
  manuscriptSource: string,
  projectStatus: 'active' | 'complete'
): WorkflowStep[] {
  if (projectStatus === 'complete') {
    return [
      {
        id: 'rest_in_library',
        title: 'In your library',
        why: 'This manuscript is finished. It lives in the library now — not on the active workbench.',
        action: 'Browse library',
        view: 'library',
        done: true,
      },
    ];
  }

  const commission = loadCommission();
  const manuscript = commission?.artefact?.trim() || draftPage.trim() || manuscriptSource.trim();
  const words = wordCount(manuscript);
  const hasDiagnosis = Boolean(commission?.diagnosis);
  const hasChapters = (commission?.chapters?.length || 0) > 0;
  const commissionComplete = commission?.phase === 'complete';
  const gold = isGoldMode(brief);

  const ctx = loadExportContext(brief);
  const gate = evaluateExportGate(ctx, false);

  const steps: WorkflowStep[] = [];

  const briefStarted = Boolean(brief.idea?.trim() && brief.title && !brief.title.startsWith('Untitled'));
  steps.push({
    id: 'start_brief',
    title: gold ? 'Confirm what you are polishing' : 'Lock your brief',
    why: gold
      ? 'Gold mode needs the manuscript and tone locked so polish passes stay on-voice.'
      : 'Caspa routes every room from title, mode, and premise — without this, tools guess.',
    action: briefStarted ? 'Review brief' : 'Set up project',
    view: 'project',
    done: briefStarted,
  });

  if (gold) {
    steps.push({
      id: 'draft_or_paste',
      title: 'Paste the manuscript',
      why: 'Polish needs source text. Paste your draft or open White Page and drop it in.',
      action: words > 0 ? 'Edit manuscript' : 'Open White Page',
      view: words > 0 ? 'write' : 'write',
      done: words >= 100,
    });
    steps.push({
      id: 'polish_optional',
      title: 'Run Gold Refinery',
      why: 'Structure, subtext, and line passes tighten prose before export. Skip if already prize-ready.',
      action: 'Open Gold Refinery',
      view: 'gold',
      optional: true,
      done: false,
    });
  } else {
    steps.push({
      id: 'draft_or_paste',
      title: 'Get words on the page',
      why: 'Write fresh in White Page, or paste existing material into Workshop. Caspa needs text to diagnose.',
      action: words > 0 ? 'Continue writing' : 'Start in White Page',
      view: words > 0 && !hasDiagnosis ? 'workshop' : 'write',
      done: words >= 50,
    });

    steps.push({
      id: 'workshop_diagnose',
      title: 'Diagnose in Workshop',
      why: 'Workshop reads your draft, scores viability, and lists fixes. This is how Caspa knows what to write next.',
      action: hasDiagnosis ? 'Review diagnosis' : 'Open Workshop',
      view: 'workshop',
      done: hasDiagnosis,
    });

    steps.push({
      id: 'workshop_write',
      title: 'Commission the rewrite',
      why: 'Select recommendations, then Write it. Caspa produces a manuscript-ready artefact for White Page.',
      action: commissionComplete ? 'View artefact' : hasChapters ? 'Finish commission' : 'Open Workshop',
      view: 'workshop',
      done: commissionComplete,
    });

    steps.push({
      id: 'review_draft',
      title: 'Read the draft',
      why: 'Read what Caspa produced. Edit in White Page before you export — machines do not know your ending yet.',
      action: 'Open White Page',
      view: 'write',
      done: commissionComplete && words >= 100,
    });
  }

  steps.push({
    id: 'export',
    title: 'Export when ready',
    why: gate.blockers.length
      ? `Blocked: ${gate.blockers[0]}`
      : 'Publish Pack checks promises and word count so nothing broken leaves the building.',
    action: gate.canExport ? 'Export manuscript' : 'Check export gate',
    view: 'publish',
    done: gate.canExport,
  });

  steps.push({
    id: 'complete_to_library',
    title: 'Move to library',
    why: 'Finished work belongs on the shelf, not the workbench. Completing clears the active slot for your next project.',
    action: 'Complete project',
    view: 'library',
    done: false,
  });

  return steps;
}

export function getNextStep(
  brief: ProjectBriefLike,
  draftPage: string,
  manuscriptSource: string,
  projectStatus: 'active' | 'complete'
): WorkflowStep {
  const steps = getWorkflowSteps(brief, draftPage, manuscriptSource, projectStatus);
  if (projectStatus === 'complete') return steps[0];
  return steps.find((s) => !s.done) || steps[steps.length - 1];
}

export function getProgressSummary(
  brief: ProjectBriefLike,
  draftPage: string,
  manuscriptSource: string,
  projectStatus: 'active' | 'complete'
): { done: number; total: number; percent: number } {
  const steps = getWorkflowSteps(brief, draftPage, manuscriptSource, projectStatus).filter((s) => !s.optional);
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function projectKeyForBrief(brief: ProjectBriefLike): string {
  return getProjectKey(brief);
}
