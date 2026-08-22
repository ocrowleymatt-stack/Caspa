import { describe, expect, it } from "vitest";
import type { Project } from "../../drizzle/schema";
import { deterministicDiagnosis, validateDiagnosisPayload } from "./diagnosis";

const project = {
  id: 1,
  ownerId: 2,
  title: "Archive City",
  authorName: "A. Writer",
  format: "fiction",
  premise: "An archivist discovers the city rewrites its past.",
  targetWordCount: 80000,
  currentState: "draft",
  activeVersionId: 1,
  wordCount: 0,
  chapterCount: 0,
  archivedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies Project;

describe("diagnosis contract", () => {
  it("always returns evidence, confidence, rationale, criterion, and a reversible fix", () => {
    const payload = deterministicDiagnosis(project, "# Chapter One\n\nMara opened the archive door.");
    expect(payload.findings.length).toBeGreaterThan(0);
    for (const finding of payload.findings) {
      expect(finding.evidenceQuote.length).toBeGreaterThan(0);
      expect(finding.citationLabel.length).toBeGreaterThan(0);
      expect(finding.confidence).toBeGreaterThanOrEqual(0);
      expect(finding.rationale.length).toBeGreaterThan(0);
      expect(finding.suggestedFix.length).toBeGreaterThan(0);
      expect(finding.criterion.length).toBeGreaterThan(0);
    }
    expect(() => validateDiagnosisPayload(payload)).not.toThrow();
  });

  it("rejects provider-shaped output that omits manuscript evidence", () => {
    expect(() => validateDiagnosisPayload({ overallSummary: "A sufficiently long but unsupported summary.", overallConfidence: 90, findings: [{ title: "Unsupported" }] })).toThrow();
  });
});
