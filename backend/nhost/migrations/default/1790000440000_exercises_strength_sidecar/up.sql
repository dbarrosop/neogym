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
  kind           text NOT NULL DEFAULT 'strength'
    CONSTRAINT exercises_strength_kind_check CHECK (kind = 'strength'),
  double_weight  boolean NOT NULL DEFAULT false,
  force          text REFERENCES public.exercise_forces(value)    ON UPDATE CASCADE ON DELETE RESTRICT,
  mechanic       text REFERENCES public.exercise_mechanics(value) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_strength_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind) REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.exercises_strength IS
  'Sidecar for strength exercises (class-table inheritance with exercises): carries strength-specific catalog metadata (double_weight, force, mechanic). kind is pinned to ''strength'' and composite-FKs to exercises(id, kind), making the strength/cardio split structural. Lifecycle is atomic: every strength exercise must have a matching row at commit time (exercise_must_have_sidecar trigger), and this row cannot be deleted standalone (sidecar_delete_requires_parent_delete trigger).';

COMMENT ON COLUMN public.exercises_strength.kind IS
  'Pinned to ''strength'' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction.';

COMMENT ON COLUMN public.exercises_strength.double_weight IS
  'Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used".';

COMMENT ON COLUMN public.exercises_strength.force IS
  'Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges.';

COMMENT ON COLUMN public.exercises_strength.mechanic IS
  'Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges.';

COMMENT ON CONSTRAINT exercises_strength_kind_check ON public.exercises_strength IS
  'Pins kind to ''strength''. Combined with the composite FK to exercises(id, kind), this rejects any cascade from a category flip that would make the parent ''cardio'' — the transaction rolls back.';

COMMENT ON CONSTRAINT exercises_strength_exercise_id_kind_fk ON public.exercises_strength IS
  'Composite FK to exercises(id, kind). Pinned-kind enforcement: this row can only attach to a strength exercise. ON UPDATE CASCADE + the pinned CHECK above are what make category flips atomic.';

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
  ADD COLUMN kind text NOT NULL DEFAULT 'cardio'
    CONSTRAINT exercises_cardio_kind_check CHECK (kind = 'cardio'),
  DROP CONSTRAINT exercises_cardio_exercise_id_fkey,
  ADD CONSTRAINT exercises_cardio_exercise_id_kind_fk
    FOREIGN KEY (exercise_id, kind) REFERENCES public.exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE;

COMMENT ON COLUMN public.exercises_cardio.kind IS
  'Pinned to ''cardio'' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength.';

COMMENT ON CONSTRAINT exercises_cardio_kind_check ON public.exercises_cardio IS
  'Pins kind to ''cardio''. See exercises_strength_kind_check for the symmetric strength constraint.';

COMMENT ON CONSTRAINT exercises_cardio_exercise_id_kind_fk ON public.exercises_cardio IS
  'Composite FK to exercises(id, kind). Pinned-kind enforcement: this row can only attach to a cardio exercise. Retrofitted from a single-column FK to close the asymmetry with exercises_strength.';

