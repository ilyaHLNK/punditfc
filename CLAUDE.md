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
| `docs/adr/0009-module-system.md`      | ESM everywhere, and what it requires          |

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
- **Branch protection is active.** The `protected branches` ruleset requires a
  pull request into `develop` and `main`, requires the `Verify` check to pass,
  requires the branch to be up to date, and blocks force pushes and deletions.
  Its bypass list is empty on purpose, so the rule applies to the owner too: a
  red pipeline blocks the merge for everyone. An emergency merge is done by
  switching the ruleset's enforcement status, which is visible in its history —
  never by adding a bypass. The ruleset lives in the GitHub settings interface,
  not in the repository, so it does not travel with a clone or a fork.
- **Deleting `dist` by hand does not force a rebuild.** `tsc` keeps its
  incremental state in `*.tsbuildinfo` beside the tsconfig. With that state
  intact and the output gone, the next build believes everything is current and
  emits almost nothing. The symptom appears one package away: the dependent
  package reports dozens of "type that cannot be resolved" lint errors and
  `any`-typed imports, because the declarations it reads point at files that
  were never written. Delete `*.tsbuildinfo` whenever you delete `dist`.
- **`@types/node` must be named explicitly** in an application's tsconfig
  (`"types": ["node"]`). With pnpm's isolated `node_modules`, TypeScript does
  not find the package on its own, and `console` and `import.meta` come back as
  unknown identifiers.
- **The generated Prisma client only works inside a package that declares
  `"type": "module"`.** It uses `import.meta.url`, and TypeScript picks a file's
  module format from the nearest `package.json` of the _source_. Generated under
  the repository root, which declares nothing, it compiles to CommonJS and
  throws at runtime. Details and the compiler options it needs are in ADR-0009.

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
- Every test is shown failing before it is trusted. After writing one, break the
  code it covers and confirm it goes red, then restore. A test that has never
  been red proves only that it runs. ADR-0007 says what deserves a test; this
  says when a test counts as written.
- Branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `ci/…` → PR into `develop`
  → `main`.
- `develop` deploys to staging, `main` deploys to production.
- A release is a pull request from `develop` into `main`, titled
  `release: vX.Y.Z — short summary`. Its description says what changes for the
  user and how to get back — whether there are migrations and whether they are
  reversible — rather than how it was implemented.
- After the merge, `main` is tagged `vX.Y.Z` and the tag carries a GitHub
  Release with the notes. The tag is the rollback anchor: rolling back means
  redeploying the previous one. Versions stay in `0.x` until the MVP is live
  with a README, a demo login and a public URL; that is `v1.0.0`.
- Releases follow completed vertical slices, roughly weekly. The first one is
  the empty deployed application, before any feature — a deployment chain first
  proven on a finished product is proven too late.
- A hotfix branches from `main`, is merged into `main`, and is then merged back
  into `develop`. It is the only path that does not go through `develop`, and
  skipping the merge back means losing the fix at the next release.
- Generating `CHANGELOG.md` and version bumps from the commit history
  (release-please) is deliberately deferred until after the MVP. Conventional
  Commits are already enforced, so adopting it later is configuration rather
  than a migration.

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

Both pure packages are done, and the module system is settled: ESM everywhere,
verified with a throwaway NestJS application rather than assumed (ADR-0009).
Read that ADR before scaffolding the API — it lists the compiler options Nest
needs and the one that decides whether the Prisma client works at all.

Next, in this order.

**1. `apps/api` — NestJS skeleton with a health endpoint.** Small on purpose:
the point is a deployable process, not features. The configuration is already
known from the spike — `"type": "module"`, `experimentalDecorators`,
`emitDecoratorMetadata`, `"types": ["node"]`, and
`allowImportingTsExtensions` with `rewriteRelativeImportExtensions` for the
generated Prisma client. The generator `output` moves out of `prisma/generated`
and into the application, because a client generated under the repository root
compiles as CommonJS and throws on `import.meta.url` at runtime.

This is also the home for the type-level check that the market list in
`packages/contracts` still matches the `PredictionMarket` enum in
`schema.prisma` — the API is the only place allowed to see both.

**2. `apps/web` — Next.js skeleton.** Do the UI design pass first: no screen
inventory, no per-screen states and no visual direction exist anywhere yet.
Agree the screens, record them in `docs/ui-scope.md`, draft the artboards, and
turn the agreed palette and spacing into the Tailwind theme — before any
component is written.

**3. Deploy both skeletons to staging and production.** `docs/scope.md` puts an
empty deployed application in week one deliberately. Before configuring
anything, check what the free tiers actually allow and write ADR-0010: Render
has no free tier for background workers, which decides how the worker runs, and
a reduced staging with a recorded reason beats two full environments promised
and quietly not delivered. ADR-0001 currently cites ADR-0005 for "free-tier
hosting was verified", which is the wrong document and no such verification
exists — fix that reference in the same pull request.

Debts carried forward, none of them blocking:

- The `selection` shape constraint has no automated test. It gets one when the
  Testcontainers harness arrives with the predictions endpoint, where the
  deadline and the pick quota need the same harness.
- Two decisions to record when predictions are built: a `Prediction` on a
  cancelled match is kept and excluded from the quota count by status rather
  than deleted, and the quota is checked only when a bet is placed, never
  retroactively when a postponed match lands in a week the member has already
  filled.
- Workspace packages are consumed through `dist`, so the CI pipeline builds
  before it lints, typechecks and tests. Resolving to sources instead — project
  references, or an extra condition in the exports map — would restore the
  conventional order and is worth doing when the build stops being instant.

## Status

- [x] Scope agreed
- [x] Stack chosen
- [x] Database schema designed and migrated (`prisma/schema.prisma`)
- [x] `CHECK` constraint on the shape of `selection`
- [x] Repository scaffolding — pnpm workspace, tsconfig, prettier, husky,
      commitlint
- [x] Docker Compose — postgres on host port **5434**, redis on 6379
- [x] `packages/contracts` — prediction market schemas
- [x] `packages/scoring` — pure scoring engine
- [ ] NestJS api skeleton with a health endpoint
- [ ] Next.js web skeleton
- [ ] Auth
- [ ] Fixture sync
- [ ] Pools and invites
- [ ] Predictions
- [ ] Scoring worker
- [ ] Leaderboard
- [x] CI — lint, typecheck, test and build on every pull request
- [ ] Staging and production deployment
- [ ] README and demo seed
