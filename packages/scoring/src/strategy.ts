import type { MatchScore } from "@punditfc/contracts";

/**
 * What a strategy answers.
 *
 * `INVALID_SELECTION` is a result rather than an exception. The selection comes
 * out of a JSON column: the CHECK constraint guarantees its shape, but not the
 * product bounds, and a row written by an older release is still a row this
 * code has to survive. One corrupt row must not abort scoring for every member
 * of every pool.
 */
export type Evaluation =
  | { readonly status: "EVALUATED"; readonly isHit: boolean }
  | { readonly status: "INVALID_SELECTION" };

/**
 * Just enough of a zod schema to parse with.
 *
 * Declared structurally rather than imported from zod, so this package depends
 * on `@punditfc/contracts` and nothing else. A zod schema satisfies it as it
 * is, and the day a schema is built differently, only this type changes.
 */
interface SelectionParser<TSelection> {
  safeParse: (value: unknown) => { success: true; data: TSelection } | { success: false };
}

export interface MarketStrategy {
  readonly evaluate: (selection: unknown, fullTime: MatchScore) => Evaluation;
}

/**
 * Binds a market's schema to its rule.
 *
 * The selection type is captured here and erased from `MarketStrategy`, which
 * is what lets the registry hold three strategies with three different
 * selection shapes in one object without a cast. Inside each market file the
 * rule stays fully typed: it receives a parsed selection, never `unknown`.
 *
 * Note what a strategy does not have: a point value. Points come from the
 * `Ruleset` the caller passes, so a strategy answers only "is this bet right?".
 * ADR-0005 sketched `points` as a field on the strategy, which would make the
 * balance a property of the code rather than an argument.
 */
export const defineStrategy = <TSelection>(
  schema: SelectionParser<TSelection>,
  isHit: (selection: TSelection, fullTime: MatchScore) => boolean,
): MarketStrategy => ({
  evaluate: (selection, fullTime) => {
    const parsed = schema.safeParse(selection);

    if (!parsed.success) {
      return { status: "INVALID_SELECTION" };
    }

    return { status: "EVALUATED", isHit: isHit(parsed.data, fullTime) };
  },
});
