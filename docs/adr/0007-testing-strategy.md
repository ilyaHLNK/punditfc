# ADR-0007 — Testing strategy

- **Status:** Accepted
- **Date:** 2026-08-17

## Context

A portfolio project is read, not run. Tests are one of the few places a reviewer
can see whether the author understands what is actually risky in the system.

That makes coverage the wrong target. A suite of 200 trivial assertions on
getters proves nothing; a handful of tests aimed at the parts that can genuinely
break proves a great deal.

## Decision

| Layer                                     | Tool           |
| ----------------------------------------- | -------------- |
| Test runner, everywhere                   | Vitest         |
| HTTP-level API tests                      | supertest      |
| Integration tests against a real database | Testcontainers |
| Browser end-to-end                        | Playwright     |

### Vitest rather than Jest

NestJS scaffolds Jest, and Jest appears more often in job descriptions — that
is the argument for it, and it is a real one.

Vitest is chosen because this is a monorepo containing both NestJS and Next.js.
With Jest the frontend and backend would need separate runners and separate
configurations; with Vitest there is one runner, one config style, and one
mental model across `apps/*` and `packages/*`. Vitest is also ESM- and
TypeScript-native, which matters given `verbatimModuleSyntax` and NodeNext
resolution in the base config.

The migration cost, should it ever be needed, is low: the assertion API is
Jest-compatible.

### Testcontainers rather than mocks or a shared test database

The riskiest logic in this project is the part that depends on PostgreSQL
behaviour: unique constraints, transaction boundaries, and isolation levels. A
mocked repository would assert that our assumptions are self-consistent, not
that the database enforces them. That is the difference between a test that
passes and a test that means something.

A permanently running test database was the alternative. Rejected because it
requires setup instructions, drifts from production over time, and leaks state
between runs.

Testcontainers starts a real `postgres:17-alpine` container for the test run and
throws it away afterwards. It behaves identically on a laptop and in CI, and it
reuses the image already pulled for local development.

## What gets tested, and how much

| Target                              | Level                         | Depth                                                          |
| ----------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Scoring engine (`packages/scoring`) | Unit, no I/O                  | Exhaustive — every market, every edge case                     |
| Prediction deadline                 | Integration, real DB          | The rule and its boundary                                      |
| Pick quota per gameweek             | Integration + **concurrency** | N parallel requests must produce exactly N_max rows            |
| Scoring job idempotency             | Integration                   | Run twice, assert identical result; simulate a corrected score |
| Auth                                | HTTP via supertest            | Happy path, wrong password, expired token, refresh rotation    |
| Pools and memberships               | HTTP via supertest            | Ownership rules, invite codes                                  |
| Everything else                     | Thin                          | Enough to catch a regression, no more                          |
| One user journey                    | Playwright                    | Register → join pool → place a bet → see the leaderboard       |

Two of these are deliberately unusual and exist because they are the honest test
of the design:

- **The concurrency test.** Fire simultaneous requests at the pick endpoint and
  assert the quota held. Most portfolio projects never test this, because most
  portfolio projects never have a rule that can be broken by timing.
- **The idempotency test.** Run the scoring job twice, then feed it a corrected
  score, and assert the totals are right in both cases.

## Non-goals

- No coverage threshold in CI. It rewards testing what is easy rather than what
  is risky, and it is the fastest way to end up with meaningless tests.
- No snapshot tests of API responses. They fail on formatting and pass on logic.
- No unit tests for controllers. They contain no logic worth asserting; the
  behaviour is tested through supertest instead.

## Consequences

- Integration tests need Docker available, locally and in CI. GitHub Actions
  provides it.
- Integration tests are slow (seconds, not milliseconds). They run as a separate
  CI job from the unit tests so that fast feedback stays fast.
- `packages/scoring` must stay free of I/O for its tests to remain trivial —
  which is the same constraint rule 4 in `CLAUDE.md` already imposes.
