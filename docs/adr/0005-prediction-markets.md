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

| Market             | Selection                                 | Points | v1    |
| ------------------ | ----------------------------------------- | ------ | ----- |
| `EXACT_SCORE`      | `{ homeGoals, awayGoals }`                | 10     | yes   |
| `MATCH_RESULT`     | `{ result: HOME \| DRAW \| AWAY }`        | 2      | yes   |
| `TOTAL_GOALS`      | `{ direction: OVER \| UNDER, line: 2.5 }` | 2      | yes   |
| `BOTH_TEAMS_SCORE` | `{ value: boolean }`                      | 2      | later |
| `HALF_TIME_RESULT` | `{ result: HOME \| DRAW \| AWAY }`        | 3      | later |
| `GOAL_DIFFERENCE`  | `{ margin: number }`                      | 4      | later |

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

| Market       | Rough hit rate | Points | Expected |
| ------------ | -------------- | ------ | -------- |
| Exact score  | ~11%           | 10     | 1.10     |
| Match result | ~50%           | 2      | 1.00     |
| Total goals  | ~55%           | 2      | 1.10     |

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

The trade-off this was originally willing to accept: the database does not
guarantee the shape of `selection`, so that guarantee moves to the boundary — a
zod schema per market in `packages/contracts`, applied on the API edge and
reused by the frontend form.

That was too generous. The next section records the correction.

## Correction: the shape of `selection` is constrained in the database

- **Amended:** 2026-09-01

The paragraph above claimed the shape of `selection` could safely live in the
validation layer. It cannot, because the API is not the only writer. The seed
script, a backfill, `psql` during debugging and a controller that forgets its
validation pipe all reach the same column, and `jsonb` accepts anything at all —
an object with the wrong keys, a bare number, a string.

Validation in a controller protects that controller. A constraint protects the
data. A `CHECK` constraint on `predictions` therefore ties the shape of
`selection` to the value of `market`, and the invariant returns to storage where
rule 2 in `CLAUDE.md` puts it.

**The split, stated precisely.**

| Layer                       | Rejects                                                                                                        | Because                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `CHECK` in PostgreSQL       | missing or unexpected keys, wrong types, negative or fractional goals, an unknown outcome, a whole totals line | none of these can ever be a valid bet, and no writer may create one                        |
| zod in `packages/contracts` | more than 20 goals, a line outside 0.5–9.5                                                                     | product decisions we may tune, which deserve a readable message rather than SQLSTATE 23514 |

The whole totals line sits on the database side of that line deliberately. A
match landing exactly on it is a push, and a binary market has no third state to
record one — the row would be unanswerable rather than merely generous.

**What it costs.** Adding a market now requires a migration, which the section
above counted as an advantage of JSON. That is the price of the guarantee, and
it is small: implementing a market already means writing its zod schema and its
scoring strategy, so a third file joins the same pull request. No existing rows
are touched.

**Mechanics worth recording.**

- Prisma cannot express `CHECK` in `schema.prisma`. The SQL is hand-written into
  an empty migration created with `prisma migrate dev --create-only`. Prisma
  ignores what it cannot model, so the constraint survives later migrations —
  verified by re-running `migrate dev` and confirming it proposes nothing.
- The branches are nested `CASE` expressions, not one `AND` chain. PostgreSQL
  does not promise to evaluate `AND` operands left to right, and `CASE` never
  evaluates a branch it does not need — without that, deleting a key from a bare
  number would raise a type error instead of failing the check.
- Missing keys must be rejected explicitly with `?` and `?&`. `jsonb_typeof` of
  an absent key returns NULL rather than a type name, a comparison against NULL
  yields NULL rather than false, and a `CHECK` whose expression is NULL admits
  the row. The first version of this constraint accepted `{"homeGoals": 1}` for
  exactly that reason, and the omission was found by trying it.
- The table was empty, so the constraint was added in one step. On a populated
  table this is `ADD CONSTRAINT … NOT VALID` followed by `VALIDATE CONSTRAINT`,
  which checks existing rows without holding a lock for the length of a scan.
- A market with no selection schema cannot be written at all: the `ELSE` branch
  is `false`.

**Not yet tested automatically.** The constraint was verified by hand with 28
inserts inside a rolled-back transaction. An automated test needs a real
PostgreSQL, and the Testcontainers harness that ADR-0007 calls for arrives with
the predictions endpoint, where the deadline and the pick quota need it too.

## Void and postponed matches

A bet occupies one of the member's picks for the gameweek, so a match that never
happens must not silently cost them a slot.

- `CANCELLED` — the bet is voided, its `PredictionScore` row is deleted, and the
  slot returns to that gameweek's quota.
- `POSTPONED` — the bet travels with the match to its new date. The slot in the
  original gameweek is released, and the bet counts against the quota of the
  gameweek the match moves into, leaving the member two free picks there.

The second rule is the more complex of the two and was chosen deliberately: a
member who predicted a fixture should still be judged on it when it is finally
played, and losing a slot in a week they had no control over would feel
arbitrary.

## The totals line is stored, not hardcoded

`TOTAL_GOALS` stores `{ direction, line }` even though the UI offers only 2.5 in
v1. Adding 1.5 or 3.5 later then requires no migration.

The line is deliberately fractional: with a whole number the result could land
exactly on it, which in betting terms is a push, and a binary market has no way
to express one.

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

**Point values are an argument, not a module constant.** The engine takes a
`Ruleset` (a map of market to points) as a parameter. This keeps per-pool rules
in v2 a matter of passing a different object rather than changing signatures, and
it lets tests assert hit detection with a flat ruleset instead of re-asserting
the current balance every time it is tuned.

**An unknown market is skipped, not thrown.** A single unrecognised row must not
abort scoring for every member of every pool. This can genuinely happen: a
rolled-back release leaves rows for a market the running code no longer knows,
and during a deploy the API and the worker are briefly on different versions.
The runtime therefore logs at `error` level and leaves the prediction unscored.

Forgetting to implement a market is a separate problem and is prevented at
compile time by an exhaustive `switch` with a `never` check in the `default`
branch, which fails the build rather than the job.

**Scores are read from `fullTime`.** Stoppage time is already included there.
Extra time does not occur in league football; if a knockout competition is ever
added, this decision has to be revisited.

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
