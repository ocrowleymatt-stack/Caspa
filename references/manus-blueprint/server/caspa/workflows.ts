import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  chapterCheckpoints,
  diagnoses,
  diagnosisFindings,
  exportPreflights,
  manuscriptVersions,
  projects,
  revisionJobs,
  revisionPlanItems,
  revisionPlans,
  type ChapterCheckpoint,
  type Project,
  type RevisionJob,
  type RevisionPlan,
} from "../../drizzle/schema";
import { RUBRIC_VERSION } from "../../shared/editorial";
import { countWords, manuscriptMetrics, splitManuscript } from "../../shared/manuscript";
import { assertActionAllowed, assertTransition } from "../../shared/workflow";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { createTraceId, logPrivateError } from "./errors";
import { requireConfiguredApprovals } from "./collaboration";
import { diagnoseWithAi } from "./diagnosis";
import { runExportPreflight } from "./preflight";
import { acceptedRevisionStatus, canAuthorizeDownload, completedCheckpointUpdate, restoreSnapshotSpec, revisionJobProgress, revisionLengthWithinGuard } from "./policies";
import { CaspaNotFoundError, createNamedVersion, requireOwnedProject, requireOwnedVersion } from "./repository";
import { getActiveStyleGrounding } from "./style";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function runDiagnosis(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "run-diagnosis");
  if (!project.activeVersionId) throw new Error("MANUSCRIPT_REQUIRED");
  const source = await requireOwnedVersion(ownerId, project.activeVersionId);
  const result = await diagnoseWithAi(project, source.content);
  const db = await database();

  return db.transaction(async tx => {
    const snapshotResult = await tx.insert(manuscriptVersions).values({
      projectId,
      name: `Diagnosis snapshot · ${new Date().toLocaleDateString("en-GB")}`,
      trigger: "diagnosis",
      content: source.content,
      wordCount: source.wordCount,
      chapterCount: source.chapterCount,
      sourceVersionId: source.id,
      createdByUserId: ownerId,
    });
    const snapshotId = Number(snapshotResult[0].insertId);
    const diagnosisResult = await tx.insert(diagnoses).values({
      projectId,
      versionId: snapshotId,
      rubricVersion: RUBRIC_VERSION,
      mode: result.mode,
      warningCode: result.warningCode,
      overallSummary: result.payload.overallSummary,
      overallConfidence: result.payload.overallConfidence,
      traceId: result.traceId,
    });
    const diagnosisId = Number(diagnosisResult[0].insertId);
    await tx.insert(diagnosisFindings).values(result.payload.findings.map(finding => ({
      diagnosisId,
      criterion: finding.criterion,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      title: finding.title,
      rationale: finding.rationale,
      suggestedFix: finding.suggestedFix,
      evidenceQuote: finding.evidenceQuote,
      citationLabel: finding.citationLabel,
      citationStart: finding.citationStart ?? null,
      citationEnd: finding.citationEnd ?? null,
      selectedByDefault: finding.selectedByDefault,
    })));
    assertTransition(project.currentState, "diagnosed");
    await tx.update(projects).set({ currentState: "diagnosed", activeVersionId: snapshotId }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
    return { diagnosisId, mode: result.mode, warningCode: result.warningCode, traceId: result.traceId };
  });
}

export async function getLatestDiagnosis(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const rows = await db.select().from(diagnoses).where(eq(diagnoses.projectId, projectId)).orderBy(desc(diagnoses.createdAt)).limit(1);
  const diagnosis = rows[0] ?? null;
  if (!diagnosis) return null;
  const findings = await db.select().from(diagnosisFindings).where(eq(diagnosisFindings.diagnosisId, diagnosis.id)).orderBy(asc(diagnosisFindings.id));
  return { diagnosis, findings };
}

export async function getLatestRevisionPlan(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const rows = await db.select().from(revisionPlans).where(eq(revisionPlans.projectId, projectId)).orderBy(desc(revisionPlans.createdAt)).limit(1);
  const plan = rows[0] ?? null;
  if (!plan) return null;
  const items = await db.select({ item: revisionPlanItems, finding: diagnosisFindings })
    .from(revisionPlanItems)
    .innerJoin(diagnosisFindings, eq(revisionPlanItems.findingId, diagnosisFindings.id))
    .where(eq(revisionPlanItems.planId, plan.id));
  const jobs = await db.select().from(revisionJobs).where(eq(revisionJobs.planId, plan.id)).orderBy(desc(revisionJobs.createdAt)).limit(1);
  return { plan, items, job: jobs[0] ?? null };
}

