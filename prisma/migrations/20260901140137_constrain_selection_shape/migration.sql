-- Ties the shape of `selection` to the value of `market`.
--
-- `selection` is a jsonb column, and jsonb accepts anything: an object with the
-- wrong keys, a bare number, a string. ADR-0005 originally left that shape to
-- the validation layer, which protects only the path that runs the validator —
-- the seed script, a backfill and psql all reach this column directly.
--
-- The database rejects what can never be a valid bet: missing or unexpected
-- keys, wrong types, fractional or negative goals, an unknown outcome, a whole
-- totals line. The product bounds we may tune — at most 20 goals, a line within
-- 0.5 and 9.5 — stay in zod, where a violation can answer with a readable
-- message instead of SQLSTATE 23514.
--
-- Written by hand into an empty migration created with
-- `prisma migrate dev --create-only`, because `schema.prisma` cannot express a
-- CHECK constraint.
--
-- The branches are nested CASE expressions rather than one AND chain on
-- purpose: PostgreSQL does not promise to evaluate the operands of AND left to
-- right, while CASE never evaluates a branch it does not need. Without that
-- ordering, `selection - 'homeGoals'` on a bare number and `::numeric` on a
-- non-numeric value would raise a type error instead of failing the check.
--
-- Key presence is checked before the types are, and explicitly. Deleting a key
-- that is not there succeeds, and `jsonb_typeof` of a missing key returns NULL
-- rather than a type name — so comparing against it yields NULL, not false, and
-- a CHECK whose expression evaluates to NULL admits the row. `?` and `?&` are
-- what make a missing key a rejection.
--
-- The table is empty, so the constraint is added and validated in one step. On
-- a populated table this would be ADD CONSTRAINT ... NOT VALID followed by
-- VALIDATE CONSTRAINT, which checks existing rows without holding a lock that
-- blocks writes for the length of a full scan.
--
-- ELSE false: a market whose selection schema does not exist yet cannot be
-- written at all. Implementing one means adding its branch here in the same
-- pull request that adds its zod schema and its scoring strategy.

ALTER TABLE "predictions"
    ADD CONSTRAINT "predictions_selection_shape_check" CHECK (
        CASE "market"

            WHEN 'EXACT_SCORE' THEN
                CASE
                    WHEN jsonb_typeof("selection") <> 'object' THEN false
                    WHEN NOT "selection" ?& array['homeGoals', 'awayGoals'] THEN false
                    WHEN "selection" - 'homeGoals' - 'awayGoals' <> '{}'::jsonb THEN false
                    WHEN jsonb_typeof("selection" -> 'homeGoals') <> 'number' THEN false
                    WHEN jsonb_typeof("selection" -> 'awayGoals') <> 'number' THEN false
                    ELSE ("selection" ->> 'homeGoals')::numeric >= 0
                     AND ("selection" ->> 'awayGoals')::numeric >= 0
                     AND ("selection" ->> 'homeGoals')::numeric % 1 = 0
                     AND ("selection" ->> 'awayGoals')::numeric % 1 = 0
                END

            WHEN 'MATCH_RESULT' THEN
                CASE
                    WHEN jsonb_typeof("selection") <> 'object' THEN false
                    WHEN NOT "selection" ? 'result' THEN false
                    WHEN "selection" - 'result' <> '{}'::jsonb THEN false
                    ELSE "selection" ->> 'result' IN ('HOME', 'DRAW', 'AWAY')
                END

            WHEN 'TOTAL_GOALS' THEN
                CASE
                    WHEN jsonb_typeof("selection") <> 'object' THEN false
                    WHEN NOT "selection" ?& array['direction', 'line'] THEN false
                    WHEN "selection" - 'direction' - 'line' <> '{}'::jsonb THEN false
                    WHEN jsonb_typeof("selection" -> 'line') <> 'number' THEN false
                    WHEN "selection" ->> 'direction' NOT IN ('OVER', 'UNDER') THEN false
                    -- A whole line can be matched exactly by the total, which is
                    -- a push, and a market that is either right or wrong has no
                    -- third state to record one.
                    ELSE ("selection" ->> 'line')::numeric > 0
                     AND ("selection" ->> 'line')::numeric % 1 = 0.5
                END

            ELSE false
        END
    );
