import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { approvalDecisions, approvalRequirements, coverConcepts, illustrationAssets, layoutVersions, manuscriptVersions, productionPreflights, projectAuditEvents, projectCollaborators, projects, reviewAssignments, reviewRounds, reviewSubmissions, revisionPlans, users } from "../../drizzle/schema";
import { anonymousReviewLabel, canRoleApprove, type ApprovalArea, type CollaboratorRole, type ReviewDimension } from "../../shared/collaboration";
import { getDb } from "../db";
import { CaspaServiceError, createTraceId, logPrivateError } from "./errors";
import { requireOwnedProject, requireOwnedVersion } from "./repository";

const reviewerLabels = ["Reader Alder", "Reader Briar", "Reader Cinder", "Reader Dune", "Reader Elm", "Reader Fable"];
const manuscriptLabelPrefixes = ["Manuscript Amber", "Manuscript Cedar", "Manuscript Flint", "Manuscript Lark", "Manuscript Rowan", "Manuscript Vale"];

function randomizedManuscriptLabel() {
  const prefix = manuscriptLabelPrefixes[randomBytes(1)[0]! % manuscriptLabelPrefixes.length]!;
  return `${prefix} · ${randomBytes(2).toString("hex").toUpperCase()}`;
}

function randomizedReaderLabel() {
  const prefix = reviewerLabels[randomBytes(1)[0]! % reviewerLabels.length]!;
  return `${prefix} · ${randomBytes(2).toString("hex").toUpperCase()}`;
}

async function database() {
  const db = await getDb();
  if (!db) throw new CaspaServiceError("DATABASE_UNAVAILABLE", "Collaboration is temporarily unavailable. Please try again.");
  return db;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function audit(projectId: number, actorUserId: number | null, eventType: string, targetType: string, targetId: number | null, details: Record<string, unknown>) {
  const db = await database();
  await db.insert(projectAuditEvents).values({ projectId, actorUserId, eventType, targetType, targetId, detailsJson: JSON.stringify(details) });
}

async function requireActiveCollaborator(userId: number, projectId: number, role?: CollaboratorRole) {
  const db = await database();
  const rows = await db.select().from(projectCollaborators).where(and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId), eq(projectCollaborators.status, "active"))).limit(1);
  const collaborator = rows[0];
  if (!collaborator || (role && collaborator.role !== role)) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "You do not have access to this project collaboration action.");
  return collaborator;
}

export async function getCollaborationWorkspace(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const [collaborators, rounds, requirements, decisions, events] = await Promise.all([
    db.select({ collaborator: projectCollaborators, user: users }).from(projectCollaborators).leftJoin(users, eq(projectCollaborators.userId, users.id)).where(eq(projectCollaborators.projectId, projectId)).orderBy(asc(projectCollaborators.createdAt)),
    db.select().from(reviewRounds).where(eq(reviewRounds.projectId, projectId)).orderBy(desc(reviewRounds.createdAt)),
    db.select().from(approvalRequirements).where(eq(approvalRequirements.projectId, projectId)),
    db.select().from(approvalDecisions).where(eq(approvalDecisions.projectId, projectId)).orderBy(desc(approvalDecisions.createdAt)),
    db.select().from(projectAuditEvents).where(eq(projectAuditEvents.projectId, projectId)).orderBy(desc(projectAuditEvents.createdAt)).limit(60),
  ]);
  const roundIds = rounds.map(round => round.id);
  const submissions = roundIds.length ? await db.select().from(reviewSubmissions).where(inArray(reviewSubmissions.reviewRoundId, roundIds)) : [];
  const assignments = roundIds.length ? await db.select().from(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds)) : [];
  const summaries = rounds.map(round => {
    const roundSubmissions = submissions.filter(submission => submission.reviewRoundId === round.id);
    const totals: Record<string, number[]> = {};
    for (const submission of roundSubmissions) {
      const ratings = JSON.parse(submission.ratingsJson) as Record<string, number>;
      for (const [dimension, score] of Object.entries(ratings)) if (typeof score === "number") (totals[dimension] ||= []).push(score);
    }
    return { ...round, submissionCount: roundSubmissions.length, assignmentCount: assignments.filter(assignment => assignment.reviewRoundId === round.id).length, averages: Object.fromEntries(Object.entries(totals).map(([key, scores]) => [key, Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10])) };
  });
  const reviewerByAssignment = new Map(assignments.map(assignment => [assignment.id, collaborators.find(item => item.collaborator.id === assignment.collaboratorId)]));
  const decisionViews = decisions.map(decision => {
    const collaborator = collaborators.find(item => item.collaborator.id === decision.collaboratorId);
    return { ...decision, collaboratorRole: collaborator?.collaborator.role ?? "unknown", collaboratorName: collaborator?.user?.name ?? collaborator?.collaborator.invitedEmail ?? "Collaborator" };
  });
  const feedbackByRound = new Map(rounds.filter(round => round.status === "closed").map(round => [round.id, submissions.filter(submission => submission.reviewRoundId === round.id).map(submission => {
    const reviewer = reviewerByAssignment.get(submission.assignmentId);
    return { id: submission.id, feedback: submission.feedback, submittedAt: submission.submittedAt, reviewer: round.identityPolicy === "reveal-on-close" ? (reviewer?.user?.name ?? reviewer?.collaborator.invitedEmail ?? "Reviewer") : "Anonymous reviewer" };
  })]));
  return {
    collaborators: collaborators.map(({ collaborator, user }) => ({ ...collaborator, displayName: user?.name ?? null, acceptedEmail: user?.email ?? null, inviteTokenHash: undefined })),
    rounds: summaries.map(round => ({ ...round, permittedFeedback: feedbackByRound.get(round.id) ?? [] })),
    requirements,
    decisions: decisionViews,
    auditEvents: events,
  };
}

