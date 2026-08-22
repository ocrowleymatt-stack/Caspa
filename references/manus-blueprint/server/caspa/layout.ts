import { and, desc, eq, inArray } from "drizzle-orm";
import { artBriefs, coverConcepts, illustrationAssets, illustrationPlans, illustrationSlots, layoutSpecs, layoutVersions, productionPreflights, projects, proofAnnotations } from "../../drizzle/schema";
import { composeBookPages, latestProofCanBeApproved, productionChecks, proofResolutionValues, restoredLayoutValues, trimPresets } from "../../shared/layout";
import { assertActionAllowed, assertTransition } from "../../shared/workflow";
import { latestProductionRows, productionDb, requireOwnedAnnotation, requireOwnedLayout, requireOwnedPreflight } from "./productionRepository";
import { requireOwnedProject, requireOwnedVersion } from "./repository";
import { requireConfiguredApprovals } from "./collaboration";

export type LayoutSpecInput = {
  projectId: number;
  trimSize: keyof typeof trimPresets;
  margins: { top: number; right: number; bottom: number; left: number };
  bleedPt: number;
  bodyFont: string;
  displayFont: string;
  bodySizePt: number;
  lineHeightPct: number;
  paragraphStyle: "indent" | "spaced";
  runningHeads: boolean;
  folios: boolean;
  chapterOpening: "right-hand" | "next-page" | "continuous";
  imagePlacement: "inline" | "full-page" | "spread";
  editionMode: "print" | "digital" | "both";
  language: string;
  digitalNavigation: boolean;
  imageAltPolicy: "required" | "optional";
  printProfile: "grayscale" | "standard-color" | "premium-color";
};

