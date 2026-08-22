import { describe, expect, it } from "vitest";
import { countWords, manuscriptMetrics, splitManuscript } from "../../shared/manuscript";

describe("manuscript metrics", () => {
  it("counts words without treating blank text as content", () => {
    expect(countWords("  one   two\nthree ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("creates deterministic chapter checkpoints from headings", () => {
    const chapters = splitManuscript("# Chapter One\n\nOpening text.\n\n# Chapter Two\n\nClosing text here.");
    expect(chapters).toHaveLength(2);
    expect(chapters.map(chapter => chapter.title)).toEqual(["Chapter One", "Chapter Two"]);
    expect(chapters.map(chapter => chapter.wordCount)).toEqual([2, 3]);
  });

  it("treats an unstructured short work as one checkpoint", () => {
    expect(manuscriptMetrics("A short lyric essay.").chapterCount).toBe(1);
  });
});
