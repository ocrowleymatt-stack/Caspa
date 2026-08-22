import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectAuditEvents, projectCollaborators, reviewAssignments, reviewRounds, reviewSubmissions, users } from "../../drizzle/schema";
import { reviewDimensions } from "../../shared/collaboration";
import { appRouter } from "../routers";
import { getDb } from "../db";
import type { TrpcContext } from "../_core/context";

type DbUser = NonNullable<TrpcContext["user"]>;
type Fixture = { owner: DbUser; editor: DbUser; outsider: DbUser; ownerCaller: ReturnType<typeof appRouter.createCaller>; editorCaller: ReturnType<typeof appRouter.createCaller>; outsiderCaller: ReturnType<typeof appRouter.createCaller>; projectId: number; title: string; versionId: number; collaboratorId: number; roundId: number };
let fixture: Fixture | null = null;

function callerFor(user: DbUser) {
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] });
}

async function createUser(label: string) {
  const db = await getDb(); if (!db) throw new Error("DATABASE_REQUIRED_FOR_COLLABORATION_TEST");
  const openId = `caspa-collab-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({ openId, name: `Collaboration ${label}`, email: `${openId}@example.test`, loginMethod: "vitest", lastSignedIn: new Date() });
  const row = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
  if (!row) throw new Error("COLLABORATION_TEST_USER_FAILED");
  return row;
}

const ratings = Object.fromEntries(reviewDimensions.map(dimension => [dimension, 4])) as Record<(typeof reviewDimensions)[number], number>;

beforeEach(async () => {
  const owner = await createUser("owner"); const editor = await createUser("editor"); const outsider = await createUser("outsider");
  const ownerCaller = callerFor(owner); const editorCaller = callerFor(editor);
  const created = await ownerCaller.projects.create({ title: `CASPA collaboration integration ${Date.now()}`, authorName: owner.name || "Author", format: "fiction", premise: "An archivist follows an erased civic record through a city that quietly removes its own history.", targetWordCount: 12000 });
  const version = await ownerCaller.projects.saveManuscript({ projectId: created.id, name: "Blind review source", content: "# Arrival\n\nMara entered the archive and recorded ash beside the missing index. The shelves hummed with every record the city wanted gone." });
  const invitation = await ownerCaller.collaboration.invite({ projectId: created.id, email: editor.email!, role: "editor" });
  await editorCaller.collaboration.accept({ inviteCode: invitation.inviteCode });
  const workspace = await ownerCaller.collaboration.workspace({ projectId: created.id });
  const collaborator = workspace.collaborators.find(item => item.userId === editor.id);
  if (!collaborator) throw new Error("COLLABORATOR_NOT_CREATED");
  const round = await ownerCaller.collaboration.openRound({ projectId: created.id, versionId: version.id, title: "Anonymous first read", collaboratorIds: [collaborator.id], identityPolicy: "anonymous" });
  fixture = { owner, editor, outsider, ownerCaller, editorCaller, outsiderCaller: callerFor(outsider), projectId: created.id, title: created.title, versionId: version.id, collaboratorId: collaborator.id, roundId: round.id };
});

afterEach(async () => {
  const active = fixture; fixture = null; if (!active) return;
  const db = await getDb();
  try {
    const roundIds = (await db!.select().from(reviewRounds).where(eq(reviewRounds.projectId, active.projectId))).map(round => round.id);
    if (roundIds.length) {
      const assignmentIds = (await db!.select().from(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds))).map(item => item.id);
      if (assignmentIds.length) await db!.delete(reviewSubmissions).where(inArray(reviewSubmissions.assignmentId, assignmentIds));
      await db!.delete(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds));
      await db!.delete(reviewRounds).where(inArray(reviewRounds.id, roundIds));
    }
    await db!.delete(projectAuditEvents).where(eq(projectAuditEvents.projectId, active.projectId));
    await db!.delete(projectCollaborators).where(eq(projectCollaborators.projectId, active.projectId));
    const workspace = await active.ownerCaller.projects.get({ projectId: active.projectId });
    if (workspace.project.currentState !== "archived") await active.ownerCaller.projects.archive({ projectId: active.projectId });
    await active.ownerCaller.settings.deleteProject({ projectId: active.projectId, confirmation: active.title });
  } finally {
    await db!.delete(users).where(inArray(users.id, [active.owner.id, active.editor.id, active.outsider.id]));
  }
});

describe("collaboration real persistence lifecycle", () => {
  it("matches invited email, conceals contributor identity, and seals a blind review after submission", async () => {
    await expect(fixture!.outsiderCaller.collaboration.reviewerRound({ reviewRoundId: fixture!.roundId })).rejects.toThrow(/COLLABORATOR_ACCESS_DENIED\|This blind review is not available/);
    const reader = await fixture!.editorCaller.collaboration.reviewerRound({ reviewRoundId: fixture!.roundId });
    expect(reader.manuscriptLabel).toMatch(/^Manuscript (Amber|Cedar|Flint|Lark|Rowan|Vale) · [A-F0-9]{4} · Reader (Alder|Briar|Cinder|Dune|Elm|Fable) · [A-F0-9]{4}$/);
    expect(reader.reviewerLabel).toMatch(/^Reader (Alder|Briar|Cinder|Dune|Elm|Fable) · [A-F0-9]{4}$/);
    expect(reader.manuscript).toContain("Mara entered the archive");
    await expect(fixture!.editorCaller.collaboration.submitReview({ reviewRoundId: fixture!.roundId, ratings, feedback: "The opening creates a quiet, unsettling mystery while the archive setting keeps the reader oriented." })).resolves.toEqual({ reviewRoundId: fixture!.roundId, status: "submitted" });
    await expect(fixture!.editorCaller.collaboration.submitReview({ reviewRoundId: fixture!.roundId, ratings, feedback: "A changed score must not replace the submitted blind review." })).rejects.toThrow(/REVIEW_CLOSED\|This review cannot be submitted or changed/);
  });

  it("reveals permitted anonymous narrative feedback only after the author closes a review round", async () => {
    await fixture!.editorCaller.collaboration.submitReview({ reviewRoundId: fixture!.roundId, ratings, feedback: "The archive imagery carries the central mystery, while the opening could slow slightly before introducing the missing index." });
    const beforeClose = await fixture!.ownerCaller.collaboration.workspace({ projectId: fixture!.projectId });
    expect(beforeClose.rounds.find(round => round.id === fixture!.roundId)?.permittedFeedback).toEqual([]);
    await fixture!.ownerCaller.collaboration.closeRound({ reviewRoundId: fixture!.roundId, authorConfirmed: true });
    const afterClose = await fixture!.ownerCaller.collaboration.workspace({ projectId: fixture!.projectId });
    expect(afterClose.rounds.find(round => round.id === fixture!.roundId)?.permittedFeedback).toMatchObject([{ reviewer: "Anonymous reviewer" }]);
  });

  it("assigns distinct randomized manuscript labels across blind rounds without exposing contributor identity", async () => {
    const first = await fixture!.editorCaller.collaboration.reviewerRound({ reviewRoundId: fixture!.roundId });
    const secondRound = await fixture!.ownerCaller.collaboration.openRound({ projectId: fixture!.projectId, versionId: fixture!.versionId, title: "Second anonymous read", collaboratorIds: [fixture!.collaboratorId], identityPolicy: "anonymous" });
    const second = await fixture!.editorCaller.collaboration.reviewerRound({ reviewRoundId: secondRound.id });
    expect(first.manuscriptLabel).toMatch(/^Manuscript (Amber|Cedar|Flint|Lark|Rowan|Vale) · [A-F0-9]{4} · Reader (Alder|Briar|Cinder|Dune|Elm|Fable) · [A-F0-9]{4}$/);
    expect(second.manuscriptLabel).toMatch(/^Manuscript (Amber|Cedar|Flint|Lark|Rowan|Vale) · [A-F0-9]{4} · Reader (Alder|Briar|Cinder|Dune|Elm|Fable) · [A-F0-9]{4}$/);
    expect(second.manuscriptLabel).not.toBe(first.manuscriptLabel);
    expect(JSON.stringify(second)).not.toContain("Fixture Author");
  });

  it("revokes active access and records project audit history", async () => {
    await fixture!.ownerCaller.collaboration.revoke({ collaboratorId: fixture!.collaboratorId, authorConfirmed: true });
    await expect(fixture!.editorCaller.collaboration.reviewerRound({ reviewRoundId: fixture!.roundId })).rejects.toThrow(/COLLABORATOR_ACCESS_DENIED\|This blind review is not available/);
    const workspace = await fixture!.ownerCaller.collaboration.workspace({ projectId: fixture!.projectId });
    expect(workspace.collaborators.find(item => item.id === fixture!.collaboratorId)?.status).toBe("revoked");
    expect(workspace.auditEvents.map(event => event.eventType)).toEqual(expect.arrayContaining(["collaborator-invited", "collaborator-accepted", "review-round-opened", "collaborator-revoked"]));
  });

  it("rejects fabricated collaborator approvals even when the author enables an approval gate", async () => {
    await fixture!.ownerCaller.collaboration.setRequirement({ projectId: fixture!.projectId, area: "revision", requiredRole: "editor", enabled: true, authorConfirmed: true });
    await expect(fixture!.editorCaller.collaboration.decide({ projectId: fixture!.projectId, area: "revision", targetType: "revision-plan", targetId: 999999, decision: "approved" })).rejects.toThrow(/WORKFLOW_STATE_CONFLICT\|This decision is not currently assigned/);
  });

  it("denies invitation acceptance when the signed-in email does not match the author’s invite", async () => {
    const invitation = await fixture!.ownerCaller.collaboration.invite({ projectId: fixture!.projectId, email: fixture!.outsider.email!, role: "designer" });
    await expect(fixture!.editorCaller.collaboration.accept({ inviteCode: invitation.inviteCode })).rejects.toThrow(/COLLABORATOR_ACCESS_DENIED\|Sign in with the email address/);
    const workspace = await fixture!.ownerCaller.collaboration.workspace({ projectId: fixture!.projectId });
    expect(workspace.collaborators.some(item => item.email === fixture!.outsider.email && item.status === "active")).toBe(false);
  });

  it("lets only the author change an active collaborator role and records the decision", async () => {
    await expect(fixture!.editorCaller.collaboration.changeRole({ collaboratorId: fixture!.collaboratorId, role: "designer", authorConfirmed: true })).rejects.toThrow(/REQUEST_FAILED\|The collaborator role could not be changed/);
    await expect(fixture!.ownerCaller.collaboration.changeRole({ collaboratorId: fixture!.collaboratorId, role: "designer", authorConfirmed: true })).resolves.toMatchObject({ id: fixture!.collaboratorId, role: "designer", unchanged: false });
    const workspace = await fixture!.ownerCaller.collaboration.workspace({ projectId: fixture!.projectId });
    expect(workspace.collaborators.find(item => item.id === fixture!.collaboratorId)?.role).toBe("designer");
    expect(workspace.auditEvents.some(event => event.eventType === "collaborator-role-changed")).toBe(true);
  });
});
