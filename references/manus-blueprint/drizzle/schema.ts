import {
  boolean,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { projectStates } from "../shared/workflow";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projectFormats = [
  "fiction",
  "non-fiction",
  "picture-book",
  "script",
  "essay",
  "poetry",
  "polish",
] as const;

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    authorName: varchar("authorName", { length: 180 }).notNull(),
    format: mysqlEnum("format", projectFormats).notNull(),
    premise: text("premise").notNull(),
    targetWordCount: int("targetWordCount").notNull(),
    currentState: mysqlEnum("currentState", projectStates).default("draft").notNull(),
    activeVersionId: int("activeVersionId"),
    wordCount: int("wordCount").default(0).notNull(),
    chapterCount: int("chapterCount").default(0).notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("projects_owner_state_idx").on(table.ownerId, table.currentState),
    index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt),
  ],
);

export const manuscriptVersions = mysqlTable(
  "manuscriptVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    trigger: mysqlEnum("trigger", ["project-created", "manual-save", "upload", "auto-draft", "diagnosis", "revision", "restore"]).notNull(),
    content: longtext("content").notNull(),
    wordCount: int("wordCount").default(0).notNull(),
    chapterCount: int("chapterCount").default(0).notNull(),
    sourceVersionId: int("sourceVersionId"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("versions_project_created_idx").on(table.projectId, table.createdAt)],
);

export const draftPreviews = mysqlTable(
  "draftPreviews",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sourceVersionId: int("sourceVersionId").references(() => manuscriptVersions.id, { onDelete: "set null" }),
    chapterTitle: varchar("chapterTitle", { length: 240 }).notNull(),
    mode: mysqlEnum("mode", ["opening", "append-chapter", "replace-chapter"]).notNull(),
    chapterNumber: int("chapterNumber"),
    targetWords: int("targetWords").notNull(),
    briefJson: longtext("briefJson").notNull(),
    content: longtext("content").notNull(),
    groundingSummary: text("groundingSummary").notNull(),
    status: mysqlEnum("status", ["previewed", "accepted", "rejected"]).default("previewed").notNull(),
    traceId: varchar("traceId", { length: 64 }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("draft_previews_project_created_idx").on(table.projectId, table.createdAt), index("draft_previews_project_status_idx").on(table.projectId, table.status)],
);

export type DraftPreview = typeof draftPreviews.$inferSelect;

export const manuscriptUploads = mysqlTable(
  "manuscriptUploads",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: int("versionId").references(() => manuscriptVersions.id, { onDelete: "set null" }),
    originalName: varchar("originalName", { length: 320 }).notNull(),
    mimeType: varchar("mimeType", { length: 160 }).notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 900 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("uploads_project_idx").on(table.projectId)],
);

