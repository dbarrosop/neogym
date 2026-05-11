CREATE TABLE public.workout_session_cardio_entries (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_session_exercise_id   uuid NOT NULL REFERENCES public.workout_session_exercises(id) ON UPDATE CASCADE ON DELETE CASCADE,
  entry_number                  integer NOT NULL CHECK (entry_number >= 1),
  metrics                       jsonb NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_session_exercise_id, entry_number)
);

CREATE TRIGGER set_public_workout_session_cardio_entries_updated_at
BEFORE UPDATE ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_session_cardio_entries_updated_at ON public.workout_session_cardio_entries
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- A CHECK can't subquery another row, so validate `metrics` against the
-- parent exercise's `metrics_schema` via a BEFORE INSERT/UPDATE trigger.
CREATE OR REPLACE FUNCTION public.validate_workout_session_cardio_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_category text;
  v_schema   jsonb;
  v_errors   text[];
BEGIN
  SELECT e.category, e.metrics_schema INTO v_category, v_schema
  FROM public.workout_session_exercises wse
  JOIN public.exercises e ON e.id = wse.exercise_id
  WHERE wse.id = NEW.workout_session_exercise_id;

  IF v_category IS DISTINCT FROM 'cardio' OR v_schema IS NULL THEN
    RAISE EXCEPTION 'cannot log cardio entry for non-cardio exercise (category=%)', v_category
      USING ERRCODE = '22023',
            HINT = 'This exercise is not configured for cardio logging.';
  END IF;

  IF NOT jsonb_matches_schema(v_schema::json, NEW.metrics) THEN
    v_errors := jsonschema_validation_errors(v_schema::json, NEW.metrics::json);
    RAISE EXCEPTION 'cardio metrics failed schema validation: %', array_to_string(v_errors, '; ')
      USING ERRCODE = '23514',
            HINT = 'See exercise.metrics_schema for the required shape.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_public_workout_session_cardio_entries_metrics
BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id
ON public.workout_session_cardio_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session_cardio_entry();
