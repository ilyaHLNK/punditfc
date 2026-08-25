import { describe, expect, it } from "vitest";

import { goalCountSchema, matchScoreSchema, MAX_GOALS } from "./score.js";

describe("goalCountSchema", () => {
  it.each([0, 1, 9, MAX_GOALS])("accepts %i goals", (goals) => {
    expect(goalCountSchema.safeParse(goals).success).toBe(true);
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["above the bound", MAX_GOALS + 1],
  ])("rejects a %s value", (_reason, goals) => {
    expect(goalCountSchema.safeParse(goals).success).toBe(false);
  });

  it.each([
    ["a numeric string", "2"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_reason, value) => {
    expect(goalCountSchema.safeParse(value).success).toBe(false);
  });
});

describe("matchScoreSchema", () => {
  it("accepts a goalless draw", () => {
    expect(matchScoreSchema.safeParse({ homeGoals: 0, awayGoals: 0 }).success).toBe(true);
  });

  it("rejects a score missing a side", () => {
    expect(matchScoreSchema.safeParse({ homeGoals: 1 }).success).toBe(false);
  });

  it("rejects an unexpected key rather than stripping it", () => {
    const result = matchScoreSchema.safeParse({ homeGoals: 1, awayGoals: 0, extraTime: 0 });

    expect(result.success).toBe(false);
  });
});
