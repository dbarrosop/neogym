# Nutrition domain

Nutrition tracks reusable foods, meals, daily meal plans, and what the user actually ate on a calendar day. The backend contract is additive and lives in migration `1790000500000_nutrition`; Hasura metadata exposes it to the `user` role through the same permission patterns described in [`permissions.md`](permissions.md).

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
- Sort children stably by `(position, id)` for meal ingredients and by `(slot_time, position, id)` for plan meals. There are no unique position constraints, so reorder swaps do not need deferred uniqueness tricks.

Template FKs intentionally restrict deletion: a food used by any `meal_ingredients` row cannot be deleted until that ingredient is removed, and a meal used by any `nutrition_plan_meals` row cannot be deleted until the slot is removed.

## Daily logs

`nutrition_days` is one private row per `(user_id, log_date)`. `nutrition_plan_id` is nullable and uses `ON DELETE SET NULL`: it records which template was selected as suggestions, not a scheduled assignment or binding contract.

`nutrition_log_meals` is an optional group/provenance row for a logged meal. It may point at a source `meal` and/or `nutrition_plan_meal`, but both FKs use `ON DELETE SET NULL` so historical logs remain if templates are deleted. `name` is a client-copied display snapshot. `slot_time` is the actual logged time-of-day chosen by the user, defaulting to now; for planned meals it must not be copied blindly from the template slot time.

`nutrition_log_entries` stores the actual consumed food rows. Standalone entries have `nutrition_log_meal_id IS NULL` and their own `slot_time` logged time-of-day, also defaulting to now. Grouped entries use the composite FK `(nutrition_log_meal_id, nutrition_day_id) -> nutrition_log_meals(id, nutrition_day_id) ON DELETE CASCADE`; their display time comes from the parent logged meal group. That FK both cascades group deletes and rejects a child entry whose group belongs to a different day.

## Trusted food snapshots

`nutrition_log_entries` introduces a trusted insert-only snapshot pattern:

- On `BEFORE INSERT`, `populate_nutrition_log_entry_food_snapshot()` requires `food_id IS NOT NULL` and copies food name plus per-100g nutrients into `snapshot_*` columns.
- The trigger does **not** run on update, and users cannot write snapshot columns or update `food_id`.
- Later food edits do not change historical rows.
- Later food deletes set `nutrition_log_entries.food_id` to null but keep the non-null `snapshot_*` values.

Daily totals must be computed from `grams / 100 * snapshot_*`, never from the live `foods` row. Hasura `numeric` values may arrive in clients as strings, so frontend helpers should normalize before doing macro math.

## Logging a meal

The GraphQL shape expected by the backend is a nested insert of one `nutritionLogMeal` with child `nutritionLogEntries`. Each child entry must explicitly include the same `nutritionDayId` as the group; Hasura/Nhost nested inserts populate `nutritionLogMealId`, but not the direct day FK used by permissions and the composite same-day FK. The parent group and child entries should all carry the user-selected logged `slotTime` (default now), while `nutritionPlanMealId` preserves which plan slot was used. `backend/tests/nutrition.test.ts` proves this shape early.

Metadata footgun: `nutrition_log_entries.nutrition_day_id` participates in both the direct day FK and the composite same-day group FK. Nhost GraphQL/Constellation can choose the wrong FK or generate ambiguous SQL if those relationships are auto-tracked from constraints. The metadata therefore uses manual relationships for `nutritionLogEntry.nutritionDay`, `nutritionLogEntry.nutritionLogMeal`, `nutritionDay.nutritionLogEntries`, and `nutritionLogMeal.nutritionLogEntries`; keep that explicit mapping if you regenerate or edit metadata.

## Operations caveat

`meal_ingredients.food_id` is `ON DELETE RESTRICT`. This means deleting a public food can be blocked by any user's private meal template once that food is referenced. Curated public foods should usually be edited, renamed/deprecated, or hidden by an admin migration rather than deleted after release.
