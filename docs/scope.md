# PunditFC — MVP Scope

> Status: **agreed** · Last updated: 2026-08-12
>
> This document is the contract for v1. Anything not listed under "In scope" is
> explicitly out of scope until the MVP is deployed and documented.

## Product in one sentence

PunditFC lets a group of friends create a private pool, predict exact scores for
real Premier League fixtures, and compete on a leaderboard that updates
automatically once matches finish.

## Core user journey

1. User signs up (or clicks **Try the demo** for a pre-seeded account).
2. User creates a **Pool** attached to a **Competition** (Premier League 2026/27)
   and shares the invite code.
3. Friends join the pool with the invite code.
4. Before each match kicks off, every member submits an exact-score prediction.
   After kickoff the prediction is locked.
5. When a match finishes, a background worker fetches the real result and awards
   points.
6. The pool leaderboard, prediction history and personal stats update.

## Prediction markets and scoring (v1)

Every market is binary — the selection is right or wrong — and carries its own
point value. Full rationale in [ADR-0005](adr/0005-prediction-markets.md).

**One bet per match**, chosen from the markets available. Point values are
balanced so that expected value is comparable and only the variance differs.

| Market                            | Points | v1                    |
| --------------------------------- | ------ | --------------------- |
| Exact score                       | 10     | yes                   |
| Match result (home / draw / away) | 2      | yes                   |
| Total goals over/under 2.5        | 2      | yes                   |
| Both teams to score               | 2      | modelled, ships later |
| Half-time result                  | 3      | modelled, ships later |
| Goal difference                   | 4      | modelled, ships later |

Markets that need match events (first team to score, scorers, cards) are
impossible on the free data tier and are not planned.

Each market is a pure, unit-tested strategy. Adding one means adding a file, not
editing existing code.

## In scope

### Accounts

- Email + password registration, login, logout.
- Password hashing with argon2.
- JWT access token + refresh token rotation.
- Demo account with a one-click login (seeded data).

### Competitions (read-only, synced)

- Four competitions in v1: Premier League, La Liga, Serie A, Bundesliga.
- Teams, fixtures, kickoff times, half-time and full-time scores.
- Scheduled sync from football-data.org.
- Fixtures are grouped into a **gameweek** — a date window — rather than a
  matchday, because matchday numbers do not line up across competitions.

### Pools

- Create a pool and choose which competitions it plays.
- Join via invite code.
- Roles: `OWNER`, `MEMBER`.
- Leave a pool; owner can remove a member.
- List of pools the current user belongs to.

### Predictions

- Submit / update a prediction until kickoff: pick a match, answer one market.
- **Predictions are optional** — a skipped match simply scores nothing.
- Per-pool cap of picks per gameweek (`maxPicksPerGameweek`, default 3),
  enforced transactionally.
- Server-side deadline enforcement (database time, never client time).
- One bet per (pool, user, match) — unique constraint.
- Other members' predictions are hidden until kickoff.

### Scoring & leaderboard

- Background job fetches finished matches and awards points.
- Job is idempotent and safe to re-run (handles score corrections).
- Pool leaderboard with rank, total points, and a breakdown by hit type.
- Personal prediction history.

### Notifications

- Email reminder when a matchday deadline is near and predictions are missing.

### Cross-cutting

- Request validation on every endpoint (zod / class-validator).
- Consistent error envelope and global exception filter.
- Structured logging with request correlation ids.
- OpenAPI docs published at `/api/docs`.
- Rate limiting on auth endpoints, backed by Redis rather than process memory.
- Graceful shutdown: on `SIGTERM` the API stops accepting requests and the
  worker finishes the job in flight before exiting.

### Testing

Strategy and rationale in [ADR-0007](adr/0007-testing-strategy.md).

- Exhaustive unit tests for the scoring engine (no I/O).
- Integration tests against a real PostgreSQL via Testcontainers for the
  deadline rule, the pick quota and scoring idempotency.
- A concurrency test proving the quota holds under parallel requests.
- HTTP tests for auth and pools via supertest.
- One Playwright journey: register → join a pool → place a bet → leaderboard.

### Delivery

- Docker Compose for local development (api, worker, postgres, redis).
- GitHub Actions: lint, typecheck, test, build on every PR.
- Two environments: `staging` (from `develop`) and `production` (from `main`).
- Documented rollback procedure.
- Seed script producing a realistic demo pool.
- README with screenshots, live link and demo credentials.

## Out of scope for v1

Recorded so we can say _no_ quickly, and so the README can list them honestly as
future work.

- Amateur / user-managed competitions with manual result entry (v2 — see
  [ADR-0003](adr/0003-domain-model.md); the schema is prepared for it).
- The three remaining markets (both teams to score, half-time result, goal
  difference) — modelled in the schema, implemented after the MVP is live.
- Chat, comments, reactions, any social feed.
- Public pools and a global ranking.
- Predictions on scorers, line-ups, or season-long outcomes.
- Real money, payments, or anything resembling gambling.
- Mobile application.
- Internationalisation.
- OAuth / social login.
- Push notifications.

## Timeline (4 weeks, ~20-25 h/week)

| Week | Goal              | Definition of done                                                                                                               |
| ---- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Foundation        | Repo, Docker Compose, Postgres + Prisma, schema and migrations, auth, CI green, **empty app deployed to staging and production** |
| 2    | Domain            | Competition sync from external API, pools, invites, membership, frontend shell with real data                                    |
| 3    | Core value        | Predictions with deadline enforcement, scoring engine, BullMQ worker, leaderboard                                                |
| 4    | Production polish | Email reminders, tests on the scoring engine, OpenAPI, seed + demo login, README, screenshots, final deploy                      |

Deploying in week 1 is deliberate: projects that leave deployment until the end
usually never get deployed.

## Definition of done for the MVP

- Public URL works for an anonymous visitor within a few seconds.
- Demo login shows a populated pool with history and a leaderboard.
- `docker compose up` runs the whole stack locally from a clean checkout.
- CI is green on `main`; a red pipeline blocks the merge.
- README explains what the project is, how to run it, and how it is built.
