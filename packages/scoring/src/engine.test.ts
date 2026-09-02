import {
  IMPLEMENTED_MARKETS,
  type ImplementedMarket,
  PREDICTION_MARKETS,
} from "@punditfc/contracts";
import { describe, expect, it } from "vitest";

import { scorePrediction } from "./engine.js";
import { DEFAULT_RULESET, type Ruleset } from "./ruleset.js";

const FULL_TIME = { homeGoals: 2, awayGoals: 1 };

/** A hit on every implemented market, against a 2:1 home win. */
const WINNING_SELECTION: Record<ImplementedMarket, unknown> = {
  EXACT_SCORE: { homeGoals: 2, awayGoals: 1 },
  MATCH_RESULT: { result: "HOME" },
  TOTAL_GOALS: { direction: "OVER", line: 2.5 },
};

const LOSING_SELECTION: Record<ImplementedMarket, unknown> = {
  EXACT_SCORE: { homeGoals: 0, awayGoals: 0 },
  MATCH_RESULT: { result: "AWAY" },
  TOTAL_GOALS: { direction: "UNDER", line: 2.5 },
};

// Flat on purpose: a test asserting hit detection should not fail when the
// balance in DEFAULT_RULESET is tuned. See ADR-0005.
const FLAT_RULESET: Ruleset = { EXACT_SCORE: 1, MATCH_RESULT: 1, TOTAL_GOALS: 1 };

describe("scorePrediction, market coverage", () => {
  // Every implemented market must be reachable end to end. Without this, a
  // market could have a schema in the contract and no working strategy behind
  // it, and nothing would notice until a real bet was scored.
  it.each([...IMPLEMENTED_MARKETS])("scores a winning bet on %s", (market) => {
    const outcome = scorePrediction(
      { market, selection: WINNING_SELECTION[market], fullTime: FULL_TIME },
      FLAT_RULESET,
    );

    expect(outcome).toEqual({ status: "SCORED", points: 1, isHit: true });
  });

  it.each([...IMPLEMENTED_MARKETS])("scores a losing bet on %s as zero", (market) => {
    const outcome = scorePrediction(
      { market, selection: LOSING_SELECTION[market], fullTime: FULL_TIME },
      FLAT_RULESET,
    );

    expect(outcome).toEqual({ status: "SCORED", points: 0, isHit: false });
  });
});

describe("scorePrediction, the ruleset", () => {
  it("takes the points from the ruleset it is given", () => {
    const generous: Ruleset = { ...FLAT_RULESET, EXACT_SCORE: 99 };

    const outcome = scorePrediction(
      { market: "EXACT_SCORE", selection: WINNING_SELECTION.EXACT_SCORE, fullTime: FULL_TIME },
      generous,
    );

    expect(outcome).toEqual({ status: "SCORED", points: 99, isHit: true });
  });

  it("awards the shipped value when the default ruleset is passed", () => {
    const outcome = scorePrediction(
      { market: "EXACT_SCORE", selection: WINNING_SELECTION.EXACT_SCORE, fullTime: FULL_TIME },
      DEFAULT_RULESET,
    );

    expect(outcome).toEqual({ status: "SCORED", points: DEFAULT_RULESET.EXACT_SCORE, isHit: true });
  });

  it("prices every implemented market", () => {
    expect(Object.keys(DEFAULT_RULESET).sort()).toEqual([...IMPLEMENTED_MARKETS].sort());
  });
});

describe("scorePrediction, bets it cannot evaluate", () => {
  it.each(["BOTH_TEAMS_SCORE", "HALF_TIME_RESULT", "GOAL_DIFFERENCE"])(
    "skips %s, a market the contract knows but nothing implements",
    (market) => {
      const outcome = scorePrediction(
        { market, selection: { value: true }, fullTime: FULL_TIME },
        FLAT_RULESET,
      );

      expect(outcome).toEqual({ status: "SKIPPED", reason: "UNIMPLEMENTED_MARKET" });
    },
  );

  it.each(["FIRST_SCORER", "exact_score", ""])("skips %s, a market nothing knows", (market) => {
    const outcome = scorePrediction(
      { market, selection: WINNING_SELECTION.EXACT_SCORE, fullTime: FULL_TIME },
      FLAT_RULESET,
    );

    expect(outcome).toEqual({ status: "SKIPPED", reason: "UNKNOWN_MARKET" });
  });

  it.each([
    ["another market's selection", { result: "HOME" }],
    ["a selection missing a side", { homeGoals: 2 }],
    ["a value outside the product bounds", { homeGoals: 99, awayGoals: 1 }],
    ["a bare number", 42],
    ["null", null],
    ["undefined", undefined],
  ])("skips a bet carrying %s", (_case, selection) => {
    const outcome = scorePrediction(
      { market: "EXACT_SCORE", selection, fullTime: FULL_TIME },
      FLAT_RULESET,
    );

    expect(outcome).toEqual({ status: "SKIPPED", reason: "INVALID_SELECTION" });
  });

  it("keeps every unimplemented market inside the contract's list", () => {
    const unimplemented = PREDICTION_MARKETS.filter(
      (market) => !IMPLEMENTED_MARKETS.some((implemented) => implemented === market),
    );

    expect(unimplemented).toEqual(["BOTH_TEAMS_SCORE", "HALF_TIME_RESULT", "GOAL_DIFFERENCE"]);
  });
});

describe("scorePrediction, purity", () => {
  it("returns the same answer for the same arguments", () => {
    const bet = {
      market: "TOTAL_GOALS",
      selection: WINNING_SELECTION.TOTAL_GOALS,
      fullTime: FULL_TIME,
    };

    expect(scorePrediction(bet, DEFAULT_RULESET)).toEqual(scorePrediction(bet, DEFAULT_RULESET));
  });

  it("does not mutate the bet or the ruleset it is given", () => {
    const ruleset: Ruleset = { ...DEFAULT_RULESET };
    const bet = {
      market: "EXACT_SCORE",
      selection: { homeGoals: 2, awayGoals: 1 },
      fullTime: { ...FULL_TIME },
    };

    scorePrediction(bet, ruleset);

    expect(ruleset).toEqual(DEFAULT_RULESET);
    expect(bet.selection).toEqual({ homeGoals: 2, awayGoals: 1 });
    expect(bet.fullTime).toEqual(FULL_TIME);
  });
});
