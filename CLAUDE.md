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
| `docs/adr/0008-typescript-version.md` | Why TypeScript is pinned below latest         |

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
- **TypeScript is pinned to 6.x deliberately.** TypeScript 7 is the native
  compiler and no longer exports the JavaScript compiler API, so
  `typescript-eslint` — and with it every type-aware lint rule — cannot run on
  it. Do not bump it to `latest`; ADR-0008 records the condition that lifts the
  pin.

## Conventions

- Code, comments, identifiers and documentation: **English**.
- **No TypeScript `enum` in application code.** Derive unions from zod schemas
  in `packages/contracts` instead — one declaration gives both runtime
  validation and the type, and `const enum` is unusable under
  `isolatedModules`. Enums in `schema.prisma` are a different thing entirely:
  those are native PostgreSQL types and are correct there.
- Discussion with the author: **Russian**.
- Conventional Commits, enforced by commitlint + husky.
  Example: `feat(predictions): lock submissions after kickoff`
- Pull request descriptions use three `##` sections and nothing else:
  **What** — what changed, in prose; **Why** — the reason it was done now and
  the risk it removes; **Notes** — trade-offs, rejected alternatives and
  follow-ups, as bullets. No checklists, no template boilerplate.
- Commits are split by logical unit — migration, service, endpoint and tests
  are separate commits, not one dump.
- Branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `ci/…` → PR into `develop`
  → `main`.
- `develop` deploys to staging, `main` deploys to production.

## Keeping this file current — an obligation, not a suggestion

This file is the only thing that carries context between sessions and between
tools. A stale `CLAUDE.md` is worse than none, because it is trusted.

Before finishing any piece of work, update, in the same commit as the code:

- **Status** — tick what is done, add what appeared.
- **Current task** — replace it with what comes next and its constraints.
- **Environment notes** — add anything that cost more than ten minutes to
  debug. If it surprised you once, it will surprise you again.
- **Domain vocabulary** — add any new term, so the next session uses the same
  word.

If a decision was made in conversation and is not written down here or in
`docs/`, treat it as lost. Write it down before moving on.

## Working agreement

- Discuss architecture before implementing it; record the outcome in an ADR.
- Do not add a feature because it would look impressive. Every dependency must
  answer "why this and not the simpler option?" — and the answer, with the
  rejected alternative, goes into the table in ADR-0001 before the package is
  installed. A dependency without a recorded reason is a defect.
- Flag weak spots honestly rather than agreeing by default.
- **Explain backend work in full.** The author is a frontend developer learning
  the backend through this project. Every backend, database, build-tooling or
  infrastructure concept is explained properly — what it is, what it affects,
  what breaks without it, which alternative was rejected — before he is asked to
  decide anything. Shorthand that assumes accumulated context is not usable, and
  a Russian note in `notes/` follows the explanation.
- **Announce the plan before writing code.** Before any meaningful block of
  work, state the branch name, the commit split, and the pull request title and
  body. One pull request is one branch.
- **The author owns the git history.** He creates the branch; an assistant
  prepares the working tree and drafts the commit message. Running `git commit`,
  pushing and opening the pull request are his, so no diff enters history
  unreviewed and he stays hands-on with git.

## Current task — read this first

Next up: `packages/contracts` and `packages/scoring`.

`packages/contracts` — shared types and zod schemas for every market selection,
consumed by both the API and the web app. This is the package that stops the
client and the server from drifting apart, so it exists before either of them.

`packages/scoring` — the pure scoring engine. Constraints, all already agreed:

- One strategy per market, each a pure function of `(selection, fullTime,
halfTime)`. No I/O, no Prisma, no clock.
- Point values arrive as a `Ruleset` argument; `DEFAULT_RULESET` lives in the
  package but is never read implicitly.
- v1 implements `EXACT_SCORE` (10), `MATCH_RESULT` (2), `TOTAL_GOALS` (2). The
  other three exist in the enum only.
- Exhaustive `switch` with a `never` check; the runtime `default` branch logs and
  skips rather than throwing.
- Exhaustive unit tests: every market, 0:0, draws, high scores, the line
  boundary.

Everything decided about markets, void matches and scoring is in
`docs/adr/0005-prediction-markets.md`. Read it before writing the engine.

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
