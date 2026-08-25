import { describe, expect, it } from "vitest";

import { IMPLEMENTED_MARKETS, PREDICTION_MARKETS } from "./market.js";
import {
  predictionInputSchema,
  type PredictionSelection,
  SELECTION_SCHEMA_BY_MARKET,
  type SelectionFor,
} from "./registry.js";

const VALID_SELECTION: {
  [TMarket in (typeof IMPLEMENTED_MARKETS)[number]]: SelectionFor<TMarket>;
} = {
  EXACT_SCORE: { homeGoals: 2, awayGoals: 1 },
  MATCH_RESULT: { result: "HOME" },
  TOTAL_GOALS: { direction: "OVER", line: 2.5 },
};

describe("the market lists", () => {
  it("keeps every implemented market in the full list", () => {
    expect(PREDICTION_MARKETS).toEqual(expect.arrayContaining([...IMPLEMENTED_MARKETS]));
  });

  it("leaves the markets that ship later out of the implemented list", () => {
    expect(IMPLEMENTED_MARKETS).not.toContain("BOTH_TEAMS_SCORE");
  });
});

describe("SELECTION_SCHEMA_BY_MARKET", () => {
  it("holds a schema for every implemented market and nothing else", () => {
    expect(Object.keys(SELECTION_SCHEMA_BY_MARKET).sort()).toEqual([...IMPLEMENTED_MARKETS].sort());
  });

  it.each([...IMPLEMENTED_MARKETS])("validates a %s selection through the lookup", (market) => {
    const selection: PredictionSelection = VALID_SELECTION[market];

    expect(SELECTION_SCHEMA_BY_MARKET[market].safeParse(selection).success).toBe(true);
  });
});

describe("predictionInputSchema", () => {
  // The union is a second list, and `satisfies` cannot see it. Without this
  // test a market could be registered in the lookup and still be impossible to
  // submit over HTTP.
  it.each([...IMPLEMENTED_MARKETS])("accepts a bet on %s", (market) => {
    const result = predictionInputSchema.safeParse({ market, selection: VALID_SELECTION[market] });

    expect(result.success).toBe(true);
  });

  it("rejects a selection belonging to another market", () => {
    const result = predictionInputSchema.safeParse({
      market: "EXACT_SCORE",
      selection: VALID_SELECTION.MATCH_RESULT,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a market that has no selection schema yet", () => {
    const result = predictionInputSchema.safeParse({
      market: "BOTH_TEAMS_SCORE",
      selection: { value: true },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a bet carrying no market", () => {
    expect(
      predictionInputSchema.safeParse({ selection: VALID_SELECTION.EXACT_SCORE }).success,
    ).toBe(false);
  });
});