export async function inviteCollaborator(ownerId: number, input: { projectId: number; email: string; role: CollaboratorRole }) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  const db = await database();
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(projectCollaborators).where(and(eq(projectCollaborators.projectId, project.id), eq(projectCollaborators.invitedEmail, email))).limit(1);
  if (existing[0]) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "That email already has an invitation or collaborator role for this project.");
  const token = randomBytes(18).toString("base64url");
  const result = await db.insert(projectCollaborators).values({ projectId: project.id, role: input.role, invitedEmail: email, inviteTokenHash: hashToken(token), invitedByUserId: ownerId });
  const collaboratorId = Number(result[0].insertId);
  await audit(project.id, ownerId, "collaborator-invited", "collaborator", collaboratorId, { role: input.role, invitedEmail: email });
  return { collaboratorId, email, role: input.role, inviteCode: token, note: "Share this one-time invite code privately. CASPA requires the invited account email to match before acceptance." };
}

export async function acceptInvitation(userId: number, input: { inviteCode: string }) {
  const db = await database();
  const rows = await db.select({ collaborator: projectCollaborators, user: users }).from(projectCollaborators).leftJoin(users, eq(users.id, userId)).where(eq(projectCollaborators.inviteTokenHash, hashToken(input.inviteCode))).limit(1);
  const row = rows[0];
  if (!row || row.collaborator.status !== "invited") throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "This invitation is no longer available.");
  const email = row.user?.email?.trim().toLowerCase();
  if (!email || email !== row.collaborator.invitedEmail.trim().toLowerCase()) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "Sign in with the email address that received this invitation.");
  await db.update(projectCollaborators).set({ userId, status: "active", acceptedAt: new Date() }).where(eq(projectCollaborators.id, row.collaborator.id));
  await audit(row.collaborator.projectId, userId, "collaborator-accepted", "collaborator", row.collaborator.id, { role: row.collaborator.role });
  return { projectId: row.collaborator.projectId, role: row.collaborator.role, status: "active" as const };
}

export async function revokeCollaborator(ownerId: number, collaboratorId: number) {
  const db = await database();
  const rows = await db.select().from(projectCollaborators).where(eq(projectCollaborators.id, collaboratorId)).limit(1);
  const collaborator = rows[0];
  if (!collaborator) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "That collaborator is no longer available.");
  await requireOwnedProject(ownerId, collaborator.projectId);
  await db.update(projectCollaborators).set({ status: "revoked", revokedAt: new Date() }).where(eq(projectCollaborators.id, collaboratorId));
  await db.update(reviewAssignments).set({ status: "revoked" }).where(eq(reviewAssignments.collaboratorId, collaboratorId));
  await audit(collaborator.projectId, ownerId, "collaborator-revoked", "collaborator", collaboratorId, { role: collaborator.role });
  return { id: collaboratorId, status: "revoked" as const };
}

