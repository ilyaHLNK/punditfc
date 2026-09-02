# ADR-0009 — Module system: ESM everywhere

- **Status:** Accepted
- **Date:** 2026-09-02

## Context

Node has two module systems. CommonJS (`require`) is the historical one, unique
to Node. ES modules (`import`) are the JavaScript standard, the same system the
browser uses. A package declares which one it is with `"type": "module"` in its
`package.json`, and there is no third option — supporting both means building
twice.

`packages/contracts` and `packages/scoring` are ESM already. The API is the
first place that could refuse it: NestJS is CommonJS-first, its `nest new`
template produces a CommonJS project, and its documentation, plugins and the
answers people find online all assume it. Dependency injection is the specific
risk, because Nest resolves constructor arguments from metadata the compiler
writes beside each decorator.

Choosing by reading documentation was not possible: the Nest documentation does
not state that ESM works, and it does not state that it does not. So the
question was answered by running it.

## The spike

A throwaway NestJS 12 application with `"type": "module"`, a module, a
controller and an injected service, deleted after the result was recorded. Not
committed: its value is the answer, not the code.

| Checked                                               | Result                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `tsc` compiles decorators to ESM                      | Yes — `__decorate` / `__metadata` helpers beside real `import` statements    |
| Dependency injection through decorator metadata       | Yes — the service was resolved and injected                                  |
| `node dist/main.js` serves a request                  | Yes — `GET /health` answered 200                                             |
| Top-level `await` in `main.ts`                        | Yes — an ESM-only feature, so `NestFactory.create` needs no wrapper function |
| Importing a workspace package (`@punditfc/contracts`) | Yes — a zod schema parsed at runtime inside the controller                   |
| `nest start --watch`                                  | Yes — started, and recompiled and restarted on a file change                 |
| Compiling the generated Prisma client                 | Yes, with conditions — see below                                             |

## Decision

**ES modules everywhere**, including `apps/api` and `apps/worker`.

The prepared fallback — CommonJS for `apps/api` alone, relying on Node 24's
ability to `require()` an ES module without top-level await — is not needed and
is recorded only so the reasoning survives.

## What it requires

Findings worth keeping, because each one costs an afternoon to rediscover.

**Decorator options are not in the base config.** `experimentalDecorators` and
`emitDecoratorMetadata` are what let Nest see constructor types at runtime.
`tsconfig.base.json` has neither, so they belong in the tsconfig of each Nest
application and nowhere else — the pure packages must not grow decorators.

**`@types/node` has to be named explicitly.** With pnpm's isolated
`node_modules`, TypeScript did not pick the package up automatically: it looked
in the repository root and in dependency directories, not in the workspace's own
`node_modules/@types`. Without `"types": ["node"]` in the application's
tsconfig, `console` and `import.meta` are unknown identifiers.

**The generated Prisma client is ESM, and where it is generated decides whether
it works.** The Prisma 7 `prisma-client` generator emits TypeScript source that
uses `import.meta.url` and imports its neighbours with `.ts` extensions. Two
consequences:

- The application must compile it, with `allowImportingTsExtensions` and
  `rewriteRelativeImportExtensions` so those specifiers become `.js` on emit.
- TypeScript decides a file's module format from the nearest `package.json` **of
  the source**, not of the output. Generated into `prisma/generated` — under the
  repository root, which does not declare `"type": "module"` — the client is
  compiled as CommonJS, and `import.meta.url` survives into the emitted
  JavaScript, where it throws at runtime. Copied inside a package that declares
  ESM, the same source emits correct ESM. The generator output therefore has to
  move into the application that owns the client, which is `apps/api`.

Both variants were compiled and their output compared; this is not deduced from
documentation.

## Consequences

- One module system across the repository: no dual builds, no interop rules to
  remember, no argument about which files use which syntax.
- Relative imports carry the `.js` extension of the compiled file even in `.ts`
  sources. That is how ESM works — TypeScript deliberately does not rewrite
  module specifiers — and it is the part that looks wrong to a reader coming
  from CommonJS.
- Any dependency that is CommonJS-only still works: ESM can import CommonJS. The
  reverse, which is where the pain usually lives, does not arise.
- `prisma.config.ts` and the generator `output` in `schema.prisma` change when
  the API skeleton lands.

## Revisit trigger

If a dependency the project needs turns out to work only under CommonJS, the
fallback stands: `apps/api` alone becomes CommonJS, and the shared packages stay
as they are, because Node 24 can `require()` them. Nothing else in this decision
would change.
