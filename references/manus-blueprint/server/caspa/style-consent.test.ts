import { describe, expect, it } from "vitest";
import { createStyleSample } from "./style";

describe("author-owned style consent", () => {
  it("rejects an unconfirmed sample before storage or profiling", async () => {
    await expect(createStyleSample(1, { name: "Unconfirmed", content: "word ".repeat(100), consentConfirmed: false } as never)).rejects.toThrow(/Confirm that you own or are licensed/);
  });
});
