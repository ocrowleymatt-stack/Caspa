import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import { acceptDraftPreview, createDraftPreview, latestDraftPreview, rejectDraftPreview } from "../caspa/drafting";

const draftBrief = z.object({
  projectId: z.number().int().positive(),
  mode: z.enum(["opening", "append-chapter", "replace-chapter"]),
  chapterTitle: z.string().trim().min(2).max(240),
  chapterNumber: z.number().int().positive().max(500).nullable().optional(),
  targetWords: z.number().int().min(250).max(6000),
  outline: z.string().trim().max(10_000).optional(),
  voiceNotes: z.string().trim().max(4_000).optional(),
  exclusions: z.string().trim().max(2_000).optional(),
  styleProfileId: z.number().int().positive().nullable().optional(),
});

export const draftingRouter = router({
  latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => latestDraftPreview(ctx.user.id, input.projectId)),
  preview: protectedProcedure.input(draftBrief).mutation(async ({ ctx, input }) => {
    try { return await createDraftPreview(ctx.user.id, input.projectId, input); } catch (error) { return toSafeTrpcError(error, "CASPA could not prepare a draft preview. Your manuscript is unchanged."); }
  }),
  accept: protectedProcedure.input(z.object({ previewId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await acceptDraftPreview(ctx.user.id, input.previewId); } catch (error) { return toSafeTrpcError(error, "The draft preview could not be accepted. Your manuscript remains unchanged."); }
  }),
  reject: protectedProcedure.input(z.object({ previewId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await rejectDraftPreview(ctx.user.id, input.previewId); } catch (error) { return toSafeTrpcError(error, "The draft preview could not be rejected."); }
  }),
});
