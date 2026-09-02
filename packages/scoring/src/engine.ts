import {
  implementedMarketSchema,
  type MatchScore,
  predictionMarketSchema,
} from "@punditfc/contracts";

import { STRATEGY_BY_MARKET } from "./markets/registry.js";
import type { ScoringOutcome } from "./outcome.js";
import type { Ruleset } from "./ruleset.js";

/**
 * A bet as it comes out of the database.
 *
 * `market` is a string rather than the union on purpose. The column holds an
 * enum, but a row can name a market this build does not know: a rolled-back
 * release leaves rows behind, and during a deploy the API and the worker run
 * different versions for a few minutes. A type that promises otherwise would be
 * lying about the data.
 *
 * `selection` is `unknown` for the same reason, one layer deeper — the shape is
 * constrained in PostgreSQL, the product bounds are not, and an older release
 * may have written values this one no longer accepts.
 *
 * `fullTime` is trusted. It comes from two integer columns the database fully
 * constrains, so re-validating it would check something already guaranteed.
 */
export interface ScorableBet {
  readonly market: string;
  readonly selection: unknown;
  readonly fullTime: MatchScore;
}

/**
 * Scores one bet. Pure: no database, no clock, no logger, no randomness.
 *
 * Every failure is a returned value. The caller — the worker — is the one with
 * the prediction id, the job and the attempt number, so it is the one that can
 * write a log line worth reading.
 */
export const scorePrediction = (bet: ScorableBet, ruleset: Ruleset): ScoringOutcome => {
  const known = predictionMarketSchema.safeParse(bet.market);

  if (!known.success) {
    return { status: "SKIPPED", reason: "UNKNOWN_MARKET" };
  }

  const implemented = implementedMarketSchema.safeParse(known.data);

  if (!implemented.success) {
    return { status: "SKIPPED", reason: "UNIMPLEMENTED_MARKET" };
  }

  const market = implemented.data;
  const evaluation = STRATEGY_BY_MARKET[market].evaluate(bet.selection, bet.fullTime);

  if (evaluation.status === "INVALID_SELECTION") {
    return { status: "SKIPPED", reason: "INVALID_SELECTION" };
  }

  // A miss is a result, not a failure: zero points, and a row worth storing.
  return {
    status: "SCORED",
    points: evaluation.isHit ? ruleset[market] : 0,
    isHit: evaluation.isHit,
  };
};
