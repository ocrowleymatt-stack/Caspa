import type { Project } from "../drizzle/schema";
import { splitManuscript } from "./manuscript";

export type IllustrationMode = "none" | "cover-only" | "limited" | "fully-illustrated";
export type Suitability = "required" | "recommended" | "optional" | "not-recommended";

const defaults = {
  fiction: { suitability: "optional", illustrationMode: "limited", trimSize: "6 × 9 in", medium: "Painterly editorial realism", audience: "Adult and crossover fiction readers" },
  "non-fiction": { suitability: "recommended", illustrationMode: "limited", trimSize: "7 × 10 in", medium: "Clear editorial illustration with documentary restraint", audience: "Readers seeking explanation, evidence, and practical clarity" },
  "picture-book": { suitability: "required", illustrationMode: "fully-illustrated", trimSize: "10 × 8 in", medium: "Expressive hand-painted storybook illustration", audience: "Children and shared read-aloud audiences" },
  script: { suitability: "not-recommended", illustrationMode: "cover-only", trimSize: "8.5 × 11 in", medium: "Cinematic key art", audience: "Professional readers, performers, and production teams" },
  essay: { suitability: "not-recommended", illustrationMode: "cover-only", trimSize: "6 × 9 in", medium: "Conceptual editorial collage", audience: "General literary and ideas readers" },
  poetry: { suitability: "optional", illustrationMode: "limited", trimSize: "6 × 9 in", medium: "Restrained lyrical mixed media", audience: "Poetry and literary-art readers" },
  polish: { suitability: "optional", illustrationMode: "cover-only", trimSize: "6 × 9 in", medium: "Elegant editorial image-making", audience: "Readers of the existing work" },
} as const;

export function productionDefaults(project: Project) {
  const preset = defaults[project.format];
  const rationale = project.format === "picture-book"
    ? "Illustration is part of the narrative grammar, pacing, and page-turn experience."
    : project.format === "non-fiction"
      ? "Images are recommended only where they explain structure, evidence, process, or place more clearly than prose."
      : project.format === "fiction" || project.format === "poetry"
        ? "A restrained image program can deepen atmosphere without competing with the reader’s imagination."
        : "The edition should remain primarily typographic unless the author deliberately chooses a visual program.";
  return {
    ...preset,
    rationale,
    genreSignals: project.format.replace("-", " "),
    tone: "Authoritative, specific, emotionally truthful, and free of generic AI imagery",
    motifs: project.premise.slice(0, 500),
    exclusions: "No stock-photo clichés, no illegible generated text, no style drift, no unapproved character redesign",
    palette: "Obsidian, warm ivory, antique brass, and one manuscript-specific accent family",
    typographyDirection: "High-contrast literary serif display with a quiet, highly readable text face",
    distribution: "both" as const,
  };
}

export function illustrationPlanFromManuscript(project: Project, content: string, mode: IllustrationMode) {
  const chapters = splitManuscript(content);
  if (mode === "none" || mode === "cover-only") return [];
  const maxSlots = mode === "fully-illustrated" ? Math.max(1, Math.min(24, chapters.length || 1)) : Math.min(project.format === "non-fiction" ? 6 : 4, Math.max(1, chapters.length));
  const chosen = chapters.length <= maxSlots
    ? chapters
    : Array.from({ length: maxSlots }, (_, index) => chapters[Math.min(chapters.length - 1, Math.round(index * (chapters.length - 1) / Math.max(1, maxSlots - 1)))]);
  return chosen.map((chapter, index) => ({
    sequence: index + 1,
    chapterIndex: chapter.index,
    placement: project.format === "picture-book" ? `Spread ${index + 1}` : `After ${chapter.title}`,
    purpose: project.format === "non-fiction" ? "Clarify a concept or place with visual evidence" : "Create a deliberate visual pause at a structural turn",
    sceneBrief: chapter.content.slice(0, 900) || project.premise,
    aspectRatio: project.format === "picture-book" ? "5:4" : "3:2",
    bleed: project.format === "picture-book",
    caption: project.format === "non-fiction" ? chapter.title : null,
    altText: `Illustration supporting ${chapter.title}`,
    continuityNotes: `Maintain the approved palette, medium, character identity, period detail, and environmental logic across slot ${index + 1}.`,
  }));
}

export function safeAssetMime(mimeType: string) {
  return ["image/png", "image/jpeg", "image/webp"].includes(mimeType);
}

export function continuityProfileComplete(profile: Record<string, unknown>) {
  return ["characterIdentity", "locations", "palette", "medium", "periodDetails", "worldRules"].every(key => typeof profile[key] === "string" && String(profile[key]).trim().length >= 2);
}

export function artProgramIssues(input: {
  briefStatus: string | null;
  illustrationMode: IllustrationMode | null;
  approvedCoverCount: number;
  unresolvedSlotCount: number;
  approvedSlotIds: number[];
  approvedAssetSlotIds: number[];
}) {
  const issues: string[] = [];
  if (input.briefStatus !== "approved") issues.push("ART_BRIEF_APPROVAL_REQUIRED");
  if (input.approvedCoverCount < 1) issues.push("COVER_APPROVAL_REQUIRED");
  if (input.illustrationMode && !["none", "cover-only"].includes(input.illustrationMode)) {
    if (input.unresolvedSlotCount > 0) issues.push("ILLUSTRATION_PLAN_APPROVAL_REQUIRED");
    if (input.approvedSlotIds.some(slotId => !input.approvedAssetSlotIds.includes(slotId))) issues.push("ILLUSTRATION_ASSET_APPROVAL_REQUIRED");
  }
  return issues;
}