export async function changeCollaboratorRole(ownerId: number, collaboratorId: number, role: CollaboratorRole) {
  const db = await database();
  const rows = await db.select().from(projectCollaborators).where(eq(projectCollaborators.id, collaboratorId)).limit(1);
  const collaborator = rows[0];
  if (!collaborator || collaborator.status === "revoked") throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "That collaborator is no longer available.");
  await requireOwnedProject(ownerId, collaborator.projectId);
  if (collaborator.role === role) return { id: collaboratorId, role, unchanged: true as const };
  await db.update(projectCollaborators).set({ role }).where(eq(projectCollaborators.id, collaboratorId));
  await audit(collaborator.projectId, ownerId, "collaborator-role-changed", "collaborator", collaboratorId, { from: collaborator.role, to: role });
  return { id: collaboratorId, role, unchanged: false as const };
}

export async function openReviewRound(ownerId: number, input: { projectId: number; versionId: number; title: string; collaboratorIds: number[]; identityPolicy: "anonymous" | "reveal-on-close" }) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  const version = await requireOwnedVersion(ownerId, input.versionId);
  if (version.projectId !== project.id) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Choose a manuscript version belonging to this project.");
  const db = await database();
  const collaborators = await db.select().from(projectCollaborators).where(inArray(projectCollaborators.id, input.collaboratorIds));
  if (collaborators.length !== input.collaboratorIds.length || collaborators.some(item => item.projectId !== project.id || item.status !== "active")) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "Choose active collaborators from this project for the review round.");
  const roundResult = await db.insert(reviewRounds).values({ projectId: project.id, versionId: version.id, title: input.title, anonymousLabel: randomizedManuscriptLabel(), identityPolicy: input.identityPolicy, createdByUserId: ownerId });
  const roundId = Number(roundResult[0].insertId);
  await db.insert(reviewAssignments).values(collaborators.map(collaborator => ({ reviewRoundId: roundId, collaboratorId: collaborator.id, anonymousLabel: randomizedReaderLabel(), status: "assigned" as const })));
  await audit(project.id, ownerId, "review-round-opened", "review-round", roundId, { versionId: version.id, assignmentCount: collaborators.length, identityPolicy: input.identityPolicy });
  return { id: roundId, anonymousLabel: anonymousReviewLabel(roundId), status: "open" as const };
}

export async function getReviewerRound(userId: number, reviewRoundId: number) {
  const db = await database();
  const rows = await db.select({ round: reviewRounds, assignment: reviewAssignments, collaborator: projectCollaborators, version: manuscriptVersions }).from(reviewAssignments).innerJoin(reviewRounds, eq(reviewAssignments.reviewRoundId, reviewRounds.id)).innerJoin(projectCollaborators, eq(reviewAssignments.collaboratorId, projectCollaborators.id)).innerJoin(manuscriptVersions, eq(reviewRounds.versionId, manuscriptVersions.id)).where(eq(reviewAssignments.reviewRoundId, reviewRoundId)).limit(10);
  const row = rows.find(item => item.collaborator.userId === userId && item.collaborator.status === "active" && item.assignment.status === "assigned");
  if (!row || row.round.status !== "open") throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "This blind review is not available to your account.");
  return { reviewRoundId: row.round.id, reviewTitle: row.round.title, manuscriptLabel: `${row.round.anonymousLabel} · ${row.assignment.anonymousLabel}`, reviewerLabel: row.assignment.anonymousLabel, manuscript: row.version.content, wordCount: row.version.wordCount, identityPolicy: row.round.identityPolicy };
}