export const diagnoses = mysqlTable(
  "diagnoses",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: int("versionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    rubricVersion: varchar("rubricVersion", { length: 40 }).notNull(),
    mode: mysqlEnum("mode", ["ai", "deterministic-fallback"]).default("ai").notNull(),
    warningCode: varchar("warningCode", { length: 80 }),
    overallSummary: text("overallSummary").notNull(),
    overallConfidence: int("overallConfidence").notNull(),
    traceId: varchar("traceId", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("diagnoses_project_created_idx").on(table.projectId, table.createdAt)],
);

export const diagnosisFindings = mysqlTable(
  "diagnosisFindings",
  {
    id: int("id").autoincrement().primaryKey(),
    diagnosisId: int("diagnosisId").notNull().references(() => diagnoses.id, { onDelete: "cascade" }),
    criterion: varchar("criterion", { length: 120 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    severity: mysqlEnum("severity", ["critical", "major", "moderate", "minor"]).notNull(),
    confidence: int("confidence").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    rationale: text("rationale").notNull(),
    suggestedFix: text("suggestedFix").notNull(),
    evidenceQuote: text("evidenceQuote").notNull(),
    citationLabel: varchar("citationLabel", { length: 180 }).notNull(),
    citationStart: int("citationStart"),
    citationEnd: int("citationEnd"),
    selectedByDefault: boolean("selectedByDefault").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("findings_diagnosis_idx").on(table.diagnosisId)],
);

export const revisionPlans = mysqlTable(
  "revisionPlans",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    diagnosisId: int("diagnosisId").notNull().references(() => diagnoses.id, { onDelete: "cascade" }),
    sourceVersionId: int("sourceVersionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    styleProfileId: int("styleProfileId").references(() => styleProfiles.id, { onDelete: "set null" }),
    scope: mysqlEnum("scope", ["whole-book", "chapter-range", "single-chapter"]).notNull(),
    startChapter: int("startChapter"),
    endChapter: int("endChapter"),
    status: mysqlEnum("status", ["approved", "submitted", "completed"]).default("approved").notNull(),
    approvedAt: timestamp("approvedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("plans_project_created_idx").on(table.projectId, table.createdAt)],
);

export const revisionPlanItems = mysqlTable(
  "revisionPlanItems",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull().references(() => revisionPlans.id, { onDelete: "cascade" }),
    findingId: int("findingId").notNull().references(() => diagnosisFindings.id, { onDelete: "cascade" }),
    selected: boolean("selected").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("plan_finding_unique").on(table.planId, table.findingId)],
);

export const revisionJobs = mysqlTable(
  "revisionJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    planId: int("planId").notNull().references(() => revisionPlans.id, { onDelete: "cascade" }),
    sourceVersionId: int("sourceVersionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    resultVersionId: int("resultVersionId").references(() => manuscriptVersions.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["queued", "running", "awaiting-review", "succeeded", "succeeded-with-warnings", "failed"]).default("queued").notNull(),
    currentChapter: int("currentChapter").default(0).notNull(),
    totalChapters: int("totalChapters").default(0).notNull(),
    progress: int("progress").default(0).notNull(),
    beforeWordCount: int("beforeWordCount").default(0).notNull(),
    afterWordCount: int("afterWordCount").default(0).notNull(),
    warningCount: int("warningCount").default(0).notNull(),
    lastErrorCode: varchar("lastErrorCode", { length: 80 }),
    traceId: varchar("traceId", { length: 64 }).notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("jobs_project_status_idx").on(table.projectId, table.status)],
);

export const chapterCheckpoints = mysqlTable(
  "chapterCheckpoints",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull().references(() => revisionJobs.id, { onDelete: "cascade" }),
    chapterIndex: int("chapterIndex").notNull(),
    chapterTitle: varchar("chapterTitle", { length: 240 }).notNull(),
    status: mysqlEnum("status", ["queued", "running", "succeeded", "warning", "failed"]).default("queued").notNull(),
    progress: int("progress").default(0).notNull(),
    beforeText: longtext("beforeText").notNull(),
    afterText: longtext("afterText"),
    beforeWordCount: int("beforeWordCount").default(0).notNull(),
    afterWordCount: int("afterWordCount").default(0).notNull(),
    warningsJson: text("warningsJson"),
    traceId: varchar("traceId", { length: 64 }).notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("job_chapter_unique").on(table.jobId, table.chapterIndex)],
);

export const exportPreflights = mysqlTable(
  "exportPreflights",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: int("versionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    passed: boolean("passed").default(false).notNull(),
    checksJson: longtext("checksJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("preflights_project_created_idx").on(table.projectId, table.createdAt)],
);

export const accountBackups = mysqlTable(
  "accountBackups",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["created", "failed"]).default("created").notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 900 }).notNull(),
    projectCount: int("projectCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("backups_owner_created_idx").on(table.ownerId, table.createdAt)],
);

export const artBriefs = mysqlTable(
  "artBriefs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    version: int("version").default(1).notNull(),
    suitability: mysqlEnum("suitability", ["required", "recommended", "optional", "not-recommended"]).notNull(),
    illustrationMode: mysqlEnum("illustrationMode", ["none", "cover-only", "limited", "fully-illustrated"]).notNull(),
    rationale: text("rationale").notNull(),
    audience: text("audience").notNull(),
    genreSignals: text("genreSignals").notNull(),
    tone: text("tone").notNull(),
    motifs: text("motifs").notNull(),
    exclusions: text("exclusions").notNull(),
    palette: text("palette").notNull(),
    medium: varchar("medium", { length: 180 }).notNull(),
    typographyDirection: text("typographyDirection").notNull(),
    trimSize: varchar("trimSize", { length: 40 }).notNull(),
    distribution: mysqlEnum("distribution", ["print", "digital", "both"]).default("both").notNull(),
    status: mysqlEnum("status", ["draft", "approved", "superseded"]).default("draft").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("art_briefs_project_version_idx").on(table.projectId, table.version)],
);

export const coverConcepts = mysqlTable(
  "coverConcepts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    artBriefId: int("artBriefId").notNull().references(() => artBriefs.id, { onDelete: "cascade" }),
    version: int("version").default(1).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    direction: text("direction").notNull(),
    source: mysqlEnum("source", ["ai", "upload"]).notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 900 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    width: int("width").default(0).notNull(),
    height: int("height").default(0).notNull(),
    promptProvenance: longtext("promptProvenance"),
    status: mysqlEnum("status", ["generated", "approved", "rejected", "superseded"]).default("generated").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("cover_concepts_project_status_idx").on(table.projectId, table.status)],
);

export const illustrationPlans = mysqlTable(
  "illustrationPlans",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    artBriefId: int("artBriefId").notNull().references(() => artBriefs.id, { onDelete: "cascade" }),
    version: int("version").default(1).notNull(),
    consistencyJson: longtext("consistencyJson").notNull(),
    status: mysqlEnum("status", ["draft", "approved", "completed", "waived"]).default("draft").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("illustration_plans_project_version_idx").on(table.projectId, table.version)],
);

