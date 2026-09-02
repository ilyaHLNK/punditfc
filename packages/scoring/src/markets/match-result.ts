import { type MatchResult, matchResultSelectionSchema, type MatchScore } from "@punditfc/contracts";

import { defineStrategy } from "../strategy.js";

/**
 * The outcome of a match, derived from the full-time score.
 *
 * Stoppage time is already included there, and extra time does not occur in
 * league football — a knockout competition would force this to be revisited
 * (ADR-0005).
 */
export const resultOf = ({ homeGoals, awayGoals }: MatchScore): MatchResult => {
  if (homeGoals > awayGoals) {
    return "HOME";
  }

  if (homeGoals < awayGoals) {
    return "AWAY";
  }

  return "DRAW";
};

/** MATCH_RESULT — right when the predicted outcome is the one that happened. */
export const matchResultStrategy = defineStrategy(
  matchResultSelectionSchema,
  (selection, fullTime) => selection.result === resultOf(fullTime),
);
