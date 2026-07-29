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
  | 'quickwrite'
  | 'design'
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

function isPictureMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'picture';
}

function isNonfictionMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'nonfiction' || brief.mode === 'essay';
}

function isPoetryMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'poetry';
}

function hasDesignPlan(): boolean {
  try {
    const raw = localStorage.getItem('caspa.bookDesign');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return Boolean(saved?.plan?.pages?.length || saved?.plan?.spreads?.length || saved?.coverImage || saved?.plan);
  } catch {
    return false;
  }
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
  const picture = isPictureMode(brief);
  const nonfiction = isNonfictionMode(brief);
  const poetry = isPoetryMode(brief);
  const designReady = hasDesignPlan();

  const ctx = loadExportContext(brief);
  const gate = evaluateExportGate(ctx, false);

  const steps: WorkflowStep[] = [];

  const briefStarted = Boolean(brief.idea?.trim() && brief.title && !brief.title.startsWith('Untitled'));
  steps.push({
    id: 'start_brief',
    title: gold
      ? 'Confirm what you are polishing'
      : picture
        ? 'Confirm the picture-book brief'
        : nonfiction
          ? 'Lock the non-fiction brief'
          : poetry
            ? 'Lock the poetry brief'
            : 'Lock your brief',
    why: gold
      ? 'Gold mode needs the manuscript and tone locked so polish passes stay on-voice.'
      : picture
        ? 'Age band, premise, and tone steer spreads, covers, and read-aloud voice.'
        : nonfiction
          ? 'Subject, angle, audience, and promised deliverable keep research and draft honest.'
          : poetry
            ? 'Form, tone, and occasion keep the sequence coherent.'
            : 'Caspa routes every room from title, mode, and premise — without this, tools guess.',
    action: briefStarted ? 'Review brief' : 'Set up project',
    view: 'project',
    done: briefStarted,
  });

  if (picture) {
    steps.push({
      id: 'draft_or_paste',
      title: 'Plan spreads & covers',
      why: 'Design first: age band, trim, wraparound cover, character lock, facing spreads with text-safe zones.',
      action: designReady ? 'Continue Design' : 'Open Design',
      view: 'design',
      done: designReady || words >= 20,
    });
    steps.push({
      id: 'review_draft',
      title: 'Lock the read-aloud text',
      why: 'Keep page text short and concrete. Edit in White Page or finish captions in Design.',
      action: words > 0 ? 'Edit text' : 'Open White Page',
      view: 'write',
      done: words >= 40,
    });
    steps.push({
      id: 'export',
      title: 'Export picture-book PDF',
      why: gate.blockers.length
        ? `Blocked: ${gate.blockers[0]}`
        : 'Publish Pack exports kdp-picture-book / illustrated-spread ready files.',
      action: gate.canExport ? 'Export PDF' : 'Open Publish Pack',
      view: 'publish',
      done: gate.canExport,
    });
  } else if (gold) {
    steps.push({
      id: 'draft_or_paste',
      title: 'Paste the manuscript',
      why: 'Polish needs source text. Paste your draft or open White Page and drop it in.',
      action: words > 0 ? 'Edit manuscript' : 'Open White Page',
      view: 'write',
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
    steps.push({
      id: 'export',
      title: 'Export when ready',
      why: gate.blockers.length
        ? `Blocked: ${gate.blockers[0]}`
        : 'Publish Pack for manuscript export.',
      action: gate.canExport ? 'Export manuscript' : 'Check export gate',
      view: 'publish',
      done: gate.canExport,
    });
  } else if (nonfiction) {
    steps.push({
      id: 'draft_or_paste',
      title: 'Get the argument on the page',
      why: 'Outline, chapters, or a messy brain-dump — Caspa needs text before it can diagnose structure and claims.',
      action: words > 0 ? 'Continue drafting' : 'Open Just write',
      view: words > 0 && !hasDiagnosis ? 'workshop' : 'quickwrite',
      done: words >= 50,
    });
    steps.push({
      id: 'workshop_diagnose',
      title: 'Gather sources (optional)',
      why: 'Research Desk holds notes, quotes, and links so the draft stays evidenced instead of invented.',
      action: 'Open Research Desk',
      view: 'research',
      optional: true,
      done: false,
    });
    steps.push({
      id: 'workshop_write',
      title: 'Diagnose & commission',
      why: 'Workshop scores clarity, structure, and missing proof, then can rewrite sections to order.',
      action: hasDiagnosis ? 'Continue Workshop' : 'Open Workshop',
      view: 'workshop',
      done: commissionComplete,
    });
    steps.push({
      id: 'review_draft',
      title: 'Read the draft',
      why: 'Check claims, voice, and ending. Edit in White Page before export.',
      action: 'Open White Page',
      view: 'write',
      done: commissionComplete && words >= 100,
    });
    steps.push({
      id: 'export',
      title: 'Export when ready',
      why: gate.blockers.length
        ? `Blocked: ${gate.blockers[0]}`
        : 'Publish Pack for manuscript export.',
      action: gate.canExport ? 'Export manuscript' : 'Check export gate',
      view: 'publish',
      done: gate.canExport,
    });
  } else {
    steps.push({
      id: 'draft_or_paste',
      title: poetry ? 'Get lines on the page' : 'Get words on the page',
      why: poetry
        ? 'Draft the poem or sequence. Paste fragments if you already have them.'
        : 'Use Just write for a prize-target draft, or paste into Workshop. Caspa needs text to diagnose.',
      action: words > 0 ? 'Continue writing' : 'Open Just write',
      view: words > 0 && !hasDiagnosis ? 'workshop' : 'quickwrite',
      done: words >= (poetry ? 20 : 50),
    });

    steps.push({
      id: 'workshop_diagnose',
      title: 'Diagnose in Workshop',
      why: poetry
        ? 'Workshop can pressure-test image, music, and dead weight — then you cut.'
        : 'Workshop reads your draft, scores viability, and lists fixes. This is how Caspa knows what to write next.',
      action: hasDiagnosis ? 'Review diagnosis' : 'Open Workshop',
      view: 'workshop',
      done: hasDiagnosis,
    });

    steps.push({
      id: 'workshop_write',
      title: poetry ? 'Commission the cut / rewrite' : 'Commission the rewrite',
      why: 'Direct the idea if needed, select recommendations, then Write it. Caspa produces a manuscript-ready artefact for White Page.',
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
      done: commissionComplete && words >= (poetry ? 40 : 100),
    });

    steps.push({
      id: 'polish_optional',
      title: 'Design cover & pages',
      why: poetry
        ? 'Optional pamphlet / cover design when you want a physical object.'
        : 'Optional for prose. Use when you want a cover or illustrated companion pages.',
      action: 'Open Design',
      view: 'design',
      optional: true,
      done: false,
    });

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
  }

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
  // Prefer required work; optional rooms stay in the checklist without blocking.
  return (
    steps.find((s) => !s.done && !s.optional) ||
    steps.find((s) => !s.done) ||
    steps[steps.length - 1]
  );
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
