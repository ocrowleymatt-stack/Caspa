import { and, desc, eq, ne } from "drizzle-orm";
import { imageSize } from "image-size";
import sharp from "sharp";
import { artBriefs, coverConcepts, illustrationAssets, illustrationPlans, illustrationSlots, projects } from "../../drizzle/schema";
import { artProgramIssues, continuityProfileComplete, illustrationPlanFromManuscript, productionDefaults, safeAssetMime, type IllustrationMode } from "../../shared/production";
import { assertActionAllowed, assertTransition } from "../../shared/workflow";
import { generateImage } from "../_core/imageGeneration";
import { storageGetSignedUrl, storagePut } from "../storage";
import { CaspaServiceError, createTraceId, logPrivateError } from "./errors";
import { requireConfiguredApprovals } from "./collaboration";
import { latestProductionRows, productionDb, requireOwnedArtBrief, requireOwnedCover, requireOwnedIllustrationAsset, requireOwnedIllustrationPlan, requireOwnedIllustrationSlot } from "./productionRepository";
import { requireOwnedProject, requireOwnedVersion } from "./repository";

function safeRows(rows: Awaited<ReturnType<typeof latestProductionRows>>) {
  return {
    ...rows,
    brief: rows.brief,
    covers: rows.covers.map(({ storageKey, promptProvenance, ...cover }) => cover),
    assets: rows.assets.map(({ storageKey, promptProvenance, ...asset }) => asset),
    plan: rows.plan ? { ...rows.plan, consistency: JSON.parse(rows.plan.consistencyJson) } : null,
    layouts: rows.layouts.map(({ pagesJson, ...layout }) => ({ ...layout, pages: JSON.parse(pagesJson) })),
    latestPreflight: rows.latestPreflight ? (({ checksJson, ...preflight }) => ({ ...preflight, checks: JSON.parse(checksJson) }))(rows.latestPreflight) : null,
    exports: rows.exports.map(({ storageKey, ...item }) => item),
  };
}

async function createPlan(db: Awaited<ReturnType<typeof productionDb>>, project: Awaited<ReturnType<typeof requireOwnedProject>>, briefId: number, version: number, mode: IllustrationMode) {
  const active = project.activeVersionId ? await requireOwnedVersion(project.ownerId, project.activeVersionId) : null;
  const consistency = { palette: productionDefaults(project).palette, medium: productionDefaults(project).medium, characterIdentity: "Keep recurring faces, ages, silhouettes, clothing logic, and distinctive objects consistent.", worldRules: "Preserve period, architecture, weather, geography, and light direction across images." };
  const planResult = await db.insert(illustrationPlans).values({ projectId: project.id, artBriefId: briefId, version, consistencyJson: JSON.stringify(consistency), status: mode === "none" || mode === "cover-only" ? "waived" : "draft" });
  const planId = Number(planResult[0].insertId);
  const slots = active ? illustrationPlanFromManuscript(project, active.content, mode) : [];
  if (slots.length) await db.insert(illustrationSlots).values(slots.map(slot => ({ planId, ...slot })));
  return planId;
}

export async function startArtDirection(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "start-art-direction");
  if (!project.activeVersionId) throw new Error("MANUSCRIPT_REQUIRED");
  const defaults = productionDefaults(project);
  const db = await productionDb();
  await db.transaction(async tx => {
    const result = await tx.insert(artBriefs).values({ projectId, version: 1, suitability: defaults.suitability, illustrationMode: defaults.illustrationMode, rationale: defaults.rationale, audience: defaults.audience, genreSignals: defaults.genreSignals, tone: defaults.tone, motifs: defaults.motifs, exclusions: defaults.exclusions, palette: defaults.palette, medium: defaults.medium, typographyDirection: defaults.typographyDirection, trimSize: defaults.trimSize, distribution: defaults.distribution });
    await createPlan(tx as unknown as Awaited<ReturnType<typeof productionDb>>, project, Number(result[0].insertId), 1, defaults.illustrationMode);
    assertTransition(project.currentState, "art-direction");
    await tx.update(projects).set({ currentState: "art-direction" }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  });
  return getArtWorkspace(ownerId, projectId);
}

