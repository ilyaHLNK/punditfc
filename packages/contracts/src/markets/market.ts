import { z } from "zod";

/**
 * Every market the database knows about.
 *
 * The list mirrors the `PredictionMarket` enum in `prisma/schema.prisma`, which
 * this package deliberately does not import: contracts is bundled into the
 * browser, and the Prisma client has no business being there. The parity
 * between the two lists is checked at compile time in the API, the one place
 * allowed to see both.
 *
 * It is a zod schema rather than a TypeScript enum on purpose — one declaration
 * gives both the runtime validator and the type.
 */
export const PREDICTION_MARKETS = [
  "EXACT_SCORE",
  "MATCH_RESULT",
  "TOTAL_GOALS",
  "BOTH_TEAMS_SCORE",
  "HALF_TIME_RESULT",
  "GOAL_DIFFERENCE",
] as const;

export const predictionMarketSchema = z.enum(PREDICTION_MARKETS);

export type PredictionMarket = z.infer<typeof predictionMarketSchema>;

/**
 * The markets a member can actually bet on today.
 *
 * The remaining three are modelled in the database and listed above so that a
 * row written by a future release is never unreadable, but they have no
 * selection schema and no scoring strategy yet (ADR-0005). A bet on one of them
 * therefore fails validation at the edge instead of reaching a scoring engine
 * that cannot evaluate it.
 */
export const IMPLEMENTED_MARKETS = ["EXACT_SCORE", "MATCH_RESULT", "TOTAL_GOALS"] as const;

export const implementedMarketSchema = z.enum(IMPLEMENTED_MARKETS);

export type ImplementedMarket = z.infer<typeof implementedMarketSchema>;
