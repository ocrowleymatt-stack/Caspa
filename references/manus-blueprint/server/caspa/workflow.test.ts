import { describe, expect, it } from "vitest";
import { canPerformAction, canTransition, nextGuidedAction, PROJECT_STATE_ORDER } from "../../shared/workflow";

describe("canonical project workflow", () => {
  it("keeps the required state order", () => {
    expect(PROJECT_STATE_ORDER).toEqual(["draft", "diagnosed", "plan-approved", "revision-running", "review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready", "archived"]);
  });

  it("allows the forward authoring transitions", () => {
    expect(canTransition("draft", "diagnosed")).toBe(true);
    expect(canTransition("diagnosed", "plan-approved")).toBe(true);
    expect(canTransition("plan-approved", "revision-running")).toBe(true);
    expect(canTransition("revision-running", "review")).toBe(true);
    expect(canTransition("review", "export-ready")).toBe(true);
    expect(canTransition("export-ready", "archived")).toBe(true);
  });

  it("blocks skipped and reversed workflow steps", () => {
    expect(canTransition("draft", "export-ready")).toBe(false);
    expect(canTransition("review", "diagnosed")).toBe(false);
    expect(canTransition("export-ready", "draft")).toBe(false);
  });

  it("derives gated actions and the guided next action from state", () => {
    expect(canPerformAction("draft", "run-diagnosis")).toBe(true);
    expect(canPerformAction("draft", "download-export")).toBe(false);
    expect(canPerformAction("review", "run-preflight")).toBe(true);
    expect(nextGuidedAction("diagnosed")).toBe("approve-plan");
    expect(nextGuidedAction("export-ready")).toBe("start-art-direction");
  });
});
