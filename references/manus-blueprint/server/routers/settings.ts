import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, router } from "../_core/trpc";
import { buildAccountExport, createAccountBackup, deleteAccount, deleteOwnedProject, listAccountBackups } from "../caspa/account";
import { toSafeTrpcError } from "../caspa/errors";

export const settingsRouter = router({
  backups: protectedProcedure.query(async ({ ctx }) => {
    try { return await listAccountBackups(ctx.user.id); } catch (error) { return toSafeTrpcError(error, "Backups could not be loaded."); }
  }),
  createBackup: protectedProcedure.mutation(async ({ ctx }) => {
    try { return await createAccountBackup(ctx.user.id); } catch (error) { return toSafeTrpcError(error, "The backup could not be created. Your projects are unchanged."); }
  }),
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const payload = await buildAccountExport(ctx.user.id);
      return { filename: `caspa-account-${new Date().toISOString().slice(0, 10)}.json`, mimeType: "application/json", content: JSON.stringify(payload, null, 2) };
    } catch (error) { return toSafeTrpcError(error, "Your account export could not be prepared."); }
  }),
  deleteProject: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), confirmation: z.string().max(240) })).mutation(async ({ ctx, input }) => {
    try { return await deleteOwnedProject(ctx.user.id, input.projectId, input.confirmation); } catch (error) { return toSafeTrpcError(error, "The project was not deleted. Type its exact title to confirm."); }
  }),
  deleteAccount: protectedProcedure.input(z.object({ confirmation: z.string().max(80) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await deleteAccount(ctx.user.id, input.confirmation);
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return result;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      return toSafeTrpcError(error, "The account was not deleted. Type the confirmation phrase exactly.");
    }
  }),
});