export async function submitBlindReview(userId: number, input: { reviewRoundId: number; ratings: Record<ReviewDimension, number>; feedback: string }) {
  const db = await database();
  const rows = await db.select({ round: reviewRounds, assignment: reviewAssignments, collaborator: projectCollaborators }).from(reviewAssignments).innerJoin(reviewRounds, eq(reviewAssignments.reviewRoundId, reviewRounds.id)).innerJoin(projectCollaborators, eq(reviewAssignments.collaboratorId, projectCollaborators.id)).where(eq(reviewAssignments.reviewRoundId, input.reviewRoundId));
  const row = rows.find(item => item.collaborator.userId === userId && item.collaborator.status === "active");
  if (!row || row.round.status !== "open" || row.assignment.status !== "assigned") throw new CaspaServiceError("REVIEW_CLOSED", "This review cannot be submitted or changed.");
  await db.insert(reviewSubmissions).values({ reviewRoundId: row.round.id, assignmentId: row.assignment.id, ratingsJson: JSON.stringify(input.ratings), feedback: input.feedback });
  await db.update(reviewAssignments).set({ status: "submitted", submittedAt: new Date() }).where(eq(reviewAssignments.id, row.assignment.id));
  await audit(row.round.projectId, userId, "blind-review-submitted", "review-round", row.round.id, { assignmentId: row.assignment.id });
  return { reviewRoundId: row.round.id, status: "submitted" as const };
}

export async function closeReviewRound(ownerId: number, reviewRoundId: number) {
  const db = await database();
  const rows = await db.select().from(reviewRounds).where(eq(reviewRounds.id, reviewRoundId)).limit(1);
  const round = rows[0];
  if (!round) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "This review round is no longer available.");
  await requireOwnedProject(ownerId, round.projectId);
  if (round.status !== "open") throw new CaspaServiceError("REVIEW_CLOSED", "This review round has already closed.");
  await db.update(reviewRounds).set({ status: "closed", closedAt: new Date() }).where(eq(reviewRounds.id, round.id));
  await audit(round.projectId, ownerId, "review-round-closed", "review-round", round.id, { identityPolicy: round.identityPolicy });
  return { id: round.id, status: "closed" as const };
}

export async function setApprovalRequirement(ownerId: number, input: { projectId: number; area: ApprovalArea; requiredRole: CollaboratorRole; enabled: boolean }) {
  await requireOwnedProject(ownerId, input.projectId);
  if (!canRoleApprove(input.requiredRole, input.area)) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Editors approve revisions; designers approve visual and production decisions.");
  const db = await database();
  await db.insert(approvalRequirements).values({ ...input, updatedByUserId: ownerId }).onDuplicateKeyUpdate({ set: { enabled: input.enabled, updatedByUserId: ownerId, updatedAt: new Date() } });
  await audit(input.projectId, ownerId, "approval-requirement-updated", "approval-requirement", null, input);
  return input;
}

export async function recordCollaboratorApproval(userId: number, input: { projectId: number; area: ApprovalArea; targetType: string; targetId: number; decision: "approved" | "rejected"; note?: string }) {
  const collaborator = await requireActiveCollaborator(userId, input.projectId);
  if (!canRoleApprove(collaborator.role, input.area)) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "Your role cannot approve this project decision.");
  const db = await database();
  const requirements = await db.select().from(approvalRequirements).where(and(eq(approvalRequirements.projectId, input.projectId), eq(approvalRequirements.area, input.area), eq(approvalRequirements.requiredRole, collaborator.role), eq(approvalRequirements.enabled, true)));
  if (!requirements.length) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "The author has not requested collaborator approval for this decision.");
  const inbox = await getApprovalInbox(userId, input.projectId);
  if (!inbox.items.some(item => item.area === input.area && item.targetType === input.targetType && item.targetId === input.targetId)) {
    throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "This decision is not currently assigned to your approval inbox.");
  }
  const existing = await db.select().from(approvalDecisions).where(and(eq(approvalDecisions.collaboratorId, collaborator.id), eq(approvalDecisions.targetType, input.targetType), eq(approvalDecisions.targetId, input.targetId))).limit(1);
  if (existing[0]) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Your approval decision is already recorded and cannot be changed.");
  const result = await db.insert(approvalDecisions).values({ ...input, collaboratorId: collaborator.id, note: input.note?.trim() || null });
  const decisionId = Number(result[0].insertId);
  await audit(input.projectId, userId, "collaborator-approval-recorded", "approval-decision", decisionId, { area: input.area, targetType: input.targetType, targetId: input.targetId, decision: input.decision });
  return { id: decisionId, decision: input.decision };
}

