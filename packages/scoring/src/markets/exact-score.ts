import { exactScoreSelectionSchema } from "@punditfc/contracts";

import { defineStrategy } from "../strategy.js";

/**
 * EXACT_SCORE — right only when both numbers match.
 *
 * The high-variance market: hit roughly one time in nine, worth ten points.
 */
export const exactScoreStrategy = defineStrategy(
  exactScoreSelectionSchema,
  (selection, fullTime) =>
    selection.homeGoals === fullTime.homeGoals && selection.awayGoals === fullTime.awayGoals,
);
