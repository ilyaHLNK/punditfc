# Database design notes

Companion to `prisma/schema.prisma`. This file explains _why_ the schema looks
the way it does — the questions a reviewer or interviewer is most likely to ask.

## Entity map

```
User ──< PoolMembership >── Pool ──> Season ──> Competition
 │                           │         │
 │                           │         └──< Match >── Team (home / away)
 │                           │                 │
 └──────< Prediction >───────┘                 │
              │  └──> Match ───────────────────┘
              │
              └──1:1── PredictionScore

Pool ──< PoolStanding >── User        (derived aggregate)
```

## The invariants that live in the database

| Constraint                                             | Prevents                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `UNIQUE (pool_id, user_id, match_id)` on `predictions` | Two concurrent submits creating two bets on the same match |
| `UNIQUE (pool_id, user_id)` on `pool_memberships`      | Joining the same pool twice                                |
| `UNIQUE (invite_code)` on `pools`                      | Ambiguous invite links                                     |
| `UNIQUE (external_id)` on synced entities              | Duplicate rows when a sync job re-runs                     |

The first one is the important one. A check-then-insert in application code is a
race: two requests can both read "no prediction exists" before either writes.
The unique index makes the second write fail, and the service turns that failure
into an update. Correctness stops depending on timing.

## The prediction deadline

`Match.kickoffAt` is the deadline. Enforcement rules:

- Compared against database time (`now()`), never a client timestamp.
- Checked inside the same transaction as the write, not before it.
- The frontend also hides the form after kickoff — that is UX, not security.

Interview question this invites: _"what if the client clocks are wrong, or
someone calls the API directly?"_ The answer is that the client is not part of
the decision at any point.

## Hiding other members' predictions

Before kickoff a member may read only their own prediction. This is an ownership
rule enforced in the service layer against `PoolMembership`, not a global role
check — the same user is allowed to see everything in a pool whose matches have
started, and nothing in a pool whose matches have not.

## Why `PoolStanding` exists

The leaderboard could be computed on the fly:

```sql
SELECT user_id, SUM(points) FROM predictions
JOIN prediction_scores ON …
WHERE pool_id = $1 GROUP BY user_id ORDER BY 2 DESC;
```

That is correct and, at portfolio data volumes, fast. It is still the wrong
design, because the leaderboard is the most-viewed screen in the product and it
would re-aggregate every prediction of the season on every page load.

`PoolStanding` is a derived aggregate rebuilt by the scoring job. It carries no
information that cannot be recomputed from `PredictionScore`, so it can be
rebuilt from scratch at any time — which is what makes it safe.

The index `(pool_id, total_points DESC)` turns the leaderboard into one indexed
range scan.

**Trade-off to be able to state out loud:** this is denormalisation. It buys
read performance and costs a consistency risk, mitigated by rebuilding rather
than incrementing, and by the aggregate being derivable.

## Idempotent scoring

`Match.scoringStatus` (`PENDING → IN_PROGRESS → SCORED`) plus recomputation
instead of incrementation. A VAR correction that arrives an hour later resets
the match to `PENDING`; the next run recomputes every `PredictionScore` for that
match and rebuilds the affected standings. Because nothing is accumulated in
place, running the job twice produces the same result as running it once.

## Indexes and their justification

| Index                                         | Query it serves                                 |
| --------------------------------------------- | ----------------------------------------------- |
| `matches (season_id, matchday)`               | Fixture list for a matchday                     |
| `matches (status, kickoff_at)`                | Sync scheduler, upcoming fixtures               |
| `matches (scoring_status, status)`            | Scoring job finding unscored finished matches   |
| `predictions (match_id)`                      | "All predictions for this match" during scoring |
| `predictions (pool_id, user_id)`              | Personal prediction history                     |
| `pool_standings (pool_id, total_points DESC)` | Leaderboard                                     |
| `pool_memberships (user_id)`                  | "My pools"                                      |

No index was added speculatively; each maps to a query in the scope document.

## Deliberate omissions

- **No soft deletes.** They complicate every query and buy nothing here.
- **No audit log.** Out of scope; `createdAt`/`updatedAt` are enough.
- **No per-pool scoring rules.** v1 uses one ruleset, but the scoring function
  takes the ruleset as an argument so v2 does not require a rewrite.
- **`Team` is global, not season-scoped.** Promotion and relegation are handled
  by fixtures referencing teams, not by duplicating teams per season.

## Known gaps found while walking the scenarios

These were caught by replaying the main flows against the schema before writing
any code. They need a decision, not a fix to the diagram.

1. **A prediction is not constrained to its pool's season.** `Prediction` links
   to `Pool` and to `Match` independently, so nothing at the database level
   stops a forecast on a match from a different season. Options: validate in the
   service layer (simple, chosen for now), or denormalise `seasonId` onto
   `Prediction` and use composite foreign keys (airtight, noisier). Documented
   deliberately — an interviewer asking "what does your schema _not_ guarantee?"
   deserves a real answer.
2. **Postponed and cancelled matches.** A cancelled match must void its
   predictions rather than score them as misses. The scoring job needs an
   explicit branch, and `PredictionScore` needs no new state — the rows are
   simply deleted and standings rebuilt.
3. **Email case sensitivity.** `UNIQUE (email)` in PostgreSQL is
   case-sensitive, so `Ilya@x.com` and `ilya@x.com` would both be accepted.
   Emails are normalised to lower case before persistence.

## The pick quota is the hard one

`Pool.maxPicksPerGameweek` cannot be enforced by a constraint, because "how many
matches has this member picked this gameweek" is a count over a date range, not
a property of one row. A naive implementation reads the count and then inserts —
two concurrent requests both read 4, both insert, and the member ends up with 6
picks against a limit of 5.

Options, in increasing order of cost:

1. Count and insert inside one transaction at `SERIALIZABLE` isolation, and
   retry on a serialization failure. Correct, and Postgres does the hard part.
2. A `pool_gameweek_quota` row per (pool, user, gameweek) locked with
   `SELECT … FOR UPDATE` before the insert. More code, coarser lock, no retries.
3. Advisory locks keyed on (pool, user, gameweek).

Leaning towards option 1: it keeps the invariant in one place and demonstrates
that isolation levels are understood rather than avoided.

This is deliberately the hardest piece of backend work in the project, and it
ships in v1 — the whole point of the exercise is to have something non-trivial
to explain. It also needs a concurrency test: fire N simultaneous requests at
the endpoint and assert that exactly `maxPicksPerGameweek` rows exist. A test
like that is worth more in a portfolio than another CRUD endpoint.

## Open questions for review

1. Should a pool be joinable after the season has started? Currently yes, and
   the member simply has no points for finished matchdays. Alternative: a
   join deadline. Leaning towards keeping it simple.
2. Tie-breaking on the leaderboard — currently equal points share a rank.
   Common alternative is to break ties by exact-score count, which
   `PoolStanding.exactScores` already supports.
