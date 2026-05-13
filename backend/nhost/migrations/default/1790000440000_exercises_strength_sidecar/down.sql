-- Drop the deferred constraint triggers first so the rest of the down
-- migration can delete and reshape sidecars without tripping the no-orphan
-- checks at commit time.
DROP TRIGGER IF EXISTS exercises_cardio_no_orphan_parent ON public.exercises_cardio;
DROP TRIGGER IF EXISTS exercises_strength_no_orphan_parent ON public.exercises_strength;
DROP TRIGGER IF EXISTS exercise_must_have_sidecar ON public.exercises;
DROP FUNCTION IF EXISTS public.sidecar_delete_requires_parent_delete();
DROP FUNCTION IF EXISTS public.exercise_must_have_sidecar();

-- Revert the exercises_cardio retrofit, restoring the single-column FK
-- that the table was originally created with in migration 1790000410000.
ALTER TABLE public.exercises_cardio
  DROP CONSTRAINT IF EXISTS exercises_cardio_exercise_id_kind_fk,
  DROP COLUMN IF EXISTS kind,
  ADD CONSTRAINT exercises_cardio_exercise_id_fkey
    FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.exercises
  ADD COLUMN double_weight boolean NOT NULL DEFAULT false,
  ADD COLUMN force         text REFERENCES public.exercise_forces(value)    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN mechanic      text REFERENCES public.exercise_mechanics(value) ON UPDATE CASCADE ON DELETE RESTRICT;

UPDATE public.exercises e
   SET double_weight = es.double_weight,
       force         = es.force,
       mechanic      = es.mechanic
  FROM public.exercises_strength es
 WHERE es.exercise_id = e.id;

CREATE INDEX IF NOT EXISTS exercises_force_idx    ON public.exercises(force);
CREATE INDEX IF NOT EXISTS exercises_mechanic_idx ON public.exercises(mechanic);

-- DROP TABLE drops the strength-sidecar indexes implicitly, but being explicit
-- keeps the down migration symmetric with the up.
DROP INDEX IF EXISTS public.exercises_strength_force_idx;
DROP INDEX IF EXISTS public.exercises_strength_mechanic_idx;

DROP TABLE IF EXISTS public.exercises_strength;
