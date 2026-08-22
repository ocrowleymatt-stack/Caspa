import type { LayoutSpec, LayoutVersion, Project } from "../drizzle/schema";
import { splitManuscript } from "./manuscript";

export type LayoutPage = {
  number: number;
  kind: "title" | "copyright" | "blank" | "chapter-opening" | "text" | "illustration";
  chapterIndex?: number;
  chapterTitle?: string;
  text?: string;
  imageUrl?: string;
  imageAlt?: string;
  caption?: string | null;
  warnings: string[];
};

export const trimPresets = {
  "5 × 8 in": { width: 360, height: 576, orientation: "portrait" as const },
  "5.5 × 8.5 in": { width: 396, height: 612, orientation: "portrait" as const },
  "6 × 9 in": { width: 432, height: 648, orientation: "portrait" as const },
  "7 × 10 in": { width: 504, height: 720, orientation: "portrait" as const },
  "8.5 × 11 in": { width: 612, height: 792, orientation: "portrait" as const },
  "10 × 8 in": { width: 720, height: 576, orientation: "landscape" as const },
} as const;

export type IllustrationPlacement = {
  chapterIndex: number | null;
  imageUrl: string;
  altText: string;
  caption: string | null;
  bleed: boolean;
};

export function wordsPerPage(spec: Pick<LayoutSpec, "pageWidthPt" | "pageHeightPt" | "marginsJson" | "bodySizePt" | "lineHeightPct">, format: Project["format"]) {
  if (format === "picture-book") return 55;
  if (format === "script") return 260;
  const margins = JSON.parse(spec.marginsJson) as { top: number; right: number; bottom: number; left: number };
  const usableWidth = Math.max(180, spec.pageWidthPt - margins.left - margins.right);
  const usableHeight = Math.max(240, spec.pageHeightPt - margins.top - margins.bottom);
  const lineHeight = spec.bodySizePt * (spec.lineHeightPct / 100);
  const lines = Math.max(10, Math.floor(usableHeight / lineHeight));
  const wordsPerLine = Math.max(5, Math.floor(usableWidth / (spec.bodySizePt * 2.7)));
  return Math.max(120, Math.min(520, lines * wordsPerLine));
}

function chunks(text: string, size: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Array.from({ length: Math.ceil(words.length / size) }, (_, index) => words.slice(index * size, (index + 1) * size).join(" "));
}

export function composeBookPages(project: Project, content: string, spec: LayoutSpec, illustrations: IllustrationPlacement[]) {
  const pages: LayoutPage[] = [
    { number: 1, kind: "title", text: `${project.title}\n${project.authorName}`, warnings: [] },
    { number: 2, kind: "copyright", text: `Copyright © ${new Date().getUTCFullYear()} ${project.authorName}\nAll rights reserved.`, warnings: [] },
  ];
  const capacity = wordsPerPage(spec, project.format);
  const chapters = splitManuscript(content);
  for (const chapter of chapters) {
    if (spec.chapterOpening === "right-hand" && pages.length % 2 === 0) pages.push({ number: pages.length + 1, kind: "blank", warnings: [] });
    pages.push({ number: pages.length + 1, kind: "chapter-opening", chapterIndex: chapter.index, chapterTitle: chapter.title, warnings: [] });
    for (const image of illustrations.filter(item => item.chapterIndex === chapter.index)) {
      pages.push({ number: pages.length + 1, kind: "illustration", chapterIndex: chapter.index, chapterTitle: chapter.title, imageUrl: image.imageUrl, imageAlt: image.altText, caption: image.caption, warnings: image.altText.trim() ? [] : ["ILLUSTRATION_ALT_TEXT_MISSING"] });
    }
    for (const text of chunks(chapter.content, capacity)) {
      pages.push({ number: pages.length + 1, kind: "text", chapterIndex: chapter.index, chapterTitle: chapter.title, text, warnings: text.split(/\s+/).length > capacity ? ["TEXT_OVERFLOW"] : [] });
    }
  }
  return pages.map((page, index) => ({ ...page, number: index + 1 }));
}

