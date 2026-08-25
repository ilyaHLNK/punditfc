import { z } from "zod";

/**
 * TOTAL_GOALS — "more than 2.5 goals in this match".
 *
 * The line is stored with the selection rather than hardcoded, so offering 1.5
 * or 3.5 later needs no migration and leaves existing bets meaning what they
 * meant when they were placed (ADR-0005).
 */
export const TOTAL_GOALS_DIRECTIONS = ["OVER", "UNDER"] as const;

export const totalGoalsDirectionSchema = z.enum(TOTAL_GOALS_DIRECTIONS);

export type TotalGoalsDirection = z.infer<typeof totalGoalsDirectionSchema>;

export const MIN_TOTAL_GOALS_LINE = 0.5;
export const MAX_TOTAL_GOALS_LINE = 9.5;

/**
 * The line has to fall between whole numbers.
 *
 * With a whole line the total can land exactly on it — three goals against a
 * line of three is neither over nor under. In betting that is a push, and a
 * market whose answer is either right or wrong has no way to express one:
 * there is no third state in `PredictionScore` and no third branch in the
 * scoring engine. ADR-0005 states this in prose; the constraint is what makes
 * it true.
 */
const isHalfStep = (line: number): boolean => Number.isInteger(line * 2) && !Number.isInteger(line);

export const totalGoalsLineSchema = z
  .number()
  .min(MIN_TOTAL_GOALS_LINE)
  .max(MAX_TOTAL_GOALS_LINE)
  .refine(isHalfStep, {
    message: "Line must fall between whole numbers (1.5, 2.5, 3.5, …) so a match cannot land on it",
  });

export const totalGoalsSelectionSchema = z.strictObject({
  direction: totalGoalsDirectionSchema,
  line: totalGoalsLineSchema,
});

export type TotalGoalsSelection = z.infer<typeof totalGoalsSelectionSchema>;
