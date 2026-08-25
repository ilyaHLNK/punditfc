import { z } from "zod";

/**
 * MATCH_RESULT — "the home side wins".
 *
 * The outcome is read from the full-time score, so a draw is a first-class
 * answer rather than the absence of one.
 */
export const MATCH_RESULTS = ["HOME", "DRAW", "AWAY"] as const;

export const matchResultSchema = z.enum(MATCH_RESULTS);

export type MatchResult = z.infer<typeof matchResultSchema>;

export const matchResultSelectionSchema = z.strictObject({
  result: matchResultSchema,
});

export type MatchResultSelection = z.infer<typeof matchResultSelectionSchema>;
