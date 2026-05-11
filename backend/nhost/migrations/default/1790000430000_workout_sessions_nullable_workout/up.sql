-- Allow ad-hoc sessions (e.g. quick cardio logging) without a parent workout.
ALTER TABLE public.workout_sessions ALTER COLUMN workout_id DROP NOT NULL;
