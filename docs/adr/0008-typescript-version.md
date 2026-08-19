# ADR-0008 — TypeScript version and the native compiler

- **Status:** Accepted
- **Date:** 2026-08-19

## Context

The repository was scaffolded with `typescript@7.0.2`, the current `latest` on
npm. TypeScript 7 is the compiler rewritten in Go: the same language, a much
faster `tsc`, and a package that no longer ships the JavaScript compiler API.

The export map of `typescript@7.0.2` makes that concrete:

```json
{
  ".": "./lib/version.cjs",
  "./unstable/sync": "./dist/api/sync/api.js",
  "./unstable/ast": "./dist/ast/index.js"
}
```

Importing `typescript` no longer yields a parser, a type checker or the AST
types. Those live behind a new, explicitly unstable API, and the compiler itself
is a native binary.

Every tool that reasons about types rather than merely transpiling them is built
on the old API. The one this project depends on immediately is
`typescript-eslint`, whose type-aware rules ask the checker questions —
`no-floating-promises` is not pattern matching, it is "does this expression
produce a Promise that nothing awaits?". Both its released and canary versions
declare:

```
"typescript": ">=4.8.4 <6.1.0"
```

No release supports TypeScript 7. The same constraint will apply to
`vitest --typecheck` and to the NestJS CLI plugins that derive OpenAPI schemas
from types.

Nothing in `packages/` or `apps/` exists yet, so the cost of changing the
version now is zero. In three weeks it would not be.

## Decision

Pin the workspace to **`typescript@6.0.3`**.

TypeScript 6 is the transition release: the last major built on the JavaScript
codebase, with the deprecations of TypeScript 7 already applied. It is the
newest version the toolchain supports, and code written against it is code that
compiles under 7.

Rejected alternatives:

- **Stay on 7.0.2 and disable type-aware lint rules.** The type-aware rules are
  the reason ESLint is being configured at all; without them the linter checks
  style and misses the class of bug — a forgotten `await` — that actually breaks
  a Node backend.
- **Two TypeScript versions — 7 for the build, 5.x for the linter.** Possible
  through `pnpm.overrides`, and a reliable way to end up with a compiler and a
  linter that disagree about the same file, months later, for no visible reason.
- **`typescript@5.9.3`.** The most conservative option and the fallback if any
  tool turns out to reject 6.x. Not chosen as the default because it leaves the
  project one further step away from 7.

## Revisit trigger

Move to TypeScript 7 when `typescript-eslint` declares it in
`peerDependencies` — that is the signal that the ecosystem has migrated to the
new API. Verify `vitest --typecheck` and the NestJS build at the same time.

Until then `typescript` stays pinned. A routine "update everything to latest"
silently disables the type-aware rules, because ESLint reports the missing
program as a warning rather than an error.

## Consequences

- `tsc` is the JavaScript implementation, so builds are slower than the native
  compiler would be. At this project size the difference is not measurable.
- The base `tsconfig.json` uses no options removed in 6.x, so the change is a
  version bump and nothing else.
- The constraint is recorded in the environment notes of `CLAUDE.md`, where the
  next session will read it before running an upgrade.
