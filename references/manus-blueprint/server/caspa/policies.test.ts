import { describe, expect, it } from "vitest";
import type { ManuscriptVersion } from "../../drizzle/schema";
import { acceptedRevisionStatus, canAuthorizeDownload, completedCheckpointUpdate, failedCheckpointRetryUpdate, isOwnedBy, restoreSnapshotSpec, revisionJobProgress, revisionLengthWithinGuard } from "./policies";

describe("server authorization policies", () => {
  it("requires export-ready state and the latest passing preflight for the active version", () => {
    expect(canAuthorizeDownload("export-ready", 8, { versionId: 8, passed: true })).toBe(true);
    expect(canAuthorizeDownload("review", 8, { versionId: 8, passed: true })).toBe(false);
    expect(canAuthorizeDownload("export-ready", 8, { versionId: 7, passed: true })).toBe(false);
    expect(canAuthorizeDownload("export-ready", 8, { versionId: 8, passed: false })).toBe(false);
    expect(canAuthorizeDownload("export-ready", 8, null)).toBe(false);
  });

  it("maps accepted jobs to the required terminal status model", () => {
    expect(acceptedRevisionStatus(0)).toBe("succeeded");
    expect(acceptedRevisionStatus(2)).toBe("succeeded-with-warnings");
  });

  it("denies records whose persisted owner differs from the requesting user", () => {
    expect(isOwnedBy(4, 4)).toBe(true);
    expect(isOwnedBy(4, 9)).toBe(false);
  });

  it("persists checkpoint completion, warnings, retry state, and bounded job progress", () => {
    expect(completedCheckpointUpdate("Revised chapter", null)).toMatchObject({ status: "succeeded", progress: 100, afterText: "Revised chapter", warningsJson: null });
    expect(completedCheckpointUpdate("Original chapter", "AI_TEMPORARILY_UNAVAILABLE")).toMatchObject({ status: "warning", progress: 100, warningsJson: "[\"AI_TEMPORARILY_UNAVAILABLE\"]" });
    expect(failedCheckpointRetryUpdate("failed")).toEqual({ status: "queued", progress: 0 });
    expect(failedCheckpointRetryUpdate("succeeded")).toBeNull();
    expect(revisionJobProgress(1, 4)).toBe(24);
    expect(revisionJobProgress(4, 4)).toBe(95);
  });

  it("builds a restore snapshot spec that preserves history instead of overwriting the source", () => {
    const source: ManuscriptVersion = {
      id: 18,
      projectId: 3,
      name: "Before diagnosis",
      trigger: "diagnosis",
      content: "# Chapter One\n\nOriginal text.",
      wordCount: 3,
      chapterCount: 1,
      sourceVersionId: 17,
      createdByUserId: 4,
      createdAt: new Date(0),
    };
    expect(restoreSnapshotSpec(source)).toEqual({
      name: "Restored from “Before diagnosis”",
      trigger: "restore",
      content: source.content,
      sourceVersionId: source.id,
    });
  });

  it("rejects destructive chapter rewrites with implausible word-count deltas", () => {
    expect(revisionLengthWithinGuard(500, 450)).toBe(true);
    expect(revisionLengthWithinGuard(500, 675)).toBe(true);
    expect(revisionLengthWithinGuard(500, 374)).toBe(false);
    expect(revisionLengthWithinGuard(500, 676)).toBe(false);
    expect(revisionLengthWithinGuard(536, 45)).toBe(false);
  });
});
