import { describe, expect, it } from "vitest";

import { totalGoalsStrategy } from "./total-goals.js";

const evaluate = (selection: unknown, homeGoals: number, awayGoals: number) =>
  totalGoalsStrategy.evaluate(selection, { homeGoals, awayGoals });

describe("totalGoalsStrategy", () => {
  // The line is always fractional, so the total falls on one side or the other
  // and a push cannot happen. These cases sit either side of 2.5.
  it.each([
    ["OVER 2.5 with three goals", { direction: "OVER", line: 2.5 }, 2, 1, true],
    ["OVER 2.5 with two goals", { direction: "OVER", line: 2.5 }, 1, 1, false],
    ["UNDER 2.5 with two goals", { direction: "UNDER", line: 2.5 }, 2, 0, true],
    ["UNDER 2.5 with three goals", { direction: "UNDER", line: 2.5 }, 3, 0, false],
    ["OVER 0.5 with a goalless draw", { direction: "OVER", line: 0.5 }, 0, 0, false],
    ["UNDER 0.5 with a goalless draw", { direction: "UNDER", line: 0.5 }, 0, 0, true],
    ["OVER 3.5 with a rout", { direction: "OVER", line: 3.5 }, 5, 1, true],
  ])("evaluates %s", (_case, selection, homeGoals, awayGoals, isHit) => {
    expect(evaluate(selection, homeGoals, awayGoals)).toEqual({ status: "EVALUATED", isHit });
  });

  it("counts goals from both sides, not only the home side", () => {
    expect(evaluate({ direction: "OVER", line: 2.5 }, 0, 3)).toEqual({
      status: "EVALUATED",
      isHit: true,
    });
  });

  it.each([
    ["a whole line", { direction: "OVER", line: 3 }],
    ["a quarter line", { direction: "OVER", line: 2.25 }],
    ["a line outside the offered range", { direction: "OVER", line: 12.5 }],
    ["an unknown direction", { direction: "EXACTLY", line: 2.5 }],
    ["a missing line", { direction: "OVER" }],
    ["another market's selection", { result: "HOME" }],
  ])("reports %s as invalid", (_case, selection) => {
    expect(evaluate(selection, 2, 1)).toEqual({ status: "INVALID_SELECTION" });
  });
});
