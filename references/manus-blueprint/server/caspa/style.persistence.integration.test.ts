import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { styleProfiles, styleSamples, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { deleteStyleSample, exportStyleLibrary, getActiveStyleGrounding, setStyleProfileStatus } from "./style";

let ownerId = 0; let outsiderId = 0; let ownedProfileId = 0; let removableSampleId = 0;

async function createUser(label: string) {
  const db = await getDb(); if (!db) throw new Error("DATABASE_REQUIRED_FOR_STYLE_TEST");
  const openId = `caspa-style-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({ openId, name: `Style ${label}`, email: `${openId}@example.test`, loginMethod: "vitest", lastSignedIn: new Date() });
  const user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; if (!user) throw new Error("STYLE_TEST_USER_FAILED"); return user;
}

beforeEach(async () => {
  const db = await getDb(); if (!db) throw new Error("DATABASE_REQUIRED_FOR_STYLE_TEST");
  const owner = await createUser("owner"); const outsider = await createUser("outsider"); ownerId = owner.id; outsiderId = outsider.id;
  const sample = await db.insert(styleSamples).values({ ownerId, name: "Consented source", tags: "private", consentConfirmed: true, content: "Stored in private object storage.", wordCount: 100, storageKey: "test-style-source.txt", storageUrl: "/manus-storage/test-style-source.txt" });
  const sampleId = Number(sample[0].insertId);
  const removable = await db.insert(styleSamples).values({ ownerId, name: "Removable source", tags: "private", consentConfirmed: true, content: "Stored in private object storage.", wordCount: 100, storageKey: "test-style-removable.txt", storageUrl: "/manus-storage/test-style-removable.txt" });
  removableSampleId = Number(removable[0].insertId);
  const profile = await db.insert(styleProfiles).values({ ownerId, name: "Private craft profile", sampleIdsJson: JSON.stringify([sampleId]), dimensionsJson: JSON.stringify({ pointOfView: "close third", sentenceRhythm: "varied", dialogueDensity: "moderate", imagery: "precise", pacing: "measured", register: "literary" }), cautions: "Do not quote or imitate a named author.", status: "active", traceId: "style-test-trace" });
  ownedProfileId = Number(profile[0].insertId);
});

afterEach(async () => {
  const db = await getDb(); if (!db) return;
  await db.delete(styleProfiles).where(inArray(styleProfiles.ownerId, [ownerId, outsiderId]));
  await db.delete(styleSamples).where(inArray(styleSamples.ownerId, [ownerId, outsiderId]));
  await db.delete(users).where(inArray(users.id, [ownerId, outsiderId]));
});

describe("author-owned style persistence", () => {
  it("returns an active profile only to its owner and prevents cross-account status changes", async () => {
    await expect(getActiveStyleGrounding(ownerId, ownedProfileId)).resolves.toMatchObject({ name: "Private craft profile", dimensions: { pointOfView: "close third" } });
    await expect(getActiveStyleGrounding(outsiderId, ownedProfileId)).rejects.toThrow(/Select an active profile from your private style library/);
    await expect(setStyleProfileStatus(outsiderId, ownedProfileId, "revoked")).rejects.toThrow(/not available in your private library/);
  });

  it("lets the author delete an unprofiled private sample", async () => {
    await expect(deleteStyleSample(ownerId, removableSampleId)).resolves.toEqual({ id: removableSampleId, deleted: true });
  });

  it("exports owner metadata and profiles without private source text or storage references", async () => {
    const exported = await exportStyleLibrary(ownerId);
    const json = JSON.stringify(exported);
    expect(exported.samples).toHaveLength(2);
    expect(exported.profiles).toHaveLength(1);
    expect(json).not.toContain("Stored in private object storage.");
    expect(json).not.toContain("test-style-source.txt");
    expect(json).not.toContain("/manus-storage/");
  });
});