export function productionChecks(input: { project: Project; spec: Pick<LayoutSpec, "bleedPt" | "marginsJson" | "bodyFont" | "displayFont">; pages: LayoutPage[]; coverApproved: boolean; coverWidth: number; coverHeight: number; requiredAssetCount: number; approvedAssetCount: number; allAltText: boolean; openAnnotationCount: number; layoutStatus: string; bleedAssetCount: number }) {
  const { project, pages } = input;
  const margins = JSON.parse(input.spec.marginsJson) as { top: number; right: number; bottom: number; left: number };
  const fontAllowlist = ["times", "georgia", "garamond", "baskerville", "helvetica", "courier"];
  const fontPolicyPassed = [input.spec.bodyFont, input.spec.displayFont].every(font => fontAllowlist.some(allowed => font.toLowerCase().includes(allowed)));
  const blankPages = pages.filter(page => page.kind === "blank");
  const blankPagePolicyPassed = blankPages.every(page => pages[page.number]?.kind === "chapter-opening");
  return [
    { id: "cover-approved", label: "Approved cover", passed: input.coverApproved, detail: input.coverApproved ? "An approved cover concept is attached." : "Approve one cover concept." },
    { id: "cover-resolution", label: "Cover resolution", passed: input.coverWidth >= 1200 && input.coverHeight >= 1800, detail: `${input.coverWidth || 0} × ${input.coverHeight || 0} px; minimum 1200 × 1800 px.` },
    { id: "asset-availability", label: "Approved illustration assets", passed: input.approvedAssetCount === input.requiredAssetCount, detail: `${input.approvedAssetCount} of ${input.requiredAssetCount} required assets are approved.` },
    { id: "accessibility", label: "Illustration alt text", passed: input.allAltText, detail: input.allAltText ? "Every included illustration has alt text." : "Add alt text to every included illustration." },
    { id: "bleed", label: "Bleed policy", passed: input.bleedAssetCount === 0 || input.spec.bleedPt >= 9, detail: input.bleedAssetCount === 0 ? "No full-bleed assets are included." : `${input.spec.bleedPt} pt bleed for ${input.bleedAssetCount} full-bleed assets; minimum 9 pt.` },
    { id: "safe-areas", label: "Text safe areas", passed: Math.min(margins.top, margins.right, margins.bottom, margins.left) >= 36, detail: `Smallest text margin is ${Math.min(margins.top, margins.right, margins.bottom, margins.left)} pt; minimum 36 pt.` },
    { id: "font-policy", label: "Embeddable font policy", passed: fontPolicyPassed, detail: fontPolicyPassed ? `${input.spec.bodyFont} and ${input.spec.displayFont} are in the approved production family set.` : "Choose Times, Georgia, Garamond, Baskerville, Helvetica, or Courier families." },
    { id: "metadata", label: "Title and author metadata", passed: Boolean(project.title.trim() && project.authorName.trim()), detail: `“${project.title}” by ${project.authorName}` },
    { id: "pagination", label: "Pagination and overflow", passed: pages.length >= 3 && pages.every(page => page.warnings.length === 0), detail: `${pages.length} pages; ${pages.reduce((sum, page) => sum + page.warnings.length, 0)} layout warnings.` },
    { id: "blank-pages", label: "Intentional blank pages", passed: blankPagePolicyPassed, detail: blankPagePolicyPassed ? `${blankPages.length} intentional chapter-opening blanks.` : "A blank page appears outside the configured chapter-opening policy." },
    { id: "proof-comments", label: "Proof comments resolved", passed: input.openAnnotationCount === 0, detail: input.openAnnotationCount ? `${input.openAnnotationCount} comments remain open or deferred.` : "All proof comments are resolved or accepted as-is." },
    { id: "proof-version", label: "Proof version submitted", passed: input.layoutStatus === "proof", detail: input.layoutStatus === "proof" ? "The latest layout is the submitted proof." : "Submit the latest layout for proof review." },
  ];
}

export function latestProofCanBeApproved(input: { preflightPassed: boolean; preflightLayoutId: number; latestLayoutId: number | null; preflightId: number; latestPreflightId: number | null }) {
  return input.preflightPassed && input.preflightLayoutId === input.latestLayoutId && input.preflightId === input.latestPreflightId;
}

export function restoredLayoutValues(source: Pick<LayoutVersion, "projectId" | "manuscriptVersionId" | "artBriefId" | "coverConceptId" | "illustrationPlanId" | "layoutSpecId" | "name" | "pageCount" | "pagesJson">, version: number) {
  if (version < 1) throw new Error("LAYOUT_VERSION_INVALID");
  return { projectId: source.projectId, manuscriptVersionId: source.manuscriptVersionId, artBriefId: source.artBriefId, coverConceptId: source.coverConceptId, illustrationPlanId: source.illustrationPlanId, layoutSpecId: source.layoutSpecId, version, name: `Restored from ${source.name}`, pageCount: source.pageCount, pagesJson: source.pagesJson, status: "draft" as const };
}

export function proofResolutionValues(currentStatus: "open" | "resolved" | "accepted-as-is" | "deferred", nextStatus: "resolved" | "accepted-as-is" | "deferred", resolutionNote: string, resolvedAt = new Date()) {
  if (!["open", "deferred"].includes(currentStatus)) throw new Error("PROOF_ANNOTATION_ALREADY_CLOSED");
  const note = resolutionNote.trim();
  if (note.length < 2) throw new Error("PROOF_RESOLUTION_NOTE_REQUIRED");
  return { status: nextStatus, resolutionNote: note, resolvedAt };
}
