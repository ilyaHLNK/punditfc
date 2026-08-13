# ADR-0003 — Separating Competition from Pool

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

The word "league" means two different things in this product: the Premier
League, and a private group of friends competing against each other. Using one
word for both concepts caused real confusion during design discussion, which is
a reliable warning sign about a domain model.

## Decision

Two distinct concept groups, and the word `League` is banned from the codebase.

**Professional football — read-only, externally sourced:**

- `Competition` — Premier League, La Liga, …
- `Season` — a competition in a given year
- `Team`
- `Match` — fixture with kickoff time, status and final score

**User-generated prediction game:**

- `Pool` — a private group, bound to one `Season`
- `PoolMembership` — a user's membership and role in a pool
- `Prediction` — one member's forecast for one match in one pool
- `PredictionScore` — points awarded for a prediction

## Rationale

Naming ambiguity in a domain model is not cosmetic — it propagates into
services, DTOs and endpoints, and every future reader pays the cost. Two
unambiguous names remove it permanently.

The split also draws a clean boundary between data we own and data we merely
mirror. Everything under `Competition` is written exclusively by the sync
process; everything under `Pool` is written exclusively by users. That
separation makes cache invalidation, permissions and re-sync all simpler.

## Forward compatibility: amateur competitions

A future version should let a user run their own amateur competition, entering
results by hand. Building it now would roughly double the scope, so it is out of
v1 — but two cheap decisions keep the door open:

1. `Competition.source` is an enum: `EXTERNAL | LOCAL`.
2. Result ingestion sits behind a `MatchResultProvider` interface with one
   implementation in v1 (`FootballDataApiProvider`). A future
   `ManualResultProvider` plugs in without touching the scoring engine.

This is the intended balance: do not build the feature, do not block it either.

## Consequences

- `Pool` binds to a `Season`, not to a `Competition`, so a pool is scoped to one
  year and archives cleanly when the season ends.
- v1 config exposes exactly one competition even though the schema supports many.
