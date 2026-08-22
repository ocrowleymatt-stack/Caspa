export const collaboratorRoles = ["editor", "designer"] as const;
export type CollaboratorRole = (typeof collaboratorRoles)[number];

export const approvalAreas = ["revision", "cover", "illustration", "layout", "proof", "production-export"] as const;
export type ApprovalArea = (typeof approvalAreas)[number];

export const reviewDimensions = [
  "prose",
  "structure",
  "clarity",
  "emotional-effect",
  "character",
  "pacing",
  "visual-direction",
  "cover",
  "illustration-continuity",
  "layout-readability",
] as const;
export type ReviewDimension = (typeof reviewDimensions)[number];

export function canRoleApprove(role: CollaboratorRole, area: ApprovalArea) {
  if (area === "revision") return role === "editor";
  return role === "designer";
}

export function anonymousReviewLabel(roundId: number) {
  return `Manuscript ${String.fromCharCode(65 + ((roundId - 1) % 26))}`;
}
