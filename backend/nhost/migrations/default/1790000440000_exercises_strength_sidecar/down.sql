-- Revert the exercises_cardio retrofit first, restoring the single-column FK
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
