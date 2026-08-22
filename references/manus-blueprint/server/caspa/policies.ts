import type { ProjectState } from "../../shared/workflow";
import type { ManuscriptVersion } from "../../drizzle/schema";

export type LatestPreflightLike = {
  versionId: number;
  passed: boolean;
} | null | undefined;

export function canAuthorizeDownload(state: ProjectState, activeVersionId: number | null, latestPreflight: LatestPreflightLike) {
  return state === "export-ready"
    && activeVersionId !== null
    && Boolean(latestPreflight?.passed)
    && latestPreflight?.versionId === activeVersionId;
}

export function acceptedRevisionStatus(warningCount: number): "succeeded" | "succeeded-with-warnings" {
  return warningCount > 0 ? "succeeded-with-warnings" : "succeeded";
}

export function isOwnedBy(requestingUserId: number, recordOwnerId: number) {
  return requestingUserId === recordOwnerId;
}

export function completedCheckpointUpdate(content: string, warning: string | null) {
  return {
    status: warning ? "warning" as const : "succeeded" as const,
    progress: 100,
    afterText: content,
    warningsJson: warning ? JSON.stringify([warning]) : null,
  };
}

export function failedCheckpointRetryUpdate(status: "queued" | "running" | "succeeded" | "warning" | "failed") {
  return status === "failed" ? { status: "queued" as const, progress: 0 } : null;
}

export function revisionJobProgress(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(95, Math.max(5, Math.round((completed / total) * 95)));
}

export function revisionLengthWithinGuard(beforeWordCount: number, afterWordCount: number) {
  if (beforeWordCount <= 0) return afterWordCount >= 0;
  const ratio = afterWordCount / beforeWordCount;
  return ratio >= 0.75 && ratio <= 1.35;
}

export function restoreSnapshotSpec(version: ManuscriptVersion) {
  return {
    name: `Restored from “${version.name}”`,
    trigger: "restore" as const,
    content: version.content,
    sourceVersionId: version.id,
  };
}
