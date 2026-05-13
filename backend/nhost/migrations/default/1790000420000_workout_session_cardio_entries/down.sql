-- DROP TABLE CASCADE drops the trigger implicitly because the trigger lives
-- on the table, but being explicit keeps the down symmetric with the up and
-- avoids relying on cascade-ordering side-effects if the function ever moves.
DROP TRIGGER IF EXISTS validate_public_workout_session_cardio_entries_metrics
  ON public.workout_session_cardio_entries;
DROP TABLE IF EXISTS public.workout_session_cardio_entries CASCADE;
DROP FUNCTION IF EXISTS public.validate_workout_session_cardio_entry();
