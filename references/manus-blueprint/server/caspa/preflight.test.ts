import { describe, expect, it } from "vitest";
import type { Project } from "../../drizzle/schema";
import { runExportPreflight } from "./preflight";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    ownerId: 7,
    title: "The Lantern Index",
    authorName: "A. Writer",
    format: "essay",
    premise: "A study of memory and civic archives.",
    targetWordCount: 100,
    currentState: "review",
    activeVersionId: 2,
    wordCount: 0,
    chapterCount: 0,
    archivedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe("server export preflight", () => {
  it("passes only when completeness, structure, metadata, and word range all pass", () => {
    const content = `# Essay\n\n${Array.from({ length: 100 }, (_, index) => `word${index}`).join(" ")}`;
    const result = runExportPreflight(project(), content);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.every(check => check.passed)).toBe(true);
  });

  it("fails missing metadata and out-of-range length independently", () => {
    const result = runExportPreflight(project({ authorName: "" }), "# Essay\n\nFar too short.");
    expect(result.passed).toBe(false);
    expect(result.checks.find(check => check.id === "metadata")?.passed).toBe(false);
    expect(result.checks.find(check => check.id === "word-count")?.passed).toBe(false);
  });
});
