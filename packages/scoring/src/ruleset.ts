import type { ImplementedMarket } from "@punditfc/contracts";

/**
 * What each market is worth.
 *
 * Passed to the engine as an argument rather than read from a module constant.
 * Two reasons, both from ADR-0005: per-pool rules in v2 become a matter of
 * passing a different object instead of changing signatures, and a test can
 * assert that a hit was detected using a flat ruleset instead of re-asserting
 * the current balance every time it is tuned.
 */
export type Ruleset = Record<ImplementedMarket, number>;

/**
 * The values the game ships with.
 *
 * They are balanced on expected value, not on difficulty: roughly 11% × 10 for
 * the exact score against 50% × 2 for the outcome. Comparable expectation is
 * what makes the choice of market a real decision — what differs is variance,
 * so a member who is behind can swing for an exact score while a member who is
 * ahead plays safe. The naive 5 / 2 / 1 scheme made MATCH_RESULT strictly
 * better and the choice decorative.
 */
export const DEFAULT_RULESET: Ruleset = {
  EXACT_SCORE: 10,
  MATCH_RESULT: 2,
  TOTAL_GOALS: 2,
};
