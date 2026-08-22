import { desc, eq, inArray } from "drizzle-orm";
import { styleProfiles, styleSamples } from "../../drizzle/schema";
import { countWords } from "../../shared/manuscript";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { storageGetSignedUrl, storagePut } from "../storage";
import { CaspaServiceError, createTraceId, logPrivateError } from "./errors";

type StyleDimensions = {
  pointOfView: string;
  sentenceRhythm: string;
  dialogueDensity: string;
  imagery: string;
  pacing: string;
  register: string;
};

const styleSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "caspa_style_profile",
    strict: true,
    schema: {
      type: "object",
      properties: {
        pointOfView: { type: "string" },
        sentenceRhythm: { type: "string" },
        dialogueDensity: { type: "string" },
        imagery: { type: "string" },
        pacing: { type: "string" },
        register: { type: "string" },
        cautions: { type: "string" },
      },
      required: ["pointOfView", "sentenceRhythm", "dialogueDensity", "imagery", "pacing", "register", "cautions"],
      additionalProperties: false,
    },
  },
};

const privateStorageMarker = "Stored in private object storage.";

async function database() {
  const db = await getDb();
  if (!db) throw new CaspaServiceError("DATABASE_UNAVAILABLE", "Your style library is temporarily unavailable. Please try again.");
  return db;
}

export async function listStyleLibrary(ownerId: number) {
  const db = await database();
  const [samples, profiles] = await Promise.all([
    db.select().from(styleSamples).where(eq(styleSamples.ownerId, ownerId)).orderBy(desc(styleSamples.createdAt)),
    db.select().from(styleProfiles).where(eq(styleProfiles.ownerId, ownerId)).orderBy(desc(styleProfiles.createdAt)),
  ]);
  return {
    samples: samples.map(({ content, ...sample }) => sample),
    profiles: profiles.map(profile => ({ ...profile, traceId: undefined })),
  };
}

export async function exportStyleLibrary(ownerId: number) {
  const library = await listStyleLibrary(ownerId);
  return {
    exportedAt: new Date().toISOString(),
    policy: "Author-owned or explicitly licensed samples only. Source text and storage locations are intentionally excluded.",
    samples: library.samples.map(sample => ({ id: sample.id, name: sample.name, tags: sample.tags, sourceNote: sample.sourceNote, wordCount: sample.wordCount, consentConfirmed: sample.consentConfirmed, createdAt: sample.createdAt })),
    profiles: library.profiles.map(profile => ({ id: profile.id, name: profile.name, sampleIds: JSON.parse(profile.sampleIdsJson), dimensions: JSON.parse(profile.dimensionsJson), cautions: profile.cautions, status: profile.status, createdAt: profile.createdAt })),
  };
}

export async function createStyleSample(ownerId: number, input: { name: string; tags?: string; sourceNote?: string; content: string; consentConfirmed: true }) {
  if (!input.consentConfirmed) throw new CaspaServiceError("STYLE_CONSENT_REQUIRED", "Confirm that you own or are licensed to use this sample before adding it.");
  const content = input.content.trim();
  const words = countWords(content);
  if (words < 80) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Add at least 80 words so CASPA can build a useful craft profile.");
  if (content.length > 40_000) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Keep a single style sample below 40,000 characters.");
  const traceId = createTraceId();
  try {
    const safeName = input.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "style-sample";
    const stored = await storagePut(`style-samples/${ownerId}/${safeName}.txt`, content, "text/plain; charset=utf-8");
    const db = await database();
    const result = await db.insert(styleSamples).values({
      ownerId,
      name: input.name,
      tags: input.tags?.trim() || "",
      sourceNote: input.sourceNote?.trim() || null,
      consentConfirmed: true,
      content: privateStorageMarker,
      wordCount: words,
      storageKey: stored.key,
      storageUrl: stored.url,
    });
    const rows = await db.select().from(styleSamples).where(eq(styleSamples.id, Number(result[0].insertId))).limit(1);
    const { content: _content, ...sample } = rows[0]!;
    return sample;
  } catch (error) {
    logPrivateError("style-sample", traceId, error, { ownerId });
    if (error instanceof CaspaServiceError) throw error;
    throw new CaspaServiceError("UPLOAD_UNSUPPORTED", "The style sample could not be saved. Your library is unchanged.", traceId);
  }
}

