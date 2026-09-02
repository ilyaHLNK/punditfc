/**
 * Why a bet could not be scored.
 *
 * Three reasons rather than one, because they mean different things to whoever
 * is on call:
 *
 * - `UNKNOWN_MARKET` — the market is not in the contract at all. Version drift:
 *   a rolled-back release leaves rows this build does not recognise, and during
 *   a deploy the API and the worker are briefly on different versions.
 * - `UNIMPLEMENTED_MARKET` — a market the contract knows but that has no
 *   evaluator yet. A row from a future release, or a bug in whatever wrote it.
 * - `INVALID_SELECTION` — the JSON in the column does not match the schema for
 *   its market. Corrupt data, or a schema that changed under existing rows.
 */
export const SKIP_REASONS = [
  "UNKNOWN_MARKET",
  "UNIMPLEMENTED_MARKET",
  "INVALID_SELECTION",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

/**
 * The answer the engine gives.
 *
 * A losing bet is `SCORED` with zero points, not `SKIPPED` — skipped means "I
 * could not evaluate this", not "I evaluated it as wrong". The distinction
 * matters to the worker: a skip is written to the log and leaves no
 * `PredictionScore` row, while a miss is a normal result worth storing.
 *
 * The engine never logs. Logging is I/O, and the same document that asks for it
 * requires the engine to stay pure. The worker logs instead, because only the
 * worker knows the prediction id, the job and the attempt — the engine could
 * only ever write "unknown market", which is not a line anyone can investigate.
 */
export type ScoringOutcome =
  | { readonly status: "SCORED"; readonly points: number; readonly isHit: boolean }
  | { readonly status: "SKIPPED"; readonly reason: SkipReason };