export async function getApprovalInbox(userId: number, projectId: number) {
  const collaborator = await requireActiveCollaborator(userId, projectId);
  const db = await database();
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const project = projectRows[0];
  if (!project) throw new CaspaServiceError("COLLABORATOR_ACCESS_DENIED", "This project is not available to your account.");
  const requirements = await db.select().from(approvalRequirements).where(and(eq(approvalRequirements.projectId, projectId), eq(approvalRequirements.requiredRole, collaborator.role), eq(approvalRequirements.enabled, true)));
  const items: Array<{ area: ApprovalArea; targetType: string; targetId: number; title: string; detail: string }> = [];
  for (const requirement of requirements) {
    if (requirement.area === "revision") {
      const rows = await db.select().from(revisionPlans).where(and(eq(revisionPlans.projectId, projectId), eq(revisionPlans.status, "approved")));
      rows.forEach(plan => items.push({ area: "revision", targetType: "revision-plan", targetId: plan.id, title: "Revision plan", detail: `${plan.scope.replace(/-/g, " ")} scope · plan ${plan.id}` }));
    }
    if (requirement.area === "cover") {
      const rows = await db.select().from(coverConcepts).where(and(eq(coverConcepts.projectId, projectId), eq(coverConcepts.status, "generated")));
      rows.forEach(cover => items.push({ area: "cover", targetType: "cover-concept", targetId: cover.id, title: cover.name, detail: cover.direction }));
    }
    if (requirement.area === "illustration") {
      const rows = await db.select().from(illustrationAssets).where(and(eq(illustrationAssets.projectId, projectId), eq(illustrationAssets.status, "generated")));
      rows.forEach(asset => items.push({ area: "illustration", targetType: "illustration-asset", targetId: asset.id, title: `Illustration asset ${asset.id}`, detail: asset.source === "ai" ? "Generated illustration" : "Uploaded illustration" }));
    }
    if (requirement.area === "layout") {
      const rows = await db.select().from(layoutVersions).where(and(eq(layoutVersions.projectId, projectId), eq(layoutVersions.status, "draft")));
      rows.forEach(layout => items.push({ area: "layout", targetType: "layout-version", targetId: layout.id, title: layout.name, detail: `${layout.pageCount} pages` }));
    }
    if (requirement.area === "proof" || requirement.area === "production-export") {
      const rows = await db.select().from(productionPreflights).where(and(eq(productionPreflights.projectId, projectId), eq(productionPreflights.passed, true))).orderBy(desc(productionPreflights.createdAt)).limit(1);
      const preflight = rows[0];
      if (preflight) items.push({ area: requirement.area, targetType: "production-preflight", targetId: preflight.id, title: requirement.area === "proof" ? "Passing production proof" : "Production package release", detail: "Latest server preflight passed" });
    }
  }
  const decisions = await db.select().from(approvalDecisions).where(eq(approvalDecisions.collaboratorId, collaborator.id));
  const decided = new Set(decisions.map(decision => `${decision.targetType}:${decision.targetId}`));
  return { projectTitle: project.title, role: collaborator.role, items: items.filter(item => !decided.has(`${item.targetType}:${item.targetId}`)) };
}

export async function requireConfiguredApprovals(ownerId: number, projectId: number, area: ApprovalArea, targetType: string, targetId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const requirements = await db.select().from(approvalRequirements).where(and(eq(approvalRequirements.projectId, projectId), eq(approvalRequirements.area, area), eq(approvalRequirements.enabled, true)));
  for (const requirement of requirements) {
    const decisions = await db.select({ decision: approvalDecisions, collaborator: projectCollaborators }).from(approvalDecisions).innerJoin(projectCollaborators, eq(approvalDecisions.collaboratorId, projectCollaborators.id)).where(and(eq(approvalDecisions.projectId, projectId), eq(approvalDecisions.targetType, targetType), eq(approvalDecisions.targetId, targetId), eq(projectCollaborators.role, requirement.requiredRole), eq(projectCollaborators.status, "active")));
    if (!decisions.some(row => row.decision.decision === "approved")) throw new CaspaServiceError("APPROVAL_REQUIRED", `An active ${requirement.requiredRole} approval is required before this decision can proceed.`);
  }
  return true;
}
