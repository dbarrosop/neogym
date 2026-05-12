-- Set up the discriminator-composite-FK pattern that enforces the
-- strength/cardio split structurally instead of via triggers.
--
-- `exercises.category` is a rich taxonomy (cardio, strength, stretching,
-- powerlifting, plyometrics, olympic_weightlifting, strongman) and stays as
-- catalog metadata. The discriminator that actually routes logging behavior
-- is binary: a session-exercise is either "cardio" (logs metric entries) or
-- "strength" (logs reps/weight sets). We materialize that binary discriminator
-- as `exercises.kind`, derived from category, and use *that* column in the
-- composite FKs.
--
--   1. `exercises.kind` is a GENERATED STORED column ('cardio' iff
--      category='cardio', else 'strength'). UNIQUE (id, kind) lets child
--      tables target the pair via composite FK.
--   2. `workout_exercises` and `workout_session_exercises` each gain a `kind`
--      column whose value is forced to match the parent exercise's kind via
--      composite FK on (exercise_id, kind). A BEFORE INSERT/UPDATE trigger
--      auto-populates it from the parent, so clients don't pass it.
--   3. `workout_session_exercises` also gains UNIQUE (id, kind) so the per-
--      kind entry tables can do the same trick against it (cardio entries in
--      migration 1790000420000, strength sets in 1790000425000).

UPDATE public.exercises SET category = 'strength' WHERE category IS NULL;

ALTER TABLE public.exercises
  ALTER COLUMN category SET NOT NULL,
  ADD COLUMN kind text
    GENERATED ALWAYS AS (CASE category WHEN 'cardio' THEN 'cardio' ELSE 'strength' END) STORED,
  ADD CONSTRAINT exercises_id_kind_uq UNIQUE (id, kind);

-- workout_exercises ---------------------------------------------------------
ALTER TABLE public.workout_exercises ADD COLUMN kind text;
UPDATE public.workout_exercises we
  SET kind = e.kind
  FROM public.exercises e
  WHERE we.exercise_id = e.id;
ALTER TABLE public.workout_exercises
  ALTER COLUMN kind SET NOT NULL,
  ADD CONSTRAINT workout_exercises_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind)
    REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  DROP CONSTRAINT workout_exercises_exercise_id_fkey;

-- workout_session_exercises -------------------------------------------------
ALTER TABLE public.workout_session_exercises ADD COLUMN kind text;
UPDATE public.workout_session_exercises wse
  SET kind = e.kind
  FROM public.exercises e
  WHERE wse.exercise_id = e.id;
ALTER TABLE public.workout_session_exercises
  ALTER COLUMN kind SET NOT NULL,
  ADD CONSTRAINT workout_session_exercises_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind)
    REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT workout_session_exercises_id_kind_uq UNIQUE (id, kind),
  DROP CONSTRAINT workout_session_exercises_exercise_id_fkey;

-- Auto-populate the discriminator from the parent exercise so the column is a
-- pure FK slot. The trigger overwrites any client-supplied value on every
-- INSERT, every UPDATE OF exercise_id, and every direct UPDATE OF kind — so a
-- wrong kind cannot bypass the composite FK either (the FK would catch it on
-- its own, but the trigger normalizes the column so the row ends up with the
-- correct kind instead of just rejecting the write).
CREATE OR REPLACE FUNCTION public.sync_workout_exercise_kind()
RETURNS TRIGGER AS $$
BEGIN
  SELECT kind INTO NEW.kind FROM public.exercises WHERE id = NEW.exercise_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_public_workout_exercises_kind
BEFORE INSERT OR UPDATE OF exercise_id, kind ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.sync_workout_exercise_kind();

CREATE TRIGGER sync_public_workout_session_exercises_kind
BEFORE INSERT OR UPDATE OF exercise_id, kind ON public.workout_session_exercises
FOR EACH ROW EXECUTE FUNCTION public.sync_workout_exercise_kind();
