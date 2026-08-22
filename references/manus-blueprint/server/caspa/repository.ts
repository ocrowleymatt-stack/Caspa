import { and, desc, eq } from "drizzle-orm";
import {
  manuscriptVersions,
  projects,
  type ManuscriptVersion,
  type Project,
} from "../../drizzle/schema";
import { assertActionAllowed, assertTransition, type ProjectState, type WorkflowAction } from "../../shared/workflow";
import { manuscriptMetrics } from "../../shared/manuscript";
import { getDb } from "../db";
import { isOwnedBy } from "./policies";

export class CaspaNotFoundError extends Error {
  constructor(message = "Project not found") {
    super(message);
    this.name = "CaspaNotFoundError";
  }
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function requireOwnedProject(ownerId: number, projectId: number): Promise<Project> {
  const db = await database();
  const rows = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0] || !isOwnedBy(ownerId, rows[0].ownerId)) throw new CaspaNotFoundError();
  return rows[0];
}

export async function requireOwnedVersion(ownerId: number, versionId: number): Promise<ManuscriptVersion> {
  const db = await database();
  const rows = await db
    .select({ version: manuscriptVersions })
    .from(manuscriptVersions)
    .innerJoin(projects, eq(manuscriptVersions.projectId, projects.id))
    .where(and(eq(manuscriptVersions.id, versionId), eq(projects.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new CaspaNotFoundError("Manuscript version not found");
  return rows[0].version;
}

export async function listOwnedProjects(ownerId: number) {
  const db = await database();
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt));
}

export async function createOwnedProject(input: {
  ownerId: number;
  title: string;
  authorName: string;
  format: Project["format"];
  premise: string;
  targetWordCount: number;
}) {
  const db = await database();
  return db.transaction(async tx => {
    const inserted = await tx.insert(projects).values({
      ownerId: input.ownerId,
      title: input.title,
      authorName: input.authorName,
      format: input.format,
      premise: input.premise,
      targetWordCount: input.targetWordCount,
      currentState: "draft",
    });
    const projectId = Number(inserted[0].insertId);
    const versionResult = await tx.insert(manuscriptVersions).values({
      projectId,
      name: "Project created",
      trigger: "project-created",
      content: "",
      wordCount: 0,
      chapterCount: 0,
      createdByUserId: input.ownerId,
    });
    const versionId = Number(versionResult[0].insertId);
    await tx.update(projects).set({ activeVersionId: versionId }).where(eq(projects.id, projectId));
    const rows = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    return rows[0];
  });
}

export async function createNamedVersion(input: {
  ownerId: number;
  projectId: number;
  name: string;
  trigger: ManuscriptVersion["trigger"];
  content: string;
  sourceVersionId?: number | null;
}) {
  const project = await requireOwnedProject(input.ownerId, input.projectId);
  if (input.sourceVersionId) await requireOwnedVersion(input.ownerId, input.sourceVersionId);
  const db = await database();
  const metrics = manuscriptMetrics(input.content);
  return db.transaction(async tx => {
    const result = await tx.insert(manuscriptVersions).values({
      projectId: input.projectId,
      name: input.name,
      trigger: input.trigger,
      content: input.content,
      wordCount: metrics.wordCount,
      chapterCount: metrics.chapterCount,
      sourceVersionId: input.sourceVersionId ?? project.activeVersionId ?? null,
      createdByUserId: input.ownerId,
    });
    const versionId = Number(result[0].insertId);
    await tx.update(projects).set({
      activeVersionId: versionId,
      wordCount: metrics.wordCount,
      chapterCount: metrics.chapterCount,
    }).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, input.ownerId)));
    const rows = await tx.select().from(manuscriptVersions).where(eq(manuscriptVersions.id, versionId)).limit(1);
    return rows[0];
  });
}

export async function listOwnedVersions(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  return db.select().from(manuscriptVersions).where(eq(manuscriptVersions.projectId, projectId)).orderBy(desc(manuscriptVersions.createdAt));
}

export async function getOwnedProjectWorkspace(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  const activeVersion = project.activeVersionId ? await requireOwnedVersion(ownerId, project.activeVersionId) : null;
  const versions = await listOwnedVersions(ownerId, projectId);
  return { project, activeVersion, versions };
}

export async function transitionOwnedProject(ownerId: number, projectId: number, to: ProjectState) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertTransition(project.currentState, to);
  const db = await database();
  await db.update(projects).set({
    currentState: to,
    archivedAt: to === "archived" ? new Date() : null,
  }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  return requireOwnedProject(ownerId, projectId);
}

export async function assertOwnedAction(ownerId: number, projectId: number, action: WorkflowAction) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, action);
  return project;
}
