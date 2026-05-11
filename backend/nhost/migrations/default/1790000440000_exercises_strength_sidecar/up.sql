-- Move strength-only catalog columns out of the base `exercises` table into a
-- new `exercises_strength` sidecar, mirroring the existing `exercises_cardio`.
-- After this migration the class-table-inheritance shape is fully symmetric:
--
--   exercises                  ← truly shared columns
--     ├─ exercises_strength    ← double_weight, force, mechanic
--     └─ exercises_cardio      ← metrics_schema
--
-- Every exercise has exactly one matching sidecar row, determined by `kind`.
-- The invariant is enforced structurally: each sidecar pins a `kind` column to
-- its kind via DEFAULT + CHECK, and composite-FKs to `exercises(id, kind)`.
-- An `exercises.category` flip recomputes `exercises.kind`; ON UPDATE CASCADE
-- propagates into the sidecar's `kind`, which the pinned CHECK rejects — so
-- the whole transaction rolls back rather than leaving a wrong-kind sidecar
-- attached. Same trick used on workout_session_strength_sets.parent_kind /
-- workout_session_cardio_entries.parent_kind.
--
-- Adding a future kind (yoga, mobility, …) is a new sidecar with no changes
-- to the base or existing kinds.

CREATE TABLE public.exercises_strength (
  exercise_id    uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'strength' CHECK (kind = 'strength'),
  double_weight  boolean NOT NULL DEFAULT false,
  force          text REFERENCES public.exercise_forces(value)    ON UPDATE CASCADE ON DELETE RESTRICT,
  mechanic       text REFERENCES public.exercise_mechanics(value) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_strength_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind) REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TRIGGER set_public_exercises_strength_updated_at
BEFORE UPDATE ON public.exercises_strength
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_exercises_strength_updated_at ON public.exercises_strength
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- Carry over the indexes that previously lived on exercises(force) and
-- exercises(mechanic). The parent FK lookup tables are tiny, so the FK-check
-- speedup is negligible — but any faceted listing by force/mechanic on the
-- exercise catalog would otherwise regress to a seq scan.
CREATE INDEX exercises_strength_force_idx    ON public.exercises_strength(force);
CREATE INDEX exercises_strength_mechanic_idx ON public.exercises_strength(mechanic);

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

-- Retrofit exercises_cardio with the same pinned-kind composite-FK pattern.
-- exercises_cardio was created in migration 1790000410000 *before* `kind`
-- existed on exercises (that column lands in 1790000415000), so it only got a
-- single-column FK on exercise_id. That asymmetry left a hole: a category
-- flip on a private exercise with no WSE children would silently succeed and
-- leave a stale cardio sidecar attached to a now-strength exercise (or vice
-- versa). The DEFAULT + CHECK + composite FK closes it symmetrically with
-- exercises_strength above.
ALTER TABLE public.exercises_cardio
  ADD COLUMN kind text NOT NULL DEFAULT 'cardio' CHECK (kind = 'cardio'),
  DROP CONSTRAINT exercises_cardio_exercise_id_fkey,
  ADD CONSTRAINT exercises_cardio_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind) REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE;
