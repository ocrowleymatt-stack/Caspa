import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import { listOwnedVersions, requireOwnedVersion } from "../caspa/repository";
import { restoreVersion } from "../caspa/workflows";

export const versionsRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await listOwnedVersions(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "Version history could not be loaded."); }
  }),
  compare: protectedProcedure.input(z.object({ leftVersionId: z.number().int().positive(), rightVersionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      const [left, right] = await Promise.all([requireOwnedVersion(ctx.user.id, input.leftVersionId), requireOwnedVersion(ctx.user.id, input.rightVersionId)]);
      if (left.projectId !== right.projectId) throw new Error("VERSION_PROJECT_MISMATCH");
      return { left, right, wordDelta: right.wordCount - left.wordCount, chapterDelta: right.chapterCount - left.chapterCount };
    } catch (error) { return toSafeTrpcError(error, "The selected versions could not be compared."); }
  }),
  restore: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), versionId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await restoreVersion(ctx.user.id, input.projectId, input.versionId); } catch (error) { return toSafeTrpcError(error, "The selected version was not restored. Your current version is unchanged."); }
  }),
});
