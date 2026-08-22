import { describe, expect, it } from "vitest";
import { type DraftPreview } from "../../drizzle/schema";
import { canPerformAction } from "../../shared/workflow";
import { assertDraftPreviewProjectOwnership, canAcceptDraftPreview, cleanDraft, mergePreview, normalizeDraftPayload, parseStructuredJson, sourceContext, validateContinuityReview } from "./drafting";

const preview = {
  id: 1,
  projectId: 1,
  sourceVersionId: 2,
  chapterTitle: "The Lantern Room",
  mode: "append-chapter",
  chapterNumber: null,
  targetWords: 300,
  briefJson: "{}",
  content: "draft ".repeat(250),
  groundingSummary: "Continue after the current final chapter.",
  status: "previewed",
  traceId: "trace-safe",
  createdByUserId: 1,
  acceptedAt: null,
  createdAt: new Date(),
} satisfies DraftPreview;

describe("Draft with CASPA policies", () => {
  it("is available only before diagnosis and keeps later manuscript history from auto-writing", () => {
    expect(canPerformAction("draft", "draft-manuscript")).toBe(true);
    expect(canPerformAction("diagnosed", "draft-manuscript")).toBe(false);
    expect(canPerformAction("production-ready", "draft-manuscript")).toBe(false);
  });

  it("grounds append and replacement drafts in the selected manuscript material", () => {
    const manuscript = "# Arrival\n\nMara enters the archive.\n\n# The Lantern\n\nA light begins to speak.";
    expect(sourceContext(manuscript, "append-chapter").summary).toContain("The Lantern");
    expect(sourceContext(manuscript, "replace-chapter", 1).excerpt).toContain("Mara enters");
    expect(() => sourceContext(manuscript, "replace-chapter", 3)).toThrow("DRAFT_CHAPTER_NOT_FOUND");
  });

  it("enforces a bounded preview length before any author sees an accept control", () => {
    expect(cleanDraft("word ".repeat(250), 300).split(/\s+/).length).toBeGreaterThan(150);
    expect(() => cleanDraft("brief", 300)).toThrow("DRAFT_LENGTH_OUT_OF_RANGE");
  });

  it("rejects and stale previews without changing the active manuscript", () => {
    expect(canAcceptDraftPreview({ projectState: "draft", previewStatus: "previewed", activeVersionId: 2, sourceVersionId: 2 })).toBe(true);
    expect(canAcceptDraftPreview({ projectState: "draft", previewStatus: "rejected", activeVersionId: 2, sourceVersionId: 2 })).toBe(false);
    expect(canAcceptDraftPreview({ projectState: "draft", previewStatus: "previewed", activeVersionId: 3, sourceVersionId: 2 })).toBe(false);
  });

  it("creates a new composed manuscript only when a preview is accepted", () => {
    const source = "# Arrival\n\nMara enters the archive.";
    const composed = mergePreview(source, preview);
    expect(composed).toContain("# Arrival");
    expect(composed).toContain("# The Lantern Room");
    expect(source).toBe("# Arrival\n\nMara enters the archive.");
  });

  it("normalizes supported authoring JSON variants while rejecting unstructured responses", () => {
    const normalized = normalizeDraftPayload(parseStructuredJson("```json\n{\"prose\":\"word ".repeat(1) + "word ".repeat(200) + "\",\"continuity_checklist\":[\"Mara remains in the archive\"]}\n```"));
    expect(normalized.prose.split(/\s+/).length).toBeGreaterThan(100);
    expect(normalized.continuity.checkedFacts[0]).toContain("Mara");
    expect(() => parseStructuredJson("not json")).toThrow("DRAFT_RESPONSE_INVALID");
  });

  it("rejects a failed continuity verdict before a preview can be stored", () => {
    expect(() => validateContinuityReview({ approved: false, violations: [{ type: "exclusion", sourceEvidence: "resolved mystery", explanation: "The draft resolves the mystery." }] })).toThrow("DRAFT_CONTINUITY_REJECTED");
    expect(validateContinuityReview({ approved: true, violations: [] }).approved).toBe(true);
  });

  it("denies cross-project draft-preview access before mutation", () => {
    expect(() => assertDraftPreviewProjectOwnership(11, 12)).toThrow("DRAFT_PREVIEW_ACCESS_DENIED");
    expect(() => assertDraftPreviewProjectOwnership(11, 11)).not.toThrow();
  });
});
