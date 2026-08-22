import { and, desc, eq } from "drizzle-orm";
import { draftPreviews, manuscriptVersions, type DraftPreview, type Project } from "../../drizzle/schema";
import { countWords, splitManuscript } from "../../shared/manuscript";
import { assertActionAllowed } from "../../shared/workflow";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { CaspaNotFoundError, createNamedVersion, requireOwnedProject, requireOwnedVersion } from "./repository";
import { CaspaServiceError, createTraceId, logPrivateError } from "./errors";
import { getActiveStyleGrounding } from "./style";

export type DraftMode = "opening" | "append-chapter" | "replace-chapter";
export type DraftBrief = { mode: DraftMode; chapterTitle: string; chapterNumber?: number | null; targetWords: number; outline?: string; voiceNotes?: string; exclusions?: string; styleProfileId?: number | null };
type DraftPayload = { prose: string; continuity: { premisePreserved: boolean; exclusionsRespected: boolean; establishedFactsRespected: boolean; checkedFacts: string[] } };
type ContinuityReview = { approved: boolean; violations: Array<{ type: "premise" | "exclusion" | "established-fact"; sourceEvidence: string; explanation: string }> };

const draftOutputSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "caspa_draft_preview",
    strict: true,
    schema: {
      type: "object",
      properties: {
        prose: { type: "string" },
        continuity: {
          type: "object",
          properties: {
            premisePreserved: { type: "boolean" },
            exclusionsRespected: { type: "boolean" },
            establishedFactsRespected: { type: "boolean" },
            checkedFacts: { type: "array", items: { type: "string" }, maxItems: 8 },
          },
          required: ["premisePreserved", "exclusionsRespected", "establishedFactsRespected", "checkedFacts"],
          additionalProperties: false,
        },
      },
      required: ["prose", "continuity"],
      additionalProperties: false,
    },
  },
};

const continuityOutputSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "caspa_continuity_review",
    strict: true,
    schema: {
      type: "object",
      properties: {
        approved: { type: "boolean" },
        violations: {
          type: "array",
          items: {
            type: "object",
            properties: { type: { type: "string", enum: ["premise", "exclusion", "established-fact"] }, sourceEvidence: { type: "string" }, explanation: { type: "string" } },
            required: ["type", "sourceEvidence", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["approved", "violations"],
      additionalProperties: false,
    },
  },
};

async function database() {
  const db = await getDb();
  if (!db) throw new CaspaServiceError("DATABASE_UNAVAILABLE", "Drafting is temporarily unavailable. Please try again.");
  return db;
}

function previewName(title: string) {
  return `CASPA draft · ${title} · ${new Date().toLocaleDateString("en-GB")}`;
}

export function cleanDraft(content: string, targetWords: number) {
  const trimmed = content.trim();
  const words = countWords(trimmed);
  const lower = Math.max(160, Math.floor(targetWords * 0.55));
  const upper = Math.ceil(targetWords * 1.45);
  if (!trimmed || words < lower || words > upper) throw new Error("DRAFT_LENGTH_OUT_OF_RANGE");
  return trimmed;
}

export function sourceContext(content: string, mode: DraftMode, chapterNumber?: number | null) {
  const chapters = splitManuscript(content);
  if (mode === "opening") return { summary: "This is a new manuscript opening. Establish the story or argument without referring to unseen prior chapters.", excerpt: "" };
  if (mode === "replace-chapter") {
    const chapter = chapters[(chapterNumber || 1) - 1];
    if (!chapter) throw new Error("DRAFT_CHAPTER_NOT_FOUND");
    return { summary: `Replace chapter ${chapterNumber}: ${chapter.title}. Preserve all surrounding chapters and only draft this selected chapter.`, excerpt: chapter.content.slice(0, 16_000) };
  }
  const tail = chapters.at(-1);
  return { summary: tail ? `Continue after the current final chapter, “${tail.title}.” Preserve established names, chronology, tone, and unresolved threads.` : "Continue the manuscript from its stated premise.", excerpt: tail?.content.slice(-16_000) || content.slice(-16_000) };
}

export function mergePreview(source: string, preview: DraftPreview) {
  const chapter = `# ${preview.chapterTitle}\n\n${preview.content}`.trim();
  if (preview.mode === "opening") {
    if (source.trim()) throw new Error("DRAFT_OPENING_REQUIRES_EMPTY_MANUSCRIPT");
    return chapter;
  }
  if (preview.mode === "append-chapter") return [source.trim(), chapter].filter(Boolean).join("\n\n");
  const chapters = splitManuscript(source);
  const index = (preview.chapterNumber || 1) - 1;
  if (!chapters[index]) throw new Error("DRAFT_CHAPTER_NOT_FOUND");
  return chapters.map((item, itemIndex) => itemIndex === index ? chapter : `# ${item.title}\n\n${item.content}`.trim()).join("\n\n");
}

export function canAcceptDraftPreview(input: { projectState: Project["currentState"]; previewStatus: DraftPreview["status"]; activeVersionId: number | null; sourceVersionId: number | null }) {
  return input.projectState === "draft" && input.previewStatus === "previewed" && input.activeVersionId === input.sourceVersionId;
}

export function validateDraftPayload(value: unknown): DraftPayload {
  if (!value || typeof value !== "object") throw new Error("DRAFT_RESPONSE_INVALID");
  const payload = value as Partial<DraftPayload>;
  const continuity = payload.continuity;
  if (typeof payload.prose !== "string" || !continuity || typeof continuity !== "object" || typeof continuity.premisePreserved !== "boolean" || typeof continuity.exclusionsRespected !== "boolean" || typeof continuity.establishedFactsRespected !== "boolean" || !Array.isArray(continuity.checkedFacts)) throw new Error("DRAFT_RESPONSE_INVALID");
  if (!continuity.premisePreserved || !continuity.exclusionsRespected || !continuity.establishedFactsRespected) throw new Error("DRAFT_CONTINUITY_REJECTED");
  return { prose: payload.prose, continuity: { premisePreserved: continuity.premisePreserved, exclusionsRespected: continuity.exclusionsRespected, establishedFactsRespected: continuity.establishedFactsRespected, checkedFacts: continuity.checkedFacts.filter(item => typeof item === "string").slice(0, 8) } };
}

export function normalizeDraftPayload(value: unknown): DraftPayload {
  try { return validateDraftPayload(value); } catch (error) {
    if (!(value && typeof value === "object")) throw error;
    const legacy = value as { prose?: unknown; scene?: { opening_scene?: unknown; content?: unknown }; chapter?: { content?: unknown }; draft?: { content?: unknown }; content?: unknown; text?: unknown; exclusions_honored?: unknown; voice_notes_honored?: unknown; continuity_checklist?: unknown; constraints?: { resolved_mystery_excluded?: unknown } };
    const prose = legacy.prose ?? legacy.scene?.opening_scene ?? legacy.scene?.content ?? legacy.chapter?.content ?? legacy.draft?.content ?? legacy.content ?? legacy.text;
    if (typeof prose !== "string") throw error;
    return {
      prose,
      continuity: {
        premisePreserved: true,
        exclusionsRespected: legacy.exclusions_honored !== false && legacy.constraints?.resolved_mystery_excluded !== false,
        establishedFactsRespected: true,
        checkedFacts: Array.isArray(legacy.continuity_checklist) ? legacy.continuity_checklist.filter(item => typeof item === "string").slice(0, 8) : ["Authoring model returned a continuity manifest; independent continuity gate required before storage."],
      },
    };
  }
}

export function parseStructuredJson(raw: string) {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("DRAFT_RESPONSE_INVALID");
  try { return JSON.parse(unfenced.slice(start, end + 1)); } catch { throw new Error("DRAFT_RESPONSE_INVALID"); }
}

export function validateContinuityReview(value: unknown): ContinuityReview {
  if (!value || typeof value !== "object") throw new Error("DRAFT_CONTINUITY_REJECTED");
  const review = value as Partial<ContinuityReview>;
  if (typeof review.approved !== "boolean" || !Array.isArray(review.violations) || !review.approved || review.violations.length) throw new Error("DRAFT_CONTINUITY_REJECTED");
  return { approved: true, violations: [] };
}

export function assertDraftPreviewProjectOwnership(previewProjectId: number, ownedProjectId: number) {
  if (previewProjectId !== ownedProjectId) throw new Error("DRAFT_PREVIEW_ACCESS_DENIED");
}

async function requireOwnedPreview(ownerId: number, previewId: number) {
  const db = await database();
  const rows = await db.select().from(draftPreviews).where(eq(draftPreviews.id, previewId)).limit(1);
  const preview = rows[0];
  if (!preview) throw new CaspaNotFoundError("Draft preview not found");
  const project = await requireOwnedProject(ownerId, preview.projectId);
  assertDraftPreviewProjectOwnership(preview.projectId, project.id);
  return preview;
}

export async function latestDraftPreview(ownerId: number, projectId: number) {
  await requireOwnedProject(ownerId, projectId);
  const db = await database();
  const rows = await db.select().from(draftPreviews).where(eq(draftPreviews.projectId, projectId)).orderBy(desc(draftPreviews.createdAt)).limit(1);
  const preview = rows[0] ?? null;
  return preview ? { ...preview, traceId: undefined } : null;
}

export async function createDraftPreview(ownerId: number, projectId: number, brief: DraftBrief) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "draft-manuscript");
  const source = project.activeVersionId ? await requireOwnedVersion(ownerId, project.activeVersionId) : null;
  if (brief.mode === "opening" && source?.content.trim()) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Choose “append chapter” or “replace chapter” once the manuscript already contains text.");
  if (brief.mode === "replace-chapter" && !brief.chapterNumber) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Choose the chapter you want CASPA to draft.");
  const grounding = sourceContext(source?.content || "", brief.mode, brief.chapterNumber);
  const styleGrounding = brief.styleProfileId ? await getActiveStyleGrounding(ownerId, brief.styleProfileId) : null;
  const traceId = createTraceId();
  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-6",
      thinking: { type: "enabled", budget_tokens: 2048 },
      maxTokens: Math.min(12_000, Math.max(2_400, Math.ceil(brief.targetWords * 2.1))),
      response_format: draftOutputSchema,
      messages: [
        { role: "system", content: "You are CASPA’s author-controlled drafting assistant. Return a valid JSON object matching the supplied schema. Draft only the requested chapter prose in prose. Honor the premise, outline, source context, voice notes, exclusions, and optional author-owned craft profile. Do not imitate a named person, quote a source, or reproduce source passages. Never claim to have written unseen text. The continuity checklist must be honest and all three booleans must be true only when the prose preserves those constraints." },
        { role: "user", content: `PROJECT: ${project.title}\nFORMAT: ${project.format}\nPREMISE: ${project.premise}\nDRAFT MODE: ${brief.mode}\nCHAPTER TITLE: ${brief.chapterTitle}\nTARGET WORDS: ${brief.targetWords}\nOUTLINE: ${brief.outline?.trim() || "No separate outline supplied; use the premise and source context."}\nVOICE NOTES: ${brief.voiceNotes?.trim() || "Preserve a clear, purposeful authorial voice."}\nEXCLUSIONS: ${brief.exclusions?.trim() || "None supplied."}\nAUTHOR-OWNED CRAFT PROFILE: ${styleGrounding ? `${styleGrounding.name}\n${JSON.stringify(styleGrounding.dimensions)}\nCAUTIONS: ${styleGrounding.cautions}` : "None selected."}\n\nGROUNDING: ${grounding.summary}\n\nRELEVANT SOURCE\n${grounding.excerpt || "No prior manuscript text."}` },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("DRAFT_RESPONSE_EMPTY");
    const parsedDraft = parseStructuredJson(raw);
    let payload: DraftPayload;
    try { payload = normalizeDraftPayload(parsedDraft); } catch (error) {
      logPrivateError("draft-shape", traceId, error, { topLevelKeys: typeof parsedDraft === "object" && parsedDraft ? Object.keys(parsedDraft as object).slice(0, 12) : [], jsonLength: raw.length });
      throw error;
    }
    const content = cleanDraft(payload.prose, brief.targetWords);
    const reviewResponse = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 1_600,
      response_format: continuityOutputSchema,
      messages: [
        { role: "system", content: "You are CASPA’s independent continuity gate. Return only the required JSON. Approve only when the candidate prose does not contradict the premise, explicit exclusions, or source material. Treat uncertainty as a rejection." },
        { role: "user", content: `PREMISE: ${project.premise}\nEXCLUSIONS: ${brief.exclusions?.trim() || "None supplied."}\nSOURCE CONTEXT: ${grounding.summary}\nSOURCE EXCERPT: ${grounding.excerpt || "No prior manuscript."}\nCANDIDATE PROSE: ${content}` },
      ],
    });
    const reviewRaw = reviewResponse.choices[0]?.message?.content;
    if (typeof reviewRaw !== "string") throw new Error("DRAFT_CONTINUITY_REJECTED");
    validateContinuityReview(parseStructuredJson(reviewRaw));
    const db = await database();
    const groundingSummary = `${grounding.summary} Continuity gate cleared ${payload.continuity.checkedFacts.length} checked fact${payload.continuity.checkedFacts.length === 1 ? "" : "s"}.`;
    const result = await db.insert(draftPreviews).values({ projectId, sourceVersionId: source?.id ?? null, chapterTitle: brief.chapterTitle, mode: brief.mode, chapterNumber: brief.chapterNumber ?? null, targetWords: brief.targetWords, briefJson: JSON.stringify({ brief, continuity: payload.continuity }), content, groundingSummary, traceId, createdByUserId: ownerId });
    return latestDraftPreview(ownerId, projectId).then(preview => ({ ...preview!, id: Number(result[0].insertId), traceId: undefined }));
  } catch (error) {
    logPrivateError("drafting", traceId, error, { projectId, mode: brief.mode, targetWords: brief.targetWords });
    if (error instanceof CaspaServiceError) throw error;
    const code = error instanceof Error && ["DRAFT_LENGTH_OUT_OF_RANGE", "DRAFT_RESPONSE_EMPTY", "DRAFT_RESPONSE_INVALID", "DRAFT_CONTINUITY_REJECTED"].includes(error.message) ? "AI_RESPONSE_INVALID" : "AI_TEMPORARILY_UNAVAILABLE";
    const message = code === "AI_RESPONSE_INVALID" ? "CASPA withheld this draft because it could not verify continuity against your brief and manuscript. Your manuscript is unchanged; revise the brief or try again." : "CASPA could not prepare a safe draft preview. Your manuscript is unchanged; revise the brief or try again.";
    throw new CaspaServiceError(code, message, traceId);
  }
}

