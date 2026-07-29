/**
 * Caspa guided workflow — one clear next step with rationale
 */

import type { CommissionState } from '../types/commission';
import type { ProjectBriefLike } from './commissionService';
import { evaluateExportGate, loadExportContext } from './exportService';
import { getProjectKey } from './researchLibraryService';
import { hasShowBoxContent } from './showBoxService';

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
  | 'settings'
  | 'showbox';

export type WorkshopTab = 'inbox' | 'recommendations' | 'promises' | 'workshop';

export type WorkflowStepId =
  | 'start_brief'
  | 'draft_or_paste'
  | 'research_sources'
  | 'show_pack'
  | 'workshop_diagnose'
  | 'workshop_write'
  | 'review_draft'
  | 'polish_optional'
  | 'export'
  | 'complete_to_library'
  | 'rest_in_library';

/** Where Full path / Next step should land — view plus optional Workshop deep-link. */
export interface WorkflowNavTarget {
  view: WorkflowView;
  workshopTab?: WorkshopTab;
  focusChapter?: number;
}

export interface WorkflowStep {
  id: WorkflowStepId;
  title: string;
  why: string;
  action: string;
  view: WorkflowView;
  /** Workshop tab to open when view is workshop — makes diagnose vs commission visitable. */
  workshopTab?: WorkshopTab;
  optional?: boolean;
  done: boolean;
}

export function stepToNavTarget(step: WorkflowStep): WorkflowNavTarget {
  return {
    view: step.view,
    workshopTab: step.workshopTab,
  };
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

function isShowMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'musical';
}

function isScriptMode(brief: ProjectBriefLike): boolean {
  return brief.mode === 'script';
}

