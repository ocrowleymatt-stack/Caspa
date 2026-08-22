export const projectStates = [
  "draft",
  "diagnosed",
  "plan-approved",
  "revision-running",
  "review",
  "export-ready",
  "art-direction",
  "art-approved",
  "layout",
  "proof-review",
  "production-ready",
  "archived",
] as const;

export type ProjectState = (typeof projectStates)[number];

export const PROJECT_STATE_ORDER: readonly ProjectState[] = projectStates;

const allowedTransitions: Record<ProjectState, readonly ProjectState[]> = {
  draft: ["diagnosed", "archived"],
  diagnosed: ["plan-approved", "archived"],
  "plan-approved": ["revision-running", "archived"],
  "revision-running": ["review"],
  review: ["export-ready", "archived"],
  "export-ready": ["art-direction", "archived"],
  "art-direction": ["art-approved", "archived"],
  "art-approved": ["layout", "archived"],
  layout: ["proof-review", "archived"],
  "proof-review": ["layout", "production-ready", "archived"],
  "production-ready": ["archived"],
  archived: ["draft", "diagnosed", "plan-approved", "review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready"],
};

export const STATE_LABELS: Record<ProjectState, string> = {
  draft: "Draft",
  diagnosed: "Diagnosed",
  "plan-approved": "Plan approved",
  "revision-running": "Revision running",
  review: "Review",
  "export-ready": "Export ready",
  "art-direction": "Art direction",
  "art-approved": "Art approved",
  layout: "Layout",
  "proof-review": "Proof review",
  "production-ready": "Production ready",
  archived: "Archived",
};

export type WorkflowAction =
  | "edit-manuscript"
  | "draft-manuscript"
  | "run-diagnosis"
  | "approve-plan"
  | "start-revision"
  | "review-revision"
  | "run-preflight"
  | "download-export"
  | "start-art-direction"
  | "edit-art-brief"
  | "generate-cover"
  | "approve-cover"
  | "approve-illustrations"
  | "approve-art-program"
  | "compose-layout"
  | "submit-proof"
  | "resolve-proof"
  | "run-production-preflight"
  | "download-production"
  | "restore-version"
  | "archive"
  | "restore-archive";

const actionStates: Record<WorkflowAction, readonly ProjectState[]> = {
  "edit-manuscript": ["draft", "review"],
  "draft-manuscript": ["draft"],
  "run-diagnosis": ["draft"],
  "approve-plan": ["diagnosed"],
  "start-revision": ["plan-approved"],
  "review-revision": ["review"],
  "run-preflight": ["review"],
  "download-export": ["export-ready"],
  "start-art-direction": ["export-ready"],
  "edit-art-brief": ["art-direction"],
  "generate-cover": ["art-direction"],
  "approve-cover": ["art-direction"],
  "approve-illustrations": ["art-direction"],
  "approve-art-program": ["art-direction"],
  "compose-layout": ["art-approved", "layout"],
  "submit-proof": ["layout"],
  "resolve-proof": ["proof-review"],
  "run-production-preflight": ["proof-review"],
  "download-production": ["production-ready"],
  "restore-version": ["draft", "diagnosed", "plan-approved", "review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready"],
  archive: ["draft", "diagnosed", "plan-approved", "review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready"],
  "restore-archive": ["archived"],
};

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(from: ProjectState, to: ProjectState): void {
  if (!canTransition(from, to)) {
    throw new Error(`WORKFLOW_TRANSITION_DENIED:${from}:${to}`);
  }
}

export function canPerformAction(state: ProjectState, action: WorkflowAction): boolean {
  return actionStates[action].includes(state);
}

export function assertActionAllowed(state: ProjectState, action: WorkflowAction): void {
  if (!canPerformAction(state, action)) {
    throw new Error(`WORKFLOW_ACTION_DENIED:${state}:${action}`);
  }
}

export function nextGuidedAction(state: ProjectState): WorkflowAction {
  switch (state) {
    case "draft": return "draft-manuscript";
    case "diagnosed": return "approve-plan";
    case "plan-approved": return "start-revision";
    case "revision-running": return "review-revision";
    case "review": return "run-preflight";
    case "export-ready": return "start-art-direction";
    case "art-direction": return "approve-art-program";
    case "art-approved": return "compose-layout";
    case "layout": return "submit-proof";
    case "proof-review": return "run-production-preflight";
    case "production-ready": return "download-production";
    case "archived": return "restore-archive";
  }
}

export function stateProgress(state: ProjectState): number {
  if (state === "archived") return 100;
  const index = PROJECT_STATE_ORDER.indexOf(state);
  return Math.round((index / (PROJECT_STATE_ORDER.length - 2)) * 100);
}