async function requireOwnedPlan(ownerId: number, planId: number): Promise<RevisionPlan> {
  const db = await database();
  const rows = await db.select({ plan: revisionPlans })
    .from(revisionPlans)
    .innerJoin(projects, eq(revisionPlans.projectId, projects.id))
    .where(and(eq(revisionPlans.id, planId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new CaspaNotFoundError("Revision plan not found");
  return rows[0].plan;
}

async function requireOwnedJob(ownerId: number, jobId: number): Promise<RevisionJob> {
  const db = await database();
  const rows = await db.select({ job: revisionJobs })
    .from(revisionJobs)
    .innerJoin(projects, eq(revisionJobs.projectId, projects.id))
    .where(and(eq(revisionJobs.id, jobId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new CaspaNotFoundError("Revision job not found");
  return rows[0].job;
}

export async function approveRevisionPlan(input: {
  ownerId: number;
  projectId: number;
  diagnosisId: number;
  findingIds: number[];
  scope: RevisionPlan["scope"];
  startChapter?: number | null;
  endChapter?: number | null;
  styleProfileId?: number | null;
}) {
  const project = await requireOwnedProject(input.ownerId, input.projectId);
  assertActionAllowed(project.currentState, "approve-plan");
  const db = await database();
  const diagnosisRows = await db.select().from(diagnoses).where(and(eq(diagnoses.id, input.diagnosisId), eq(diagnoses.projectId, input.projectId))).limit(1);
  const diagnosis = diagnosisRows[0];
  if (!diagnosis) throw new CaspaNotFoundError("Diagnosis not found");
  if (!input.findingIds.length) throw new Error("REVISION_PLAN_EMPTY");
  if (input.styleProfileId) await getActiveStyleGrounding(input.ownerId, input.styleProfileId);
  const findings = await db.select().from(diagnosisFindings).where(and(eq(diagnosisFindings.diagnosisId, diagnosis.id), inArray(diagnosisFindings.id, input.findingIds)));
  if (findings.length !== new Set(input.findingIds).size) throw new Error("REVISION_PLAN_FINDING_MISMATCH");

  return db.transaction(async tx => {
    const result = await tx.insert(revisionPlans).values({
      projectId: input.projectId,
      diagnosisId: input.diagnosisId,
      sourceVersionId: diagnosis.versionId,
      styleProfileId: input.styleProfileId ?? null,
      scope: input.scope,
      startChapter: input.scope === "whole-book" ? null : input.startChapter ?? 1,
      endChapter: input.scope === "single-chapter" ? input.startChapter ?? 1 : input.scope === "whole-book" ? null : input.endChapter ?? input.startChapter ?? 1,
      status: "approved",
    });
    const planId = Number(result[0].insertId);
    await tx.insert(revisionPlanItems).values(input.findingIds.map(findingId => ({ planId, findingId, selected: true })));
    assertTransition(project.currentState, "plan-approved");
    await tx.update(projects).set({ currentState: "plan-approved" }).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, input.ownerId)));
    const rows = await tx.select().from(revisionPlans).where(eq(revisionPlans.id, planId)).limit(1);
    return rows[0];
  });
}

function inScope(index: number, plan: RevisionPlan) {
  const chapterNumber = index + 1;
  if (plan.scope === "whole-book") return true;
  if (plan.scope === "single-chapter") return chapterNumber === (plan.startChapter ?? 1);
  return chapterNumber >= (plan.startChapter ?? 1) && chapterNumber <= (plan.endChapter ?? plan.startChapter ?? 1);
}

export async function startRevision(ownerId: number, planId: number) {
  const plan = await requireOwnedPlan(ownerId, planId);
  if (plan.status !== "approved") throw new Error("REVISION_PLAN_ALREADY_SUBMITTED");
  const project = await requireOwnedProject(ownerId, plan.projectId);
  assertActionAllowed(project.currentState, "start-revision");
  await requireConfiguredApprovals(ownerId, project.id, "revision", "revision-plan", plan.id);
  const source = await requireOwnedVersion(ownerId, plan.sourceVersionId);
  const chapters = splitManuscript(source.content);
  const targeted = chapters.filter(chapter => inScope(chapter.index, plan));
  if (!targeted.length) throw new Error("REVISION_SCOPE_EMPTY");
  const db = await database();
  const traceId = createTraceId();

  return db.transaction(async tx => {
    const result = await tx.insert(revisionJobs).values({
      projectId: project.id,
      planId: plan.id,
      sourceVersionId: source.id,
      status: "queued",
      currentChapter: 0,
      totalChapters: targeted.length,
      progress: 0,
      beforeWordCount: source.wordCount,
      afterWordCount: source.wordCount,
      traceId,
    });
    const jobId = Number(result[0].insertId);
    await tx.insert(chapterCheckpoints).values(targeted.map(chapter => ({
      jobId,
      chapterIndex: chapter.index,
      chapterTitle: chapter.title,
      status: "queued" as const,
      progress: 0,
      beforeText: chapter.content,
      beforeWordCount: chapter.wordCount,
      traceId: createTraceId(),
    })));
    await tx.update(revisionPlans).set({ status: "submitted" }).where(eq(revisionPlans.id, plan.id));
    assertTransition(project.currentState, "revision-running");
    await tx.update(projects).set({ currentState: "revision-running" }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
    const rows = await tx.select().from(revisionJobs).where(eq(revisionJobs.id, jobId)).limit(1);
    return rows[0];
  });
}

async function revisionInstructions(db: Awaited<ReturnType<typeof database>>, planId: number) {
  const rows = await db.select({ finding: diagnosisFindings })
    .from(revisionPlanItems)
    .innerJoin(diagnosisFindings, eq(revisionPlanItems.findingId, diagnosisFindings.id))
    .where(and(eq(revisionPlanItems.planId, planId), eq(revisionPlanItems.selected, true)));
  return rows.map(({ finding }) => `${finding.title}: ${finding.suggestedFix}\nEvidence: “${finding.evidenceQuote}”`).join("\n\n");
}

async function reviseCheckpoint(project: Project, checkpoint: ChapterCheckpoint, instructions: string, styleGuidance: string) {
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      reasoning: { effort: "low" },
      maxTokens: Math.min(9000, Math.max(1600, Math.ceil(checkpoint.beforeWordCount * 1.8))),
      messages: [
        { role: "system", content: `You are CASPA's controlled revision engine. Apply only the author-approved fixes. Preserve the author's voice, facts, names, chronology, and intentional ambiguity. ${styleGuidance} Return the revised chapter text only, with no commentary and no invented citations.` },
        { role: "user", content: `PROJECT: ${project.title}\nFORMAT: ${project.format}\nPREMISE: ${project.premise}\nCHAPTER: ${checkpoint.chapterTitle}\n\nAPPROVED FIXES\n${instructions}\n\nSOURCE CHAPTER\n${checkpoint.beforeText}` },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("Revision model returned empty content");
    const revisedContent = content.trim();
    if (!revisionLengthWithinGuard(checkpoint.beforeWordCount, countWords(revisedContent))) {
      logPrivateError("revision-length-guard", checkpoint.traceId, new Error("Revision output exceeded the permitted word-count delta"), { projectId: project.id, checkpointId: checkpoint.id });
      return { content: checkpoint.beforeText, warning: "REVISION_LENGTH_GUARD" };
    }
    return { content: revisedContent, warning: null as string | null };
  } catch (error) {
    logPrivateError("revision", checkpoint.traceId, error, { projectId: project.id, checkpointId: checkpoint.id });
    return { content: checkpoint.beforeText, warning: "AI_TEMPORARILY_UNAVAILABLE" };
  }
}

async function finalizeRevision(ownerId: number, job: RevisionJob) {
  const db = await database();
  const project = await requireOwnedProject(ownerId, job.projectId);
  const source = await requireOwnedVersion(ownerId, job.sourceVersionId);
  const sourceChapters = splitManuscript(source.content);
  const checkpoints = await db.select().from(chapterCheckpoints).where(eq(chapterCheckpoints.jobId, job.id)).orderBy(asc(chapterCheckpoints.chapterIndex));
  const revisedByIndex = new Map(checkpoints.map(checkpoint => [checkpoint.chapterIndex, checkpoint.afterText || checkpoint.beforeText]));
  const content = sourceChapters.map(chapter => `# ${chapter.title}\n\n${revisedByIndex.get(chapter.index) ?? chapter.content}`.trim()).join("\n\n");
  const metrics = manuscriptMetrics(content);
  const warningCount = checkpoints.filter(checkpoint => checkpoint.status === "warning").length;

  return db.transaction(async tx => {
    const versionResult = await tx.insert(manuscriptVersions).values({
      projectId: project.id,
      name: `Revision result · ${new Date().toLocaleDateString("en-GB")}`,
      trigger: "revision",
      content,
      wordCount: metrics.wordCount,
      chapterCount: metrics.chapterCount,
      sourceVersionId: source.id,
      createdByUserId: ownerId,
    });
    const versionId = Number(versionResult[0].insertId);
    await tx.update(revisionJobs).set({
      status: "awaiting-review",
      resultVersionId: versionId,
      progress: 100,
      currentChapter: job.totalChapters,
      afterWordCount: metrics.wordCount,
      warningCount,
      completedAt: new Date(),
    }).where(eq(revisionJobs.id, job.id));
    await tx.update(projects).set({
      currentState: "review",
      activeVersionId: versionId,
      wordCount: metrics.wordCount,
      chapterCount: metrics.chapterCount,
    }).where(and(eq(projects.id, project.id), eq(projects.ownerId, ownerId)));
    await tx.update(revisionPlans).set({ status: "completed" }).where(eq(revisionPlans.id, job.planId));
    return { jobId: job.id, status: "awaiting-review" as const, resultVersionId: versionId, warningCount };
  });
}

export async function advanceRevision(ownerId: number, jobId: number) {
  const job = await requireOwnedJob(ownerId, jobId);
  if (["awaiting-review", "succeeded", "succeeded-with-warnings", "failed"].includes(job.status)) return getRevisionStatus(ownerId, jobId);
  try {
    const project = await requireOwnedProject(ownerId, job.projectId);
    const db = await database();
    const checkpoints = await db.select().from(chapterCheckpoints).where(eq(chapterCheckpoints.jobId, job.id)).orderBy(asc(chapterCheckpoints.chapterIndex));
    const next = checkpoints.find(checkpoint => checkpoint.status === "queued" || checkpoint.status === "running");
    if (!next) {
      await finalizeRevision(ownerId, job);
      return getRevisionStatus(ownerId, jobId);
    }

    await db.update(revisionJobs).set({ status: "running", startedAt: job.startedAt ?? new Date() }).where(eq(revisionJobs.id, job.id));
    await db.update(chapterCheckpoints).set({ status: "running", progress: 10 }).where(eq(chapterCheckpoints.id, next.id));
    const instructions = await revisionInstructions(db, job.planId);
    const plan = await requireOwnedPlan(ownerId, job.planId);
    const style = plan.styleProfileId ? await getActiveStyleGrounding(ownerId, plan.styleProfileId) : null;
    const styleGuidance = style ? `Use only these private, non-identifying craft dimensions: ${JSON.stringify(style.dimensions)}. ${style.cautions}` : "";
    const revised = await reviseCheckpoint(project, next, instructions, styleGuidance);
    const afterWordCount = countWords(revised.content);
    await db.update(chapterCheckpoints).set({
      ...completedCheckpointUpdate(revised.content, revised.warning),
      afterWordCount,
      completedAt: new Date(),
    }).where(eq(chapterCheckpoints.id, next.id));

    const completed = checkpoints.filter(checkpoint => ["succeeded", "warning"].includes(checkpoint.status)).length + 1;
    const progress = revisionJobProgress(completed, job.totalChapters);
    await db.update(revisionJobs).set({ currentChapter: completed, progress }).where(eq(revisionJobs.id, job.id));
    if (completed >= job.totalChapters) {
      await finalizeRevision(ownerId, await requireOwnedJob(ownerId, jobId));
      return getRevisionStatus(ownerId, jobId);
    }
    return getRevisionStatus(ownerId, jobId);
  } catch (error) {
    const db = await database();
    logPrivateError("revision-job", job.traceId, error, { jobId: job.id, projectId: job.projectId });
    await db.update(revisionJobs).set({ status: "failed", lastErrorCode: "REVISION_JOB_FAILED" }).where(eq(revisionJobs.id, job.id));
    return getRevisionStatus(ownerId, job.id);
  }
}

export async function retryRevision(ownerId: number, jobId: number) {
  const job = await requireOwnedJob(ownerId, jobId);
  if (job.status !== "failed") throw new Error("REVISION_JOB_NOT_FAILED");
  const db = await database();
  await db.update(revisionJobs).set({ status: "queued", lastErrorCode: null }).where(eq(revisionJobs.id, job.id));
  await db.update(chapterCheckpoints).set({ status: "queued", progress: 0 }).where(and(eq(chapterCheckpoints.jobId, job.id), eq(chapterCheckpoints.status, "failed")));
  return getRevisionStatus(ownerId, job.id);
}

export async function getRevisionStatus(ownerId: number, jobId: number) {
  const job = await requireOwnedJob(ownerId, jobId);
  const db = await database();
  const checkpoints = await db.select().from(chapterCheckpoints).where(eq(chapterCheckpoints.jobId, job.id)).orderBy(asc(chapterCheckpoints.chapterIndex));
  return { job, checkpoints: checkpoints.map(({ beforeText, afterText, ...checkpoint }) => checkpoint) };
}

export async function acceptRevision(ownerId: number, jobId: number) {
  const job = await requireOwnedJob(ownerId, jobId);
  if (job.status !== "awaiting-review") throw new Error("REVISION_NOT_AWAITING_REVIEW");
  const db = await database();
  const status = acceptedRevisionStatus(job.warningCount);
  await db.update(revisionJobs).set({ status }).where(eq(revisionJobs.id, job.id));
  return requireOwnedJob(ownerId, job.id);
}

export async function restoreVersion(ownerId: number, projectId: number, versionId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "restore-version");
  const version = await requireOwnedVersion(ownerId, versionId);
  if (version.projectId !== projectId) throw new CaspaNotFoundError("Version does not belong to this project");
  const restored = await createNamedVersion({
    ownerId,
    projectId,
    ...restoreSnapshotSpec(version),
  });
  const db = await database();
  await db.update(projects).set({ currentState: restored.wordCount > 0 ? "review" : "draft" }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  return restored;
}

export async function performPreflight(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "run-preflight");
  if (!project.activeVersionId) throw new Error("EXPORT_PREFLIGHT_REQUIRED");
  const version = await requireOwnedVersion(ownerId, project.activeVersionId);
  const db = await database();
  const latestJobs = await db.select().from(revisionJobs).where(eq(revisionJobs.projectId, projectId)).orderBy(desc(revisionJobs.createdAt)).limit(1);
  if (latestJobs[0]?.status === "awaiting-review" || latestJobs[0]?.status === "queued" || latestJobs[0]?.status === "running") {
    throw new Error("REVISION_REVIEW_REQUIRED");
  }
  const result = runExportPreflight(project, version.content);
  await db.insert(exportPreflights).values({ projectId, versionId: version.id, passed: result.passed, checksJson: JSON.stringify(result.checks) });
  if (result.passed) {
    assertTransition(project.currentState, "export-ready");
    await db.update(projects).set({ currentState: "export-ready" }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  }
  return result;
}

export async function getLatestPreflight(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const rows = await db.select().from(exportPreflights).where(eq(exportPreflights.projectId, projectId)).orderBy(desc(exportPreflights.createdAt)).limit(1);
  const row = rows[0];
  return row ? { ...row, checks: JSON.parse(row.checksJson) } : null;
}

export async function buildAuthorizedExport(ownerId: number, projectId: number, format: "txt" | "md") {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "download-export");
  if (!project.activeVersionId) throw new Error("EXPORT_NOT_READY");
  const version = await requireOwnedVersion(ownerId, project.activeVersionId);
  const db = await database();
  const rows = await db.select().from(exportPreflights).where(and(eq(exportPreflights.projectId, projectId), eq(exportPreflights.versionId, version.id))).orderBy(desc(exportPreflights.createdAt)).limit(1);
  if (!canAuthorizeDownload(project.currentState, project.activeVersionId, rows[0])) throw new Error("EXPORT_NOT_READY");
  const safeTitle = project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "manuscript";
  const content = format === "md" ? `# ${project.title}\n\n**${project.authorName}**\n\n${version.content}` : `${project.title}\n${project.authorName}\n\n${version.content}`;
  return { filename: `${safeTitle}.${format}`, mimeType: format === "md" ? "text/markdown" : "text/plain", content };
}
