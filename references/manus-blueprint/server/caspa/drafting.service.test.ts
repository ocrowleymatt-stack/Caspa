import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  preview: null as any,
  project: null as any,
  source: null as any,
  createdVersions: [] as any[],
}));

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.preview ? [state.preview] : [] }) }) }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { Object.assign(state.preview, values); } }) }),
  })),
}));

vi.mock("./repository", () => ({
  CaspaNotFoundError: class CaspaNotFoundError extends Error {},
  requireOwnedProject: vi.fn(async () => state.project),
  requireOwnedVersion: vi.fn(async () => state.source),
  createNamedVersion: vi.fn(async (input: Record<string, unknown>) => {
    state.createdVersions.push(input);
    return { id: 901, ...input };
  }),
}));

import { acceptDraftPreview, rejectDraftPreview } from "./drafting";
import { createNamedVersion } from "./repository";

function reset() {
  state.preview = {
    id: 73,
    projectId: 7,
    sourceVersionId: 11,
    chapterTitle: "After the Bell",
    mode: "append-chapter",
    chapterNumber: null,
    targetWords: 300,
    briefJson: "{}",
    content: "Mara returned to the archive with the bell still ringing in her memory.",
    groundingSummary: "Continue from the last chapter.",
    status: "previewed",
    traceId: "trace-private",
    createdByUserId: 5,
  };
  state.project = { id: 7, ownerId: 5, currentState: "draft", activeVersionId: 11 };
  state.source = { id: 11, content: "# Arrival\n\nMara entered the archive." };
  state.createdVersions = [];
  vi.clearAllMocks();
}

describe("draft-preview persisted lifecycle", () => {
  beforeEach(reset);

  it("rejects a preview without mutating the manuscript or creating a version", async () => {
    const result = await rejectDraftPreview(5, 73);

    expect(result).toEqual({ id: 73, status: "rejected" });
    expect(state.preview.status).toBe("rejected");
    expect(state.source.content).toBe("# Arrival\n\nMara entered the archive.");
    expect(createNamedVersion).not.toHaveBeenCalled();
  });

  it("accepts a current preview by persisting one immutable auto-draft version", async () => {
    const version = await acceptDraftPreview(5, 73);

    expect(version).toMatchObject({ id: 901, trigger: "auto-draft", sourceVersionId: 11 });
    expect(state.preview.status).toBe("accepted");
    expect(createNamedVersion).toHaveBeenCalledTimes(1);
    expect(state.createdVersions[0]).toMatchObject({ projectId: 7, trigger: "auto-draft", sourceVersionId: 11 });
    expect(String(state.createdVersions[0].name)).toMatch(/^CASPA draft · After the Bell · /);
    expect(String(state.createdVersions[0].content)).toContain("# After the Bell");
  });

  it("refuses stale previews before creating a version or changing preview status", async () => {
    state.project.activeVersionId = 12;

    await expect(acceptDraftPreview(5, 73)).rejects.toMatchObject({ message: "The manuscript changed after this preview. Generate a new draft from the current version." });
    expect(state.preview.status).toBe("previewed");
    expect(createNamedVersion).not.toHaveBeenCalled();
  });

  it("refuses a preview when the owner-scoped project lookup does not match its persisted project", async () => {
    state.project.id = 8;

    await expect(rejectDraftPreview(5, 73)).rejects.toThrow("DRAFT_PREVIEW_ACCESS_DENIED");
    expect(state.preview.status).toBe("previewed");
    expect(createNamedVersion).not.toHaveBeenCalled();
  });
});
