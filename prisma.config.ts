import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * Prisma 7 no longer reads `.env` implicitly and no longer takes the connection
 * string from `schema.prisma` — both moved here. `import "dotenv/config"` is
 * what loads the local `.env`.
 *
 * `env()` throws when the variable is missing, which is deliberate: a silent
 * fallback would let a command run against the wrong database. CI therefore has
 * to provide DATABASE_URL even for commands that do not touch the database.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
