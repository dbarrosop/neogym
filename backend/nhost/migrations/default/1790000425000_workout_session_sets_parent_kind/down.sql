ALTER TABLE public.workout_session_sets
  DROP CONSTRAINT IF EXISTS workout_session_sets_workout_session_exercise_id_kind_fk,
  ADD CONSTRAINT workout_session_sets_workout_session_exercise_id_fkey
    FOREIGN KEY (workout_session_exercise_id)
    REFERENCES public.workout_session_exercises(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  DROP COLUMN IF EXISTS parent_kind;
