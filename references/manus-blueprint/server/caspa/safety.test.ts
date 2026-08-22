import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { CaspaServiceError, toSafeTrpcError } from "./errors";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("author-facing safety boundaries", () => {
  it("does not expose the framework system router to clients", () => {
    expect(Object.keys(appRouter._def.record)).not.toContain("system");
  });

  it("rejects anonymous access before any ownership-scoped project query runs", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.projects.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.drafting.latest({ projectId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.production.workspace({ projectId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.production.generatePackage({ projectId: 1, authorConfirmed: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns only stable error code, recovery message, and trace ID for known AI errors", () => {
    expect(() => toSafeTrpcError(new CaspaServiceError("AI_TEMPORARILY_UNAVAILABLE", "Try again from the saved checkpoint.", "trace-safe"))).toThrowError(/AI_TEMPORARILY_UNAVAILABLE\|Try again from the saved checkpoint\.\|trace-safe/);
    expect(() => toSafeTrpcError(new CaspaServiceError("AI_RESPONSE_INVALID", "CASPA withheld this draft safely.", "trace-draft"))).toThrowError(/AI_RESPONSE_INVALID\|CASPA withheld this draft safely\.\|trace-draft/);
  });

  it("never exposes raw provider, key, endpoint, or environment diagnostics for unknown failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let message = "";
    try { toSafeTrpcError(new Error("OPENAI_API_KEY missing at https://provider.internal/v1")); } catch (error) { message = error instanceof Error ? error.message : String(error); }
    expect(message).toContain("REQUEST_FAILED|");
    expect(message).not.toContain("OPENAI_API_KEY");
    expect(message).not.toContain("provider.internal");
    log.mockRestore();
  });
});
