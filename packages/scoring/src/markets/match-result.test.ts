import { describe, expect, it } from "vitest";

import { matchResultStrategy, resultOf } from "./match-result.js";

const evaluate = (selection: unknown, homeGoals: number, awayGoals: number) =>
  matchResultStrategy.evaluate(selection, { homeGoals, awayGoals });

describe("resultOf", () => {
  it.each([
    ["HOME", 2, 1],
    ["HOME", 1, 0],
    ["AWAY", 0, 1],
    ["AWAY", 1, 3],
    ["DRAW", 0, 0],
    ["DRAW", 2, 2],
  ])("reads %s from %i:%i", (result, homeGoals, awayGoals) => {
    expect(resultOf({ homeGoals, awayGoals })).toBe(result);
  });
});

describe("matchResultStrategy", () => {
  it.each([
    ["HOME", 2, 1],
    ["DRAW", 1, 1],
    ["AWAY", 0, 2],
  ])("hits when %s was predicted and happened", (result, homeGoals, awayGoals) => {
    expect(evaluate({ result }, homeGoals, awayGoals)).toEqual({
      status: "EVALUATED",
      isHit: true,
    });
  });

  it.each([
    ["HOME", 1, 1],
    ["HOME", 0, 1],
    ["DRAW", 2, 1],
    ["AWAY", 2, 1],
  ])("misses when %s was predicted and %i:%i happened", (result, homeGoals, awayGoals) => {
    expect(evaluate({ result }, homeGoals, awayGoals)).toEqual({
      status: "EVALUATED",
      isHit: false,
    });
  });

  it.each([
    ["the wrong case", { result: "home" }],
    ["an unknown outcome", { result: "PENALTIES" }],
    ["another market's selection", { homeGoals: 2, awayGoals: 1 }],
    ["an empty object", {}],
  ])("reports %s as invalid", (_case, selection) => {
    expect(evaluate(selection, 2, 1)).toEqual({ status: "INVALID_SELECTION" });
  });
});
