import assert from "node:assert/strict";
import { appRouter } from "../server/routers";
import { getUserByOpenId } from "../server/db";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";

const title = `CASPA auto-draft verification ${Date.now()}`;
const keepFixture = process.env.CASPA_KEEP_FIXTURE === "1";

async function main() {
  const user = await getUserByOpenId(ENV.ownerOpenId);
  assert(user, "The project owner must exist before authenticated verification can run.");
  const caller = appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as unknown as TrpcContext["res"] });
  let projectId = 0;
  try {
    const project = await caller.projects.create({ format: "fiction", premise: "An archivist discovers that every missing record in the city library was removed by the same unseen hand.", targetWordCount: 12_000, title, authorName: "CASPA Verification Author" });
    projectId = project.id;
    const firstPreview = await caller.drafting.preview({ projectId, mode: "opening", chapterTitle: "The Missing Shelf", targetWords: 300, outline: "Mara arrives before dawn, finds a shelf missing from the floor plan, and hears paper turning behind a locked wall.", voiceNotes: "Tense, sensory, literary suspense.", exclusions: "Do not resolve the mystery." });
    assert.equal(firstPreview.status, "previewed");
    assert(firstPreview.content.split(/\s+/).length >= 160);
    const beforeReject = await caller.projects.get({ projectId });
    assert.equal(beforeReject.project.wordCount, 0);
    await caller.drafting.reject({ previewId: firstPreview.id });
    const afterReject = await caller.projects.get({ projectId });
    assert.equal(afterReject.project.activeVersionId, beforeReject.project.activeVersionId);
    assert.equal(afterReject.project.wordCount, 0);

    const acceptedPreview = await caller.drafting.preview({ projectId, mode: "opening", chapterTitle: "The Missing Shelf", targetWords: 300, outline: "Mara arrives before dawn, finds a shelf missing from the floor plan, and hears paper turning behind a locked wall.", voiceNotes: "Tense, sensory, literary suspense.", exclusions: "Do not resolve the mystery." });
    const firstVersion = await caller.drafting.accept({ previewId: acceptedPreview.id, authorConfirmed: true });
    assert.equal(firstVersion.trigger, "auto-draft");
    assert(firstVersion.content.includes("# The Missing Shelf"));

    const appendPreview = await caller.drafting.preview({ projectId, mode: "append-chapter", chapterTitle: "After the Bell", targetWords: 300, outline: "Mara follows a paper trail into the shuttered municipal archive and discovers the first erased name.", voiceNotes: "Maintain the same close third-person voice and winter-night atmosphere.", exclusions: "Do not name the unseen antagonist." });
    assert.equal(appendPreview.status, "previewed");
    assert(appendPreview.groundingSummary.includes("Continue after"));
    const workspace = await caller.projects.get({ projectId });
    assert.equal(workspace.project.activeVersionId, firstVersion.id);
    assert.equal(workspace.versions.filter(version => version.trigger === "auto-draft").length, 1);

    let handoff: { diagnosisId: number; findingCount: number } | null = null;
    if (!keepFixture) {
      const diagnosisRun = await caller.workshop.diagnose({ projectId });
      const diagnosis = await caller.workshop.latest({ projectId });
      const diagnosedWorkspace = await caller.projects.get({ projectId });
      assert(diagnosis);
      assert(diagnosis.findings.length > 0);
      assert.equal(diagnosedWorkspace.project.currentState, "diagnosed");
      handoff = { diagnosisId: diagnosisRun.diagnosisId, findingCount: diagnosis.findings.length };
    }

    console.log(JSON.stringify({ projectId, title, keepFixture, rejectionPreservedActiveVersion: true, acceptedVersion: { id: firstVersion.id, trigger: firstVersion.trigger, wordCount: firstVersion.wordCount }, pendingPreview: { id: appendPreview.id, chapterTitle: appendPreview.chapterTitle, targetWords: appendPreview.targetWords }, workshopHandoff: handoff, state: keepFixture ? workspace.project.currentState : "diagnosed" }, null, 2));
  } finally {
    if (projectId && !keepFixture) {
      await caller.projects.archive({ projectId });
      await caller.settings.deleteProject({ projectId, confirmation: title });
    }
  }
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
