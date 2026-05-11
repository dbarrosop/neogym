-- Rename `workout_session_sets` to `workout_session_strength_sets` so the
-- kind-specific table names are symmetric:
--
--   workout_session_exercises  (base)
--     ├─ workout_session_strength_sets
--     └─ workout_session_cardio_entries
--
-- Constraint and trigger names contain the old prefix and don't auto-rename,
-- so we rename them too. Postgres takes care of internal FK references.

ALTER TABLE public.workout_session_sets RENAME TO workout_session_strength_sets;

ALTER TRIGGER set_public_workout_session_sets_updated_at ON public.workout_session_strength_sets
  RENAME TO set_public_workout_session_strength_sets_updated_at;

ALTER TABLE public.workout_session_strength_sets
  RENAME CONSTRAINT workout_session_sets_pkey
  TO workout_session_strength_sets_pkey;

ALTER TABLE public.workout_session_strength_sets
  RENAME CONSTRAINT workout_session_sets_workout_session_exercise_id_set_number_key
  TO workout_session_strength_sets_wse_id_set_number_key;

ALTER TABLE public.workout_session_strength_sets
  RENAME CONSTRAINT workout_session_sets_workout_session_exercise_id_kind_fk
  TO workout_session_strength_sets_wse_id_kind_fk;
