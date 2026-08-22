import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { manuscriptUploads, projectFormats } from "../../drizzle/schema";
import { deriveProjectTitle } from "../../shared/manuscript";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { toSafeTrpcError } from "../caspa/errors";
import {
  CaspaNotFoundError,
  assertOwnedAction,
  createNamedVersion,
  createOwnedProject,
  getOwnedProjectWorkspace,
  listOwnedProjects,
  requireOwnedProject,
  transitionOwnedProject,
} from "../caspa/repository";

const formatSchema = z.enum(projectFormats);

function projectError(error: unknown): never {
  if (error instanceof CaspaNotFoundError) throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  const message = error instanceof Error ? error.message : "PROJECT_OPERATION_FAILED";
  if (message.startsWith("WORKFLOW_")) throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The project could not be updated. Please try again." });
}

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listOwnedProjects(ctx.user.id)),

  get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await getOwnedProjectWorkspace(ctx.user.id, input.projectId); } catch (error) { return projectError(error); }
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().trim().max(240).optional(),
    authorName: z.string().trim().max(180).optional(),
    format: formatSchema,
    premise: z.string().trim().min(12).max(6000),
    targetWordCount: z.number().int().min(50).max(250000),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await createOwnedProject({
        ownerId: ctx.user.id,
        title: input.title || deriveProjectTitle(input.premise, input.format),
        authorName: input.authorName || ctx.user.name || "Author",
        format: input.format,
        premise: input.premise,
        targetWordCount: input.targetWordCount,
      });
    } catch (error) { return projectError(error); }
  }),

  saveManuscript: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    content: z.string().max(2_000_000),
    name: z.string().trim().min(2).max(200).default("Manual save"),
  })).mutation(async ({ ctx, input }) => {
    try {
      await assertOwnedAction(ctx.user.id, input.projectId, "edit-manuscript");
      return await createNamedVersion({
        ownerId: ctx.user.id,
        projectId: input.projectId,
        name: input.name,
        trigger: "manual-save",
        content: input.content,
      });
    } catch (error) { return projectError(error); }
  }),

  uploadManuscript: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    fileName: z.string().trim().min(1).max(320),
    mimeType: z.enum(["text/plain", "text/markdown"]),
    dataBase64: z.string().min(1).max(12_000_000),
  })).mutation(async ({ ctx, input }) => {
    try {
      await requireOwnedProject(ctx.user.id, input.projectId);
      await assertOwnedAction(ctx.user.id, input.projectId, "edit-manuscript");
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("UPLOAD_UNSUPPORTED");
      const content = bytes.toString("utf8").replace(/^\uFEFF/, "");
      if (!content.trim()) throw new Error("MANUSCRIPT_REQUIRED");
      const safeName = input.fileName.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "manuscript.txt";
      const stored = await storagePut(`caspa/${ctx.user.id}/projects/${input.projectId}/uploads/${Date.now()}-${safeName}`, bytes, input.mimeType);
      const version = await createNamedVersion({
        ownerId: ctx.user.id,
        projectId: input.projectId,
        name: `Uploaded · ${input.fileName}`,
        trigger: "upload",
        content,
      });
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      await db.insert(manuscriptUploads).values({
        projectId: input.projectId,
        versionId: version.id,
        originalName: input.fileName,
        mimeType: input.mimeType,
        storageKey: stored.key,
        storageUrl: stored.url,
        sizeBytes: bytes.length,
      });
      return version;
    } catch (error) {
      return toSafeTrpcError(error, "That file could not be imported. Upload a UTF-8 text or Markdown manuscript up to 8 MB.");
    }
  }),

  archive: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      await assertOwnedAction(ctx.user.id, input.projectId, "archive");
      return await transitionOwnedProject(ctx.user.id, input.projectId, "archived");
    } catch (error) { return projectError(error); }
  }),

  restoreArchive: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      await assertOwnedAction(ctx.user.id, input.projectId, "restore-archive");
      return await transitionOwnedProject(ctx.user.id, input.projectId, "draft");
    } catch (error) { return projectError(error); }
  }),
});
