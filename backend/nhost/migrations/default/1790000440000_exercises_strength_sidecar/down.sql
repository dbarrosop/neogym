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
