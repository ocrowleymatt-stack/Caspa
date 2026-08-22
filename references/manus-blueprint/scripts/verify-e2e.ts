import assert from "node:assert/strict";
import { appRouter } from "../server/routers";
import { getUserByOpenId } from "../server/db";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";

const title = `CASPA verification ${Date.now()}`;
const keepFixture = process.env.CASPA_KEEP_FIXTURE === "1";
const paragraph = "The archivist entered the lantern room before dawn, carrying a ledger that contradicted the official history. She compared the ink, followed the erased names, and chose to preserve the evidence even though the decision would cost her position. ";
const manuscript = `# The Lantern Index\n\n${paragraph.repeat(14)}`;

async function main() {
  const user = await getUserByOpenId(ENV.ownerOpenId);
  assert(user, "The project owner must exist before authenticated verification can run.");

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
  const caller = appRouter.createCaller(ctx);
  let projectId = 0;

  try {
    const created = await caller.projects.create({
      format: "essay",
      premise: "An archivist must decide whether preserving a forbidden civic record is worth losing her place in the institution she serves.",
      targetWordCount: 500,
      title,
      authorName: "CASPA Verification Author",
    });
    projectId = created.id;
    assert.equal(created.currentState, "draft");

    const saved = await caller.projects.saveManuscript({ projectId, content: manuscript, name: "Verification source" });
    assert(saved.id > 0);

    const diagnosisRun = await caller.workshop.diagnose({ projectId });
    const diagnosis = await caller.workshop.latest({ projectId });
    assert(diagnosis);
    assert(diagnosis.findings.length > 0);
    assert(diagnosis.findings.every(finding => finding.evidenceQuote && finding.citationLabel && finding.rationale));

    const selectedFindingIds = diagnosis.findings.slice(0, Math.min(2, diagnosis.findings.length)).map(finding => finding.id);
    const plan = await caller.revisions.approvePlan({
      projectId,
      diagnosisId: diagnosis.diagnosis.id,
      findingIds: selectedFindingIds,
      scope: "single-chapter",
      startChapter: 1,
      endChapter: 1,
      authorConfirmed: true,
    });
    assert.equal(plan.status, "approved");

    const job = await caller.revisions.start({ planId: plan.id, authorConfirmed: true });
    assert.equal(job.status, "queued");
    let status = await caller.revisions.advance({ jobId: job.id });
    for (let attempt = 0; attempt < 8 && ["queued", "running"].includes(status.job.status); attempt += 1) {
      status = await caller.revisions.advance({ jobId: status.job.id });
    }
    assert.equal(status.job.status, "awaiting-review");
    assert(status.checkpoints.every(checkpoint => checkpoint.progress === 100));

    const accepted = await caller.revisions.accept({ jobId: status.job.id, authorConfirmed: true });
    assert(["succeeded", "succeeded-with-warnings"].includes(accepted.status));

    const preflight = await caller.exports.preflight({ projectId });
    assert.equal(preflight.passed, true, JSON.stringify(preflight.checks));
    const download = await caller.exports.download({ projectId, format: "md" });
    assert(download.filename.endsWith(".md"));
    assert(download.content.length > 100);

    if (!keepFixture) {
      const archived = await caller.projects.archive({ projectId });
      assert.equal(archived.currentState, "archived");
    }

    console.log(JSON.stringify({
      projectId,
      projectTitle: title,
      statesVerified: keepFixture ? ["draft", "diagnosed", "plan-approved", "revision-running", "review", "export-ready"] : ["draft", "diagnosed", "plan-approved", "revision-running", "review", "export-ready", "archived"],
      diagnosisMode: diagnosisRun.mode,
      findingCount: diagnosis.findings.length,
      checkpointCount: status.checkpoints.length,
      terminalJobStatus: accepted.status,
      preflightChecks: preflight.checks.map(check => ({ id: check.id, passed: check.passed })),
      downloadBytes: download.content.length,
    }, null, 2));
  } finally {
    if (projectId && !keepFixture) await caller.settings.deleteProject({ projectId, confirmation: title });
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
