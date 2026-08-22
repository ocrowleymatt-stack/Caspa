import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { approveArtBrief, approveArtProgram, approveCoverConcept, approveIllustrationAsset, generateCoverConcept, generateIllustration, getArtWorkspace, reviseArtBrief, reviseIllustrationSlot, setIllustrationSlotStatus, startArtDirection, updateContinuityProfile, uploadCoverConcept, uploadIllustration } from "../caspa/art";
import { toSafeTrpcError } from "../caspa/errors";
import { addProofAnnotation, approveProductionProof, composeLayout, resolveProofAnnotation, restoreLayoutVersion, returnProofToLayout, runProductionPreflight, submitProof } from "../caspa/layout";
import { generateProductionPackage } from "../caspa/productionOutput";

const bounded = z.string().trim().min(1).max(4000);

export const productionRouter = router({
  workspace: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getArtWorkspace(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The production workspace could not be loaded."); }
  }),
  start: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await startArtDirection(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "Book production could not be started from this manuscript state."); }
  }),
  reviseBrief: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), illustrationMode: z.enum(["none", "cover-only", "limited", "fully-illustrated"]), audience: bounded, genreSignals: bounded, tone: bounded, motifs: bounded, exclusions: bounded, palette: bounded, medium: z.string().trim().min(2).max(180), typographyDirection: bounded, trimSize: z.string().trim().min(3).max(40), distribution: z.enum(["print", "digital", "both"]) })).mutation(async ({ ctx, input }) => {
    try { return await reviseArtBrief(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The visual brief was not revised. The previous version is unchanged."); }
  }),
  approveBrief: protectedProcedure.input(z.object({ artBriefId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await approveArtBrief(ctx.user.id, input.artBriefId); } catch (error) { return toSafeTrpcError(error, "The visual brief was not approved."); }
  }),
  generateCover: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), artBriefId: z.number().int().positive(), name: z.string().trim().min(2).max(200), direction: bounded })).mutation(async ({ ctx, input }) => {
    try { return await generateCoverConcept(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The cover concept could not be generated. Your brief is saved."); }
  }),
  uploadCover: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), artBriefId: z.number().int().positive(), name: z.string().trim().min(2).max(200), direction: bounded, mimeType: z.string().max(120), dataBase64: z.string().min(20).max(21_000_000) })).mutation(async ({ ctx, input }) => {
    try { return await uploadCoverConcept(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The cover artwork could not be uploaded. Use PNG, JPEG, or WebP under 15 MB."); }
  }),
  approveCover: protectedProcedure.input(z.object({ coverId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await approveCoverConcept(ctx.user.id, input.coverId); } catch (error) { return toSafeTrpcError(error, "The cover concept was not approved."); }
  }),
  setSlotStatus: protectedProcedure.input(z.object({ slotId: z.number().int().positive(), status: z.enum(["approved", "rejected", "waived"]), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await setIllustrationSlotStatus(ctx.user.id, input.slotId, input.status); } catch (error) { return toSafeTrpcError(error, "The illustration brief was not updated."); }
  }),
  reviseSlot: protectedProcedure.input(z.object({ slotId: z.number().int().positive(), placement: z.string().trim().min(2).max(240), purpose: bounded, sceneBrief: bounded, aspectRatio: z.enum(["1:1", "4:3", "5:4", "3:2", "2:3", "16:9"]), bleed: z.boolean(), caption: z.string().trim().max(1000), altText: z.string().trim().min(2).max(1000), continuityNotes: bounded })).mutation(async ({ ctx, input }) => {
    try { return await reviseIllustrationSlot(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The illustration brief could not be revised."); }
  }),
  updateContinuity: protectedProcedure.input(z.object({ planId: z.number().int().positive(), characters: bounded, locations: bounded, palette: bounded, medium: bounded, periodDetails: bounded, worldRules: bounded })).mutation(async ({ ctx, input }) => {
    try { return await updateContinuityProfile(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The continuity profile could not be updated."); }
  }),
  generateIllustration: protectedProcedure.input(z.object({ slotId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await generateIllustration(ctx.user.id, input.slotId); } catch (error) { return toSafeTrpcError(error, "The illustration could not be generated. Its brief is saved."); }
  }),
  uploadIllustration: protectedProcedure.input(z.object({ slotId: z.number().int().positive(), mimeType: z.string().max(120), dataBase64: z.string().min(20).max(21_000_000) })).mutation(async ({ ctx, input }) => {
    try { return await uploadIllustration(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The illustration could not be uploaded. Use PNG, JPEG, or WebP under 15 MB."); }
  }),
  approveIllustration: protectedProcedure.input(z.object({ assetId: z.number().int().positive(), authorConfirmed: z.literal(true), continuityConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await approveIllustrationAsset(ctx.user.id, input.assetId); } catch (error) { return toSafeTrpcError(error, "The illustration was not approved."); }
  }),
  approveProgram: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await approveArtProgram(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "Approve the visual brief, one cover, and every required illustration before layout."); }
  }),
  composeLayout: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), trimSize: z.enum(["5 × 8 in", "5.5 × 8.5 in", "6 × 9 in", "7 × 10 in", "8.5 × 11 in", "10 × 8 in"]), margins: z.object({ top: z.number().int().min(18).max(144), right: z.number().int().min(18).max(144), bottom: z.number().int().min(18).max(144), left: z.number().int().min(18).max(144) }), bleedPt: z.number().int().min(0).max(36), bodyFont: z.string().trim().min(2).max(120), displayFont: z.string().trim().min(2).max(120), bodySizePt: z.number().int().min(8).max(18), lineHeightPct: z.number().int().min(110).max(200), paragraphStyle: z.enum(["indent", "spaced"]), runningHeads: z.boolean(), folios: z.boolean(), chapterOpening: z.enum(["right-hand", "next-page", "continuous"]), imagePlacement: z.enum(["inline", "full-page", "spread"]), editionMode: z.enum(["print", "digital", "both"]), language: z.string().trim().min(2).max(16), digitalNavigation: z.boolean(), imageAltPolicy: z.enum(["required", "optional"]), printProfile: z.enum(["grayscale", "standard-color", "premium-color"]), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { const { authorConfirmed, ...spec } = input; return await composeLayout(ctx.user.id, spec); } catch (error) { return toSafeTrpcError(error, "The layout could not be composed. Approved manuscript and art versions are unchanged."); }
  }),
  submitProof: protectedProcedure.input(z.object({ layoutVersionId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await submitProof(ctx.user.id, input.layoutVersionId); } catch (error) { return toSafeTrpcError(error, "The layout could not be submitted for proof review."); }
  }),
  returnToLayout: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await returnProofToLayout(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The proof could not be returned to layout."); }
  }),
  restoreLayout: protectedProcedure.input(z.object({ layoutVersionId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await restoreLayoutVersion(ctx.user.id, input.layoutVersionId); } catch (error) { return toSafeTrpcError(error, "The selected layout could not be restored as a new version."); }
  }),
  addAnnotation: protectedProcedure.input(z.object({ layoutVersionId: z.number().int().positive(), pageNumber: z.number().int().positive(), xPct: z.number().int().min(0).max(100), yPct: z.number().int().min(0).max(100), note: z.string().trim().min(2).max(4000) })).mutation(async ({ ctx, input }) => {
    try { return await addProofAnnotation(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The proof comment could not be added."); }
  }),
  resolveAnnotation: protectedProcedure.input(z.object({ annotationId: z.number().int().positive(), status: z.enum(["resolved", "accepted-as-is", "deferred"]), resolutionNote: z.string().trim().min(2).max(4000), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await resolveProofAnnotation(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The proof comment could not be resolved."); }
  }),
  preflight: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await runProductionPreflight(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "Production preflight could not be completed. The proof remains unchanged."); }
  }),
  approveProof: protectedProcedure.input(z.object({ preflightId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await approveProductionProof(ctx.user.id, input.preflightId); } catch (error) { return toSafeTrpcError(error, "The latest passing proof could not be approved for production."); }
  }),
  generatePackage: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await generateProductionPackage(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The production package could not be generated. The approved proof remains unchanged."); }
  }),
});