-- Atomicity: every exercise has a matching sidecar at commit time, and a
-- sidecar can only be deleted when its parent exercise is also deleted in
-- the same transaction.
--
-- The composite-FK + pinned-kind plumbing above blocks kind-changing flips
-- and wrong-kind inserts, but on its own it doesn't prevent two remaining
-- bad states an admin (or a careless seed) could still reach:
--
--   1. Exercise inserted without a matching sidecar. For cardio this makes
--      the per-entry validation trigger raise 22023 ("cardio exercise has
--      no metrics_schema configured") on every logged entry; for strength
--      it silently elides the catalog metadata sidecar.
--   2. Sidecar deleted standalone, leaving the parent exercise in state (1).
--
-- We close both with DEFERRABLE INITIALLY DEFERRED constraint triggers, so
-- the check fires at commit and clients can INSERT the exercise and its
-- matching sidecar in either order within the same transaction. The natural
-- shapes are:
--
--   - Hasura nested mutation:
--       insertExercise(object: { ..., strength: { data: { ... } } })
--       insertExercise(object: { ..., cardio:   { data: { ... } } })
--     Hasura inserts the parent first, then the nested child, both within
--     one transaction; the deferred check passes at commit.
--   - SQL CTE:
--       WITH e AS (INSERT INTO exercises (...) VALUES (...) RETURNING id)
--       INSERT INTO exercises_strength (exercise_id, ...) SELECT id, ... FROM e;
--
-- The check is enforced for admins and users alike — only the deliberate
-- `SET session_replication_role = replica` (disables all user triggers)
-- escapes, which is the well-known PG "I know what I'm doing" footgun.
--
-- We DON'T provide a default-valued auto-create trigger because the cardio
-- metrics_schema is genuinely per-exercise — there's no useful generic
-- default, and silently inserting an empty schema would just shift the
-- failure mode from "tx aborts at commit" to "every logged entry fails
-- validation". An explicit "you forgot the sidecar" at commit time is the
-- clearer failure.

CREATE OR REPLACE FUNCTION public.exercise_must_have_sidecar()
RETURNS TRIGGER AS $$
DECLARE
  v_kind text;
  v_has_sidecar boolean;
BEGIN
  -- By the time the deferred trigger fires the exercise might have been
  -- deleted within this transaction (insert+delete in the same tx); if so,
  -- no orphan possible — skip.
  SELECT kind INTO v_kind FROM public.exercises WHERE id = NEW.id;
  IF v_kind IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_kind = 'strength' THEN
    v_has_sidecar := EXISTS (SELECT 1 FROM public.exercises_strength WHERE exercise_id = NEW.id);
  ELSE
    v_has_sidecar := EXISTS (SELECT 1 FROM public.exercises_cardio WHERE exercise_id = NEW.id);
  END IF;

  IF NOT v_has_sidecar THEN
    RAISE EXCEPTION 'exercise % (kind=%) is missing its matching sidecar at commit time', NEW.id, v_kind
      USING ERRCODE = '23503',
            HINT = 'INSERT the matching exercises_strength or exercises_cardio row in the same transaction. Hasura: nested mutation { ..., strength|cardio: { data: {...} } }. SQL: CTE with INSERT...RETURNING.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.exercise_must_have_sidecar() IS
  'DEFERRABLE INITIALLY DEFERRED constraint trigger function (AFTER INSERT on exercises). At commit time, verifies the inserted exercise has a matching exercises_strength or exercises_cardio row. Lets clients INSERT parent and sidecar in either order within a single transaction (Hasura nested mutation or SQL CTE). Bypassed by SET session_replication_role = replica (the deliberate PG footgun). AFTER INSERT only is deliberate: kind/category UPDATE paths are covered by the GENERATED kind column (1790000415000) plus the pinned CHECK + composite FK on each sidecar — a kind-changing category flip rolls the whole transaction back via cascade, so no UPDATE-time guard is needed here.';

-- AFTER INSERT only is deliberate. Post-insert protection against a wrong-
-- kind or missing sidecar is covered by two other invariants:
--   1. `exercises.kind` is GENERATED STORED from category (migration
--      1790000415000) — clients can't set or update `kind` directly.
--   2. Each sidecar pins `kind` via DEFAULT + CHECK and composite-FKs to
--      exercises(id, kind) with ON UPDATE CASCADE. A category flip
--      recomputes kind; the cascade hits the pinned CHECK and rolls back.
-- A future migration that removes (1) or weakens (2) must revisit this
-- trigger and widen it to AFTER INSERT OR UPDATE OF category, kind.
CREATE CONSTRAINT TRIGGER exercise_must_have_sidecar
AFTER INSERT ON public.exercises
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.exercise_must_have_sidecar();
COMMENT ON TRIGGER exercise_must_have_sidecar ON public.exercises IS
  'Deferred AFTER INSERT check: every new exercise must have a matching sidecar (exercises_strength or exercises_cardio) row at commit time. See exercise_must_have_sidecar().';

CREATE OR REPLACE FUNCTION public.sidecar_delete_requires_parent_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If the parent exercise still exists at commit time, deleting this
  -- sidecar orphaned it. The CASCADE path from `DELETE FROM exercises`
  -- removes both atomically and skips this check (the parent is gone, so
  -- the EXISTS below is false).
  IF EXISTS (SELECT 1 FROM public.exercises WHERE id = OLD.exercise_id) THEN
    RAISE EXCEPTION 'deleting % standalone would orphan exercise %', TG_TABLE_NAME, OLD.exercise_id
      USING ERRCODE = '23503',
            HINT = 'sidecar lifecycle is owned by the parent exercise — DELETE FROM exercises (the CASCADE removes the sidecar atomically).';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sidecar_delete_requires_parent_delete() IS
  'DEFERRABLE INITIALLY DEFERRED constraint trigger function (AFTER DELETE on each sidecar). At commit time, refuses to commit if the sidecar was deleted standalone — i.e., the parent exercise still exists. The CASCADE path from DELETE FROM exercises skips this check (parent is gone, so the EXISTS check passes through). Bypassed by SET session_replication_role = replica.';

CREATE CONSTRAINT TRIGGER exercises_strength_no_orphan_parent
AFTER DELETE ON public.exercises_strength
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.sidecar_delete_requires_parent_delete();
COMMENT ON TRIGGER exercises_strength_no_orphan_parent ON public.exercises_strength IS
  'Deferred AFTER DELETE check: standalone sidecar deletion would orphan the parent exercise. See sidecar_delete_requires_parent_delete().';

CREATE CONSTRAINT TRIGGER exercises_cardio_no_orphan_parent
AFTER DELETE ON public.exercises_cardio
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.sidecar_delete_requires_parent_delete();
COMMENT ON TRIGGER exercises_cardio_no_orphan_parent ON public.exercises_cardio IS
  'Deferred AFTER DELETE check: standalone sidecar deletion would orphan the parent exercise. See sidecar_delete_requires_parent_delete().';