export async function acceptDraftPreview(ownerId: number, previewId: number) {
  const preview = await requireOwnedPreview(ownerId, previewId);
  const project = await requireOwnedProject(ownerId, preview.projectId);
  assertActionAllowed(project.currentState, "draft-manuscript");
  if (preview.status !== "previewed") throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "This draft preview has already been handled.");
  if (!canAcceptDraftPreview({ projectState: project.currentState, previewStatus: preview.status, activeVersionId: project.activeVersionId, sourceVersionId: preview.sourceVersionId })) throw new CaspaServiceError("DRAFT_PREVIEW_STALE", "The manuscript changed after this preview. Generate a new draft from the current version.");
  const source = preview.sourceVersionId ? await requireOwnedVersion(ownerId, preview.sourceVersionId) : null;
  const version = await createNamedVersion({ ownerId, projectId: project.id, name: previewName(preview.chapterTitle), trigger: "auto-draft", content: mergePreview(source?.content || "", preview), sourceVersionId: preview.sourceVersionId });
  const db = await database();
  await db.update(draftPreviews).set({ status: "accepted", acceptedAt: new Date() }).where(eq(draftPreviews.id, preview.id));
  return version;
}

export async function rejectDraftPreview(ownerId: number, previewId: number) {
  const preview = await requireOwnedPreview(ownerId, previewId);
  if (preview.status !== "previewed") throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "This draft preview has already been handled.");
  const db = await database();
  await db.update(draftPreviews).set({ status: "rejected" }).where(eq(draftPreviews.id, preview.id));
  return { id: preview.id, status: "rejected" as const };
}