export const illustrationSlots = mysqlTable(
  "illustrationSlots",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull().references(() => illustrationPlans.id, { onDelete: "cascade" }),
    sequence: int("sequence").notNull(),
    chapterIndex: int("chapterIndex"),
    placement: varchar("placement", { length: 160 }).notNull(),
    purpose: text("purpose").notNull(),
    sceneBrief: longtext("sceneBrief").notNull(),
    aspectRatio: varchar("aspectRatio", { length: 40 }).notNull(),
    bleed: boolean("bleed").default(false).notNull(),
    caption: text("caption"),
    altText: text("altText").notNull(),
    continuityNotes: text("continuityNotes").notNull(),
    status: mysqlEnum("status", ["proposed", "approved", "rejected", "waived"]).default("proposed").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("illustration_slot_sequence_unique").on(table.planId, table.sequence)],
);

export const illustrationAssets = mysqlTable(
  "illustrationAssets",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    slotId: int("slotId").references(() => illustrationSlots.id, { onDelete: "set null" }),
    version: int("version").default(1).notNull(),
    source: mysqlEnum("source", ["ai", "upload"]).notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 900 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    width: int("width").default(0).notNull(),
    height: int("height").default(0).notNull(),
    promptProvenance: longtext("promptProvenance"),
    status: mysqlEnum("status", ["generated", "approved", "rejected", "superseded"]).default("generated").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("illustration_assets_project_status_idx").on(table.projectId, table.status)],
);

export const layoutSpecs = mysqlTable(
  "layoutSpecs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    version: int("version").default(1).notNull(),
    trimSize: varchar("trimSize", { length: 40 }).notNull(),
    orientation: mysqlEnum("orientation", ["portrait", "landscape"]).default("portrait").notNull(),
    pageWidthPt: int("pageWidthPt").notNull(),
    pageHeightPt: int("pageHeightPt").notNull(),
    marginsJson: text("marginsJson").notNull(),
    bleedPt: int("bleedPt").default(9).notNull(),
    bodyFont: varchar("bodyFont", { length: 120 }).notNull(),
    displayFont: varchar("displayFont", { length: 120 }).notNull(),
    bodySizePt: int("bodySizePt").default(11).notNull(),
    lineHeightPct: int("lineHeightPct").default(145).notNull(),
    paragraphStyle: mysqlEnum("paragraphStyle", ["indent", "spaced"]).default("indent").notNull(),
    runningHeads: boolean("runningHeads").default(true).notNull(),
    folios: boolean("folios").default(true).notNull(),
    chapterOpening: mysqlEnum("chapterOpening", ["right-hand", "next-page", "continuous"]).default("right-hand").notNull(),
    imagePlacement: mysqlEnum("imagePlacement", ["inline", "full-page", "spread"]).default("inline").notNull(),
    editionMode: mysqlEnum("editionMode", ["print", "digital", "both"]).default("both").notNull(),
    language: varchar("language", { length: 16 }).default("en").notNull(),
    digitalNavigation: boolean("digitalNavigation").default(true).notNull(),
    imageAltPolicy: mysqlEnum("imageAltPolicy", ["required", "optional"]).default("required").notNull(),
    printProfile: mysqlEnum("printProfile", ["grayscale", "standard-color", "premium-color"]).default("standard-color").notNull(),
    status: mysqlEnum("status", ["draft", "approved", "superseded"]).default("draft").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("layout_specs_project_version_idx").on(table.projectId, table.version)],
);

