import { z } from "zod";

import { exactScoreSelectionSchema } from "./exact-score.js";
import type { ImplementedMarket } from "./market.js";
import { matchResultSelectionSchema } from "./match-result.js";
import { totalGoalsSelectionSchema } from "./total-goals.js";

/**
 * The single registration point for a market.
 *
 * Adding one means writing its selection schema in its own file and naming it
 * twice here — once in the lookup, once in the union. `satisfies` makes the
 * first of those mandatory: a market listed in IMPLEMENTED_MARKETS but missing
 * from this object fails the build (ADR-0005).
 */
export const SELECTION_SCHEMA_BY_MARKET = {
  EXACT_SCORE: exactScoreSelectionSchema,
  MATCH_RESULT: matchResultSelectionSchema,
  TOTAL_GOALS: totalGoalsSelectionSchema,
} satisfies Record<ImplementedMarket, z.ZodType>;

export type SelectionFor<TMarket extends ImplementedMarket> = z.infer<
  (typeof SELECTION_SCHEMA_BY_MARKET)[TMarket]
>;

export type PredictionSelection = {
  [TMarket in ImplementedMarket]: SelectionFor<TMarket>;
}[ImplementedMarket];

/**
 * What a member sends when placing a bet.
 *
 * The two shapes exist for two different callers. The scoring engine reads
 * `market` and `selection` from separate database columns and looks the schema
 * up by market, so it needs the lookup above. An HTTP request carries both at
 * once, so it needs this union — zod picks the branch by `market` and narrows
 * `selection` to the matching type, which no lookup can do on its own.
 */
export const predictionInputSchema = z.discriminatedUnion("market", [
  z.strictObject({
    market: z.literal("EXACT_SCORE"),
    selection: exactScoreSelectionSchema,
  }),
  z.strictObject({
    market: z.literal("MATCH_RESULT"),
    selection: matchResultSelectionSchema,
  }),
  z.strictObject({
    market: z.literal("TOTAL_GOALS"),
    selection: totalGoalsSelectionSchema,
  }),
]);

export type PredictionInput = z.infer<typeof predictionInputSchema>;
