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

COMMENT ON COLUMN public.exercises.kind IS
  'GENERATED STORED discriminator derived from category (''cardio'' iff category=''cardio'', else ''strength''). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based.';

COMMENT ON CONSTRAINT exercises_id_kind_uq ON public.exercises IS
  'Anchor for composite FKs from child tables that need to reference (id, kind). Without this UNIQUE, PostgreSQL would reject the child-side composite REFERENCES.';

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

COMMENT ON COLUMN public.workout_exercises.kind IS
  'Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don''t pass this; the trigger overwrites any client-supplied value.';

COMMENT ON CONSTRAINT workout_exercises_exercise_id_kind_fk ON public.workout_exercises IS
  'Composite FK to exercises(id, kind). Forces this row''s kind to match the parent exercise''s kind. ON UPDATE CASCADE + ON DELETE RESTRICT: a category flip on the parent that changes exercises.kind would cascade here, but the workout_exercises.kind sync trigger has already normalized this column, so the cascade would only succeed if both rows''s kinds stay aligned. A direct DELETE on a referenced exercise is rejected.';

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

COMMENT ON COLUMN public.workout_session_exercises.kind IS
  'Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don''t pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries).';

COMMENT ON CONSTRAINT workout_session_exercises_exercise_id_kind_fk ON public.workout_session_exercises IS
  'Composite FK to exercises(id, kind). See workout_exercises_exercise_id_kind_fk for the same rationale.';

COMMENT ON CONSTRAINT workout_session_exercises_id_kind_uq ON public.workout_session_exercises IS
  'Anchor for composite FKs from workout_session_strength_sets and workout_session_cardio_entries on (workout_session_exercise_id, parent_kind).';

CREATE OR REPLACE FUNCTION public.sync_workout_exercise_kind()
RETURNS TRIGGER AS $$
BEGIN
  SELECT kind INTO NEW.kind FROM public.exercises WHERE id = NEW.exercise_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_workout_exercise_kind() IS
  'BEFORE INSERT/UPDATE trigger function used by workout_exercises and workout_session_exercises. Looks up the parent exercise''s kind and overwrites NEW.kind with it, so the kind column is a pure FK slot — clients don''t set it. The composite FK to exercises(id, kind) would catch a wrong kind on its own, but this trigger normalizes the column so the row ends up with the correct kind instead of just rejecting the write.';

CREATE TRIGGER sync_public_workout_exercises_kind
BEFORE INSERT OR UPDATE OF exercise_id, kind ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.sync_workout_exercise_kind();
COMMENT ON TRIGGER sync_public_workout_exercises_kind ON public.workout_exercises IS
  'Syncs kind from parent exercise on INSERT and on UPDATE OF exercise_id, kind. See sync_workout_exercise_kind().';

CREATE TRIGGER sync_public_workout_session_exercises_kind
BEFORE INSERT OR UPDATE OF exercise_id, kind ON public.workout_session_exercises
FOR EACH ROW EXECUTE FUNCTION public.sync_workout_exercise_kind();
COMMENT ON TRIGGER sync_public_workout_session_exercises_kind ON public.workout_session_exercises IS
  'Syncs kind from parent exercise on INSERT and on UPDATE OF exercise_id, kind. See sync_workout_exercise_kind().';
