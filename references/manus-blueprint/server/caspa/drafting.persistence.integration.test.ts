import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { draftPreviews, users } from "../../drizzle/schema";
import { appRouter } from "../routers";
import { getDb } from "../db";
import type { TrpcContext } from "../_core/context";

type DbUser = NonNullable<TrpcContext["user"]>;

type Fixture = {
  owner: DbUser;
  outsider: DbUser;
  ownerCaller: ReturnType<typeof appRouter.createCaller>;
  outsiderCaller: ReturnType<typeof appRouter.createCaller>;
  projectId: number;
  title: string;
  sourceVersionId: number;
};

let fixture: Fixture | null = null;

function callerFor(user: DbUser) {
  return appRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  });
}

async function createUser(suffix: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_REQUIRED_FOR_DRAFT_PERSISTENCE_TEST");
  const openId = `caspa-draft-integration-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({ openId, name: `Draft integration ${suffix}`, email: `${openId}@example.test`, loginMethod: "vitest", lastSignedIn: new Date() });
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!rows[0]) throw new Error("TEST_USER_CREATION_FAILED");
  return rows[0];
}

async function createPreview(status: "previewed" = "previewed") {
  if (!fixture) throw new Error("FIXTURE_REQUIRED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_REQUIRED_FOR_DRAFT_PERSISTENCE_TEST");
  const insert = await db.insert(draftPreviews).values({
    projectId: fixture.projectId,
    sourceVersionId: fixture.sourceVersionId,
    chapterTitle: "After the Bell",
    mode: "append-chapter",
    targetWords: 300,
    briefJson: JSON.stringify({ mode: "append-chapter", chapterTitle: "After the Bell" }),
    content: "Mara returned to the archive after the bell, following the same ash-lined aisle.",
    groundingSummary: "Continue from the last chapter without changing established facts.",
    status,
    traceId: "integration-trace",
    createdByUserId: fixture.owner.id,
  });
  return Number(insert[0].insertId);
}

beforeEach(async () => {
  const owner = await createUser("owner");
  const outsider = await createUser("outsider");
  const ownerCaller = callerFor(owner);
  const created = await ownerCaller.projects.create({
    title: `CASPA persistence integration ${Date.now()}`,
    authorName: owner.name || "Author",
    format: "fiction",
    premise: "An archivist follows an erased civic record through a city that quietly removes its own history.",
    targetWordCount: 12000,
  });
  const source = await ownerCaller.projects.saveManuscript({ projectId: created.id, name: "Integration source", content: "# Arrival\n\nMara entered the archive and recorded ash beside the missing index." });
  fixture = { owner, outsider, ownerCaller, outsiderCaller: callerFor(outsider), projectId: created.id, title: created.title, sourceVersionId: source.id };
});

afterEach(async () => {
  const active = fixture;
  fixture = null;
  if (!active) return;
  const db = await getDb();
  try {
    const workspace = await active.ownerCaller.projects.get({ projectId: active.projectId });
    if (workspace.project.currentState !== "archived") await active.ownerCaller.projects.archive({ projectId: active.projectId });
    await active.ownerCaller.settings.deleteProject({ projectId: active.projectId, confirmation: active.title });
  } finally {
    if (db) {
      await db.delete(users).where(eq(users.id, active.outsider.id));
      await db.delete(users).where(eq(users.id, active.owner.id));
    }
  }
});

describe("draft-preview real persistence lifecycle", () => {
  it("persists a rejection without changing the active manuscript version", async () => {
    const previewId = await createPreview();
    const before = await fixture!.ownerCaller.projects.get({ projectId: fixture!.projectId });

    await expect(fixture!.ownerCaller.drafting.reject({ previewId })).resolves.toEqual({ id: previewId, status: "rejected" });

    const after = await fixture!.ownerCaller.projects.get({ projectId: fixture!.projectId });
    const db = await getDb();
    const persisted = await db!.select().from(draftPreviews).where(eq(draftPreviews.id, previewId)).limit(1);
    expect(after.project.activeVersionId).toBe(before.project.activeVersionId);
    expect(persisted[0]?.status).toBe("rejected");
  });

  it("persists one accepted auto-draft version and records preview acceptance", async () => {
    const previewId = await createPreview();

    const version = await fixture!.ownerCaller.drafting.accept({ previewId, authorConfirmed: true });

    const workspace = await fixture!.ownerCaller.projects.get({ projectId: fixture!.projectId });
    const db = await getDb();
    const persisted = await db!.select().from(draftPreviews).where(eq(draftPreviews.id, previewId)).limit(1);
    expect(version.trigger).toBe("auto-draft");
    expect(version.sourceVersionId).toBe(fixture!.sourceVersionId);
    expect(workspace.project.activeVersionId).toBe(version.id);
    expect(workspace.versions.some(item => item.id === version.id && item.trigger === "auto-draft")).toBe(true);
    expect(persisted[0]?.status).toBe("accepted");
    expect(persisted[0]?.acceptedAt).toBeTruthy();
  });

  it("refuses a stale persisted preview without creating another version", async () => {
    const previewId = await createPreview();
    await fixture!.ownerCaller.projects.saveManuscript({ projectId: fixture!.projectId, name: "Changed after preview", content: "# Arrival\n\nMara returned with a different, newly saved fact before approving the preview." });
    const before = await fixture!.ownerCaller.projects.get({ projectId: fixture!.projectId });

    await expect(fixture!.ownerCaller.drafting.accept({ previewId, authorConfirmed: true })).rejects.toThrow(/The manuscript changed after this preview/);

    const after = await fixture!.ownerCaller.projects.get({ projectId: fixture!.projectId });
    const db = await getDb();
    const persisted = await db!.select().from(draftPreviews).where(eq(draftPreviews.id, previewId)).limit(1);
    expect(after.versions).toHaveLength(before.versions.length);
    expect(persisted[0]?.status).toBe("previewed");
  });

  it("denies a different authenticated user access to the persisted preview", async () => {
    const previewId = await createPreview();

    await expect(fixture!.outsiderCaller.drafting.reject({ previewId })).rejects.toThrow(/REQUEST_FAILED\|The draft preview could not be rejected\./);

    const db = await getDb();
    const persisted = await db!.select().from(draftPreviews).where(eq(draftPreviews.id, previewId)).limit(1);
    expect(persisted[0]?.status).toBe("previewed");
  });
});
