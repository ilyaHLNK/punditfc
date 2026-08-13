# ADR-0005 — Prediction markets

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

A single prediction type (exact score) makes the game thin. Members want
variety: outcome, totals, both teams to score, and so on.

Two hard constraints shape what is possible:

1. **Available data.** The football-data.org free tier returns fixtures,
   standings, half-time and full-time scores. No match events, no line-ups, no
   statistics. Any market that cannot be derived from those two scores is not
   implementable, which rules out "first team to score", scorers, cards and
   corners.
2. **Time.** The MVP ships in four weeks.

## Decision

**Markets are modelled as `market` + `selection` on `Prediction`.**

```prisma
market    PredictionMarket
selection Json
```

Six markets are defined in the enum; three are implemented in v1:

| Market | Selection | Points | v1 |
| --- | --- | --- | --- |
| `EXACT_SCORE` | `{ homeGoals, awayGoals }` | 10 | yes |
| `MATCH_RESULT` | `{ result: HOME \| DRAW \| AWAY }` | 2 | yes |
| `TOTAL_GOALS` | `{ direction: OVER \| UNDER, line: 2.5 }` | 2 | yes |
| `BOTH_TEAMS_SCORE` | `{ value: boolean }` | 2 | later |
| `HALF_TIME_RESULT` | `{ result: HOME \| DRAW \| AWAY }` | 3 | later |
| `GOAL_DIFFERENCE` | `{ margin: number }` | 4 | later |

**Markets are binary.** A selection is either right or wrong, and each market
carries its own point value. The earlier graded scheme (5 for the exact score,
3 for the goal difference, 2 for the outcome from a single prediction) is
dropped, because with `MATCH_RESULT` as its own market it would award points
twice for the same insight.

**One bet per match.** A member picks a match and answers exactly one question
about it. Enforced by `UNIQUE (pool_id, user_id, match_id)` — the market is a
column, not part of the key.

**Point values are balanced on expected value.** With the naive 5 / 2 / 1
scheme, `MATCH_RESULT` dominated: roughly 50% × 2 = 1.0 expected points against
11% × 5 = 0.55 for the exact score, so a rational player would never choose
anything else and the "choice" would be decorative. Values are set so expected
value is comparable and **variance** is what differs:

| Market | Rough hit rate | Points | Expected |
| --- | --- | --- | --- |
| Exact score | ~11% | 10 | 1.10 |
| Match result | ~50% | 2 | 1.00 |
| Total goals | ~55% | 2 | 1.10 |

The exact score becomes the high-variance option: rarely right, worth a lot.
That gives the game a real decision — play safe while leading, swing for exact
scores while chasing. Hit rates are estimates from general football statistics
and should be recalculated from real prediction data once enough has
accumulated (listed under future improvements).

**No odds.** Odds are a bookmaker's instrument: they encode probability and
margin, and would need either a data feed or a pricing model. Neither exists
here, and the product deliberately stays away from anything resembling
gambling. Variety comes from the number of markets and their different point
values, not from coefficients.

## Why `selection` is JSON rather than typed columns

Alternatives considered:

- **Nullable columns per market** (`homeGoals`, `awayGoals`, `result`,
  `direction`, …) — every row would carry mostly nulls, and adding a market
  would mean a migration on a hot table. The database could not enforce which
  combination is valid anyway.
- **A table per market** — correct in the strictest sense, but six tables, six
  repositories and six join paths for what is one concept.
- **`market` + JSON selection** — chosen. One table, one write path, and adding
  a market touches no existing rows.

The honest trade-off: the database does not guarantee the shape of `selection`.
That guarantee moves to the boundary — a zod schema per market in
`packages/contracts`, applied on the API edge and reused by the frontend form.
This is a deliberate move of an invariant from the storage layer to the
validation layer, and it is the one place in the project where that happens.

## Consequences for the scoring engine

The engine becomes a registry of strategies rather than one branching function:

```ts
type MarketStrategy<S> = {
  market: PredictionMarket;
  points: number;
  schema: ZodType<S>;
  evaluate(selection: S, result: MatchResult): boolean;
};
```

- Each strategy is a pure function of `(selection, finalScore, halfTimeScore)`.
- Unit tests need no database.
- Adding a market means adding one file and registering it — no existing code
  changes. Open for extension, closed for modification.

## Related decision: optional predictions and pick quotas

With four competitions a gameweek holds roughly 35 matches. Requiring a
prediction for every match would make the product unusable.

- **Predictions are optional.** Fewer than the quota, or none, is allowed; a
  missing prediction simply scores nothing.
- **Pools cap picks per gameweek** via `Pool.maxPicksPerGameweek`, default 3.
  Combined with one bet per match, a member places at most three bets a week.

Enforcing the quota is the one place in the project with a genuine concurrency
problem, and it ships in v1 rather than later. It cannot be expressed as a
unique constraint: "how many matches has this member picked this gameweek" is a
count over a date range, not a property of a row. Two concurrent requests both
read 2 and both insert, and the member ends up with 4 bets against a limit of 3.
The count and the insert therefore have to happen in one transaction at an
isolation level that prevents the phantom read.
