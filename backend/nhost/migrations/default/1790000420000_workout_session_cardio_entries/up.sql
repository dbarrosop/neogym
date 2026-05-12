CREATE TABLE public.workout_session_cardio_entries (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_session_exercise_id   uuid NOT NULL,
  -- Discriminator pinned to 'cardio' so the composite FK below can only target
  -- a workout_session_exercises row whose kind is 'cardio'. This makes the
  -- strength/cardio split structural — strength sessions cannot accept cardio
  -- entries by construction, no trigger needed.
  parent_kind                   text NOT NULL DEFAULT 'cardio' CHECK (parent_kind = 'cardio'),
  entry_number                  integer NOT NULL CHECK (entry_number >= 1),
  metrics                       jsonb NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workout_session_exercise_id, parent_kind)
    REFERENCES public.workout_session_exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (workout_session_exercise_id, entry_number)
);

CREATE TRIGGER set_public_workout_session_cardio_entries_updated_at
BEFORE UPDATE ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_session_cardio_entries_updated_at ON public.workout_session_cardio_entries
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- Shape validation: the composite FK guarantees the parent is cardio; this
-- trigger validates that the metrics jsonb conforms to that exercise's JSON
-- Schema in exercises_cardio.metrics_schema. The kind check is no longer
-- needed here — the FK enforces it declaratively.
--
-- Temporal semantics: validation runs only at write time on this table
-- (INSERT, or UPDATE of metrics/workout_session_exercise_id). The schema is
-- intentionally treated as "shape at time of entry," not a forever invariant:
-- if the owner of a private cardio exercise later edits
-- exercises_cardio.metrics_schema, existing entries are NOT re-validated and
-- stay as-is. That is the right behavior for this domain — a user tweaking
-- their custom exercise's metric definition shouldn't have historical entries
-- retroactively rejected or quietly mutated. New writes pick up the new shape;
-- old writes stand on their own.
CREATE OR REPLACE FUNCTION public.validate_workout_session_cardio_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_kind   text;
  v_schema jsonb;
  v_errors text[];
BEGIN
  -- LEFT JOIN + v_schema-is-NULL branch is intentional defense-in-depth, not
  -- dead code. The deferred no-orphan triggers in migration 1790000440000
  -- guarantee that under normal operation every cardio exercise has its
  -- exercises_cardio sidecar at commit time, so an INNER JOIN would behave
  -- the same in practice. But that guarantee can be bypassed in two ways:
  --   1. SET session_replication_role = replica disables constraint triggers
  --      for the session (used by some restore/import tooling).
  --   2. A future migration that drops/recreates the no-orphan triggers in a
  --      window where data exists.
  -- In either case, an orphan cardio exercise (no sidecar) reaching this
  -- trigger should fail loudly with 22023, not silently insert an unvalidated
  -- entry. Do NOT "simplify" this to INNER JOIN — it removes the only guard
  -- on that path. This path has no automated test (the test infra can't run
  -- raw SQL: the Hasura sql/query API is disabled in nhost.toml), so the
  -- guarantee lives in this comment plus the explicit ERRCODE + HINT below.
  SELECT wse.kind, ec.metrics_schema INTO v_kind, v_schema
  FROM public.workout_session_exercises wse
  LEFT JOIN public.exercises_cardio ec ON ec.exercise_id = wse.exercise_id
  WHERE wse.id = NEW.workout_session_exercise_id;

  -- If the parent isn't cardio, let the composite FK reject the insert with a
  -- clearer "foreign key violation" message. Returning NEW here means the
  -- trigger noops and the FK fires on commit.
  IF v_kind IS DISTINCT FROM 'cardio' THEN
    RETURN NEW;
  END IF;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'cardio exercise has no metrics_schema configured'
      USING ERRCODE = '22023',
            HINT = 'Insert a row into exercises_cardio for this exercise first.';
  END IF;

  IF NOT jsonb_matches_schema(v_schema::json, NEW.metrics) THEN
    v_errors := jsonschema_validation_errors(v_schema::json, NEW.metrics::json);
    RAISE EXCEPTION 'cardio metrics failed schema validation: %', array_to_string(v_errors, '; ')
      USING ERRCODE = '23514',
            HINT = 'See exercises_cardio.metrics_schema for the required shape.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_public_workout_session_cardio_entries_metrics
BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id
ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session_cardio_entry();