export const layoutVersions = mysqlTable(
  "layoutVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    manuscriptVersionId: int("manuscriptVersionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    artBriefId: int("artBriefId").notNull().references(() => artBriefs.id, { onDelete: "cascade" }),
    coverConceptId: int("coverConceptId").references(() => coverConcepts.id, { onDelete: "set null" }),
    illustrationPlanId: int("illustrationPlanId").references(() => illustrationPlans.id, { onDelete: "set null" }),
    layoutSpecId: int("layoutSpecId").notNull().references(() => layoutSpecs.id, { onDelete: "cascade" }),
    version: int("version").default(1).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    pageCount: int("pageCount").default(0).notNull(),
    pagesJson: longtext("pagesJson").notNull(),
    status: mysqlEnum("status", ["draft", "proof", "approved", "superseded"]).default("draft").notNull(),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("layout_versions_project_status_idx").on(table.projectId, table.status)],
);

export const proofAnnotations = mysqlTable(
  "proofAnnotations",
  {
    id: int("id").autoincrement().primaryKey(),
    layoutVersionId: int("layoutVersionId").notNull().references(() => layoutVersions.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    xPct: int("xPct").default(50).notNull(),
    yPct: int("yPct").default(50).notNull(),
    note: text("note").notNull(),
    status: mysqlEnum("status", ["open", "resolved", "accepted-as-is", "deferred"]).default("open").notNull(),
    resolutionNote: text("resolutionNote"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("proof_annotations_layout_status_idx").on(table.layoutVersionId, table.status)],
);

export const productionPreflights = mysqlTable(
  "productionPreflights",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    layoutVersionId: int("layoutVersionId").notNull().references(() => layoutVersions.id, { onDelete: "cascade" }),
    passed: boolean("passed").default(false).notNull(),
    checksJson: longtext("checksJson").notNull(),
    authorApproved: boolean("authorApproved").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("production_preflights_project_created_idx").on(table.projectId, table.createdAt)],
);

export const productionExports = mysqlTable(
  "productionExports",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    layoutVersionId: int("layoutVersionId").notNull().references(() => layoutVersions.id, { onDelete: "cascade" }),
    preflightId: int("preflightId").notNull().references(() => productionPreflights.id, { onDelete: "cascade" }),
    format: mysqlEnum("format", ["interior-pdf", "cover-pdf", "epub", "package"]).notNull(),
    status: mysqlEnum("status", ["created", "failed"]).default("created").notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 900 }).notNull(),
    checksum: varchar("checksum", { length: 128 }).notNull(),
    sizeBytes: int("sizeBytes").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("production_exports_project_created_idx").on(table.projectId, table.createdAt)],
);

export const styleSamples = mysqlTable(
  "styleSamples",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    tags: varchar("tags", { length: 320 }).default("").notNull(),
    sourceNote: text("sourceNote"),
    consentConfirmed: boolean("consentConfirmed").default(false).notNull(),
    content: longtext("content").notNull(),
    wordCount: int("wordCount").default(0).notNull(),
    storageKey: varchar("storageKey", { length: 700 }),
    storageUrl: varchar("storageUrl", { length: 900 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("style_samples_owner_created_idx").on(table.ownerId, table.createdAt)],
);

export const styleProfiles = mysqlTable(
  "styleProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    sampleIdsJson: longtext("sampleIdsJson").notNull(),
    dimensionsJson: longtext("dimensionsJson").notNull(),
    cautions: text("cautions").notNull(),
    status: mysqlEnum("status", ["draft", "active", "revoked"]).default("draft").notNull(),
    traceId: varchar("traceId", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("style_profiles_owner_created_idx").on(table.ownerId, table.createdAt)],
);

export const projectCollaborators = mysqlTable(
  "projectCollaborators",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["editor", "designer"]).notNull(),
    status: mysqlEnum("status", ["invited", "active", "revoked"]).default("invited").notNull(),
    invitedEmail: varchar("invitedEmail", { length: 320 }).notNull(),
    inviteTokenHash: varchar("inviteTokenHash", { length: 128 }).notNull(),
    invitedByUserId: int("invitedByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("acceptedAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("collaborators_project_email_unique").on(table.projectId, table.invitedEmail),
    index("collaborators_project_status_idx").on(table.projectId, table.status),
    index("collaborators_user_status_idx").on(table.userId, table.status),
  ],
);