export async function getArtWorkspace(ownerId: number, projectId: number) {
  return safeRows(await latestProductionRows(ownerId, projectId));
}

export async function updateContinuityProfile(ownerId: number, input: { planId: number; characters: string; locations: string; palette: string; medium: string; periodDetails: string; worldRules: string }) {
  const plan = await requireOwnedIllustrationPlan(ownerId, input.planId);
  const project = await requireOwnedProject(ownerId, plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  const db = await productionDb();
  await db.update(illustrationPlans).set({ consistencyJson: JSON.stringify({ characterIdentity: input.characters, locations: input.locations, palette: input.palette, medium: input.medium, periodDetails: input.periodDetails, worldRules: input.worldRules }) }).where(eq(illustrationPlans.id, plan.id));
  return getArtWorkspace(ownerId, project.id);
}

export async function reviseArtBrief(ownerId: number, input: { projectId: number; illustrationMode: IllustrationMode; audience: string; genreSignals: string; tone: string; motifs: string; exclusions: string; palette: string; medium: string; typographyDirection: string; trimSize: string; distribution: "print" | "digital" | "both" }) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  assertActionAllowed(project.currentState, "edit-art-brief");
  const db = await productionDb();
  const currentRows = await db.select().from(artBriefs).where(eq(artBriefs.projectId, input.projectId)).orderBy(desc(artBriefs.version)).limit(1);
  const current = currentRows[0];
  if (!current) throw new Error("ART_BRIEF_REQUIRED");
  await db.transaction(async tx => {
    await tx.update(artBriefs).set({ status: "superseded" }).where(eq(artBriefs.id, current.id));
    const result = await tx.insert(artBriefs).values({ ...input, projectId: input.projectId, version: current.version + 1, suitability: current.suitability, rationale: current.rationale });
    await createPlan(tx as unknown as Awaited<ReturnType<typeof productionDb>>, project, Number(result[0].insertId), current.version + 1, input.illustrationMode);
  });
  return getArtWorkspace(ownerId, input.projectId);
}

export async function approveArtBrief(ownerId: number, artBriefId: number) {
  const brief = await requireOwnedArtBrief(ownerId, artBriefId);
  const project = await requireOwnedProject(ownerId, brief.projectId);
  assertActionAllowed(project.currentState, "edit-art-brief");
  const db = await productionDb();
  await db.update(artBriefs).set({ status: "approved", approvedAt: new Date() }).where(eq(artBriefs.id, brief.id));
  return getArtWorkspace(ownerId, brief.projectId);
}

function coverPrompt(project: Awaited<ReturnType<typeof requireOwnedProject>>, brief: Awaited<ReturnType<typeof requireOwnedArtBrief>>, direction: string) {
  return `Create portrait 2:3 front-cover artwork for a ${project.format.replace("-", " ")} book. No typography, no letters, no words, no logos, no border, no mockup. Leave calm title-safe negative space in the upper third and author-safe space near the bottom. Premise: ${project.premise}. Audience: ${brief.audience}. Tone: ${brief.tone}. Motifs: ${brief.motifs}. Palette: ${brief.palette}. Medium: ${brief.medium}. Art direction: ${direction}. Avoid: ${brief.exclusions}. Produce a complete edge-to-edge editorial cover image with strong thumbnail readability.`;
}

async function normalizeGeneratedAsset(ownerId: number, projectId: number, kind: "covers" | "illustrations", storageKey: string) {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Generated asset could not be normalized");
  const source = Buffer.from(await response.arrayBuffer());
  const normalized = kind === "covers"
    ? await sharp(source).resize({ width: 1800, height: 2700, fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 }).withMetadata({ density: 300 }).png({ quality: 95, compressionLevel: 9 }).toBuffer()
    : await sharp(source).resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: false, kernel: sharp.kernel.lanczos3 }).withMetadata({ density: 300 }).png({ quality: 95, compressionLevel: 9 }).toBuffer();
  const dimensions = imageSize(normalized);
  if (!dimensions.width || !dimensions.height) throw new Error("Normalized asset dimensions are unavailable");
  const stored = await storagePut(`production/${ownerId}/${projectId}/${kind}/${Date.now()}-print.png`, normalized, "image/png");
  return { ...stored, width: dimensions.width, height: dimensions.height };
}

