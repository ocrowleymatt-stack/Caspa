import { describe, expect, it } from "vitest";
import type { LayoutSpec, Project } from "../../drizzle/schema";
import { composeBookPages, latestProofCanBeApproved, productionChecks, proofResolutionValues, restoredLayoutValues } from "../../shared/layout";
import { artProgramIssues, continuityProfileComplete, illustrationPlanFromManuscript, productionDefaults } from "../../shared/production";
import { canPerformAction, canTransition, nextGuidedAction } from "../../shared/workflow";
import { assertProductionOwnership } from "./productionRepository";

const project: Project = {
  id: 1,
  ownerId: 7,
  title: "The Lantern Index",
  authorName: "A. Writer",
  format: "fiction",
  premise: "An archivist discovers a forbidden civic record.",
  targetWordCount: 70_000,
  currentState: "export-ready",
  activeVersionId: 2,
  wordCount: 1200,
  chapterCount: 2,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const spec: LayoutSpec = {
  id: 1,
  projectId: 1,
  version: 1,
  trimSize: "6 × 9 in",
  orientation: "portrait",
  pageWidthPt: 432,
  pageHeightPt: 648,
  marginsJson: JSON.stringify({ top: 54, right: 48, bottom: 54, left: 54 }),
  bleedPt: 9,
  bodyFont: "Times",
  displayFont: "Baskerville",
  bodySizePt: 11,
  lineHeightPct: 145,
  paragraphStyle: "indent",
  runningHeads: true,
  folios: true,
  chapterOpening: "right-hand",
  imagePlacement: "inline",
  editionMode: "both",
  language: "en",
  digitalNavigation: true,
  imageAltPolicy: "required",
  printProfile: "standard-color",
  status: "approved",
  approvedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("book production policies", () => {
  it("extends the canonical workflow through art, layout, proof, and production", () => {
    expect(canTransition("export-ready", "art-direction")).toBe(true);
    expect(canTransition("art-direction", "art-approved")).toBe(true);
    expect(canTransition("art-approved", "layout")).toBe(true);
    expect(canTransition("layout", "proof-review")).toBe(true);
    expect(canTransition("proof-review", "production-ready")).toBe(true);
    expect(canPerformAction("production-ready", "download-production")).toBe(true);
    expect(nextGuidedAction("export-ready")).toBe("start-art-direction");
  });

  it("recommends illustration programs by manuscript format", () => {
    expect(productionDefaults({ ...project, format: "picture-book" }).suitability).toBe("required");
    expect(productionDefaults({ ...project, format: "script" }).illustrationMode).toBe("cover-only");
    expect(illustrationPlanFromManuscript({ ...project, format: "picture-book" }, "# Scene One\nA red kite rises.\n# Scene Two\nThe child follows.", "fully-illustrated")).toHaveLength(2);
    expect(illustrationPlanFromManuscript(project, "# Chapter One\nText", "cover-only")).toEqual([]);
  });

  it("blocks visual-program approval until cover, slots, and assets are approved", () => {
    expect(artProgramIssues({ briefStatus: "draft", illustrationMode: "limited", approvedCoverCount: 0, unresolvedSlotCount: 1, approvedSlotIds: [1], approvedAssetSlotIds: [] })).toEqual(["ART_BRIEF_APPROVAL_REQUIRED", "COVER_APPROVAL_REQUIRED", "ILLUSTRATION_PLAN_APPROVAL_REQUIRED", "ILLUSTRATION_ASSET_APPROVAL_REQUIRED"]);
    expect(artProgramIssues({ briefStatus: "approved", illustrationMode: "limited", approvedCoverCount: 1, unresolvedSlotCount: 0, approvedSlotIds: [1], approvedAssetSlotIds: [1] })).toEqual([]);
  });

  it("requires a complete editable continuity profile", () => {
    expect(continuityProfileComplete({ characterIdentity: "Mara, 42, silver braid", locations: "Coastal archive", palette: "Ink and rust", medium: "Gouache", periodDetails: "Near future civic technology", worldRules: "Winter light, analogue records" })).toBe(true);
    expect(continuityProfileComplete({ characterIdentity: "", locations: "Archive" })).toBe(false);
  });

  it("composes deterministic pages with intentional right-hand chapter openings", () => {
    const pages = composeBookPages(project, "# Chapter One\n" + "word ".repeat(520) + "\n# Chapter Two\n" + "text ".repeat(300), spec, []);
    expect(pages[0].kind).toBe("title");
    expect(pages[1].kind).toBe("copyright");
    expect(pages.some(page => page.kind === "chapter-opening")).toBe(true);
    expect(pages.every((page, index) => page.number === index + 1)).toBe(true);
  });

  it("checks cover, bleed, safe areas, fonts, metadata, pagination, accessibility, comments, and proof state", () => {
    const pages = composeBookPages(project, "# Chapter One\n" + "word ".repeat(400), spec, []);
    const checks = productionChecks({ project, spec, pages, coverApproved: true, coverWidth: 1536, coverHeight: 2304, requiredAssetCount: 0, approvedAssetCount: 0, allAltText: true, openAnnotationCount: 0, layoutStatus: "proof", bleedAssetCount: 0 });
    expect(checks.every(check => check.passed)).toBe(true);
    const failed = productionChecks({ project, spec: { ...spec, bleedPt: 0, marginsJson: JSON.stringify({ top: 20, right: 20, bottom: 20, left: 20 }), bodyFont: "Unknown", displayFont: "Unknown" }, pages, coverApproved: true, coverWidth: 800, coverHeight: 1200, requiredAssetCount: 1, approvedAssetCount: 0, allAltText: false, openAnnotationCount: 1, layoutStatus: "draft", bleedAssetCount: 1 });
    expect(failed.filter(check => !check.passed).map(check => check.id)).toEqual(expect.arrayContaining(["cover-resolution", "asset-availability", "accessibility", "bleed", "safe-areas", "font-policy", "proof-comments", "proof-version"]));
  });

  it("approves only the latest passing preflight for the latest layout", () => {
    expect(latestProofCanBeApproved({ preflightPassed: true, preflightLayoutId: 9, latestLayoutId: 9, preflightId: 4, latestPreflightId: 4 })).toBe(true);
    expect(latestProofCanBeApproved({ preflightPassed: true, preflightLayoutId: 8, latestLayoutId: 9, preflightId: 4, latestPreflightId: 4 })).toBe(false);
    expect(latestProofCanBeApproved({ preflightPassed: false, preflightLayoutId: 9, latestLayoutId: 9, preflightId: 4, latestPreflightId: 4 })).toBe(false);
  });

  it("conceals production assets from users who do not own the project", () => {
    expect(() => assertProductionOwnership(7, 7)).not.toThrow();
    expect(() => assertProductionOwnership(8, 7)).toThrow("Production asset not found");
  });

  it("restores a prior layout as a new immutable draft version", () => {
    const source = { projectId: 1, manuscriptVersionId: 2, artBriefId: 3, coverConceptId: 4, illustrationPlanId: 5, layoutSpecId: 6, name: "Proof v2", pageCount: 12, pagesJson: "[]" };
    expect(restoredLayoutValues(source, 3)).toEqual({ ...source, version: 3, name: "Restored from Proof v2", status: "draft" });
    expect(() => restoredLayoutValues(source, 0)).toThrow("LAYOUT_VERSION_INVALID");
  });

  it("records proof resolution history and prevents closed comments from changing twice", () => {
    const when = new Date("2026-08-22T00:00:00.000Z");
    expect(proofResolutionValues("open", "resolved", "Corrected in layout", when)).toEqual({ status: "resolved", resolutionNote: "Corrected in layout", resolvedAt: when });
    expect(proofResolutionValues("deferred", "accepted-as-is", "Author accepted the composition", when).status).toBe("accepted-as-is");
    expect(() => proofResolutionValues("resolved", "deferred", "Reopen")).toThrow("PROOF_ANNOTATION_ALREADY_CLOSED");
  });
});
