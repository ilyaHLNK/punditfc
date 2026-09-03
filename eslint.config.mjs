// @ts-check

/**
 * ESLint flat config for the whole repository.
 *
 * The file is one array of layers: later entries override earlier ones for the
 * files they match. That is how a single config serves pure packages, a Nest
 * API, a worker and a Next.js app without duplicating the base.
 *
 * Every rule enabled by hand carries the reason it is here. A configuration
 * that cannot be explained line by line was copied, not chosen.
 */

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // ---------------------------------------------------------------------------
  // Never linted: build output and generated code.
  // ---------------------------------------------------------------------------
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "prisma/generated/**",
      "prisma/migrations/**",
    ],
  },

  js.configs.recommended,

  // ---------------------------------------------------------------------------
  // TypeScript everywhere, with type information.
  //
  // strictTypeChecked is what makes this worth configuring: the rules ask the
  // type checker questions instead of matching patterns, which is the only way
  // to catch a floating promise or a misused async callback.
  // ---------------------------------------------------------------------------
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        // Resolves the right tsconfig per file on its own, which a monorepo
        // needs — every workspace has its own.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // Guards the scoring engine: ADR-0005 requires an exhaustive switch over
      // the market union, so that forgetting a market fails the build instead
      // of the job. A `default` branch does not excuse a missing case.
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { requireDefaultForNonUnion: true },
      ],

      // verbatimModuleSyntax emits imports exactly as written, so an unmarked
      // type import survives into the built JavaScript and pulls a module into
      // the runtime for nothing.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // `_` means "deliberately unused" — the only exception worth having.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // An injected dependency that is never reassigned should say so.
      "@typescript-eslint/prefer-readonly": "error",

      // Production logs are structured and carry a correlation id (docs/scope.md).
      // console.log produces a line that can be neither filtered nor traced.
      "no-console": "error",

      // CLAUDE.md, Conventions: unions come from zod schemas, not from enums.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message:
            "No TypeScript enums: derive the union from a zod schema in packages/contracts. Enums in schema.prisma are native PostgreSQL types and are unaffected.",
        },
      ],

      // `==` is banned except against null, where it is the idiomatic way to
      // cover null and undefined at once.
      eqeqeq: ["error", "always", { null: "ignore" }],

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  // ---------------------------------------------------------------------------
  // Pure packages: the dependency direction is a rule, so it is enforced.
  // ---------------------------------------------------------------------------
  {
    files: ["packages/**/*.ts"],
    rules: {
      // CLAUDE.md rule 4. packages/scoring must stay a pure function of its
      // arguments, and packages/contracts is bundled into the browser, where a
      // database client has no business being.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "**/prisma/generated/**", "@nestjs/*", "**/apps/**"],
              message:
                "Pure packages must not depend on persistence, the framework or an application. See CLAUDE.md rule 4 and ADR-0007.",
            },
          ],
        },
      ],

      // The public surface of a shared package is a contract. Left to
      // inference it changes silently when an implementation detail changes.
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },

  // ---------------------------------------------------------------------------
  // Applications.
  // ---------------------------------------------------------------------------
  {
    files: ["apps/**/*.ts"],
    rules: {
      // A NestJS module is an empty class carrying a decorator — the framework's
      // design, not a missed refactoring, and the rule cannot tell the
      // difference.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },

  // ---------------------------------------------------------------------------
  // Tooling configuration at the repository root.
  //
  // These files belong to no workspace tsconfig, so type-aware rules cannot run
  // on them, and printing to the console is exactly what they are for.
  // ---------------------------------------------------------------------------
  {
    files: ["*.config.{ts,mts,cts,js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { module: "readonly", require: "readonly", process: "readonly" },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  // Last: switches off every rule Prettier already decides.
  prettier,
);
