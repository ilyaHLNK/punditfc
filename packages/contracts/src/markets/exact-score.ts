import { z } from "zod";

import { goalCountSchema } from "../match/score.js";

/**
 * EXACT_SCORE — "the match ends 2:1".
 *
 * The high-variance market: rarely right, worth ten points. See the expected
 * value table in ADR-0005 for why the points are what they are.
 */
export const exactScoreSelectionSchema = z.strictObject({
  homeGoals: goalCountSchema,
  awayGoals: goalCountSchema,
});

export type ExactScoreSelection = z.infer<typeof exactScoreSelectionSchema>;
