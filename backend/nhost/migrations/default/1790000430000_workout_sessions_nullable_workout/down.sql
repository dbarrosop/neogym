-- Reverting requires that no ad-hoc rows exist; otherwise the SET NOT NULL fails.
ALTER TABLE public.workout_sessions ALTER COLUMN workout_id SET NOT NULL;
