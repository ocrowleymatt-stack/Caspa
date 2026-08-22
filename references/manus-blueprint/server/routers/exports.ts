import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import { buildAuthorizedExport, getLatestPreflight, performPreflight } from "../caspa/workflows";

export const exportsRouter = router({
  latestPreflight: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getLatestPreflight(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The export preflight could not be loaded."); }
  }),
  preflight: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await performPreflight(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The export preflight could not be completed."); }
  }),
  download: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), format: z.enum(["txt", "md"]) })).mutation(async ({ ctx, input }) => {
    try { return await buildAuthorizedExport(ctx.user.id, input.projectId, input.format); } catch (error) { return toSafeTrpcError(error, "Download is disabled until every server preflight check passes."); }
  }),
});
