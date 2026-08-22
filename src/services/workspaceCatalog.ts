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
  { id: 'workshop', label: 'Workshop diagnosis', help: 'A short note on what is stuck on the page you can see. The manuscript is not changed.', stages: ['Workshop'] },
  { id: 'swarm', label: 'Critic Swarm', help: 'Several specialists read this page through Atlas. Nothing is kept until you say so.', stages: ['Workshop', 'Revise'] },
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
  Library: 'Your books. Start from a sentence, open a file, or pick up where you left off.',
  Idea: 'Get the thought onto the page. Attach notes or a photo if you have them. Saving makes this the first version of the book.',
  Structure: 'Who wants what, and what turns. Rooms here do not overwrite the page until you accept a change.',
  Draft: 'Write on the page, or name a chapter and ask Caspa for a private preview. Keep it only if it earns a place.',
  Workshop: 'See what is holding, then ask the critics. Neither rewrites the page.',
  Revise: 'Change one chapter at a time. Earlier versions stay.',
  Finish: 'Collect anything Caspa already finished for this book. Nothing is added until you say so.',
  Publish: 'Check the saved version, then download that copy. If you keep writing, check again before you export.',
};

export const STAGE_NEXT: Record<DeskStage, { hint: string; next?: DeskStage; nextLabel?: string }> = {
  Library: { hint: 'Start a book, or open one you already have.' },
  Idea: { hint: 'When the idea is on the page, map the people and the spine.', next: 'Structure', nextLabel: 'Next: Structure' },
  Structure: { hint: 'When you know who it is about, write.', next: 'Draft', nextLabel: 'Next: Draft' },
  Draft: { hint: 'When you have pages, see what is working.', next: 'Workshop', nextLabel: 'Next: Workshop' },
  Workshop: { hint: 'When you know the wound, revise one chapter.', next: 'Revise', nextLabel: 'Next: Revise' },
  Revise: { hint: 'When the turn is true, gather the finished work.', next: 'Finish', nextLabel: 'Next: Finish' },
  Finish: { hint: 'When the book is the one you mean, take a copy home.', next: 'Publish', nextLabel: 'Next: Publish' },
  Publish: { hint: 'Check the saved version, then download it.' },
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
