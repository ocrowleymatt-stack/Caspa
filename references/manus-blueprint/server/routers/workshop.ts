import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import { getLatestDiagnosis, runDiagnosis } from "../caspa/workflows";

export const workshopRouter = router({
  latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getLatestDiagnosis(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The diagnosis could not be loaded."); }
  }),
  diagnose: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await runDiagnosis(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The diagnosis could not be completed. Your manuscript is unchanged."); }
  }),
});
