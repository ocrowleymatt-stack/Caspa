import { z } from "zod";
import { approvalAreas, collaboratorRoles, reviewDimensions } from "../../shared/collaboration";
import { protectedProcedure, router } from "../_core/trpc";
import { acceptInvitation, changeCollaboratorRole, closeReviewRound, getApprovalInbox, getCollaborationWorkspace, getReviewerRound, inviteCollaborator, openReviewRound, recordCollaboratorApproval, revokeCollaborator, setApprovalRequirement, submitBlindReview } from "../caspa/collaboration";
import { toSafeTrpcError } from "../caspa/errors";

const ratingSchema = z.object(Object.fromEntries(reviewDimensions.map(dimension => [dimension, z.number().int().min(1).max(5)])) as Record<(typeof reviewDimensions)[number], z.ZodNumber>);

export const collaborationRouter = router({
  approvalInbox: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getApprovalInbox(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "Your approval inbox could not be loaded."); }
  }),
  workspace: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getCollaborationWorkspace(ctx.user.id, input.projectId); } catch (error) { return toSafeTrpcError(error, "The collaboration desk could not be loaded."); }
  }),
  invite: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), email: z.string().trim().email().max(320), role: z.enum(collaboratorRoles) })).mutation(async ({ ctx, input }) => {
    try { return await inviteCollaborator(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The collaborator invitation could not be created."); }
  }),
  accept: protectedProcedure.input(z.object({ inviteCode: z.string().trim().min(12).max(200) })).mutation(async ({ ctx, input }) => {
    try { return await acceptInvitation(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "This invitation could not be accepted."); }
  }),
  revoke: protectedProcedure.input(z.object({ collaboratorId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await revokeCollaborator(ctx.user.id, input.collaboratorId); } catch (error) { return toSafeTrpcError(error, "The collaborator could not be revoked."); }
  }),
  changeRole: protectedProcedure.input(z.object({ collaboratorId: z.number().int().positive(), role: z.enum(collaboratorRoles), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await changeCollaboratorRole(ctx.user.id, input.collaboratorId, input.role); } catch (error) { return toSafeTrpcError(error, "The collaborator role could not be changed."); }
  }),
  openRound: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), versionId: z.number().int().positive(), title: z.string().trim().min(2).max(220), collaboratorIds: z.array(z.number().int().positive()).min(1).max(12), identityPolicy: z.enum(["anonymous", "reveal-on-close"]) })).mutation(async ({ ctx, input }) => {
    try { return await openReviewRound(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "The blind review round could not be opened."); }
  }),
  reviewerRound: protectedProcedure.input(z.object({ reviewRoundId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getReviewerRound(ctx.user.id, input.reviewRoundId); } catch (error) { return toSafeTrpcError(error, "This blind review is not available."); }
  }),
  submitReview: protectedProcedure.input(z.object({ reviewRoundId: z.number().int().positive(), ratings: ratingSchema, feedback: z.string().trim().min(20).max(10_000) })).mutation(async ({ ctx, input }) => {
    try { return await submitBlindReview(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "Your review could not be submitted."); }
  }),
  closeRound: protectedProcedure.input(z.object({ reviewRoundId: z.number().int().positive(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { return await closeReviewRound(ctx.user.id, input.reviewRoundId); } catch (error) { return toSafeTrpcError(error, "The review round could not be closed."); }
  }),
  setRequirement: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), area: z.enum(approvalAreas), requiredRole: z.enum(collaboratorRoles), enabled: z.boolean(), authorConfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    try { const { authorConfirmed, ...requirement } = input; return await setApprovalRequirement(ctx.user.id, requirement); } catch (error) { return toSafeTrpcError(error, "The collaboration approval setting could not be updated."); }
  }),
  decide: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), area: z.enum(approvalAreas), targetType: z.string().trim().min(2).max(80), targetId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(2_000).optional() })).mutation(async ({ ctx, input }) => {
    try { return await recordCollaboratorApproval(ctx.user.id, input); } catch (error) { return toSafeTrpcError(error, "Your collaboration decision could not be recorded."); }
  }),
});
