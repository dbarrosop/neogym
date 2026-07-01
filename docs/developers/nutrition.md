# Nutrition domain

Nutrition tracks reusable foods, meals, daily meal plans, and what the user actually ate on a calendar day. The backend contract is additive and lives in migrations `1790000500000_nutrition` and `1790000510000_nutrition_plan_foods`; Hasura metadata exposes it to the `user` role through the same permission patterns described in [`permissions.md`](permissions.md).

## Foods

`foods` is an owner-or-public catalog table, like `exercises`, `workouts`, and `labels`:

- Public/admin rows have `is_public = true` and `user_id IS NULL`.
- User-created private rows have `is_public = false` and `user_id = auth.users.id`.
- `UNIQUE NULLS NOT DISTINCT (user_id, name)` gives one public namespace and one private namespace per user.
- There is deliberately no `brand` column in v1.
- Nutrition is canonical per 100 grams: kcal, fat, carbs, protein, fiber, and sugar.

Users can read public foods and their private foods, but can insert/update/delete only their private foods. Public foods are seeded locally for tests/manual browsing. Production public-food bootstrapping is an admin/catalog operation; do not assume local Nhost seeds populate cloud projects.

## Meal and plan templates

`meals` and `nutrition_plans` are private per-user roots.

- `meal_ingredients` belongs to a meal and references a visible food. `food_id` is intentionally immutable to the user role after insert; changing a meal ingredient's food is delete+insert. `grams` and `position` are editable.
- `nutrition_plan_meals` belongs to a plan and references an owned meal. A plan is a reusable one-day template with ordered, required `slot_time` rows. `meal_id` is immutable after insert; changing a slot's meal is delete+insert.
- `nutrition_plan_foods` is the sibling direct-food slot table for plans. It belongs to a plan, references a visible food (public or the user's private food), stores `grams`, `slot_time`, optional `label`, and `position`, and keeps `nutrition_plan_id`/`food_id` immutable to the user role after insert. Changing the source food is delete+insert.
- Sort children stably by `(position, id)` for meal ingredients. Mixed plan entries sort by `(slot_time, position, kind, id)` after merging `nutrition_plan_meals` and `nutrition_plan_foods`; editors write a global `position` within each plan/time slot across both tables. There are no unique position constraints, so reorder swaps do not need deferred uniqueness tricks.

Template FKs intentionally restrict deletion: a food used by any `meal_ingredients` or `nutrition_plan_foods` row cannot be deleted until that reference is removed, and a meal used by any `nutrition_plan_meals` row cannot be deleted until the slot is removed.

## Daily logs

`nutrition_days` is one private row per `(user_id, log_date)`. `nutrition_plan_id` is nullable and uses `ON DELETE SET NULL`: it records which template was selected as suggestions, not a scheduled assignment or binding contract.

`nutrition_log_meals` is an optional group/provenance row for a logged meal. It may point at a source `meal` and/or `nutrition_plan_meal`, but both FKs use `ON DELETE SET NULL` so historical logs remain if templates are deleted. `name` is a client-copied display snapshot. `slot_time` is the actual logged time-of-day chosen by the user, defaulting to now; for planned meals it must not be copied blindly from the template slot time.

`nutrition_log_entries` stores the actual consumed food rows. Standalone entries have `nutrition_log_meal_id IS NULL` and their own `slot_time` logged time-of-day, defaulting to now; user-role updates can correct `grams`, `position`, and `slot_time`. Direct plan-food logs are standalone entries with nullable `nutrition_plan_food_id` provenance; the database rejects combining that provenance with a logged meal group and rejects any row whose `food_id` differs from the referenced plan food. Grouped entries use the composite FK `(nutrition_log_meal_id, nutrition_day_id) -> nutrition_log_meals(id, nutrition_day_id) ON DELETE CASCADE`; their display time comes from the parent logged meal group, whose `slot_time` is also user-editable. That FK both cascades group deletes and rejects a child entry whose group belongs to a different day. Day-scoped log ordering indexes lead with `(nutrition_day_id, slot_time, position, id)` for both meal groups and log entries so the database supports the slot-time-first daily intake display.

## Trusted food snapshots

`nutrition_log_entries` introduces a trusted insert-only snapshot pattern:

- On `BEFORE INSERT`, `populate_nutrition_log_entry_food_snapshot()` requires `food_id IS NOT NULL` and copies food name plus per-100g nutrients into `snapshot_*` columns.
- The trigger does **not** run on update, and users cannot write snapshot columns or update `food_id`.
- Later food edits do not change historical rows.
- Later food deletes set `nutrition_log_entries.food_id` to null but keep the non-null `snapshot_*` values.

Daily totals must be computed from `grams / 100 * snapshot_*`, never from the live `foods` row. Hasura `numeric` values may arrive in clients as strings, so frontend helpers should normalize before doing macro math.

## Logging from templates

Meal-template and plan-meal logging use a nested insert of one `nutritionLogMeal` with child `nutritionLogEntries`. Each child entry must explicitly include the same `nutritionDayId` as the group; Hasura/Nhost nested inserts populate `nutritionLogMealId`, but not the direct day FK used by permissions and the composite same-day FK. The parent group and child entries should all carry the user-selected logged `slotTime` (default now), while `nutritionPlanMealId` preserves which plan slot was used. `backend/tests/nutrition.test.ts` proves this shape early.

Direct plan-food logging uses a standalone `insertNutritionLogEntry` with `nutritionPlanFoodId`, `foodId`, grams, position, and the user-selected actual `slotTime`. The plan food's template `slot_time` is suggestion/provenance only and must not be blindly copied as the logged time. Deleting the plan or direct plan-food row nulls `nutrition_plan_food_id` on historical rows; snapshots and the consumed grams remain.

Metadata footgun: `nutrition_log_entries.nutrition_day_id` participates in both the direct day FK and the composite same-day group FK. Nhost GraphQL/Constellation can choose the wrong FK or generate ambiguous SQL if those relationships are auto-tracked from constraints. The metadata therefore uses manual relationships for `nutritionLogEntry.nutritionDay`, `nutritionLogEntry.nutritionLogMeal`, `nutritionDay.nutritionLogEntries`, and `nutritionLogMeal.nutritionLogEntries`; keep that explicit mapping if you regenerate or edit metadata. The `nutritionLogEntry.nutritionPlanFood` relationship is an additional simple FK relationship and does not replace those manual mappings.

## Operations caveat

`meal_ingredients.food_id` and `nutrition_plan_foods.food_id` are `ON DELETE RESTRICT`. This means deleting a public food can be blocked by any user's private meal or nutrition-plan template once that food is referenced. Curated public foods should usually be edited, renamed/deprecated, or hidden by an admin migration rather than deleted after release.