export async function composeLayout(ownerId: number, input: LayoutSpecInput) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  assertActionAllowed(project.currentState, "compose-layout");
  if (!project.activeVersionId) throw new Error("MANUSCRIPT_REQUIRED");
  const manuscript = await requireOwnedVersion(ownerId, project.activeVersionId);
  const rows = await latestProductionRows(ownerId, project.id);
  const brief = rows.brief;
  const cover = rows.covers.find(item => item.status === "approved");
  if (!brief || brief.status !== "approved" || !cover) throw new Error("ART_PROGRAM_APPROVAL_REQUIRED");
  const preset = trimPresets[input.trimSize];
  const db = await productionDb();
  const specRows = await db.select().from(layoutSpecs).where(eq(layoutSpecs.projectId, project.id));
  const layoutRows = await db.select().from(layoutVersions).where(eq(layoutVersions.projectId, project.id));
  const approvedAssets = rows.assets.filter(asset => asset.status === "approved" && asset.slotId);
  const placements = rows.slots.map(slot => {
    const asset = approvedAssets.find(item => item.slotId === slot.id);
    return asset ? { chapterIndex: slot.chapterIndex, imageUrl: asset.storageUrl, altText: slot.altText, caption: slot.caption, bleed: slot.bleed } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  let newLayoutId = 0;
  await db.transaction(async tx => {
    await tx.update(layoutSpecs).set({ status: "superseded" }).where(eq(layoutSpecs.projectId, project.id));
    const specResult = await tx.insert(layoutSpecs).values({ projectId: project.id, version: specRows.length + 1, trimSize: input.trimSize, orientation: preset.orientation, pageWidthPt: preset.width, pageHeightPt: preset.height, marginsJson: JSON.stringify(input.margins), bleedPt: input.bleedPt, bodyFont: input.bodyFont, displayFont: input.displayFont, bodySizePt: input.bodySizePt, lineHeightPct: input.lineHeightPct, paragraphStyle: input.paragraphStyle, runningHeads: input.runningHeads, folios: input.folios, chapterOpening: input.chapterOpening, imagePlacement: input.imagePlacement, editionMode: input.editionMode, language: input.language, digitalNavigation: input.digitalNavigation, imageAltPolicy: input.imageAltPolicy, printProfile: input.printProfile, status: "approved", approvedAt: new Date() });
    const specId = Number(specResult[0].insertId);
    const spec = { id: specId, projectId: project.id, version: specRows.length + 1, trimSize: input.trimSize, orientation: preset.orientation, pageWidthPt: preset.width, pageHeightPt: preset.height, marginsJson: JSON.stringify(input.margins), bleedPt: input.bleedPt, bodyFont: input.bodyFont, displayFont: input.displayFont, bodySizePt: input.bodySizePt, lineHeightPct: input.lineHeightPct, paragraphStyle: input.paragraphStyle, runningHeads: input.runningHeads, folios: input.folios, chapterOpening: input.chapterOpening, imagePlacement: input.imagePlacement, editionMode: input.editionMode, language: input.language, digitalNavigation: input.digitalNavigation, imageAltPolicy: input.imageAltPolicy, printProfile: input.printProfile, status: "approved" as const, approvedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
    const pages = composeBookPages(project, manuscript.content, spec, placements);
    await tx.update(layoutVersions).set({ status: "superseded" }).where(eq(layoutVersions.projectId, project.id));
    const layoutResult = await tx.insert(layoutVersions).values({ projectId: project.id, manuscriptVersionId: manuscript.id, artBriefId: brief.id, coverConceptId: cover.id, illustrationPlanId: rows.plan?.id ?? null, layoutSpecId: specId, version: layoutRows.length + 1, name: `Layout ${layoutRows.length + 1} · ${new Date().toLocaleDateString("en-GB")}`, pageCount: pages.length, pagesJson: JSON.stringify(pages), status: "draft" });
    newLayoutId = Number(layoutResult[0].insertId);
    if (project.currentState === "art-approved") {
      assertTransition(project.currentState, "layout");
      await tx.update(projects).set({ currentState: "layout" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
    }
  });
  return requireOwnedLayout(ownerId, newLayoutId);
}

export async function submitProof(ownerId: number, layoutVersionId: number) {
  const layout = await requireOwnedLayout(ownerId, layoutVersionId);
  const project = await requireOwnedProject(ownerId, layout.projectId);
  assertActionAllowed(project.currentState, "submit-proof");
  await requireConfiguredApprovals(ownerId, project.id, "layout", "layout-version", layout.id);
  const db = await productionDb();
  await db.transaction(async tx => {
    await tx.update(layoutVersions).set({ status: "proof" }).where(eq(layoutVersions.id, layout.id));
    assertTransition(project.currentState, "proof-review");
    await tx.update(projects).set({ currentState: "proof-review" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
  });
  return requireOwnedLayout(ownerId, layout.id);
}

export async function returnProofToLayout(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  if (project.currentState !== "proof-review") throw new Error("PROOF_REVIEW_REQUIRED");
  const db = await productionDb();
  assertTransition(project.currentState, "layout");
  await db.update(projects).set({ currentState: "layout" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
  return requireOwnedProject(ownerId, projectId);
}

export async function restoreLayoutVersion(ownerId: number, layoutVersionId: number) {
  const source = await requireOwnedLayout(ownerId, layoutVersionId);
  const project = await requireOwnedProject(ownerId, source.projectId);
  if (!["layout", "proof-review"].includes(project.currentState)) throw new Error("LAYOUT_RESTORE_NOT_ALLOWED");
  const db = await productionDb();
  const versions = await db.select().from(layoutVersions).where(eq(layoutVersions.projectId, project.id));
  let restoredId = 0;
  await db.transaction(async tx => {
    await tx.update(layoutVersions).set({ status: "superseded" }).where(eq(layoutVersions.projectId, project.id));
    const result = await tx.insert(layoutVersions).values(restoredLayoutValues(source, versions.length + 1));
    restoredId = Number(result[0].insertId);
    if (project.currentState === "proof-review") {
      await tx.update(projects).set({ currentState: "layout" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
    }
  });
  return requireOwnedLayout(ownerId, restoredId);
}

export async function addProofAnnotation(ownerId: number, input: { layoutVersionId: number; pageNumber: number; xPct: number; yPct: number; note: string }) {
  const layout = await requireOwnedLayout(ownerId, input.layoutVersionId);
  const project = await requireOwnedProject(ownerId, layout.projectId);
  assertActionAllowed(project.currentState, "resolve-proof");
  if (input.pageNumber < 1 || input.pageNumber > layout.pageCount) throw new Error("PROOF_PAGE_INVALID");
  const db = await productionDb();
  const result = await db.insert(proofAnnotations).values({ ...input, createdByUserId: ownerId });
  return requireOwnedAnnotation(ownerId, Number(result[0].insertId));
}

export async function resolveProofAnnotation(ownerId: number, input: { annotationId: number; status: "resolved" | "accepted-as-is" | "deferred"; resolutionNote: string }) {
  const row = await requireOwnedAnnotation(ownerId, input.annotationId);
  const project = await requireOwnedProject(ownerId, row.layout.projectId);
  assertActionAllowed(project.currentState, "resolve-proof");
  const db = await productionDb();
  await db.update(proofAnnotations).set(proofResolutionValues(row.annotation.status, input.status, input.resolutionNote)).where(eq(proofAnnotations.id, row.annotation.id));
  return requireOwnedAnnotation(ownerId, row.annotation.id);
}

export async function runProductionPreflight(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "run-production-preflight");
  const rows = await latestProductionRows(ownerId, projectId);
  const layout = rows.layouts[0];
  const spec = rows.layoutSpec;
  const cover = rows.covers.find(item => item.status === "approved");
  if (!layout || !cover || !spec) throw new Error("PRODUCTION_ASSETS_REQUIRED");
  const pages = JSON.parse(layout.pagesJson);
  const requiredSlots = rows.slots.filter(slot => slot.status === "approved");
  const approvedAssets = rows.assets.filter(asset => asset.status === "approved" && requiredSlots.some(slot => slot.id === asset.slotId));
  const openAnnotations = rows.annotations.filter(annotation => annotation.status === "open" || annotation.status === "deferred");
  const checks = productionChecks({ project, spec, pages, coverApproved: true, coverWidth: cover.width, coverHeight: cover.height, requiredAssetCount: requiredSlots.length, approvedAssetCount: approvedAssets.length, allAltText: requiredSlots.every(slot => slot.altText.trim().length > 0), openAnnotationCount: openAnnotations.length, layoutStatus: layout.status, bleedAssetCount: requiredSlots.filter(slot => slot.bleed).length });
  const passed = checks.every(check => check.passed);
  const db = await productionDb();
  const result = await db.insert(productionPreflights).values({ projectId, layoutVersionId: layout.id, passed, checksJson: JSON.stringify(checks), authorApproved: false });
  return { id: Number(result[0].insertId), passed, checks };
}

export async function approveProductionProof(ownerId: number, preflightId: number) {
  const preflight = await requireOwnedPreflight(ownerId, preflightId);
  const project = await requireOwnedProject(ownerId, preflight.projectId);
  assertActionAllowed(project.currentState, "run-production-preflight");
  await requireConfiguredApprovals(ownerId, project.id, "proof", "production-preflight", preflight.id);
  const db = await productionDb();
  const latestLayouts = await db.select().from(layoutVersions).where(eq(layoutVersions.projectId, project.id)).orderBy(desc(layoutVersions.version)).limit(1);
  const latestPreflights = await db.select().from(productionPreflights).where(eq(productionPreflights.projectId, project.id)).orderBy(desc(productionPreflights.createdAt)).limit(1);
  if (!latestProofCanBeApproved({ preflightPassed: preflight.passed, preflightLayoutId: preflight.layoutVersionId, latestLayoutId: latestLayouts[0]?.id ?? null, preflightId: preflight.id, latestPreflightId: latestPreflights[0]?.id ?? null })) throw new Error("LATEST_PROOF_PREFLIGHT_REQUIRED");
  await db.transaction(async tx => {
    await tx.update(productionPreflights).set({ authorApproved: true }).where(eq(productionPreflights.id, preflight.id));
    await tx.update(layoutVersions).set({ status: "approved", approvedAt: new Date() }).where(eq(layoutVersions.id, preflight.layoutVersionId));
    assertTransition(project.currentState, "production-ready");
    await tx.update(projects).set({ currentState: "production-ready" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
  });
  const approved = await requireOwnedPreflight(ownerId, preflight.id);
  const { checksJson, ...safe } = approved;
  return { ...safe, checks: JSON.parse(preflight.checksJson) };
}
