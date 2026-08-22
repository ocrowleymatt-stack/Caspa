import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import { createStyleProfile, createStyleSample, deleteStyleSample, exportStyleLibrary, listStyleLibrary, setStyleProfileStatus } from "../caspa/style";

export const styleRouter = router({
  library: protectedProcedure.query(({ ctx }) => listStyleLibrary(ctx.user.id)),
  exportLibrary: protectedProcedure.mutation(async ({ ctx }) => {
    try { return await exportStyleLibrary(ctx.user.id); } catch (error) { return toSafeTrpcError(error, "Your private style library could not be exported."); }
  }),
  addSample: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(200), tags: z.string().trim().max(320).optional(), sourceNote: z.string().trim().max(2_000).optional(), content: z.string().trim().min(300).max(40_000), consentConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await createStyleSample(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The style sample could not be added. Confirm that you own or are licensed to use it."); }
  }),
  deleteSample: protectedProcedure.input(z.object({ sampleId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await deleteStyleSample(ctx.user.id, input.sampleId); } catch (error) { return toSafeTrpcError(error, "The style sample could not be removed."); }
  }),
  createProfile: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(200), sampleIds: z.array(z.number().int().positive()).min(1).max(8) })).mutation(async ({ ctx, input }) => {
    try { return await createStyleProfile(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "CASPA could not prepare a private craft profile. Your samples are unchanged."); }
  }),
  setProfileStatus: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), status: z.enum(["active", "revoked"]), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await setStyleProfileStatus(ctx.user.id, input.profileId, input.status); } catch (error) { return toSafeTrpcError(error, "The style profile could not be updated."); }
  }),
});
