import { describe, expect, it } from "vitest";

import { MAX_GOALS } from "../match/score.js";
import { exactScoreSelectionSchema } from "./exact-score.js";

describe("exactScoreSelectionSchema", () => {
  it.each([
    ["a home win", { homeGoals: 2, awayGoals: 1 }],
    ["a goalless draw", { homeGoals: 0, awayGoals: 0 }],
    ["a high scoring draw", { homeGoals: 4, awayGoals: 4 }],
    ["the upper bound", { homeGoals: MAX_GOALS, awayGoals: MAX_GOALS }],
  ])("accepts %s", (_case, selection) => {
    expect(exactScoreSelectionSchema.safeParse(selection).success).toBe(true);
  });

  it.each([
    ["a negative score", { homeGoals: -1, awayGoals: 0 }],
    ["half a goal", { homeGoals: 1.5, awayGoals: 0 }],
    ["a score above the bound", { homeGoals: MAX_GOALS + 1, awayGoals: 0 }],
    ["a missing side", { homeGoals: 1 }],
    ["a misspelled key", { homeGoals: 1, awayGols: 0 }],
    ["another market's selection", { result: "HOME" }],
  ])("rejects %s", (_case, selection) => {
    expect(exactScoreSelectionSchema.safeParse(selection).success).toBe(false);
  });
});
