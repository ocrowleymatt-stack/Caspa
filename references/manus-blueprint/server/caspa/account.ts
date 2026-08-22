import { desc, eq, inArray } from "drizzle-orm";
import {
  accountBackups,
  chapterCheckpoints,
  diagnoses,
  diagnosisFindings,
  exportPreflights,
  manuscriptUploads,
  manuscriptVersions,
  projects,
  revisionJobs,
  revisionPlanItems,
  revisionPlans,
  styleProfiles,
  styleSamples,
  projectCollaborators,
  reviewRounds,
  reviewAssignments,
  reviewSubmissions,
  approvalRequirements,
  approvalDecisions,
  projectAuditEvents,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { CaspaNotFoundError, requireOwnedProject } from "./repository";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function buildAccountExport(ownerId: number) {
  const db = await database();
  const ownedProjects = await db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt));
  const [ownedStyleSamples, ownedStyleProfiles] = await Promise.all([
    db.select().from(styleSamples).where(eq(styleSamples.ownerId, ownerId)),
    db.select().from(styleProfiles).where(eq(styleProfiles.ownerId, ownerId)),
  ]);
  const payload = [];
  for (const project of ownedProjects) {
    const versions = await db.select().from(manuscriptVersions).where(eq(manuscriptVersions.projectId, project.id)).orderBy(desc(manuscriptVersions.createdAt));
    const projectDiagnoses = await db.select().from(diagnoses).where(eq(diagnoses.projectId, project.id));
    const findings = projectDiagnoses.length
      ? await db.select().from(diagnosisFindings).where(eq(diagnosisFindings.diagnosisId, projectDiagnoses[0].id))
      : [];
    const plans = await db.select().from(revisionPlans).where(eq(revisionPlans.projectId, project.id));
    const jobs = await db.select().from(revisionJobs).where(eq(revisionJobs.projectId, project.id));
    const preflights = await db.select().from(exportPreflights).where(eq(exportPreflights.projectId, project.id));
    const uploads = await db.select().from(manuscriptUploads).where(eq(manuscriptUploads.projectId, project.id));
    const [collaborators, rounds, requirements, decisions, events] = await Promise.all([
      db.select().from(projectCollaborators).where(eq(projectCollaborators.projectId, project.id)),
      db.select().from(reviewRounds).where(eq(reviewRounds.projectId, project.id)),
      db.select().from(approvalRequirements).where(eq(approvalRequirements.projectId, project.id)),
      db.select().from(approvalDecisions).where(eq(approvalDecisions.projectId, project.id)),
      db.select().from(projectAuditEvents).where(eq(projectAuditEvents.projectId, project.id)),
    ]);
    const roundIds = rounds.map(round => round.id);
    const reviewData = roundIds.length ? await Promise.all([
      db.select().from(reviewAssignments).where(inArray(reviewAssignments.reviewRoundId, roundIds)),
      db.select().from(reviewSubmissions).where(inArray(reviewSubmissions.reviewRoundId, roundIds)),
    ]) : [[], []] as const;
    payload.push({ project, versions, diagnoses: projectDiagnoses, findings, plans, jobs, preflights, uploads, collaborators, reviews: { rounds, assignments: reviewData[0], submissions: reviewData[1] }, approvalRequirements: requirements, approvalDecisions: decisions, auditEvents: events });
  }
  return { exportedAt: new Date().toISOString(), schemaVersion: 2, styleLibrary: { samples: ownedStyleSamples, profiles: ownedStyleProfiles }, projects: payload };
}

export async function createAccountBackup(ownerId: number) {
  const payload = await buildAccountExport(ownerId);
  const json = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const stored = await storagePut(`caspa/${ownerId}/backups/caspa-backup-${stamp}.json`, json, "application/json");
  const db = await database();
  const result = await db.insert(accountBackups).values({ ownerId, status: "created", storageKey: stored.key, storageUrl: stored.url, projectCount: payload.projects.length });
  const id = Number(result[0].insertId);
  const rows = await db.select().from(accountBackups).where(eq(accountBackups.id, id)).limit(1);
  return rows[0];
}

export async function listAccountBackups(ownerId: number) {
  const db = await database();
  return db.select().from(accountBackups).where(eq(accountBackups.ownerId, ownerId)).orderBy(desc(accountBackups.createdAt));
}

export async function deleteOwnedProject(ownerId: number, projectId: number, confirmation: string) {
  const project = await requireOwnedProject(ownerId, projectId);
  if (confirmation.trim() !== project.title) throw new Error("PROJECT_DELETE_CONFIRMATION_MISMATCH");
  const db = await database();
  await db.delete(projects).where(eq(projects.id, projectId));
  return { deleted: true, projectId };
}

export async function deleteAccount(ownerId: number, confirmation: string) {
  if (confirmation.trim() !== "DELETE MY CASPA ACCOUNT") throw new Error("ACCOUNT_DELETE_CONFIRMATION_MISMATCH");
  const db = await database();
  const rows = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
  if (!rows[0]) throw new CaspaNotFoundError("Account not found");
  await db.delete(users).where(eq(users.id, ownerId));
  return { deleted: true };
}
