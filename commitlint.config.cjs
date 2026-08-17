/**
 * Conventional Commits, enforced by a git hook so the rule does not depend on
 * anyone remembering it. See CLAUDE.md for the agreed commit style.
 *
 * Example: feat(predictions): lock submissions after kickoff
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "api",
        "worker",
        "web",
        "contracts",
        "scoring",
        "db",
        "auth",
        "pools",
        "predictions",
        "sync",
        "ci",
        "docker",
        "docs",
        "deps",
        "repo",
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
  },
};
