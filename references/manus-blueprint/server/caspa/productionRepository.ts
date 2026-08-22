import { and, asc, desc, eq } from "drizzle-orm";
import { artBriefs, coverConcepts, illustrationAssets, illustrationPlans, illustrationSlots, layoutSpecs, layoutVersions, productionExports, productionPreflights, proofAnnotations } from "../../drizzle/schema";
import { getDb } from "../db";
import { CaspaNotFoundError, requireOwnedProject } from "./repository";

export async function productionDb() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export function assertProductionOwnership(requestingUserId: number, projectOwnerId: number) {
  if (requestingUserId !== projectOwnerId) throw new CaspaNotFoundError("Production asset not found");
}

async function confirmOwnedProject(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertProductionOwnership(ownerId, project.ownerId);
  return project;
}

export async function requireOwnedArtBrief(ownerId: number, artBriefId: number) {
  const db = await productionDb();
  const rows = await db.select().from(artBriefs).where(eq(artBriefs.id, artBriefId)).limit(1);
  const brief = rows[0];
  if (!brief) throw new CaspaNotFoundError("Art brief not found");
  await confirmOwnedProject(ownerId, brief.projectId);
  return brief;
}

export async function requireOwnedCover(ownerId: number, coverId: number) {
  const db = await productionDb();
  const rows = await db.select().from(coverConcepts).where(eq(coverConcepts.id, coverId)).limit(1);
  const cover = rows[0];
  if (!cover) throw new CaspaNotFoundError("Cover concept not found");
  await confirmOwnedProject(ownerId, cover.projectId);
  return cover;
}

export async function requireOwnedIllustrationPlan(ownerId: number, planId: number) {
  const db = await productionDb();
  const rows = await db.select().from(illustrationPlans).where(eq(illustrationPlans.id, planId)).limit(1);
  const plan = rows[0];
  if (!plan) throw new CaspaNotFoundError("Illustration plan not found");
  await confirmOwnedProject(ownerId, plan.projectId);
  return plan;
}

export async function requireOwnedIllustrationSlot(ownerId: number, slotId: number) {
  const db = await productionDb();
  const rows = await db.select({ slot: illustrationSlots, plan: illustrationPlans }).from(illustrationSlots).innerJoin(illustrationPlans, eq(illustrationSlots.planId, illustrationPlans.id)).where(eq(illustrationSlots.id, slotId)).limit(1);
  const row = rows[0];
  if (!row) throw new CaspaNotFoundError("Illustration slot not found");
  await confirmOwnedProject(ownerId, row.plan.projectId);
  return row;
}

export async function requireOwnedIllustrationAsset(ownerId: number, assetId: number) {
  const db = await productionDb();
  const rows = await db.select().from(illustrationAssets).where(eq(illustrationAssets.id, assetId)).limit(1);
  const asset = rows[0];
  if (!asset) throw new CaspaNotFoundError("Illustration asset not found");
  await confirmOwnedProject(ownerId, asset.projectId);
  return asset;
}

export async function requireOwnedLayout(ownerId: number, layoutVersionId: number) {
  const db = await productionDb();
  const rows = await db.select().from(layoutVersions).where(eq(layoutVersions.id, layoutVersionId)).limit(1);
  const layout = rows[0];
  if (!layout) throw new CaspaNotFoundError("Layout version not found");
  await confirmOwnedProject(ownerId, layout.projectId);
  return layout;
}

export async function requireOwnedAnnotation(ownerId: number, annotationId: number) {
  const db = await productionDb();
  const rows = await db.select({ annotation: proofAnnotations, layout: layoutVersions }).from(proofAnnotations).innerJoin(layoutVersions, eq(proofAnnotations.layoutVersionId, layoutVersions.id)).where(eq(proofAnnotations.id, annotationId)).limit(1);
  const row = rows[0];
  if (!row) throw new CaspaNotFoundError("Proof annotation not found");
  await confirmOwnedProject(ownerId, row.layout.projectId);
  return row;
}

export async function latestProductionRows(ownerId: number, projectId: number) {
  await confirmOwnedProject(ownerId, projectId);
  const db = await productionDb();
  const [briefRows, coverRows, planRows, specRows, layoutRows, preflightRows, exportRows] = await Promise.all([
    db.select().from(artBriefs).where(eq(artBriefs.projectId, projectId)).orderBy(desc(artBriefs.version)).limit(1),
    db.select().from(coverConcepts).where(eq(coverConcepts.projectId, projectId)).orderBy(desc(coverConcepts.createdAt)),
    db.select().from(illustrationPlans).where(eq(illustrationPlans.projectId, projectId)).orderBy(desc(illustrationPlans.version)).limit(1),
    db.select().from(layoutSpecs).where(eq(layoutSpecs.projectId, projectId)).orderBy(desc(layoutSpecs.version)).limit(1),
    db.select().from(layoutVersions).where(eq(layoutVersions.projectId, projectId)).orderBy(desc(layoutVersions.version)),
    db.select().from(productionPreflights).where(eq(productionPreflights.projectId, projectId)).orderBy(desc(productionPreflights.createdAt)).limit(1),
    db.select().from(productionExports).where(eq(productionExports.projectId, projectId)).orderBy(desc(productionExports.createdAt)),
  ]);
  const plan = planRows[0] ?? null;
  const slots = plan ? await db.select().from(illustrationSlots).where(eq(illustrationSlots.planId, plan.id)).orderBy(asc(illustrationSlots.sequence)) : [];
  const assets = await db.select().from(illustrationAssets).where(eq(illustrationAssets.projectId, projectId)).orderBy(desc(illustrationAssets.createdAt));
  const latestLayout = layoutRows[0] ?? null;
  const annotations = latestLayout ? await db.select().from(proofAnnotations).where(eq(proofAnnotations.layoutVersionId, latestLayout.id)).orderBy(asc(proofAnnotations.pageNumber), asc(proofAnnotations.createdAt)) : [];
  return { brief: briefRows[0] ?? null, covers: coverRows, plan, slots, assets, layoutSpec: specRows[0] ?? null, layouts: layoutRows, latestPreflight: preflightRows[0] ?? null, exports: exportRows, annotations };
}

export async function requireOwnedPreflight(ownerId: number, preflightId: number) {
  const db = await productionDb();
  const rows = await db.select().from(productionPreflights).where(eq(productionPreflights.id, preflightId)).limit(1);
  const preflight = rows[0];
  if (!preflight) throw new CaspaNotFoundError("Production preflight not found");
  await confirmOwnedProject(ownerId, preflight.projectId);
  return preflight;
}
