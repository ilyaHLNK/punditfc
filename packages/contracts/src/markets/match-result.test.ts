import { describe, expect, it } from "vitest";

import { MATCH_RESULTS, matchResultSelectionSchema } from "./match-result.js";

describe("matchResultSelectionSchema", () => {
  it.each([...MATCH_RESULTS])("accepts %s", (result) => {
    expect(matchResultSelectionSchema.safeParse({ result }).success).toBe(true);
  });

  it("treats a draw as an answer of its own", () => {
    expect(MATCH_RESULTS).toContain("DRAW");
  });

  it.each([
    ["the wrong case", { result: "home" }],
    ["an unknown outcome", { result: "PENALTIES" }],
    ["no answer at all", {}],
    ["an unexpected key", { result: "HOME", confidence: 3 }],
  ])("rejects %s", (_case, selection) => {
    expect(matchResultSelectionSchema.safeParse(selection).success).toBe(false);
  });
});
