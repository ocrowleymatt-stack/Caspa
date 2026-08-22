import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { toSafeTrpcError } from "../caspa/errors";
import {
  acceptRevision,
  advanceRevision,
  approveRevisionPlan,
  getLatestRevisionPlan,
  getRevisionStatus,
  retryRevision,
  startRevision,
} from "../caspa/workflows";

export const revisionsRouter = router({
  latestPlan: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getLatestRevisionPlan(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The revision plan could not be loaded."); }
  }),
  approvePlan: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    diagnosisId: z.number().int().positive(),
    findingIds: z.array(z.number().int().positive()).min(1).max(30),
    scope: z.enum(["whole-book", "chapter-range", "single-chapter"]),
    startChapter: z.number().int().positive().nullable().optional(),
    endChapter: z.number().int().positive().nullable().optional(),
    styleProfileId: z.number().int().positive().nullable().optional(),
    authorConfirmed: z.literal(true),
  })).mutation(async ({ ctx, input }) => {
    try { return await approveRevisionPlan({ ownerId: ctx.user.id, ...input }); } catch (error) { return toSafeTrpcError(error, "The revision plan was not approved. No manuscript changes were made."); }
  }),
  start: protectedProcedure.input(z.object({ planId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await startRevision(ctx.user.id, input.planId); } catch (error) { return toSafeTrpcError(error, "The revision job was not started. Your source version is unchanged."); }
  }),
  status: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getRevisionStatus(ctx.user.id, input.jobId); } catch (error) { return toSafeTrpcError(error, "The revision status could not be loaded."); }
  }),
  advance: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await advanceRevision(ctx.user.id, input.jobId); } catch (error) { return toSafeTrpcError(error, "The revision paused safely at its latest checkpoint. Try resuming it."); }
  }),
  retry: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return await retryRevision(ctx.user.id, input.jobId); } catch (error) { return toSafeTrpcError(error, "The failed revision could not be resumed from its latest checkpoint."); }
  }),
  accept: protectedProcedure.input(z.object({ jobId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await acceptRevision(ctx.user.id, input.jobId); } catch (error) { return toSafeTrpcError(error, "The revision result is still awaiting review."); }
  }),
});