export async function generateCoverConcept(ownerId: number, input: { projectId: number; artBriefId: number; name: string; direction: string }) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  assertActionAllowed(project.currentState, "generate-cover");
  const brief = await requireOwnedArtBrief(ownerId, input.artBriefId);
  if (brief.projectId !== project.id || brief.status !== "approved") throw new Error("ART_BRIEF_APPROVAL_REQUIRED");
  const traceId = createTraceId();
  try {
    const prompt = coverPrompt(project, brief, input.direction);
    const image = await generateImage({ prompt, model: "MODEL_GPT_IMAGE_2", quality: "high" });
    if (!image.url || !image.key) throw new Error("Image service returned no asset");
    const normalized = await normalizeGeneratedAsset(ownerId, project.id, "covers", image.key);
    const db = await productionDb();
    const rows = await db.select().from(coverConcepts).where(eq(coverConcepts.projectId, project.id));
    const result = await db.insert(coverConcepts).values({ projectId: project.id, artBriefId: brief.id, version: rows.length + 1, name: input.name, direction: input.direction, source: "ai", storageKey: normalized.key, storageUrl: normalized.url, mimeType: "image/png", width: normalized.width, height: normalized.height, promptProvenance: prompt });
    await requireOwnedCover(ownerId, Number(result[0].insertId));
    return getArtWorkspace(ownerId, project.id);
  } catch (error) {
    logPrivateError("cover-generation", traceId, error, { projectId: project.id, artBriefId: brief.id });
    throw new CaspaServiceError("IMAGE_GENERATION_UNAVAILABLE", "The cover concept could not be generated. Your approved brief is saved; try again or upload artwork.", traceId);
  }
}

async function storeUploadedAsset(ownerId: number, projectId: number, kind: "covers" | "illustrations", mimeType: string, dataBase64: string) {
  if (!safeAssetMime(mimeType)) throw new Error("ASSET_FORMAT_UNSUPPORTED");
  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new Error("ASSET_SIZE_INVALID");
  const dimensions = imageSize(buffer);
  if (!dimensions.width || !dimensions.height) throw new Error("ASSET_DIMENSIONS_INVALID");
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const stored = await storagePut(`production/${ownerId}/${projectId}/${kind}/${Date.now()}.${extension}`, buffer, mimeType);
  return { ...stored, width: dimensions.width, height: dimensions.height };
}

export async function uploadCoverConcept(ownerId: number, input: { projectId: number; artBriefId: number; name: string; direction: string; mimeType: string; dataBase64: string }) {
  const project = await requireOwnedProject(ownerId, input.projectId);
  assertActionAllowed(project.currentState, "generate-cover");
  const brief = await requireOwnedArtBrief(ownerId, input.artBriefId);
  if (brief.projectId !== project.id) throw new Error("ART_BRIEF_PROJECT_MISMATCH");
  const asset = await storeUploadedAsset(ownerId, project.id, "covers", input.mimeType, input.dataBase64);
  const db = await productionDb();
  const rows = await db.select().from(coverConcepts).where(eq(coverConcepts.projectId, project.id));
  const result = await db.insert(coverConcepts).values({ projectId: project.id, artBriefId: brief.id, version: rows.length + 1, name: input.name, direction: input.direction, source: "upload", storageKey: asset.key, storageUrl: asset.url, mimeType: input.mimeType, width: asset.width, height: asset.height });
  await requireOwnedCover(ownerId, Number(result[0].insertId));
  return getArtWorkspace(ownerId, project.id);
}

