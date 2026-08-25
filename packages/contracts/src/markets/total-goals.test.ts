import { describe, expect, it } from "vitest";

import {
  MAX_TOTAL_GOALS_LINE,
  MIN_TOTAL_GOALS_LINE,
  totalGoalsSelectionSchema,
} from "./total-goals.js";

describe("totalGoalsSelectionSchema", () => {
  it.each([
    ["the usual line", { direction: "OVER", line: 2.5 }],
    ["the other direction", { direction: "UNDER", line: 2.5 }],
    ["a line we do not offer yet", { direction: "OVER", line: 3.5 }],
    ["the lower bound", { direction: "UNDER", line: MIN_TOTAL_GOALS_LINE }],
    ["the upper bound", { direction: "OVER", line: MAX_TOTAL_GOALS_LINE }],
  ])("accepts %s", (_case, selection) => {
    expect(totalGoalsSelectionSchema.safeParse(selection).success).toBe(true);
  });

  // A whole line can be matched exactly by the total, which is a push, and a
  // market that is either right or wrong cannot express one. See ADR-0005.
  it.each([0, 1, 2, 3, 10])("rejects the whole line %i", (line) => {
    expect(totalGoalsSelectionSchema.safeParse({ direction: "OVER", line }).success).toBe(false);
  });

  it("explains why a whole line is refused", () => {
    const result = totalGoalsSelectionSchema.safeParse({ direction: "OVER", line: 3 });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("between whole numbers");
    }
  });

  it.each([
    ["a quarter line", { direction: "OVER", line: 2.25 }],
    ["a line below the bound", { direction: "OVER", line: MIN_TOTAL_GOALS_LINE - 1 }],
    ["a line above the bound", { direction: "OVER", line: MAX_TOTAL_GOALS_LINE + 1 }],
    ["an unknown direction", { direction: "EXACTLY", line: 2.5 }],
    ["a missing line", { direction: "OVER" }],
    ["a line as a string", { direction: "OVER", line: "2.5" }],
    ["an unexpected key", { direction: "OVER", line: 2.5, odds: 1.9 }],
  ])("rejects %s", (_case, selection) => {
    expect(totalGoalsSelectionSchema.safeParse(selection).success).toBe(false);
  });
});
