import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { diagnoses, projectAuditEvents, projectCollaborators, reviewAssignments, reviewRounds, reviewSubmissions, revisionPlans, styleProfiles, styleSamples, users } from "../drizzle/schema";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";
import { getDb, getUserByOpenId } from "../server/db";
import { appRouter } from "../server/routers";

const title = `CASPA style collaboration verification ${Date.now()}`;

function callerFor(user: NonNullable<Awaited<ReturnType<typeof getUserByOpenId>>>) {
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] });
}

async function main() {
  const owner = await getUserByOpenId(ENV.ownerOpenId);
  assert(owner, "The project owner must exist before collaboration verification can run.");
  const ownerCaller = callerFor(owner);
  const db = await getDb();
  assert(db, "A database connection is required for collaboration verification.");
  let projectId = 0;
  let profileId = 0;
  let sampleId = 0;
  let editorId = 0;
  try {
    const project = await ownerCaller.projects.create({ format: "fiction", premise: "An archivist follows a missing shelf through a city library that quietly erases its own records.", targetWordCount: 12_000, title, authorName: "CASPA Verification Author" });
    projectId = project.id;
    const sample = await db.insert(styleSamples).values({ ownerId: owner.id, name: "Verified private sample", tags: "close-third, spare", sourceNote: "Verification-only metadata", consentConfirmed: true, content: "Stored in private object storage.", wordCount: 120, storageKey: `verification/${projectId}/style.txt`, storageUrl: "/private/verification/style.txt" });
    sampleId = Number(sample[0].insertId);
    const profile = await db.insert(styleProfiles).values({ ownerId: owner.id, name: "Quiet archival suspense", sampleIdsJson: JSON.stringify([sampleId]), dimensionsJson: JSON.stringify({ pointOfView: "close third", sentenceRhythm: "varied and restrained", dialogueDensity: "selective", imagery: "archival and winter-lit", pacing: "measured escalation", register: "literary suspense" }), cautions: "Do not quote, imitate a named author, or reproduce a source passage.", status: "active", traceId: "style-collaboration-e2e" });
    profileId = Number(profile[0].insertId);

    const preview = await ownerCaller.drafting.preview({ projectId, mode: "opening", chapterTitle: "The Missing Shelf", targetWords: 300, outline: "Mara arrives before dawn and finds a shelf missing from the floor plan.", voiceNotes: "Retain a close third-person winter-night atmosphere.", exclusions: "Do not resolve the mystery.", styleProfileId: profileId });
    assert.equal(preview.status, "previewed");
    assert.equal(JSON.parse(preview.briefJson).brief.styleProfileId, profileId);
    const version = await ownerCaller.drafting.accept({ previewId: preview.id, authorConfirmed: true });
    assert.equal(version.trigger, "auto-draft");

    const editorOpenId = `caspa-e2e-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const insertedEditor = await db.insert(users).values({ openId: editorOpenId, name: "Verification Editor", email: `${editorOpenId}@example.test`, loginMethod: "vitest", lastSignedIn: new Date() });
    editorId = Number(insertedEditor[0].insertId);
    const editor = (await db.select().from(users).where(eq(users.id, editorId)).limit(1))[0];
    assert(editor, "Verification editor was not created.");
    const editorCaller = callerFor(editor);
    const invite = await ownerCaller.collaboration.invite({ projectId, email: editor.email!, role: "editor" });
    await editorCaller.collaboration.accept({ inviteCode: invite.inviteCode });
    const desk = await ownerCaller.collaboration.workspace({ projectId });
    const collaborator = desk.collaborators.find(item => item.userId === editor.id);
    assert(collaborator, "Accepted editor is missing from the collaboration desk.");
    const round = await ownerCaller.collaboration.openRound({ projectId, versionId: version.id, title: "Anonymous manuscript read", collaboratorIds: [collaborator.id], identityPolicy: "anonymous" });
    const reader = await editorCaller.collaboration.reviewerRound({ reviewRoundId: round.id });
    assert.match(reader.manuscriptLabel, /^Manuscript (Amber|Cedar|Flint|Lark|Rowan|Vale) · [A-F0-9]{4} · Reader (Alder|Briar|Cinder|Dune|Elm|Fable) · [A-F0-9]{4}$/);
    await editorCaller.collaboration.submitReview({ reviewRoundId: round.id, ratings: { prose: 4, structure: 4, clarity: 4, "emotional-effect": 4, character: 4, pacing: 4, "visual-direction": 3, cover: 3, "illustration-continuity": 3, "layout-readability": 4 }, feedback: "The opening establishes a convincing archival mood while retaining a clear narrative question for the reader." });
    await ownerCaller.collaboration.closeRound({ reviewRoundId: round.id, authorConfirmed: true });
    const closedDesk = await ownerCaller.collaboration.workspace({ projectId });
    assert.equal(closedDesk.rounds.find(item => item.id === round.id)?.permittedFeedback.length, 1);
    await ownerCaller.collaboration.setRequirement({ projectId, area: "revision", requiredRole: "editor", enabled: true, authorConfirmed: true });
    const diagnosis = await db.insert(diagnoses).values({ projectId, versionId: version.id, rubricVersion: "style-collaboration-e2e", mode: "deterministic-fallback", overallSummary: "Verification diagnosis", overallConfidence: 90, traceId: "style-collaboration-e2e" });
    const plan = await db.insert(revisionPlans).values({ projectId, diagnosisId: Number(diagnosis[0].insertId), sourceVersionId: version.id, styleProfileId: profileId, scope: "whole-book", status: "approved" });
    const planId = Number(plan[0].insertId);
    const approval = await editorCaller.collaboration.decide({ projectId, area: "revision", targetType: "revision-plan", targetId: planId, decision: "approved", note: "The proposed revision scope preserves the chosen craft profile." });
    assert.equal(approval.decision, "approved");
    const decisionDesk = await ownerCaller.collaboration.workspace({ projectId });
    assert.equal(decisionDesk.decisions.some(item => item.id === approval.id && item.collaboratorRole === "editor"), true);
    const exported = await ownerCaller.style.exportLibrary();
    assert(!JSON.stringify(exported).includes("/private/verification/style.txt"));
    const accountExport = await ownerCaller.settings.exportData();
    assert(accountExport.content.includes("collaborator-approval-recorded"));
    assert(accountExport.content.includes("blind-review-submitted"));
    await ownerCaller.collaboration.revoke({ collaboratorId: collaborator.id, authorConfirmed: true });
    await assert.rejects(() => editorCaller.collaboration.reviewerRound({ reviewRoundId: round.id }));
    console.log(JSON.stringify({ projectId, acceptedVersionId: version.id, styleProfileId: profileId, reviewRoundId: round.id, approvalDecisionId: approval.id, feedbackReleased: true, revocationEnforced: true, styleExportSanitized: true, accountAuditExported: true }, null, 2));
  } finally {
    if (projectId) {
      const roundIds = (await db.select().from(reviewRounds).where(eq(reviewRounds.projectId, projectId))).map(round => round.id);
      if (roundIds.length) {
        const assignmentIds = (await db.select().from(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds))).map(item => item.id);
        if (assignmentIds.length) await db.delete(reviewSubmissions).where(inArray(reviewSubmissions.assignmentId, assignmentIds));
        await db.delete(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds));
        await db.delete(reviewRounds).where(inArray(reviewRounds.id, roundIds));
      }
      await db.delete(projectAuditEvents).where(eq(projectAuditEvents.projectId, projectId));
      await db.delete(projectCollaborators).where(eq(projectCollaborators.projectId, projectId));
      const workspace = await ownerCaller.projects.get({ projectId });
      if (workspace.project.currentState !== "archived") await ownerCaller.projects.archive({ projectId });
      await ownerCaller.settings.deleteProject({ projectId, confirmation: title });
    }
    if (profileId) await db.delete(styleProfiles).where(eq(styleProfiles.id, profileId));
    if (sampleId) await db.delete(styleSamples).where(eq(styleSamples.id, sampleId));
    if (editorId) await db.delete(users).where(eq(users.id, editorId));
  }
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
