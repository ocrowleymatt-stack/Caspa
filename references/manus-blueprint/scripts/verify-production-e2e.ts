import assert from "node:assert/strict";
import { appRouter } from "../server/routers";
import { getUserByOpenId } from "../server/db";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";

const title = `CASPA production verification ${Date.now()}`;
const keepFixture = process.env.CASPA_KEEP_FIXTURE === "1";
const illustrated = process.env.CASPA_ILLUSTRATED_FIXTURE === "1";
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
    const created = await caller.projects.create({ format: illustrated ? "picture-book" : "essay", premise: "An archivist decides whether a forbidden civic record is worth losing her place in the institution she serves.", targetWordCount: 500, title, authorName: "CASPA Verification Author" });
    projectId = created.id;
    await caller.projects.saveManuscript({ projectId, content: manuscript, name: "Production verification source" });
    await caller.workshop.diagnose({ projectId });
    const diagnosis = await caller.workshop.latest({ projectId });
    assert(diagnosis?.findings.length);
    const plan = await caller.revisions.approvePlan({ projectId, diagnosisId: diagnosis.diagnosis.id, findingIds: diagnosis.findings.slice(0, 1).map(item => item.id), scope: "single-chapter", startChapter: 1, endChapter: 1, authorConfirmed: true });
    const job = await caller.revisions.start({ planId: plan.id, authorConfirmed: true });
    let revision = await caller.revisions.advance({ jobId: job.id });
    for (let attempt = 0; attempt < 8 && ["queued", "running"].includes(revision.job.status); attempt += 1) revision = await caller.revisions.advance({ jobId: job.id });
    assert.equal(revision.job.status, "awaiting-review");
    await caller.revisions.accept({ jobId: job.id, authorConfirmed: true });
    const manuscriptPreflight = await caller.exports.preflight({ projectId });
    assert.equal(manuscriptPreflight.passed, true);

    const started = await caller.production.start({ projectId });
    assert.equal(started.brief?.illustrationMode, illustrated ? "fully-illustrated" : "cover-only");
    const briefId = started.brief!.id;
    await caller.production.approveBrief({ artBriefId: briefId, authorConfirmed: true });
    const withCover = await caller.production.generateCover({ projectId, artBriefId: briefId, name: "Lantern archive", direction: "A dark civic archive at dawn, one illuminated ledger as the focal symbol, restrained editorial realism, calm upper title space." });
    const cover = withCover.covers[0];
    assert(cover?.width > 0 && cover?.height > 0);
    await caller.production.approveCover({ coverId: cover.id, authorConfirmed: true });
    if (illustrated && started.plan) {
      await caller.production.updateContinuity({ planId: started.plan.id, characters: "Mara Venn, 42, silver braid, charcoal archivist coat, narrow brass spectacles", locations: "The coastal lantern archive, high stone stacks, salt-fogged windows", palette: "Obsidian, antique brass, salt ivory, rust red", medium: "Painterly gouache with restrained editorial realism", periodDetails: "Near-future civic technology alongside analogue ledgers", worldRules: "Winter dawn light enters from the east; archive geometry and character clothing remain consistent" });
      for (const [index, slot] of started.slots.entries()) {
        const revised = index === 0 ? await caller.production.reviseSlot({ slotId: slot.id, placement: slot.placement, purpose: slot.purpose, sceneBrief: `${slot.sceneBrief} Show Mara's silver braid and charcoal coat clearly.`, aspectRatio: slot.aspectRatio as "1:1" | "4:3" | "5:4" | "3:2" | "2:3" | "16:9", bleed: slot.bleed, caption: slot.caption || "", altText: slot.altText, continuityNotes: `${slot.continuityNotes} Preserve east-facing dawn light.` }) : null;
        assert(index !== 0 || revised.slots.some(item => item.id === slot.id && item.status === "proposed"));
        await caller.production.setSlotStatus({ slotId: slot.id, status: "approved", authorConfirmed: true });
        const generated = await caller.production.generateIllustration({ slotId: slot.id });
        const asset = generated.assets.find(item => item.slotId === slot.id);
        assert(asset?.width && asset?.height);
        await caller.production.approveIllustration({ assetId: asset.id, authorConfirmed: true, continuityConfirmed: true });
      }
    }
    await caller.production.approveProgram({ projectId, authorConfirmed: true });

    const layout = await caller.production.composeLayout({ projectId, trimSize: "6 × 9 in", margins: { top: 54, right: 48, bottom: 54, left: 54 }, bleedPt: 9, bodyFont: "Times", displayFont: "Baskerville", bodySizePt: 11, lineHeightPct: 145, paragraphStyle: "indent", runningHeads: true, folios: true, chapterOpening: "right-hand", imagePlacement: "inline", editionMode: "both", language: "en", digitalNavigation: true, imageAltPolicy: "required", printProfile: "standard-color", authorConfirmed: true });
    assert(layout.pageCount >= 4);
    await caller.production.submitProof({ layoutVersionId: layout.id, authorConfirmed: true });
    const annotationRow = await caller.production.addAnnotation({ layoutVersionId: layout.id, pageNumber: 1, xPct: 50, yPct: 50, note: "Verify title-page balance before release." });
    const resolvedRow = await caller.production.resolveAnnotation({ annotationId: annotationRow.annotation.id, status: "resolved", resolutionNote: "Title-page balance reviewed and accepted.", authorConfirmed: true });
    const resolvedAnnotation = resolvedRow.annotation;
    assert.equal(resolvedAnnotation.status, "resolved");
    assert(resolvedAnnotation.resolvedAt);
    const productionPreflight = await caller.production.preflight({ projectId, authorConfirmed: true });
    assert.equal(productionPreflight.passed, true, JSON.stringify(productionPreflight.checks));
    await caller.production.approveProof({ preflightId: productionPreflight.id, authorConfirmed: true });
    const output = await caller.production.generatePackage({ projectId, authorConfirmed: true });
    assert.equal(output.artifacts.length, 4);
    assert(output.artifacts.every(item => item.url.startsWith("/manus-storage/") && item.sizeBytes > 100));
    assert(output.artifacts.some(item => item.format === "interior-pdf"));
    assert(output.artifacts.some(item => item.format === "cover-pdf"));
    assert(output.artifacts.some(item => item.format === "epub"));
    assert(output.artifacts.some(item => item.format === "package"));
    if (!keepFixture) {
      const archived = await caller.projects.archive({ projectId });
      assert.equal(archived.currentState, "archived");
    }

    const finalWorkspace = await caller.production.workspace({ projectId });
    console.log(JSON.stringify({ projectId, title, keepFixture, illustrated, statesVerified: ["draft", "diagnosed", "plan-approved", "revision-running", "review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready", ...(keepFixture ? [] : ["archived"])], cover: { width: cover.width, height: cover.height }, illustrationCount: finalWorkspace.assets.filter(item => item.status === "approved").length, layout: { id: layout.id, pageCount: layout.pageCount }, proofComment: { status: resolvedAnnotation.status, resolutionNote: resolvedAnnotation.resolutionNote }, productionChecks: productionPreflight.checks.map(check => ({ id: check.id, passed: check.passed })), artifacts: output.artifacts.map(item => ({ format: item.format, sizeBytes: item.sizeBytes, checksum: item.checksum.slice(0, 16) })) }, null, 2));
  } finally {
    if (projectId && !keepFixture) await caller.settings.deleteProject({ projectId, confirmation: title });
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
