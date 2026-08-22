import type { Project } from "../../drizzle/schema";
import { manuscriptMetrics } from "../../shared/manuscript";

export type PreflightCheck = {
  id: "manuscript-complete" | "chapter-structure" | "metadata" | "word-count";
  label: string;
  passed: boolean;
  detail: string;
};

function requiredSections(project: Project) {
  if (project.format === "essay" || project.format === "poetry" || project.format === "polish" || project.format === "picture-book") return 1;
  if (project.targetWordCount < 5000) return 1;
  return project.format === "script" ? 3 : 2;
}

function targetTolerance(project: Project) {
  if (project.format === "picture-book" || project.format === "poetry") return 0.3;
  if (project.format === "essay") return 0.2;
  return 0.15;
}

export function runExportPreflight(project: Project, content: string) {
  const metrics = manuscriptMetrics(content);
  const minSections = requiredSections(project);
  const tolerance = targetTolerance(project);
  const minWords = Math.max(1, Math.round(project.targetWordCount * (1 - tolerance)));
  const maxWords = Math.round(project.targetWordCount * (1 + tolerance));
  const emptySections = metrics.chapters.filter(chapter => chapter.wordCount < 10).length;

  const checks: PreflightCheck[] = [
    {
      id: "manuscript-complete",
      label: "Manuscript completeness",
      passed: metrics.wordCount > 0 && emptySections === 0,
      detail: metrics.wordCount === 0 ? "No manuscript text is present." : emptySections ? `${emptySections} detected section${emptySections === 1 ? " is" : "s are"} effectively empty.` : `${metrics.wordCount.toLocaleString()} words are present with no empty detected sections.`,
    },
    {
      id: "chapter-structure",
      label: "Chapter or section structure",
      passed: metrics.chapterCount >= minSections,
      detail: `${metrics.chapterCount} section${metrics.chapterCount === 1 ? "" : "s"} detected; this ${project.format} project requires at least ${minSections}.`,
    },
    {
      id: "metadata",
      label: "Title and author metadata",
      passed: Boolean(project.title.trim() && project.authorName.trim()),
      detail: project.title.trim() && project.authorName.trim() ? `“${project.title}” by ${project.authorName}` : "A title and author name are both required.",
    },
    {
      id: "word-count",
      label: "Target word-count range",
      passed: metrics.wordCount >= minWords && metrics.wordCount <= maxWords,
      detail: `${metrics.wordCount.toLocaleString()} words; accepted range is ${minWords.toLocaleString()}–${maxWords.toLocaleString()} for the ${project.targetWordCount.toLocaleString()}-word target.`,
    },
  ];

  return { passed: checks.every(check => check.passed), checks, metrics, minWords, maxWords };
}