export async function approveCoverConcept(ownerId: number, coverId: number) {
  const cover = await requireOwnedCover(ownerId, coverId);
  const project = await requireOwnedProject(ownerId, cover.projectId);
  assertActionAllowed(project.currentState, "approve-cover");
  await requireConfiguredApprovals(ownerId, project.id, "cover", "cover-concept", cover.id);
  const db = await productionDb();
  await db.transaction(async tx => {
    await tx.update(coverConcepts).set({ status: "superseded" }).where(and(eq(coverConcepts.projectId, project.id), eq(coverConcepts.status, "approved"), ne(coverConcepts.id, cover.id)));
    await tx.update(coverConcepts).set({ status: "approved", approvedAt: new Date() }).where(eq(coverConcepts.id, cover.id));
  });
  return getArtWorkspace(ownerId, project.id);
}

export async function setIllustrationSlotStatus(ownerId: number, slotId: number, status: "approved" | "rejected" | "waived") {
  const { slot, plan } = await requireOwnedIllustrationSlot(ownerId, slotId);
  const project = await requireOwnedProject(ownerId, plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  const db = await productionDb();
  await db.update(illustrationSlots).set({ status, approvedAt: status === "approved" || status === "waived" ? new Date() : null }).where(eq(illustrationSlots.id, slot.id));
  return getArtWorkspace(ownerId, project.id);
}

export async function reviseIllustrationSlot(ownerId: number, input: { slotId: number; placement: string; purpose: string; sceneBrief: string; aspectRatio: "1:1" | "4:3" | "5:4" | "3:2" | "2:3" | "16:9"; bleed: boolean; caption: string; altText: string; continuityNotes: string }) {
  const { slot, plan } = await requireOwnedIllustrationSlot(ownerId, input.slotId);
  const project = await requireOwnedProject(ownerId, plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  const db = await productionDb();
  await db.update(illustrationSlots).set({ placement: input.placement, purpose: input.purpose, sceneBrief: input.sceneBrief, aspectRatio: input.aspectRatio, bleed: input.bleed, caption: input.caption, altText: input.altText, continuityNotes: input.continuityNotes, status: "proposed", approvedAt: null }).where(eq(illustrationSlots.id, slot.id));
  return getArtWorkspace(ownerId, project.id);
}

function illustrationPrompt(project: Awaited<ReturnType<typeof requireOwnedProject>>, brief: Awaited<ReturnType<typeof requireOwnedArtBrief>>, slot: Awaited<ReturnType<typeof requireOwnedIllustrationSlot>>["slot"], consistencyJson: string) {
  return `Create a publication-quality ${slot.aspectRatio} illustration for a ${project.format.replace("-", " ")} book. No text, no letters, no caption, no watermark, no frame. Narrative purpose: ${slot.purpose}. Scene: ${slot.sceneBrief}. Placement: ${slot.placement}. Art medium: ${brief.medium}. Palette: ${brief.palette}. Tone: ${brief.tone}. Continuity system: ${consistencyJson}. Slot continuity notes: ${slot.continuityNotes}. Avoid: ${brief.exclusions}. Compose for ${slot.bleed ? "full bleed with important subjects inside a safe central area" : "contained placement with clean edge breathing room"}.`;
}

export async function generateIllustration(ownerId: number, slotId: number) {
  const row = await requireOwnedIllustrationSlot(ownerId, slotId);
  const project = await requireOwnedProject(ownerId, row.plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  if (row.slot.status !== "approved") throw new Error("ILLUSTRATION_SLOT_APPROVAL_REQUIRED");
  const brief = await requireOwnedArtBrief(ownerId, row.plan.artBriefId);
  const traceId = createTraceId();
  try {
    const prompt = illustrationPrompt(project, brief, row.slot, row.plan.consistencyJson);
    const image = await generateImage({ prompt, model: "MODEL_GPT_IMAGE_2", quality: "high" });
    if (!image.url || !image.key) throw new Error("Image service returned no asset");
    const normalized = await normalizeGeneratedAsset(ownerId, project.id, "illustrations", image.key);
    const db = await productionDb();
    const prior = await db.select().from(illustrationAssets).where(eq(illustrationAssets.slotId, slotId));
    const result = await db.insert(illustrationAssets).values({ projectId: project.id, slotId, version: prior.length + 1, source: "ai", storageKey: normalized.key, storageUrl: normalized.url, mimeType: "image/png", width: normalized.width, height: normalized.height, promptProvenance: prompt });
    await requireOwnedIllustrationAsset(ownerId, Number(result[0].insertId));
    return getArtWorkspace(ownerId, project.id);
  } catch (error) {
    logPrivateError("illustration-generation", traceId, error, { projectId: project.id, slotId });
    throw new CaspaServiceError("IMAGE_GENERATION_UNAVAILABLE", "The illustration could not be generated. Its approved brief is saved; try again or upload artwork.", traceId);
  }
}

export async function uploadIllustration(ownerId: number, input: { slotId: number; mimeType: string; dataBase64: string }) {
  const row = await requireOwnedIllustrationSlot(ownerId, input.slotId);
  const project = await requireOwnedProject(ownerId, row.plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  const stored = await storeUploadedAsset(ownerId, project.id, "illustrations", input.mimeType, input.dataBase64);
  const db = await productionDb();
  const prior = await db.select().from(illustrationAssets).where(eq(illustrationAssets.slotId, input.slotId));
  const result = await db.insert(illustrationAssets).values({ projectId: project.id, slotId: input.slotId, version: prior.length + 1, source: "upload", storageKey: stored.key, storageUrl: stored.url, mimeType: input.mimeType, width: stored.width, height: stored.height });
  await requireOwnedIllustrationAsset(ownerId, Number(result[0].insertId));
  return getArtWorkspace(ownerId, project.id);
}

export async function approveIllustrationAsset(ownerId: number, assetId: number) {
  const asset = await requireOwnedIllustrationAsset(ownerId, assetId);
  if (!asset.slotId) throw new Error("ILLUSTRATION_SLOT_REQUIRED");
  const row = await requireOwnedIllustrationSlot(ownerId, asset.slotId);
  const project = await requireOwnedProject(ownerId, row.plan.projectId);
  assertActionAllowed(project.currentState, "approve-illustrations");
  await requireConfiguredApprovals(ownerId, project.id, "illustration", "illustration-asset", asset.id);
  const profile = JSON.parse(row.plan.consistencyJson) as Record<string, unknown>;
  if (!continuityProfileComplete(profile)) throw new Error("CONTINUITY_PROFILE_INCOMPLETE");
  const db = await productionDb();
  await db.transaction(async tx => {
    await tx.update(illustrationAssets).set({ status: "superseded" }).where(and(eq(illustrationAssets.slotId, asset.slotId!), eq(illustrationAssets.status, "approved"), ne(illustrationAssets.id, asset.id)));
    await tx.update(illustrationAssets).set({ status: "approved", approvedAt: new Date() }).where(eq(illustrationAssets.id, asset.id));
  });
  return getArtWorkspace(ownerId, project.id);
}

export async function approveArtProgram(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "approve-art-program");
  const rows = await latestProductionRows(ownerId, projectId);
  const approvedSlotIds = rows.slots.filter(slot => slot.status === "approved").map(slot => slot.id);
  const issues = artProgramIssues({ briefStatus: rows.brief?.status ?? null, illustrationMode: rows.brief?.illustrationMode ?? null, approvedCoverCount: rows.covers.filter(cover => cover.status === "approved" && cover.artBriefId === rows.brief?.id).length, unresolvedSlotCount: rows.slots.filter(slot => !["approved", "waived"].includes(slot.status)).length, approvedSlotIds, approvedAssetSlotIds: rows.assets.filter(asset => asset.status === "approved" && asset.slotId).map(asset => asset.slotId!) });
  if (issues[0]) throw new Error(issues[0]);
  const db = await productionDb();
  await db.transaction(async tx => {
    if (rows.plan) await tx.update(illustrationPlans).set({ status: rows.brief!.illustrationMode === "none" || rows.brief!.illustrationMode === "cover-only" ? "waived" : "completed", approvedAt: new Date() }).where(eq(illustrationPlans.id, rows.plan.id));
    assertTransition(project.currentState, "art-approved");
    await tx.update(projects).set({ currentState: "art-approved" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
  });
  return getArtWorkspace(ownerId, projectId);
}
