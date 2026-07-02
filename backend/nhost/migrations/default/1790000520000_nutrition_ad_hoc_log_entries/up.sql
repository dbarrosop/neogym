-- Add ad-hoc, log-only nutrition entries alongside food-backed logs.

ALTER TABLE public.nutrition_log_entries
  ADD COLUMN source text NOT NULL DEFAULT 'food',
  ADD CONSTRAINT nutrition_log_entries_source_check CHECK (source IN ('food', 'ad_hoc')),
  ADD CONSTRAINT nutrition_log_entries_ad_hoc_shape_check CHECK (
    source <> 'ad_hoc' OR (
      food_id IS NULL AND
      nutrition_plan_food_id IS NULL AND
      nutrition_log_meal_id IS NULL
    )
  ),
  ADD CONSTRAINT nutrition_log_entries_snapshot_food_name_format_check
    CHECK (length(btrim(snapshot_food_name)) BETWEEN 1 AND 160);

COMMENT ON COLUMN public.nutrition_log_entries.source IS
  'Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs.';

COMMENT ON TABLE public.nutrition_log_entries IS
  'Historical food log rows. source=food rows copy trusted snapshot_* values from foods at insert time; source=ad_hoc rows store standalone user-supplied snapshot values. Daily totals use snapshots, not live foods.';

CREATE OR REPLACE FUNCTION public.populate_nutrition_log_entry_food_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_food public.foods%ROWTYPE;
BEGIN
  IF NEW.source = 'food' THEN
    IF NEW.food_id IS NULL THEN
      RAISE EXCEPTION 'nutrition_log_entries.food_id is required for food-backed log entries'
        USING ERRCODE = '23502',
              HINT = 'Use source=ad_hoc with snapshot fields for standalone one-off log entries. Historical food-backed rows may later keep food_id NULL after source food deletion.';
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
  END IF;

  IF NEW.source = 'ad_hoc' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'unsupported nutrition_log_entries.source: %', NEW.source
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.populate_nutrition_log_entry_food_snapshot() IS
  'Insert-only snapshot trigger for nutrition_log_entries. Food-backed rows copy trusted food name and per-100g nutrients; ad-hoc rows keep user-supplied standalone snapshots and are constrained by table checks.';

COMMENT ON TRIGGER populate_public_nutrition_log_entry_food_snapshot ON public.nutrition_log_entries
IS 'insert-only trigger that copies trusted food snapshots into food-backed nutrition log entries and preserves ad-hoc snapshots';

CREATE OR REPLACE FUNCTION public.guard_nutrition_log_entry_snapshot_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.source IS DISTINCT FROM NEW.source THEN
    RAISE EXCEPTION 'nutrition_log_entries.source is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.source = 'food' AND (
    OLD.snapshot_food_name IS DISTINCT FROM NEW.snapshot_food_name OR
    OLD.snapshot_kcal_per_100g IS DISTINCT FROM NEW.snapshot_kcal_per_100g OR
    OLD.snapshot_fat_per_100g IS DISTINCT FROM NEW.snapshot_fat_per_100g OR
    OLD.snapshot_carbs_per_100g IS DISTINCT FROM NEW.snapshot_carbs_per_100g OR
    OLD.snapshot_protein_per_100g IS DISTINCT FROM NEW.snapshot_protein_per_100g OR
    OLD.snapshot_fiber_per_100g IS DISTINCT FROM NEW.snapshot_fiber_per_100g OR
    OLD.snapshot_sugar_per_100g IS DISTINCT FROM NEW.snapshot_sugar_per_100g
  ) THEN
    RAISE EXCEPTION 'food-backed nutrition log snapshots are immutable'
      USING ERRCODE = '23514',
            HINT = 'Update grams, position, or slot_time for food-backed rows; use source=ad_hoc for editable snapshot values.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.guard_nutrition_log_entry_snapshot_immutability() IS
  'Prevents source changes and protects food-backed snapshot columns while allowing ad-hoc snapshot edits and normal grams/position/slot_time corrections.';

CREATE TRIGGER guard_public_nutrition_log_entry_snapshot_immutability
BEFORE UPDATE OF source, snapshot_food_name, snapshot_kcal_per_100g, snapshot_fat_per_100g, snapshot_carbs_per_100g, snapshot_protein_per_100g, snapshot_fiber_per_100g, snapshot_sugar_per_100g
ON public.nutrition_log_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_nutrition_log_entry_snapshot_immutability();
COMMENT ON TRIGGER guard_public_nutrition_log_entry_snapshot_immutability ON public.nutrition_log_entries
IS 'protects source and food-backed snapshot immutability while allowing ad-hoc snapshot edits';
