# ADR-0006 — Repository layout: monorepo

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

The project ships three deployable units (API, worker, web) plus shared code.
They must be versioned, built and released somehow.

## A clarification that matters

**Monorepo and micro-frontends are not alternatives to each other.** They answer
different questions:

- *Monorepo vs polyrepo* — how many git repositories the code lives in.
- *Micro-frontends vs a single frontend* — whether the UI is split into
  independently built and deployed applications.

The two are orthogonal. Micro-frontends are commonly developed inside a
monorepo. Saying "I chose a monorepo instead of micro-frontends" invites a
correction in an interview, so the real comparison is recorded below.

## Decision

A single repository with pnpm workspaces:

```
apps/api  apps/worker  apps/web
packages/contracts  packages/scoring
```

A single Next.js frontend. No micro-frontends.

## Monorepo vs polyrepo

| | Monorepo | Polyrepo |
| --- | --- | --- |
| Shared types | Imported directly from `packages/contracts` | Published to a registry, versioned, or duplicated |
| Contract change | One PR touches API and web together, CI verifies both | Two PRs, temporary drift, breakage between deploys |
| Onboarding | One clone, one `pnpm install` | Several clones, matching versions by hand |
| CI | One pipeline, filtered by changed workspace | Several pipelines to keep in sync |
| Cost | Pipeline must be filtered or it rebuilds everything | Naturally isolated |

Chosen because the single largest source of bugs in a split stack is drift
between what the API returns and what the client expects. Sharing zod schemas
and inferred types across the boundary removes that class of bug at compile
time, and that is only cheap inside one repository.

The trade-off is a CI pipeline that must be filtered by changed workspace,
otherwise every commit rebuilds everything. At this size that is a few lines of
configuration, not a reason for Nx or Turborepo — those solve remote caching
problems this project does not have.

## Why not micro-frontends

Micro-frontends solve an organisational problem: several teams shipping parts of
one interface on independent release cycles, without coordinating deploys. The
cost is real — a shell application, module federation or import maps, shared
dependency version negotiation, cross-application routing and state, duplicated
runtime, and a harder debugging story.

This project has one developer and one release cycle. Adopting micro-frontends
here would add every cost and buy none of the benefit — a textbook case of
architecture chosen for appearance. Being able to say precisely *when* they
would be justified is worth more in an interview than having used them without
a reason.

## Consequences

- `packages/contracts` must exist from the first commit; retrofitting shared
  types after both sides have their own is painful.
- CI jobs filter on changed workspaces (`pnpm --filter`).
- Deployment targets pick their app out of the repository: Vercel builds
  `apps/web`, Render builds `apps/api` and `apps/worker` from the repo root.
