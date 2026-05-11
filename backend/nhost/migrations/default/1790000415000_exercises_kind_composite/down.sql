DROP TRIGGER IF EXISTS sync_public_workout_session_exercises_kind ON public.workout_session_exercises;
DROP TRIGGER IF EXISTS sync_public_workout_exercises_kind ON public.workout_exercises;
DROP FUNCTION IF EXISTS public.sync_workout_exercise_kind();

ALTER TABLE public.workout_session_exercises
  DROP CONSTRAINT IF EXISTS workout_session_exercises_id_kind_uq,
  DROP CONSTRAINT IF EXISTS workout_session_exercises_exercise_id_kind_fk,
  ADD CONSTRAINT workout_session_exercises_exercise_id_fkey
    FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  DROP COLUMN IF EXISTS kind;

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_exercise_id_kind_fk,
  ADD CONSTRAINT workout_exercises_exercise_id_fkey
    FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  DROP COLUMN IF EXISTS kind;

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_id_kind_uq,
  DROP COLUMN IF EXISTS kind,
  ALTER COLUMN category DROP NOT NULL;
