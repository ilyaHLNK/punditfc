# ADR-0002 — PostgreSQL as the primary datastore

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

The domain is a graph of users, pools, memberships, matches, predictions and
scores. Every meaningful read crosses several of those entities, and the write
path has real correctness requirements: a prediction must never be counted
twice, and points must never be awarded twice.

## Decision

PostgreSQL is the single source of truth. Redis is used only as a cache and as
the BullMQ backend, never as a store of record.

## Rationale

**Relational data.** The leaderboard alone joins pools, memberships, users,
predictions and matches. In a document store this becomes either denormalised
duplication or application-side joins.

**Invariants belong in the database.** Two important rules are expressed as
constraints, not as application checks:

- `UNIQUE (pool_id, user_id, match_id)` on predictions — the reason a
  double-submit race cannot create two predictions.
- `UNIQUE (pool_id, user_id)` on memberships.

An application-level "check then insert" is a textbook race condition. Pushing
the invariant into the schema means correctness does not depend on request
timing.

**Transactions.** Awarding points for a match is one atomic unit: read the
predictions, compute points, write the scores, mark the match as processed. A
partial failure must leave nothing behind.

**Market fit.** PostgreSQL appears in Node backend job descriptions more often
than every alternative combined.

## Consequences

- Migrations become part of the deployment story, including the rollback
  problem (see ADR-0006).
- The leaderboard needs an aggregate strategy rather than a naive `SUM` over all
  predictions; addressed in the schema design.

## Alternatives considered

- **MongoDB** — no transactional guarantees worth relying on for this write
  path without extra care, and the read model is relational by nature.
- **SQLite** — fine locally, but does not match a production deployment story.
- **Supabase as a backend-as-a-service** — would remove most of the backend
  work, which is precisely the work this project exists to show.