async function loadPrivateSampleText(sample: { storageKey: string | null }) {
  if (!sample.storageKey) throw new Error("STYLE_SAMPLE_STORAGE_KEY_MISSING");
  const url = await storageGetSignedUrl(sample.storageKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error("STYLE_SAMPLE_STORAGE_READ_FAILED");
  const content = await response.text();
  if (countWords(content) < 80) throw new Error("STYLE_SAMPLE_STORAGE_CONTENT_INVALID");
  return content;
}

export async function deleteStyleSample(ownerId: number, sampleId: number) {
  const db = await database();
  const rows = await db.select().from(styleSamples).where(eq(styleSamples.id, sampleId)).limit(1);
  const sample = rows[0];
  if (!sample || sample.ownerId !== ownerId) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "That style sample is not available in your private library.");
  const profiles = await db.select().from(styleProfiles).where(eq(styleProfiles.ownerId, ownerId));
  if (profiles.some(profile => JSON.parse(profile.sampleIdsJson).includes(sampleId))) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Remove this sample from its style profile before deleting it.");
  await db.delete(styleSamples).where(eq(styleSamples.id, sampleId));
  return { id: sampleId, deleted: true as const };
}

export async function createStyleProfile(ownerId: number, input: { name: string; sampleIds: number[] }) {
  const db = await database();
  const samples = await db.select().from(styleSamples).where(inArray(styleSamples.id, input.sampleIds));
  if (samples.length !== input.sampleIds.length || samples.some(sample => sample.ownerId !== ownerId || !sample.consentConfirmed)) {
    throw new CaspaServiceError("STYLE_CONSENT_REQUIRED", "Use only confirmed samples from your private style library.");
  }
  const traceId = createTraceId();
  try {
    const sourceTexts = await Promise.all(samples.map(loadPrivateSampleText));
    const material = samples.map((sample, index) => `SAMPLE ${index + 1} (${sample.name})\n${sourceTexts[index]!.slice(0, 12_000)}`).join("\n\n---\n\n");
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 1_600,
      response_format: styleSchema,
      messages: [
        { role: "system", content: "You analyze only author-owned or licensed samples. Return an original craft profile using the required fields. Do not identify, name, imitate, quote, or reproduce a source. Describe transferable craft dimensions and include cautions that prohibit verbatim reproduction." },
        { role: "user", content: `Create a private CASPA craft profile from these consented samples.\n\n${material}` },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("STYLE_PROFILE_EMPTY");
    const parsed = JSON.parse(raw) as StyleDimensions & { cautions: string };
    if (![parsed.pointOfView, parsed.sentenceRhythm, parsed.dialogueDensity, parsed.imagery, parsed.pacing, parsed.register, parsed.cautions].every(value => typeof value === "string" && value.trim())) throw new Error("STYLE_PROFILE_INVALID");
    const result = await db.insert(styleProfiles).values({
      ownerId,
      name: input.name,
      sampleIdsJson: JSON.stringify(input.sampleIds),
      dimensionsJson: JSON.stringify({ pointOfView: parsed.pointOfView, sentenceRhythm: parsed.sentenceRhythm, dialogueDensity: parsed.dialogueDensity, imagery: parsed.imagery, pacing: parsed.pacing, register: parsed.register }),
      cautions: parsed.cautions,
      status: "active",
      traceId,
    });
    const rows = await db.select().from(styleProfiles).where(eq(styleProfiles.id, Number(result[0].insertId))).limit(1);
    return { ...rows[0]!, traceId: undefined };
  } catch (error) {
    logPrivateError("style-profile", traceId, error, { ownerId, sampleCount: samples.length });
    throw new CaspaServiceError("AI_RESPONSE_INVALID", "CASPA could not prepare a safe craft profile. Your samples are unchanged.", traceId);
  }
}

export async function setStyleProfileStatus(ownerId: number, profileId: number, status: "active" | "revoked") {
  const db = await database();
  const rows = await db.select().from(styleProfiles).where(eq(styleProfiles.id, profileId)).limit(1);
  const profile = rows[0];
  if (!profile || profile.ownerId !== ownerId) throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "That style profile is not available in your private library.");
  await db.update(styleProfiles).set({ status }).where(eq(styleProfiles.id, profileId));
  return { id: profileId, status };
}

export async function getActiveStyleGrounding(ownerId: number, profileId: number) {
  const db = await database();
  const rows = await db.select().from(styleProfiles).where(eq(styleProfiles.id, profileId)).limit(1);
  const profile = rows[0];
  if (!profile || profile.ownerId !== ownerId || profile.status !== "active") throw new CaspaServiceError("WORKFLOW_STATE_CONFLICT", "Select an active profile from your private style library.");
  return { name: profile.name, dimensions: JSON.parse(profile.dimensionsJson) as StyleDimensions, cautions: profile.cautions };
}
