# ADR-0001 — Technology stack

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

The author is a frontend developer with five years of React/TypeScript
experience and limited commercial backend experience. This project is a
portfolio piece whose goal is to demonstrate fullstack capability to
Russian-speaking companies hiring for remote roles in Europe and North America.

Constraints: roughly four weeks of part-time work, and the deployed application
must stay online indefinitely at zero cost.

## Decision

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Server state | TanStack Query |
| Forms | React Hook Form + zod |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue | BullMQ on Redis |
| Cache | Redis |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Repo layout | pnpm workspaces monorepo |

## Rationale

**NestJS over Express.** Express gives no architectural opinion, so every
structural decision has to be invented and then defended in a review. NestJS
ships with dependency injection, modules, and a layered convention that any
reviewer recognises immediately. It is also the dominant Node framework in the
target job market. The trade-off — a steeper learning curve and more
boilerplate — is acceptable, and the DI/decorator model maps closely onto
Angular, which makes it explainable.

**A separate backend rather than Next.js API routes.** The explicit goal is to
prove backend competence. A standalone service with its own deployment,
container, and API contract demonstrates that far better than route handlers
living inside the frontend. It also makes the worker process a natural
citizen of the architecture rather than an awkward add-on.

**Next.js over plain React.** Server components and route handlers reduce
boilerplate for data fetching, and the framework is the market default. The app
consumes the NestJS API over HTTP like any other client.

**Prisma over TypeORM.** Prisma's generated types give end-to-end type safety
from schema to controller, which matches the TypeScript-first requirement, and
its migration workflow is explicit and reviewable. TypeORM is more common in
older NestJS codebases, and its Active Record option encourages leaking
persistence into the domain. The trade-off is that Prisma is less flexible for
exotic SQL; where that bites we drop to `$queryRaw` for a specific query rather
than fighting the abstraction.

**Monorepo with pnpm workspaces.** Shared TypeScript types between API and web
prevent contract drift, which is the single most common source of bugs in a
split stack. Nx or Turborepo would add caching we do not need at this size.

## Per-dependency rationale

Every entry here must survive the question "why this and not the simpler
option?". Nothing enters the repository without an answer.

| Dependency | Chosen because | Rejected alternative |
| --- | --- | --- |
| **NestJS** | Opinionated structure a reviewer recognises; dominant in the target market | Express (no structure to defend), Fastify (thinner market signal) |
| **Prisma** | Types generated from the schema; explicit, reviewable migrations | TypeORM (Active Record leaks persistence into the domain), Drizzle (closer to SQL, smaller ecosystem), raw `pg` (no type safety) |
| **PostgreSQL** | Relational data, transactions, constraints as invariants | MySQL (weaker types, less common in Node postings), MongoDB (wrong shape for this read model) |
| **BullMQ** | Job queue with retries, repeatable jobs, rate limiting; Redis already present | `node-cron` in-process (dies with the web process, breaks on scale-out), pg-boss (removes Redis but Redis is needed for cache anyway), RabbitMQ/Kafka (see ADR-0004) |
| **Redis** | Cache for a rate-limited external API, plus the BullMQ backend | In-memory cache (lost on restart, not shared between instances) |
| **argon2** | Current recommendation for password hashing; tunable memory cost | bcrypt (fine, but weaker against GPU attacks), plain hashes (unacceptable) |
| **zod** | One schema validates input and infers the TypeScript type, shared between API and web | class-validator (idiomatic in Nest but decorator-bound and not reusable on the frontend), Joi (no type inference) |
| **TanStack Query** | Caching, revalidation and request state for server data | `useEffect` + `useState` (reimplements caching badly), Redux Toolkit Query (heavier, and no global client state to justify Redux) |
| **React Hook Form** | Uncontrolled inputs, few re-renders, integrates with zod | Formik (heavier, re-renders more), hand-rolled forms |
| **Tailwind** | No naming overhead, no dead CSS, fast iteration solo | CSS Modules (more files, more naming), styled-components (runtime cost, RSC friction), a component library (visual identity would not be the author's) |
| **pnpm workspaces** | Fast installs, strict dependency resolution, workspace protocol | npm/yarn workspaces (slower, looser), Nx/Turborepo (remote caching this project does not need) |

State management deserves a note: the application has almost no global client
state. Nearly everything on screen is server data, which is TanStack Query's
job. Adding Redux or Zustand to a project like this is a common reflex and a
common interview trap — the defensible answer is that server cache and client
state are different problems, and only one of them exists here.

## Consequences

- The learning curve for NestJS costs time in week 1; the payoff is a codebase
  that reads as production code.
- Two deployable services (api, worker) plus a frontend must be provisioned,
  which is why free-tier hosting was verified before committing (ADR-0005).
- Shared types must live in a workspace package from the start; retrofitting
  them later is painful.

## Alternatives considered

- **Express + Zod + manual layering** — faster to start, weaker signal, invites
  "why did you structure it this way?" without a good answer.
- **Fastify** — excellent, but thinner ecosystem signal in job postings.
- **Next.js fullstack with tRPC/Drizzle** — very productive, but blurs the
  frontend/backend boundary this project exists to demonstrate.
