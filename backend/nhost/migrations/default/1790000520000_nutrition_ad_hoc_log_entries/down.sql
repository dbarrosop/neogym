-- Roll back ad-hoc nutrition log support.
-- This is a development rollback only if ad-hoc rows already exist: dropping
-- source makes them indistinguishable from food-backed, food_id-null snapshot rows.

DROP TRIGGER IF EXISTS guard_public_nutrition_log_entry_snapshot_immutability ON public.nutrition_log_entries;
DROP FUNCTION IF EXISTS public.guard_nutrition_log_entry_snapshot_immutability();

ALTER TABLE public.nutrition_log_entries
  DROP CONSTRAINT IF EXISTS nutrition_log_entries_snapshot_food_name_format_check,
  DROP CONSTRAINT IF EXISTS nutrition_log_entries_ad_hoc_shape_check,
  DROP CONSTRAINT IF EXISTS nutrition_log_entries_source_check,
  DROP COLUMN IF EXISTS source;

COMMENT ON TABLE public.nutrition_log_entries IS
  'Historical food log rows. The trusted snapshot_* columns are populated by an insert-only trigger from foods and stay stable after source food edits/deletes; users can edit grams/position/slot_time only.';

CREATE OR REPLACE FUNCTION public.populate_nutrition_log_entry_food_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_food public.foods%ROWTYPE;
BEGIN
  IF NEW.food_id IS NULL THEN
    RAISE EXCEPTION 'nutrition_log_entries.food_id is required on insert so food snapshots can be populated'
      USING ERRCODE = '23502',
            HINT = 'Historical rows may later keep food_id NULL after source food deletion, but inserts must reference a visible food.';
  END IF;

  SELECT * INTO v_food FROM public.foods WHERE id = NEW.food_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'food % does not exist for nutrition log snapshot', NEW.food_id
      USING ERRCODE = '23503';
  END IF;

  NEW.snapshot_food_name := v_food.name;
  NEW.snapshot_kcal_per_100g := v_food.kcal_per_100g;
  NEW.snapshot_fat_per_100g := v_food.fat_per_100g;
  NEW.snapshot_carbs_per_100g := v_food.carbs_per_100g;
  NEW.snapshot_protein_per_100g := v_food.protein_per_100g;
  NEW.snapshot_fiber_per_100g := v_food.fiber_per_100g;
  NEW.snapshot_sugar_per_100g := v_food.sugar_per_100g;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.populate_nutrition_log_entry_food_snapshot() IS
  'Insert-only trusted snapshot trigger for nutrition_log_entries. Copies food name and per-100g nutrients at log time and rejects NULL food_id on insert; it deliberately does not run on update or food delete.';

COMMENT ON TRIGGER populate_public_nutrition_log_entry_food_snapshot ON public.nutrition_log_entries
IS 'insert-only trigger that copies trusted food snapshots into nutrition log entries';
