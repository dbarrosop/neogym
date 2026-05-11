-- Move strength-only catalog columns out of the base `exercises` table into a
-- new `exercises_strength` sidecar, mirroring the existing `exercises_cardio`.
-- After this migration the class-table-inheritance shape is fully symmetric:
--
--   exercises                  ← truly shared columns
--     ├─ exercises_strength    ← double_weight, force, mechanic
--     └─ exercises_cardio      ← metrics_schema
--
-- Every exercise has exactly one matching sidecar row, determined by `kind`.
-- Adding a future kind (yoga, mobility, …) is a new sidecar with no changes
-- to the base or existing kinds.

CREATE TABLE public.exercises_strength (
  exercise_id    uuid PRIMARY KEY REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE CASCADE,
  double_weight  boolean NOT NULL DEFAULT false,
  force          text REFERENCES public.exercise_forces(value)    ON UPDATE CASCADE ON DELETE RESTRICT,
  mechanic       text REFERENCES public.exercise_mechanics(value) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_public_exercises_strength_updated_at
BEFORE UPDATE ON public.exercises_strength
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_exercises_strength_updated_at ON public.exercises_strength
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- Backfill from existing strength rows (everything that isn't cardio).
INSERT INTO public.exercises_strength (exercise_id, double_weight, force, mechanic)
SELECT id, double_weight, force, mechanic
FROM public.exercises
WHERE kind = 'strength';

-- Drop the moved columns from the base. FK constraints have to go first;
-- the exercises_force_idx and exercises_mechanic_idx indexes drop
-- automatically with their columns.
ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_force_fkey,
  DROP CONSTRAINT IF EXISTS exercises_mechanic_fkey,
  DROP COLUMN double_weight,
  DROP COLUMN force,
  DROP COLUMN mechanic;
