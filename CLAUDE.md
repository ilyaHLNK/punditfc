# PunditFC — project memory

This file is the shared context between Claude Desktop, Claude Code and any
IDE assistant. Read it first. Keep it current: if a decision is not written
down here or in `docs/`, it does not exist in the next session.

## What this is

A football prediction game. Friends create a private pool, predict exact scores
for real Premier League fixtures, and compete on an automatically scored
leaderboard.

It is a portfolio project. Its purpose is to demonstrate that a senior frontend
developer can build and operate a complete fullstack application. Code quality
and explainability matter more than feature count.

## Documents

| File                                  | Purpose                                       |
| ------------------------------------- | --------------------------------------------- |
| `docs/scope.md`                       | What is in v1 and what is deliberately not    |
| `docs/db-design.md`                   | Schema rationale, invariants, indexes         |
| `docs/adr/0001-tech-stack.md`         | Stack choice                                  |
| `docs/adr/0002-database-and-orm.md`   | PostgreSQL and Prisma                         |
| `docs/adr/0003-domain-model.md`       | Competition vs Pool, forward compatibility    |
| `docs/adr/0004-background-jobs.md`    | BullMQ, idempotency, rate limits              |
| `docs/adr/0005-prediction-markets.md` | Markets, binary scoring, no odds              |
| `docs/adr/0006-repository-layout.md`  | Monorepo vs polyrepo, why not micro-frontends |
| `docs/adr/0007-testing-strategy.md`   | Vitest, Testcontainers, what gets tested      |

`notes/` holds Russian-language study notes for the author. It is gitignored on
purpose: the public repository stays English-only, while backend concepts new to
the author are explained there in his language. Every time a backend or database
concept is introduced, add or extend a note there — this is a standing
requirement, not an optional extra.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind, TanStack Query,
  React Hook Form + zod
- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL + Prisma
- **Queue / cache:** BullMQ on Redis
- **Infra:** Docker Compose, GitHub Actions, Render (api + worker), Vercel
  (web), Neon (Postgres)
- **Repo:** pnpm workspaces monorepo

## Planned layout

```
apps/
  api/          NestJS HTTP API
  worker/       BullMQ processors
  web/          Next.js frontend
packages/
  contracts/    shared DTO types and zod schemas
  scoring/      pure scoring engine, heavily unit tested
prisma/         schema and migrations
docs/
```

## Domain vocabulary — use these words exactly

- `Competition` — a real tournament (Premier League). Never "league".
- `Season` — a competition in a given year.
- `Match` — a fixture. `kickoffAt` is the prediction deadline.
- `Gameweek` — a date window grouping matches across competitions. Not
  `matchday`, which is per-competition and does not align.
- `Pool` — a private group of friends. Never "league".
- `PoolSeason` — which competitions a pool plays.
- `Market` — one predictable aspect of a match (exact score, result, totals).
- `Pick` — a match a member chose to predict on; counts against the quota.
- `PoolMembership`, `Prediction`, `PredictionScore`, `PoolStanding`.

## Non-negotiable rules

1. **Deadlines are server-side.** Never trust a client timestamp.
2. **Invariants live in the database.** Unique constraints, not
   check-then-insert.
3. **Scoring recomputes, never increments.** Every job must be safe to re-run.
4. **Business logic does not import Prisma.** The scoring engine is pure.
5. **No `any`.** No silent `catch`. No commented-out code on `main`.
6. **Validation at the boundary.** Every endpoint validates input.
7. **Secrets come from the environment.** Nothing sensitive in the repo.
8. **No process-local state.** Anything that must survive a restart or be shared
   between instances lives in PostgreSQL or Redis — never in a module variable,
   a `Map`, or an in-memory counter. This includes rate-limit buckets, caches
   and quota counters. Production runs a single instance on the free tier, so
   this class of bug stays invisible until it is expensive; the rule is enforced
   at review time, not discovered in production.

## Environment notes — read before debugging setup

- **Prisma 7.** The connection string lives in `prisma.config.ts`, not in
  `schema.prisma`. Prisma no longer loads `.env` implicitly — `import
"dotenv/config"` in the config file does it. The generator is `prisma-client`
  with a required `output`; import the client from `prisma/generated/client`,
  never from `@prisma/client`.
- **Postgres is on host port 5434**, because 5432 and 5433 are occupied on the
  author's machine. Inside the compose network it is still `postgres:5432`.
- **pnpm blocks dependency build scripts.** Approvals live in
  `pnpm-workspace.yaml` under `allowBuilds`, each with a comment saying why.
  Never approve one without a reason.
- **`.env` is local only.** When `.env.example` changes, `.env` must be updated
  by hand.

## Conventions

- Code, comments, identifiers and documentation: **English**.
- Discussion with the author: **Russian**.
- Conventional Commits, enforced by commitlint + husky.
  Example: `feat(predictions): lock submissions after kickoff`
- Commits are split by logical unit — migration, service, endpoint and tests
  are separate commits, not one dump.
- Branches: `feat/…`, `fix/…`, `chore/…` → PR into `develop` → `main`.
- `develop` deploys to staging, `main` deploys to production.

## Working agreement

- Discuss architecture before implementing it; record the outcome in an ADR.
- Do not add a feature because it would look impressive. Every dependency must
  answer "why this and not the simpler option?" — and the answer, with the
  rejected alternative, goes into the table in ADR-0001 before the package is
  installed. A dependency without a recorded reason is a defect.
- Flag weak spots honestly rather than agreeing by default.

## Status

- [x] Scope agreed
- [x] Stack chosen
- [x] Database schema designed and migrated (`prisma/schema.prisma`)
- [x] Repository scaffolding — pnpm workspace, tsconfig, prettier, husky,
      commitlint
- [x] Docker Compose — postgres on host port **5434**, redis on 6379
- [ ] `packages/contracts` and `packages/scoring`
- [ ] NestJS api skeleton with a health endpoint
- [ ] Next.js web skeleton
- [ ] Auth
- [ ] Fixture sync
- [ ] Pools and invites
- [ ] Predictions
- [ ] Scoring worker
- [ ] Leaderboard
- [ ] CI/CD, staging, production
- [ ] README and demo seed