function hasShowPack(): boolean {
  return hasShowBoxContent();
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
  const show = isShowMode(brief);
  const script = isScriptMode(brief);
  const designReady = hasDesignPlan();
  const showPacked = hasShowPack();

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
        : show
          ? 'Confirm the show brief'
          : script
            ? 'Confirm the script brief'
            : nonfiction
              ? 'Lock the non-fiction brief'
              : poetry
                ? 'Lock the poetry brief'
                : 'Lock your brief',
    why: gold
      ? 'Gold mode needs the manuscript and tone locked so polish passes stay on-voice.'
      : picture
        ? 'Age band, premise, and tone steer spreads, covers, and read-aloud voice.'
        : show
          ? 'Premise, tone, and company size steer book, songs, and the production pack.'
          : script
            ? 'Form (stage/screen/radio), tone, and runtime keep scenes actable.'
            : nonfiction
              ? 'Subject, angle, audience, and promised deliverable keep research and draft honest.'
              : poetry
                ? 'Form, tone, and occasion keep the sequence coherent.'
                : 'Caspa routes every room from title, mode, and premise — without this, tools guess.',
    action: briefStarted ? 'Review brief' : 'Set up project',
    view: 'project',
    done: briefStarted,
  });

  if (show) {
    steps.push({
      id: 'show_pack',
      title: 'Pack the show in a box',
      why: 'Song list, running order, music sketch, cast doubles, and production pack — before the book wanders off alone.',
      action: showPacked ? 'Continue Show Box' : 'Open Show in a Box',
      view: 'showbox',
      done: showPacked,
    });
    steps.push({
      id: 'draft_or_paste',
      title: 'Draft the book / scenes',
      why: 'Get Act One (or a brutal outline) on the page. Songs without book scenes are a concert, not a show.',
      action: words > 0 ? 'Continue book' : 'Open Just write',
      view: words > 0 && !hasDiagnosis ? 'workshop' : 'quickwrite',
      workshopTab: words > 0 && !hasDiagnosis ? 'inbox' : undefined,
      done: words >= 80,
    });
    steps.push({
      id: 'workshop_diagnose',
      title: 'Diagnose the show draft',
      why: 'Workshop pressure-tests turns, dead numbers, and missing payoffs across book and songs.',
      action: hasDiagnosis ? 'Review diagnosis' : 'Open Workshop',
      view: 'workshop',
      workshopTab: hasDiagnosis ? 'recommendations' : 'inbox',
      done: hasDiagnosis,
    });
    steps.push({
      id: 'workshop_write',
      title: 'Commission the rewrite',
      why: 'Select fixes and scope, then Write it — scenes and lyric passes land as artefact.',
      action: commissionComplete ? 'View artefact' : hasDiagnosis ? 'Finish commission' : 'Open Workshop',
      view: 'workshop',
      workshopTab: commissionComplete ? 'workshop' : hasDiagnosis ? 'recommendations' : 'inbox',
      done: commissionComplete,
    });
    steps.push({
      id: 'polish_optional',
      title: 'Storyboard the running order (optional)',
      why: 'Jam Canvas for act pictures when the page alone will not hold the company.',
      action: 'Open Jam Canvas',
      view: 'canvas',
      optional: true,
      done: false,
    });
    steps.push({
      id: 'review_draft',
      title: 'Read / rehearse the pack',
      why: 'Assemble the box, then read book against running order in White Page before export.',
      action: words >= 80 ? 'Open White Page' : 'Open Show Box',
      view: words >= 80 ? 'write' : 'showbox',
      done: showPacked && words >= 80,
    });
    steps.push({
      id: 'export',
      title: 'Export the show pack',
      why: gate.blockers.length
        ? `Blocked: ${gate.blockers[0]}`
        : 'Publish Pack for rehearsal / pitch / production export.',
      action: gate.canExport ? 'Export pack' : 'Open Publish Pack',
      view: 'publish',
      done: gate.canExport,
    });
  } else if (script) {
    steps.push({
      id: 'draft_or_paste',
      title: 'Get scenes on the page',
      why: 'Stage, screen, or radio — Caspa needs spoken turns before it can diagnose.',
      action: words > 0 ? 'Continue script' : 'Open Just write',
      view: words > 0 && !hasDiagnosis ? 'workshop' : 'quickwrite',
      workshopTab: words > 0 && !hasDiagnosis ? 'inbox' : undefined,
      done: words >= 50,
    });
    steps.push({
      id: 'polish_optional',
      title: 'Storyboard on Jam Canvas (optional)',
      why: 'Visual running order for acts and set pieces when the page alone is not enough.',
      action: 'Open Jam Canvas',
      view: 'canvas',
      optional: true,
      done: false,
    });
    steps.push({
      id: 'workshop_diagnose',
      title: 'Diagnose in Workshop',
      why: 'Score actability, scene turns, and dead air — then commission cuts or rewrites.',
      action: hasDiagnosis ? 'Review diagnosis' : 'Open Workshop',
      view: 'workshop',
      workshopTab: hasDiagnosis ? 'recommendations' : 'inbox',
      done: hasDiagnosis,
    });
    steps.push({
      id: 'workshop_write',
      title: 'Commission the rewrite',
      why: 'Direct the idea, tick fixes, Write it. Artefact lands ready for a table read.',
      action: commissionComplete ? 'View artefact' : hasDiagnosis ? 'Finish commission' : 'Open Workshop',
      view: 'workshop',
      workshopTab: commissionComplete ? 'workshop' : hasDiagnosis ? 'recommendations' : 'inbox',
      done: commissionComplete,
    });
    steps.push({
      id: 'review_draft',
      title: 'Table-read the draft',
      why: 'Read aloud in White Page. Cut what does not play.',
      action: 'Open White Page',
      view: 'write',
      done: commissionComplete && words >= 80,
    });
    steps.push({
      id: 'export',
      title: 'Export when ready',
      why: gate.blockers.length
        ? `Blocked: ${gate.blockers[0]}`
        : 'Publish Pack for pitch / rehearsal export.',
      action: gate.canExport ? 'Export script' : 'Check export gate',
      view: 'publish',
      done: gate.canExport,
    });
  } else if (picture) {
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
      workshopTab: words > 0 && !hasDiagnosis ? 'inbox' : undefined,
      done: words >= 50,
    });
    steps.push({
      id: 'research_sources',
      title: 'Gather sources (optional)',
      why: 'Research Desk holds notes, quotes, and links so the draft stays evidenced instead of invented.',
      action: 'Open Research Desk',
      view: 'research',
      optional: true,
      done: false,
    });
    steps.push({
      id: 'workshop_diagnose',
      title: 'Diagnose in Workshop',
      why: 'Workshop scores clarity, structure, and missing proof so you know what to commission next.',
      action: hasDiagnosis ? 'Review diagnosis' : 'Open Workshop',
      view: 'workshop',
      workshopTab: hasDiagnosis ? 'recommendations' : 'inbox',
      done: hasDiagnosis,
    });
    steps.push({
      id: 'workshop_write',
      title: 'Commission the rewrite',
      why: 'Select recommendations and scope, then Write it. Caspa produces a manuscript-ready artefact.',
      action: commissionComplete ? 'View artefact' : hasDiagnosis ? 'Finish commission' : 'Open Workshop',
      view: 'workshop',
      workshopTab: commissionComplete ? 'workshop' : hasDiagnosis ? 'recommendations' : 'inbox',
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
      workshopTab: words > 0 && !hasDiagnosis ? 'inbox' : undefined,
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
      workshopTab: hasDiagnosis ? 'recommendations' : 'inbox',
      done: hasDiagnosis,
    });

    steps.push({
      id: 'workshop_write',
      title: poetry ? 'Commission the cut / rewrite' : 'Commission the rewrite',
      why: 'Direct the idea if needed, select recommendations, then Write it. Caspa produces a manuscript-ready artefact for White Page.',
      action: commissionComplete ? 'View artefact' : hasChapters ? 'Finish commission' : 'Open Workshop',
      view: 'workshop',
      workshopTab: commissionComplete ? 'workshop' : hasDiagnosis ? 'recommendations' : 'inbox',
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
