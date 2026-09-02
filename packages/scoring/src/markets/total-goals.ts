import { totalGoalsSelectionSchema } from "@punditfc/contracts";

import { defineStrategy } from "../strategy.js";

/**
 * TOTAL_GOALS — right when the match total falls on the predicted side of the
 * line.
 *
 * The comparison is strict on both sides, and that is safe rather than
 * careless: the line is always fractional, so a total can never equal it. A
 * whole line would be a push, which a binary market cannot express, and both
 * the contract schema and the CHECK constraint in PostgreSQL refuse one.
 */
export const totalGoalsStrategy = defineStrategy(
  totalGoalsSelectionSchema,
  (selection, fullTime) => {
    const total = fullTime.homeGoals + fullTime.awayGoals;

    return selection.direction === "OVER" ? total > selection.line : total < selection.line;
  },
);
