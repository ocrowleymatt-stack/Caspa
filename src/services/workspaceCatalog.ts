import type { HybridStage } from './hybridWorkflow';
import type { StudioToolId } from '../components/StudioToolBridge';

export const DESK_STAGES = ['Library', 'Idea', 'Structure', 'Draft', 'Workshop', 'Revise', 'Finish', 'Publish'] as const;
export type DeskStage = (typeof DESK_STAGES)[number];

export type WorkspaceToolId =
  | StudioToolId
  | 'research'
  | 'bible'
  | 'psychology'
  | 'gold'
  | 'redpen'
  | 'design'
  | 'publish'
  | 'workshop'
  | 'rebuild'
  | 'compare'
  | 'recovery'
  | 'preflight';

export type WorkspaceTool = {
  id: WorkspaceToolId;
  label: string;
  help: string;
  stages: DeskStage[];
  destructive?: boolean;
};

export const WORKSPACE_TOOLS: WorkspaceTool[] = [
  { id: 'research', label: 'Research Desk', help: 'Collect sources and notes against this server project. Findings stay on the project; they do not rewrite the manuscript.', stages: ['Library', 'Idea', 'Draft', 'Workshop'] },
  { id: 'intelligence', label: 'Intelligence Lab', help: 'Deep research and fact-grounding for the open version. Notes return to the same project.', stages: ['Idea', 'Draft', 'Workshop'] },
  { id: 'brainstorm', label: 'Brainstorm', help: 'Pressure the premise. Saves idea and tone to project artefacts, not the canonical manuscript.', stages: ['Idea', 'Structure'] },
  { id: 'bible', label: 'Story Bible', help: 'Live canon assembled from Workshop, psychology, research, and promises for this project.', stages: ['Structure', 'Draft', 'Workshop'] },
  { id: 'characters', label: 'Character Forge', help: 'Wants, masks, and pressure points. Characters persist as project artefacts.', stages: ['Structure', 'Draft'] },
  { id: 'psychology', label: 'Psychology Studio', help: 'Emotional journeys for the open manuscript. Blueprint is stored on the project.', stages: ['Structure', 'Workshop'] },
  { id: 'plot', label: 'Plot Architect', help: 'Spine and turns. Plot nodes save as artefacts; chapter rewrites stay proposals until accepted.', stages: ['Structure', 'Revise'] },
  { id: 'writing', label: 'Writing Studio', help: 'Chapter craft room on the current version. Accepted chapter text becomes a new immutable version.', stages: ['Draft', 'Revise'] },
  { id: 'autodraft', label: 'Auto Drafter', help: 'Deep-draft held chapters. Output is a preview until you accept a version.', stages: ['Draft', 'Revise'] },
  { id: 'workshop', label: 'Workshop diagnosis', help: 'Evidence-backed diagnosis of the current immutable version. The manuscript is not changed.', stages: ['Workshop'] },
  { id: 'swarm', label: 'Critic Swarm', help: 'Multiple critical lenses. Accepted edits become a manuscript proposal, not a silent overwrite.', stages: ['Workshop', 'Revise'] },
  { id: 'rebuild', label: 'Rip up and rebuild', help: 'Analyse, plan, preview, then accept or reject each bounded change. Only accepted changes create a new version.', stages: ['Revise'], destructive: true },
  { id: 'architect', label: 'Rip & Fix', help: 'Specialist fixer for stuck structure. Treats output as a proposal against the selected version.', stages: ['Revise'], destructive: true },
  { id: 'scalpel', label: 'Scalpel', help: 'Cut sludge. Proposed cuts preview before they can become a version.', stages: ['Revise'] },
  { id: 'gold', label: 'Gold Refinery', help: 'Multi-pass polish. The refined text is a proposal until you accept an immutable version.', stages: ['Revise', 'Finish'] },
  { id: 'redpen', label: 'Red Pen', help: 'Fast quality scan of the current version. Advisory only.', stages: ['Workshop', 'Revise', 'Finish', 'Publish'] },
  { id: 'prizes', label: 'Prize Calibration', help: 'Craft-lens pressure test. Does not mutate the manuscript.', stages: ['Finish'] },
  { id: 'design', label: 'Imagine', help: 'Grok Imagine stills, then cover and picture-book design.', stages: ['Publish'] },
  { id: 'preflight', label: 'Proof / preflight', help: 'Server publication checks against the current immutable version.', stages: ['Finish', 'Publish'] },
  { id: 'publish', label: 'Export and publishing', help: 'Download only the version that passed the latest preflight.', stages: ['Publish'] },
  { id: 'compare', label: 'Version compare', help: 'Read two immutable versions side by side. Restore creates a new snapshot.', stages: ['Revise', 'Finish'] },
  { id: 'recovery', label: 'Recovery', help: 'Promote a completed server job into project history without running AI again.', stages: ['Finish'] },
  { id: 'pilot', label: 'Pilot Seat', help: 'Directive steering that proposes plot and character changes you can commit as artefacts.', stages: ['Structure', 'Draft'] },
];

export const STAGE_HELP: Record<DeskStage, string> = {
  Library: 'Server library. Every card is a PostgreSQL project. Create from a sentence, a file, or open existing work.',
  Idea: 'Ingest a sentence, notes, or a manuscript. Photographs and receipts are OCR’d on attach; if extraction fails, nothing is stored. Promoting sources into the manuscript requires an explicit version.',
  Structure: 'Reveal Story Bible, characters, psychology, and plot only when you need them. Nothing here overwrites the canonical manuscript.',
  Draft: 'Write yourself or ask Caspa for a private chapter preview. Reject leaves the version untouched. Accept creates a new immutable version.',
  Workshop: 'Diagnose the saved version. Findings are evidence, not edits.',
  Revise: 'Rip up and rebuild with per-change approval, or open Scalpel, Gold, or Auto Drafter. Earlier versions remain.',
  Finish: 'Recover interrupted or completed jobs. Polling never re-downloads the whole manuscript.',
  Publish: 'Preflight the current version, then download that exact checksum. A later save needs a fresh preflight.',
};

export function deskStageToHybrid(stage: DeskStage): HybridStage | null {
  if (stage === 'Library' || stage === 'Idea' || stage === 'Structure') return stage === 'Idea' || stage === 'Structure' ? 'draft' : null;
  return stage.toLowerCase() as HybridStage;
}

export function toolsForStage(stage: DeskStage): WorkspaceTool[] {
  if (stage === 'Library') return WORKSPACE_TOOLS.filter((tool) => tool.stages.includes('Library'));
  return WORKSPACE_TOOLS.filter((tool) => tool.stages.includes(stage));
}

export function findWorkspaceTool(labelOrId: string): WorkspaceTool | undefined {
  const needle = labelOrId.trim().toLowerCase();
  return WORKSPACE_TOOLS.find((tool) => tool.id === needle || tool.label.toLowerCase() === needle);
}

export function isStudioToolId(id: WorkspaceToolId): id is StudioToolId {
  return ['brainstorm', 'characters', 'plot', 'architect', 'swarm', 'autodraft', 'scalpel', 'pilot', 'intelligence', 'writing', 'prizes'].includes(id);
}