export const reviewRounds = mysqlTable(
  "reviewRounds",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: int("versionId").notNull().references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    anonymousLabel: varchar("anonymousLabel", { length: 80 }).notNull(),
    identityPolicy: mysqlEnum("identityPolicy", ["anonymous", "reveal-on-close"]).default("anonymous").notNull(),
    status: mysqlEnum("status", ["open", "closed", "cancelled"]).default("open").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("review_rounds_project_status_idx").on(table.projectId, table.status)],
);

export const reviewAssignments = mysqlTable(
  "reviewAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    reviewRoundId: int("reviewRoundId").notNull().references(() => reviewRounds.id, { onDelete: "cascade" }),
    collaboratorId: int("collaboratorId").notNull().references(() => projectCollaborators.id, { onDelete: "cascade" }),
    anonymousLabel: varchar("anonymousLabel", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["assigned", "submitted", "revoked"]).default("assigned").notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
  },
  table => [uniqueIndex("review_assignment_unique").on(table.reviewRoundId, table.collaboratorId)],
);

export const reviewSubmissions = mysqlTable(
  "reviewSubmissions",
  {
    id: int("id").autoincrement().primaryKey(),
    reviewRoundId: int("reviewRoundId").notNull().references(() => reviewRounds.id, { onDelete: "cascade" }),
    assignmentId: int("assignmentId").notNull().references(() => reviewAssignments.id, { onDelete: "cascade" }),
    ratingsJson: longtext("ratingsJson").notNull(),
    feedback: longtext("feedback").notNull(),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("review_submission_assignment_unique").on(table.assignmentId)],
);

export const approvalRequirements = mysqlTable(
  "approvalRequirements",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    area: mysqlEnum("area", ["revision", "cover", "illustration", "layout", "proof", "production-export"]).notNull(),
    requiredRole: mysqlEnum("requiredRole", ["editor", "designer"]).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    updatedByUserId: int("updatedByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("approval_requirement_project_area_role_unique").on(table.projectId, table.area, table.requiredRole)],
);

export const approvalDecisions = mysqlTable(
  "approvalDecisions",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    area: mysqlEnum("area", ["revision", "cover", "illustration", "layout", "proof", "production-export"]).notNull(),
    targetType: varchar("targetType", { length: 80 }).notNull(),
    targetId: int("targetId").notNull(),
    collaboratorId: int("collaboratorId").notNull().references(() => projectCollaborators.id, { onDelete: "cascade" }),
    decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("approval_decisions_project_target_idx").on(table.projectId, table.targetType, table.targetId)],
);

export const projectAuditEvents = mysqlTable(
  "projectAuditEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("eventType", { length: 100 }).notNull(),
    targetType: varchar("targetType", { length: 100 }).notNull(),
    targetId: int("targetId"),
    detailsJson: longtext("detailsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_events_project_created_idx").on(table.projectId, table.createdAt)],
);

export type Project = typeof projects.$inferSelect;
export type ManuscriptVersion = typeof manuscriptVersions.$inferSelect;
export type Diagnosis = typeof diagnoses.$inferSelect;
export type DiagnosisFinding = typeof diagnosisFindings.$inferSelect;
export type RevisionPlan = typeof revisionPlans.$inferSelect;
export type RevisionJob = typeof revisionJobs.$inferSelect;
export type ChapterCheckpoint = typeof chapterCheckpoints.$inferSelect;
export type ArtBrief = typeof artBriefs.$inferSelect;
export type CoverConcept = typeof coverConcepts.$inferSelect;
export type IllustrationPlan = typeof illustrationPlans.$inferSelect;
export type IllustrationSlot = typeof illustrationSlots.$inferSelect;
export type IllustrationAsset = typeof illustrationAssets.$inferSelect;
export type LayoutSpec = typeof layoutSpecs.$inferSelect;
export type LayoutVersion = typeof layoutVersions.$inferSelect;
export type StyleSample = typeof styleSamples.$inferSelect;
export type StyleProfile = typeof styleProfiles.$inferSelect;
export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type ReviewRound = typeof reviewRounds.$inferSelect;
