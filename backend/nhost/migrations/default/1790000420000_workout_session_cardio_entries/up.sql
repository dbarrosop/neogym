CREATE TABLE public.workout_session_cardio_entries (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_session_exercise_id   uuid NOT NULL,
  parent_kind                   text NOT NULL DEFAULT 'cardio'
    CONSTRAINT workout_session_cardio_entries_parent_kind_check CHECK (parent_kind = 'cardio'),
  entry_number                  integer NOT NULL CHECK (entry_number >= 1),
  metrics                       jsonb NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_session_cardio_entries_wse_id_parent_kind_fk
    FOREIGN KEY (workout_session_exercise_id, parent_kind)
    REFERENCES public.workout_session_exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT workout_session_cardio_entries_wse_id_entry_number_key
    UNIQUE (workout_session_exercise_id, entry_number)
);

COMMENT ON TABLE public.workout_session_cardio_entries IS
  'Per-entry metric blobs logged for a cardio session-exercise. parent_kind is pinned to ''cardio'' (composite FK to workout_session_exercises(id, kind)), so this table can only attach to cardio session-exercises by construction — strength session-exercises cannot accept cardio entries, no trigger needed. The metrics jsonb shape is validated against the parent exercise''s exercises_cardio.metrics_schema by validate_workout_session_cardio_entry() at write time only.';

COMMENT ON COLUMN public.workout_session_cardio_entries.parent_kind IS
  'Pinned to ''cardio'' via DEFAULT + CHECK. Forms a composite FK with workout_session_exercise_id targeting workout_session_exercises(id, kind), so this row can only attach to a cardio session-exercise.';

COMMENT ON COLUMN public.workout_session_cardio_entries.metrics IS
  'Per-entry metric values. Shape validated against the parent exercise''s exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema.';

COMMENT ON CONSTRAINT workout_session_cardio_entries_parent_kind_check ON public.workout_session_cardio_entries IS
  'Pins parent_kind to ''cardio''. Combined with the composite FK to workout_session_exercises(id, kind), this makes the cardio/strength split structural — strength session-exercises cannot accept cardio entries.';

COMMENT ON CONSTRAINT workout_session_cardio_entries_wse_id_parent_kind_fk ON public.workout_session_cardio_entries IS
  'Composite FK to workout_session_exercises(id, kind). Only matches when parent kind = ''cardio''. See workout_session_strength_sets_wse_id_kind_fk for the symmetric strength constraint.';

CREATE TRIGGER set_public_workout_session_cardio_entries_updated_at
BEFORE UPDATE ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_session_cardio_entries_updated_at ON public.workout_session_cardio_entries
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

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

COMMENT ON FUNCTION public.validate_workout_session_cardio_entry() IS
  'BEFORE INSERT/UPDATE trigger function on workout_session_cardio_entries. Validates the metrics jsonb against the parent exercise''s exercises_cardio.metrics_schema (pg_jsonschema). Temporal semantics: validation runs only at write time, never retroactively — if the owner edits metrics_schema later, existing entries are not re-validated. The composite FK guarantees the parent is cardio; the trigger noops if not, leaving the FK to surface the clearer error. Raises 22023 if a cardio exercise lacks its sidecar (defense-in-depth against session_replication_role=replica), 23514 on shape mismatch.';

CREATE TRIGGER validate_public_workout_session_cardio_entries_metrics
BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id
ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session_cardio_entry();
COMMENT ON TRIGGER validate_public_workout_session_cardio_entries_metrics ON public.workout_session_cardio_entries IS
  'Shape validation of metrics jsonb against the parent exercise''s metrics_schema. See validate_workout_session_cardio_entry().';
