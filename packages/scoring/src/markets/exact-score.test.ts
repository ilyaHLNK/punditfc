import { describe, expect, it } from "vitest";

import { exactScoreStrategy } from "./exact-score.js";

const evaluate = (selection: unknown, homeGoals: number, awayGoals: number) =>
  exactScoreStrategy.evaluate(selection, { homeGoals, awayGoals });

describe("exactScoreStrategy", () => {
  it.each([
    ["a home win called exactly", { homeGoals: 2, awayGoals: 1 }, 2, 1],
    ["a goalless draw", { homeGoals: 0, awayGoals: 0 }, 0, 0],
    ["a rout", { homeGoals: 7, awayGoals: 0 }, 7, 0],
  ])("hits on %s", (_case, selection, homeGoals, awayGoals) => {
    expect(evaluate(selection, homeGoals, awayGoals)).toEqual({ status: "EVALUATED", isHit: true });
  });

  it.each([
    ["the home goals are wrong", { homeGoals: 3, awayGoals: 1 }, 2, 1],
    ["the away goals are wrong", { homeGoals: 2, awayGoals: 0 }, 2, 1],
    ["the right result with the wrong score", { homeGoals: 3, awayGoals: 0 }, 2, 1],
    ["the score is the other way round", { homeGoals: 1, awayGoals: 2 }, 2, 1],
  ])("misses when %s", (_case, selection, homeGoals, awayGoals) => {
    expect(evaluate(selection, homeGoals, awayGoals)).toEqual({
      status: "EVALUATED",
      isHit: false,
    });
  });

  it.each([
    ["a selection missing a side", { homeGoals: 2 }],
    ["another market's selection", { result: "HOME" }],
    ["a score above the product bound", { homeGoals: 99, awayGoals: 0 }],
    ["a bare number", 42],
    ["null", null],
  ])("reports %s as invalid", (_case, selection) => {
    expect(evaluate(selection, 2, 1)).toEqual({ status: "INVALID_SELECTION" });
  });
});
