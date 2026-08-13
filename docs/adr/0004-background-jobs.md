# ADR-0004 — Background jobs with BullMQ

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

Two things must happen without a user request:

1. **Fixture sync** — pull fixtures and results from football-data.org, whose
   free tier allows 10 requests per minute.
2. **Scoring** — when a match reaches `FINISHED`, award points to every
   prediction in every pool covering that match.

Both are slow, both can fail, and neither may run inside an HTTP request.

## Decision

BullMQ backed by Redis, running in a **separate worker process** deployed as its
own service. Repeatable jobs handle scheduling.

Jobs:

| Job | Schedule | Purpose |
| --- | --- | --- |
| `sync-fixtures` | hourly | Refresh upcoming fixtures and kickoff times |
| `sync-live-results` | every 5 min, only while matches are in play | Pull final scores |
| `score-match` | enqueued when a match becomes `FINISHED` | Award points |
| `deadline-reminder` | hourly | Email members with missing predictions |

## Idempotency

The single most important property here. A job can be retried after a partial
failure, and a real score can be corrected hours later after a VAR review.

Rules:

- `Match.scoringStatus` (`PENDING | IN_PROGRESS | SCORED`) guards the transition.
- Scoring **recomputes and overwrites** `PredictionScore` rows rather than
  incrementing any running total. Recomputation is naturally idempotent;
  increments are not.
- A `score-match` job is keyed by match id so duplicates collapse.
- The whole award step runs in one transaction.
- Aggregate standings are derived from `PredictionScore`, never accumulated
  in place.

## Rate limiting the external API

- 10 req/min hard ceiling on the free tier, shared across every job.
- BullMQ's limiter caps the queue at a safe rate.
- Responses cached in Redis with a TTL that varies by match state: long for
  future fixtures, short while a match is in play.
- If the provider is unavailable the job retries with exponential backoff; the
  application degrades to showing stale data rather than failing.

## Alternatives considered

- **`node-cron` inside the API process** — simplest, but the job dies with the
  web dyno, competes with request handling for the event loop, and breaks the
  moment the API is scaled to two instances. Rejected.
- **pg-boss (Postgres-backed queue)** — attractive because it removes Redis
  entirely, and `SELECT … FOR UPDATE SKIP LOCKED` is a genuinely good pattern.
  Rejected because Redis is already needed for caching, and BullMQ is far more
  commonly requested in job descriptions.
- **RabbitMQ** — solves a problem this project does not have. With a handful of
  jobs per hour and one consumer, adding a broker would be complexity for the
  sake of appearance. It would be the right call with multiple consumers,
  routing requirements, or delivery guarantees across services.
- **Kafka** — event streaming for high-throughput pipelines. Nothing here
  resembles that workload.

## Consequences

- A second deployable service, with its own Dockerfile and health check.
- Redis becomes infrastructure the project cannot start without. Note that
  serverless per-request Redis offerings are unsuitable: BullMQ relies on
  blocking commands and long-lived connections.
