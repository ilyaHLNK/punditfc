import { z } from "zod";

/**
 * A scoreline is never negative and never fractional, and no football match has
 * come close to this many goals — the record in the Premier League is nine.
 *
 * The upper bound exists because `selection` is stored in a JSON column, which
 * accepts anything: without it, `{ homeGoals: 1e9 }` is a valid prediction as
 * far as the database is concerned. ADR-0005 moved this invariant from the
 * storage layer to the validation layer deliberately, so the bound here is the
 * invariant, not a formality.
 */
export const MAX_GOALS = 20;

export const goalCountSchema = z.number().int().min(0).max(MAX_GOALS);

/**
 * The goals scored in one half or over the full match.
 *
 * Scoring reads the full-time score, which already includes stoppage time.
 * Extra time does not occur in league football; a knockout competition would
 * force this decision to be revisited (ADR-0005).
 */
export const matchScoreSchema = z.strictObject({
  homeGoals: goalCountSchema,
  awayGoals: goalCountSchema,
});

export type MatchScore = z.infer<typeof matchScoreSchema>;
