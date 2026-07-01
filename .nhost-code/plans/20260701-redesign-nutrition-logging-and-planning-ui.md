# Redesign nutrition logging and planning UI

**Status:** ready
**Created:** 2026-07-01

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

The current nutrition interfaces for logging food, logging meals, creating/editing meal templates, and creating/editing nutrition plans are unintuitive and incomplete. The product should let users build meals and plans without leaving the flow, and plans should be able to contain direct food items as well as meal templates.

### 1.2 Functional requirements

- Redesign daily intake logging into one unified flow for standalone foods, meal templates, selected plan meal suggestions, and selected plan food suggestions.
- Logging must allow actual eaten time to default to now but remain editable; planned/template times are provenance/suggestion only and must not be blindly copied as the logged time.
- Logging must allow grams to be reviewed/edited before save, show a macro preview, and write snapshot-backed log rows without rewriting source templates.
- Add backend support for nutrition plans to attach direct foods in addition to meals.
- Plan direct-food logs must write standalone `nutrition_log_entries` with `nutritionPlanFoodId` provenance.
- Meal-template logs and plan-meal logs must continue using one nested `insertNutritionLogMeal` with child `nutritionLogEntries`, every child explicitly carrying the same `nutritionDayId` as the parent group.
- Redesign meal create/edit so users can add, reorder, remove, and edit ingredients with live totals, search public/private foods, and create/edit private foods inline while composing a meal.
- Preserve the existing meal-ingredient invariant: changing an ingredient's `food_id` is delete+insert; user-role updates only edit grams/position.
- Redesign plan create/edit so timed plan entries can be either meal templates or direct foods, with labels, ordering within a time, macro totals, previews, and inline create/edit for meals/private foods.
- Preserve the plan-entry invariant: changing a plan meal's `meal_id` or plan food's `food_id` is delete+insert; user-role updates edit only mutable presentation/quantity fields.
- Update plan detail, daily plan suggestions, and target totals to display and compute both meal entries and direct food entries.
- Add native iOS parity for the same backend contract, plan display/editing, unified logging, and inline composition concepts.

### 1.3 Non-functional requirements / constraints

- Security and ownership must match existing nutrition patterns: users mutate only their private roots, may reference public foods where allowed, and cannot reference foreign private foods, plans, meals, or log rows.
- Historical logs remain immutable snapshots for nutrition math: daily totals are computed from `nutrition_log_entries.snapshot*` columns, never live food/meal/plan data.
- `nutrition_days.nutrition_plan_id` remains a suggestion/provenance pointer, not a binding scheduled assignment.
- Backend changes must be additive, migration-backed, tracked in Hasura metadata, permissioned for the `user` role, covered by negative tests, and include a down migration.
- Hasura metadata manual relationships around `nutrition_log_entries` must remain explicit; do not blindly auto-track relationships in a way that reintroduces the existing FK ambiguity footgun.
- `docs/developers/nutrition.md`, relevant permission docs, and `CLAUDE.md` must stay in sync with domain/tooling changes in the same phase.
- Frontend changes must use typed `graphql(...)`, `gqlRequest`, react-query, existing shadcn-style UI conventions, and product/domain components rather than a generic CRUD framework.
- Run `bun run codegen` after user-role GraphQL visibility changes and `bun run check` after frontend changes.
- Run `make test` after backend changes.
- Run `swift build` / `swift test` after iOS package changes, plus XcodeGen/xcodebuild when app files are added/removed or project wiring changes.
- Keep food quantities grams-only in this plan; serving/household-unit support is out of scope.
- Mobile usability matters for web and iOS; nested create/edit surfaces must be tested for focus, scroll, and touch usability.

### 1.4 Surfaces in scope

- `backend/nhost/migrations/default/` — new migration for direct plan foods and log-entry provenance.
- `backend/nhost/metadata/databases/default/tables/` — new table metadata, relationships, permissions, and updated log-entry metadata.
- `backend/tests/nutrition.test.ts` — permission, FK, provenance, and integrity tests for the new backend contract.
- `docs/developers/nutrition.md`, `docs/developers/permissions.md`, `CLAUDE.md` — documentation for the changed nutrition contract, operations caveats, and workflow expectations.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — generated user-role GraphQL contract.
- `frontend/src/lib/nutrition.ts` and tests — shared mixed plan-entry math and ordering helpers.
- `frontend/src/components/daily-intake-log.tsx`, `frontend/src/components/log-food-dialog.tsx`, `frontend/src/components/log-meal-dialog.tsx` — daily log and logging flow replacement.
- `frontend/src/components/meal-form.tsx`, `frontend/src/components/nutrition-plan-form.tsx`, `frontend/src/components/food-picker.tsx`, `frontend/src/components/meal-picker.tsx`, `frontend/src/components/food-form.tsx` — meal/plan composition and inline create/edit.
- `frontend/src/routes/_authed/nutrition/**` — plan, meal, food, and day route queries/mutations/display.
- `ios/NeoGym/Sources/NeoGymKit/*Nutrition*`, `ios/NeoGym/Sources/NeoGymKit/*Food*`, `ios/NeoGym/Sources/NeoGymKit/*Meal*` — native models, math, repositories, GraphQL documents, and tests.
- `ios/NeoGym/App/Nutrition/**` — native daily logging, plan editor/detail, meal editor, food/meal picker, and related views.

### 1.5 Out of scope

- Redesigning unrelated auth, profile, workout, session, exercise, body, or journal flows.
- Public food catalog administration or public-food curation workflows.
- Serving units / household measures beyond the existing grams/per-100g model.
- Changing the historical snapshot semantics of `nutrition_log_entries`.
- Replacing the existing Nhost/Hasura/GraphQL stack or introducing a generic CRUD framework.
- Implementing production code during architecture; this plan is for later `nhost-implement` execution.

### 1.6 Success criteria

- Users can create a private food inline while composing a meal, then create a meal inline while composing a plan.
- Users can create/edit a mixed nutrition plan containing timed meal entries and direct food entries.
- Users can select a plan on a day and log a plan meal and a plan food through a unified flow with edited actual time and grams.
- Daily totals use logged snapshots and remain unchanged after editing the source food/template.
- User-role tests reject foreign ownership, forged provenance, mutable immutable FKs, and snapshot writes.
- Backend `make test`, frontend `bun run codegen` / `bun run check`, and iOS `swift build` / `swift test` pass for the relevant phases.

---

## 2. Implementation strategy

### 2.1 Central design decision

Add direct plan foods with an additive sibling table, `public.nutrition_plan_foods`, rather than rewriting `nutrition_plan_meals` into a polymorphic table. Add `nutrition_log_entries.nutrition_plan_food_id` as nullable provenance for direct plan-food logs. Clients model plan contents as a union of meal entries and food entries, and write a merged/global `position` within each plan/time slot across both tables so mixed reordering is deterministic.

Plan foods log as standalone `nutrition_log_entries` with `nutritionPlanFoodId`. Plan meals continue to log as `nutrition_log_meals` groups with child `nutritionLogEntries` and `nutritionPlanMealId` provenance on the group.

### 2.2 Key constraints and invariants

- `nutrition_plan_foods.food_id` is immutable to the `user` role after insert; changing a plan food's source food is delete+insert.
- `nutrition_plan_foods.nutrition_plan_id` is immutable to the `user` role after insert.
- `nutrition_plan_foods.food_id` references visible foods: the caller's private foods or public foods.
- `nutrition_plan_foods.food_id` uses `ON DELETE RESTRICT`, so foods referenced by plans cannot be deleted until removed from plans.
- `nutrition_log_entries.nutrition_plan_food_id` is insertable/selectable but not user-updatable.
- A log entry with `nutrition_plan_food_id` must have the same `food_id` as the referenced plan food and must not also be grouped under `nutrition_log_meal_id`.
- Plan-food provenance may be nulled by deleting the plan/plan food, but logged nutrition and food name remain via snapshot columns.
- Mixed plan entries sort by `(slot_time, position, kind, id)` for stable display. Editors must assign `position` from the merged per-time-slot draft across both tables; `kind`/`id` are only fallback ties for legacy/imported collisions.
- Daily selected plan remains a suggestion. Logging from a plan creates independent historical rows and never rewrites the template.
- Existing manual Hasura relationships for `nutrition_log_entries` remain explicit.

### 2.3 Touched surfaces

- `backend/nhost/migrations/default/<timestamp>_nutrition_plan_foods/` — new additive schema and rollback.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plan_foods.yaml` — new table metadata and permissions.
- `backend/nhost/metadata/databases/default/tables/tables.yaml` — include the new table metadata.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plans.yaml` — add `nutritionPlanFoods` relationship.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — add `nutritionPlanFoodId` custom column/allowlists/relationship without disturbing existing manual relationships.
- `backend/tests/nutrition.test.ts` — backend contract tests.
- `docs/developers/nutrition.md`, `docs/developers/permissions.md`, `CLAUDE.md` — documentation updates.
- `frontend/src/lib/nutrition.ts` and tests — shared plan-entry helpers.
- `frontend/src/components/log-intake-dialog.tsx` — new unified logger.
- `frontend/src/components/log-food-dialog.tsx`, `frontend/src/components/log-meal-dialog.tsx` — remove once call sites migrate.
- `frontend/src/components/meal-form.tsx`, `nutrition-plan-form.tsx`, `food-picker.tsx`, `meal-picker.tsx`, `food-form.tsx` — composition UX.
- `frontend/src/routes/_authed/nutrition/**` — GraphQL documents, queries/mutations, and displays.
- `ios/NeoGym/Sources/NeoGymKit/` and `ios/NeoGym/App/Nutrition/` — native models/repositories/math/UI/tests.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** Backend schema changes are additive. Existing web and iOS clients that do not query `nutritionPlanFoods` or `nutritionPlanFoodId` continue to work; Swift decoders are not exposed to unrequested GraphQL fields.
- **Deployment:** Apply backend migration and metadata before deploying clients that query or mutate `nutritionPlanFoods`/`nutritionPlanFoodId`. Regenerate and commit frontend codegen after metadata is applied.
- **Rollback:** The down migration must drop `nutrition_log_entries.nutrition_plan_food_id` FK/index/column before dropping `nutrition_plan_foods`. Rolling back client code requires removing uses of the new GraphQL fields before removing metadata/schema.
- **Down migration validation:** `make dev-env-down && make dev-env-up` exercises only `up.sql`; implementers should either run an explicit local down→up migration check when practical or document down migration review constraints in the phase log.
- **Operations:** Food deletion can now be blocked by `meal_ingredients` and `nutrition_plan_foods`; user-facing delete error copy should mention both template references.

---

## 3. Phased plan of action

### Phase 1 — Backend contract, tests, docs, and codegen

**Goal:** Add direct food plan entries and plan-food log provenance at the backend contract level while existing clients remain functional.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/migrations/default/<timestamp>_nutrition_plan_foods/up.sql` — create `nutrition_plan_foods`, add `nutrition_log_entries.nutrition_plan_food_id`, add integrity trigger/checks and indexes.
- `backend/nhost/migrations/default/<timestamp>_nutrition_plan_foods/down.sql` — reverse in dependency order.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plan_foods.yaml` — new table metadata.
- `backend/nhost/metadata/databases/default/tables/tables.yaml` — include new table.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plans.yaml` — add `nutritionPlanFoods` array relationship.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — add custom column, select/insert allowlists, and `nutritionPlanFood` relationship while preserving manual relationships.
- `backend/tests/nutrition.test.ts` — add/extend tests.
- `docs/developers/nutrition.md`, `docs/developers/permissions.md`, `CLAUDE.md` — document new model, ordering, operations, and relationship caveats.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerate after metadata applies.
- `backend/nhost/seeds/` — optionally add one local sample direct plan-food row if existing seeds create sample nutrition plans.

**Implementation steps:**

1. Add `public.nutrition_plan_foods` with `id`, `nutrition_plan_id`, `food_id`, `grams numeric(8,2) NOT NULL CHECK (grams > 0)`, `slot_time time NOT NULL`, nullable `label`, `position integer NOT NULL CHECK (position >= 0)`, `created_at`, and `updated_at`.
2. Use FKs: `nutrition_plan_id REFERENCES nutrition_plans(id) ON UPDATE CASCADE ON DELETE CASCADE`; `food_id REFERENCES foods(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
3. Add indexes on `nutrition_plan_id`, `food_id`, and `(nutrition_plan_id, slot_time, position, id)`.
4. Add the standard `set_current_timestamp_updated_at` trigger and label/grams checks matching existing style.
5. Add nullable `nutrition_log_entries.nutrition_plan_food_id REFERENCES nutrition_plan_foods(id) ON UPDATE CASCADE ON DELETE SET NULL` plus an index.
6. Add a trigger/check function for plan-food provenance integrity: when `nutrition_plan_food_id IS NOT NULL`, `nutrition_log_meal_id` must be null and the referenced plan food's `food_id` must equal the log entry's `food_id`.
7. Write down migration that drops the provenance trigger/check, log-entry FK/index/column, relationships metadata expectations, and table in safe order.
8. Add `public_nutrition_plan_foods.yaml` with custom column names and root fields (`nutritionPlanFoods`, `insertNutritionPlanFood`, etc.).
9. Add object relationships `nutritionPlanFood.nutritionPlan`, `nutritionPlanFood.food`, `nutritionLogEntry.nutritionPlanFood`; add array relationships `nutritionPlan.nutritionPlanFoods` and `nutritionPlanFood.nutritionLogEntries` if supported without ambiguity.
10. Add user permissions: insert only for owned plan plus visible food; select/delete through owned plan; update only `grams`, `slot_time`, `label`, and `position`; never allow user update of `food_id` or `nutrition_plan_id`.
11. Add `nutrition_plan_food_id` to `nutrition_log_entries` user insert/select allowlists, but not update allowlists.
12. Keep existing manual `nutrition_log_entries` relationships intact and update docs explaining the extra relationship.
13. Add tests for own/public/foreign food references, foreign plans, immutable source FKs, immutable provenance, food/source consistency, no grouped plan-food provenance, `ON DELETE SET NULL`, snapshot preservation, food delete restriction, and plan delete cascade.
14. Update nutrition and permission docs plus `CLAUDE.md` in the same change.
15. Apply metadata/migrations locally and regenerate frontend GraphQL schema/types.

**Tests and checks:**

- `cd backend && make dev-env-down && make dev-env-up`
- `cd backend && make test`
- `cd frontend && nix develop ../ --command bun run codegen`
- `cd frontend && nix develop ../ --command bun run check` if generated TypeScript is touched.
- Explicit down→up migration check if practical; otherwise document down migration review in the implementation log.

**Definition of done:**

- Backend supports direct plan foods and log-entry plan-food provenance.
- User-role permissions enforce ownership, visibility, immutable source FKs, immutable provenance, and snapshot safety.
- Docs describe meal slots plus direct food slots, merged/global ordering, delete restrictions, and relationship caveats.
- Existing clients remain functional because all schema fields are additive.
- Backend tests and codegen pass.

**Phase commit message:** `feat(nutrition): add direct food entries to nutrition plans`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 2 — Frontend shared mixed plan-entry model

**Goal:** Add tested frontend primitives for mixed plan entries before changing UI behavior.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/lib/nutrition.ts` — plan-entry union, macro math, and merged ordering helpers.
- `frontend/src/lib/*.test.ts` or existing frontend test location — tests for mixed totals/order.

**Implementation steps:**

1. Add `PlanMealEntry`, `PlanFoodEntry`, and `PlanEntry` types compatible with generated GraphQL result shapes.
2. Add `planEntryMacroTotals(entry)` and `planEntriesMacroTotals(entries)` using existing `mealMacroTotals` and `macrosForGrams` helpers.
3. Add `mergePlanEntriesByTime(mealEntries, foodEntries)` that returns stable mixed entries grouped/sorted by `(slotTime, position, kind, id)`.
4. Document that editors write global merged `position` values per plan/time slot across both tables, and `kind`/`id` are stable fallbacks for collisions.
5. Keep old meal-only `planMacroTotals` compatibility until all callers are migrated.
6. Add tests for mixed totals, merged ordering with unique global positions, collision fallback ordering, numeric-string normalization, and direct food macros.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`

**Definition of done:**

- Shared helpers compute mixed plan totals and stable ordering.
- Tests lock the cross-table ordering contract before UI code relies on it.
- Existing meal-only callers still compile and behave as before.

**Phase commit message:** `feat(frontend): add mixed nutrition plan entry helpers`

**Implementation log**

- **Implementation notes:** Added mixed plan-entry types and helpers in
  `frontend/src/lib/nutrition.ts`: `PlanMealEntry`, `PlanFoodEntry`,
  `PlanEntry`, `planEntryMacroTotals`, `planEntriesMacroTotals`, and
  `mergePlanEntriesByTime`. The existing meal-only `planMacroTotals` helper was
  preserved for current callers. Added `frontend/src/lib/nutrition.test.ts`
  coverage for direct-food macros, mixed totals with Hasura numeric strings,
  global per-slot positions, and collision fallback ordering.
- **Reviewer verdict:** `ACCEPT`. Reviewer confirmed the helpers satisfy the
  phase definition of done, match the plan-wide `(slotTime, position, kind, id)`
  ordering contract, and do not widen scope.
- **Autonomous decisions:** Treated Phase 1 as satisfied by existing HEAD commit
  `c545a60a` despite its nonstandard message (`asd`). Justification:
  correctness and long-term maintenance — the Phase 1 files are present in HEAD
  and prior reviewers accepted them statically, so duplicating Phase 1 would be
  riskier than continuing the dependency chain. Accepted the helper's documented
  fallback kind order (`food` before `meal`) because the plan requires a stable
  fallback but does not mandate which kind wins; justification: long-term
  maintenance through deterministic behavior.
- **Quality gate:** `cd frontend && nix develop ../ --command bun run check`
  passed after installing frontend dependencies and generating the ignored route
  tree: TypeScript passed, Biome checked 104 files with no fixes, and Bun ran 97
  tests with 0 failures.

### Phase 3 — Web mixed plan display and baseline authoring

**Goal:** Let the web app create, edit, view, and use mixed meal/food plans before the full logging and inline-create redesign lands.

**Depends on:** Phases 1 and 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/nutrition-plan-form.tsx` — draft union for meal and food entries.
- `frontend/src/routes/_authed/nutrition/plans/new.tsx` — nested insert for both entry kinds.
- `frontend/src/routes/_authed/nutrition/plans/$planId_.edit.tsx` — mixed save diff.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` — mixed detail display.
- `frontend/src/components/daily-intake-log.tsx` — mixed selected-plan suggestions and target totals.
- `frontend/src/components/food-picker.tsx`, `frontend/src/components/meal-picker.tsx` — any minimal picker props needed for plan form.

**Implementation steps:**

1. Update GraphQL documents to fetch `nutritionPlanFoods { id slotTime label position grams food { ...macro fields } }` anywhere plan entries/totals/suggestions are shown.
2. Redesign `NutritionPlanForm` state from `slots` to mixed `entries` with `kind: "meal" | "food"`, shared `slotTime`, `label`, `position`, and kind-specific `mealId` or `foodId`/`grams`.
3. Add "Add meal entry" and "Add food entry" actions; food entries use `FoodPicker` plus grams input.
4. Compute per-entry and plan totals via Phase 2 helpers.
5. On submit, sort/group entries and renumber positions from the merged draft within each `slotTime` across both tables.
6. Update create mutation to nested-insert `nutritionPlanMeals` and `nutritionPlanFoods`.
7. Update edit diff: same `mealId`/`foodId` updates mutable fields; changed source deletes old row and inserts a new row; removed entries delete from the correct table.
8. Update plan detail to render one merged list with Meal/Food badges, labels, source names, grams for food entries, and macro totals.
9. Update daily selected-plan target totals and suggestions to include both kinds.
10. Add a baseline direct plan-food log action using standalone `insertNutritionLogEntry` with `nutritionPlanFoodId`, actual time defaulting to now and editable in a minimal dialog/adapter until Phase 4 replaces it.
11. Update food delete error detection/copy on web if plan-food restrictions surface in existing food delete flows.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen` if GraphQL documents changed.
- `cd frontend && nix develop ../ --command bun run check`
- Manual browser check: create/edit/view a mixed plan, reorder mixed entries within one time slot, verify merged display order, select the plan on a day, log a direct plan-food suggestion.

**Definition of done:**

- Web users can create and edit mixed plans with direct foods and meals.
- Plan detail and day suggestions show both kinds with correct totals.
- Phase is shippable before the full unified logger because direct plan-food suggestions have a baseline logging path.
- Existing meal-only plan behavior remains functional.

**Phase commit message:** `feat(frontend): support mixed nutrition plan entries`

**Implementation log**

- **Implementation notes:** Added web mixed meal/food nutrition-plan support across
  plan creation, editing, detail, list summaries, and daily selected-plan
  suggestions. `NutritionPlanForm` now edits a mixed draft union with meal and
  food entries, direct-food grams, merged per-time position renumbering, and
  Phase 2 total/order helpers. Plan create/edit mutations now write both
  `nutritionPlanMeals` and `nutritionPlanFoods` and preserve source-FK
  immutability by delete+insert on source changes. Added a baseline plan-food
  logging path through the existing food logging dialog, including editable
  actual time and standalone `nutritionPlanFoodId` provenance, and updated food
  delete copy/tests for plan-food restrictions.
- **Reviewer verdict:** `ACCEPT`. Reviewer verified the Phase 3 definition of
  done, including mixed create/edit, merged detail/day suggestions and totals,
  baseline plan-food logging, source-FK immutable edit diffs, and schema/gql
  additions matching Phase 1 metadata.
- **Autonomous decisions:** Kept `planMacroTotals`/`PlanTotalSlot` even though
  production callers migrated, deferring removal to Phase 8 cleanup because the
  plan explicitly preserved compatibility; justification: long-term maintenance
  and minimizing phase scope. Used `codegen:graphql` against the checked-in SDL
  rather than full live introspection because the local backend remains an
  unrelated schema; justification: correctness/security, avoiding generated
  artifacts from the wrong backend while keeping TypeScript documents current
  with the Phase 1 SDL additions.
- **Quality gate:** `cd frontend && nix develop ../ --command bun run check`
  passed: TypeScript passed, Biome checked 104 files with no fixes, and Bun ran
  99 tests with 0 failures. Full live `bun run codegen` and manual browser smoke
  remain pending for a correctly configured NeoGym backend environment.

### Phase 4 — Unified web logging flow

**Goal:** Replace separate food/meal logging dialogs with one coherent add-to-day flow.

**Depends on:** Phases 1, 2, and 3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/log-intake-dialog.tsx` — new unified logger.
- `frontend/src/components/log-food-dialog.tsx` — remove after migration.
- `frontend/src/components/log-meal-dialog.tsx` — remove after migration.
- `frontend/src/components/daily-intake-log.tsx` — use unified logger and remove old call sites.
- `frontend/src/lib/nutrition.ts` — any small draft/totals helper refinements.

**Implementation steps:**

1. Add `LogIntakeDialog` with modes/sections for Food, Meal, and From selected plan.
2. Search/browse foods, meals, and selected plan entries in one surface.
3. Materialize drafts: food → one standalone row; meal → one group with editable child rows; plan meal → meal group with `nutritionPlanMealId`; plan food → standalone row with `nutritionPlanFoodId`.
4. Default actual logged time to `currentTimeInputValue()` for all sources; keep it editable and do not auto-save template slot time as actual time.
5. Allow grams edits before save and show macro preview/review.
6. Save standalone food/plan-food drafts with `insertNutritionLogEntry`; never write snapshot columns from the client.
7. Save meal/plan-meal drafts with nested `insertNutritionLogMeal`, every child including `nutritionDayId` and selected `slotTime`.
8. Preserve query invalidations for `['nutrition', 'days', date]` and `['nutrition', 'days', 'index']`.
9. Migrate daily log and plan suggestions to `LogIntakeDialog`.
10. Delete `log-food-dialog.tsx` and `log-meal-dialog.tsx` once there are no call sites.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`
- Manual browser checks: log standalone food, meal template, plan meal, and plan food; edit actual time and grams before save; verify day totals update.
- Manual snapshot invariant check: log a plan food or plan meal, edit the source food's macro values, and verify the logged day's totals remain snapshot-based.

**Definition of done:**

- There is one unified web logging entry point for all supported sources.
- Old split logging dialogs are removed, not left as dead code.
- Logged rows preserve correct group/provenance shape and snapshot semantics.
- Existing daily log display and grams editing still work.

**Phase commit message:** `feat(frontend): unify nutrition intake logging`

**Implementation log**

- **Implementation notes:** Added `LogIntakeDialog` as the single web logging
  surface with Food, Meal, and From-plan modes. The dialog materializes editable
  gram drafts, previews aggregate macros via `intakeDraftMacroTotals`, defaults
  actual logged time to now, and saves standalone food/plan-food entries or
  nested meal/plan-meal groups with the correct provenance fields. Migrated daily
  log actions and plan suggestions to the unified dialog and deleted the old
  `log-food-dialog.tsx` and `log-meal-dialog.tsx` components.
- **Reviewer verdict:** `ACCEPT`. Reviewer verified a single unified entry
  point, old dialog deletion/no remaining call sites, correct standalone vs
  grouped provenance and snapshot semantics, editable time/grams, macro preview,
  and preserved query invalidations/daily log editing.
- **Autonomous decisions:** Deferred manual browser and snapshot-after-source-edit
  checks to the later cross-surface validation phase because no live backend was
  running in this environment; justification: correctness and long-term
  maintenance, keeping static/type/test gates authoritative while preserving the
  planned manual smoke path.
- **Quality gate:** `cd frontend && nix develop ../ --command bun run check`
  passed: TypeScript passed, Biome checked 103 files with no fixes, and Bun ran
  100 tests with 0 failures. LSP diagnostics on changed files were clean and
  grep found no old logging-dialog imports/call sites.

### Phase 5 — Web inline create/edit for nutrition composition

**Goal:** Let users create/edit private foods and meals inline while composing meals and plans.

**Depends on:** Phases 1 through 4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/meal-form.tsx` — inline private food create/edit while composing a meal.
- `frontend/src/components/nutrition-plan-form.tsx` — inline meal and private food create/edit while composing a plan.
- `frontend/src/components/food-picker.tsx`, `frontend/src/components/meal-picker.tsx` — picker actions or composable quick-create hooks.
- `frontend/src/components/food-form.tsx` — reuse validation/UI for quick create/edit.
- `frontend/src/routes/_authed/nutrition/foods/**`, `frontend/src/routes/_authed/nutrition/meals/**` — reuse mutation shapes where appropriate; avoid hiding domain logic in generic CRUD.

**Implementation steps:**

1. Note in code/phase log that `meal-form.tsx` already supports add/reorder/remove ingredients and live totals; this phase fills the inline-create/edit gap.
2. Add a quick private-food dialog/sheet for `MealForm`; on create, insert food, invalidate food picker queries, and select the new food in the current ingredient row.
3. Allow editing a selected private food inline and refresh totals after save.
4. Keep public foods read-only; do not add public catalog admin. If copy-to-private is not already supported, leave it out of scope.
5. Add quick meal create/edit from `NutritionPlanForm`, reusing `MealForm` and ensuring nested dialogs/sheets remain usable on mobile.
6. Add quick private-food create/edit from food entries in `NutritionPlanForm`.
7. Ensure plan and meal save diffs still perform delete+insert on source changes and update only mutable fields on preserved sources.
8. Update food/meal in-use error messages so plan-food references are explained when deletes are restricted.
9. Validate focus management, scroll containment, and cancel/close behavior for nested dialogs/sheets.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`
- Manual browser checks: create food inline in meal; edit private food inline and see totals update; create meal inline in plan; create food inline as direct plan entry; verify cancel does not mutate parent draft unexpectedly.

**Definition of done:**

- Users can compose meals/plans without leaving the current flow for private food/meal creation.
- Existing add/reorder/remove/live totals remain intact.
- Public-food permissions are respected.
- Mobile/nested-dialog usability is acceptable for the supported flows.

**Phase commit message:** `feat(frontend): add inline nutrition composition flows`

**Implementation log**

- **Implementation notes:** Added reusable quick private-food and meal dialogs
  backed by existing `FoodForm`/`MealForm` UI and typed GraphQL mutations.
  `MealForm` now supports inline private-food create/edit, selecting newly
  created foods into the active ingredient and refreshing edited private-food
  macros/totals while leaving public foods read-only. `NutritionPlanForm` now
  supports inline meal create/edit and direct private-food create/edit while
  preserving mixed add/reorder/remove/live totals and source-FK delete+insert
  semantics. Added focused helper tests for public/private editability, macro
  normalization, and meal-ingredient diff behavior.
- **Reviewer verdict:** `ACCEPT`. Reviewer confirmed the inline composition goal
  is satisfied, public foods remain read-only, source-FK diff semantics are
  preserved, and automated frontend validation passes. Reviewer model differed
  from the planned route because the requested Claude reviewer quota was
  exhausted.
- **Autonomous decisions:** Used `gpt-5.5` for the reviewer pass after
  `claude-opus-4-8` failed due quota. Justification: correctness and long-term
  maintenance — a fresh `nhost-reviewer` pass was still required before commit,
  and continuing with an available reviewer model was safer than skipping review.
  Deferred manual browser/mobile focus, scroll, cancel, and backend-backed smoke
  checks to Phase 8; justification: correctness, because no live backend/browser
  environment was available but automated checks and static review passed.
- **Quality gate:** `cd frontend && nix develop ../ --command bun run check`
  passed: TypeScript passed, Biome checked 106 files with no fixes, and Bun ran
  103 tests with 0 failures. `codegen:graphql`, LSP diagnostics, and diff checks
  also passed during implementation.

### Phase 6 — iOS NeoGymKit contract and repository parity

**Goal:** Teach native models, math, repositories, and tests about mixed plan entries and plan-food log provenance.

**Depends on:** Phase 1 and the stable web contract from Phases 2 through 4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` — plan food slots and mixed entries.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — `nutritionPlanFoodId` on log entries.
- `ios/NeoGym/Sources/NeoGymKit/NutritionMath.swift` — mixed totals and ordering helpers.
- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanRepositoryDocuments.swift` — queries/mutations/variables for `nutritionPlanFoods`.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — logging payloads with `nutritionPlanFoodId`.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` and related repository/model files — save/load logic.
- `ios/NeoGym/Tests/NeoGymKitTests/` — deterministic tests.

**Implementation steps:**

1. Add `NutritionPlanFoodSlot` and a mixed `NutritionPlanEntry` abstraction or equivalent computed merged entries.
2. Add `nutritionPlanFoodId` to native log-entry models.
3. Update nutrition math to include direct food entries and use the same global-position ordering contract as web.
4. Update GraphQL documents to query `nutritionPlanFoods` and `nutritionPlanFoodId`.
5. Update create/save plan variables to include parallel insert/update/delete blocks for `nutritionPlanFoods` and to avoid updating immutable source IDs.
6. Update logging payload builders so plan-food suggestions write `nutritionPlanFoodId`, actual time, `foodId`, and grams, and never snapshot fields.
7. Add tests for decoding mixed plans, computing mixed totals, ordering mixed entries, save variables, immutable IDs, and plan-food logging payloads.

**Tests and checks:**

- `cd ios/NeoGym && swift build`
- `cd ios/NeoGym && swift test`

**Definition of done:**

- NeoGymKit can load, save, compute, and log mixed plan entries.
- Deterministic tests cover the native contract without requiring a live backend.
- Unmodified native UI remains buildable because contract changes are additive.

**Phase commit message:** `feat(ios): add mixed nutrition plan contract support`

**Implementation log**

- **Implementation notes:** Added native mixed nutrition-plan contract support in
  NeoGymKit: direct food slots, mixed plan entries, mixed ordering by
  `(slotTime, position, kind, id)`, mixed macro totals, and additive form values
  for food slots. Repository documents and variable builders now load/save
  `nutritionPlanFoods`, diff food slots separately, and avoid updating immutable
  source IDs. Daily log models and payload builders now include
  `nutritionPlanFoodId`, with a `logPlanFood` helper that writes actual time,
  food id, grams, and provenance without snapshot fields. Added deterministic
  tests for mixed decoding, totals, ordering, save variables, immutable IDs, and
  plan-food logging payloads.
- **Reviewer verdict:** `ACCEPT`. Reviewer reported no blocking or warning
  findings for the Phase 6 contract/repository implementation.
- **Autonomous decisions:** Used `gpt-5.5` for the reviewer pass because the
  requested Claude reviewer quota had recently failed. Justification:
  correctness and long-term maintenance — retaining an independent reviewer pass
  was safer than skipping review. Used a clean system Swift environment for the
  mandatory gate after plain `swift build` failed due inherited Nix
  `SDKROOT`/compiler mismatch; justification: correctness, matching the
  repository-documented host Swift package workflow.
- **Quality gate:** Plain `cd ios/NeoGym && swift build` failed with
  `no such module 'SwiftShims'` in the inherited SDK environment. The strongest
  available equivalent passed: `swift build` and `swift test` both succeeded
  with Nix SDK-related variables unset and system toolchain paths restored;
  `swift test` executed 183 tests with 0 failures. `git diff --check` also
  passed.

### Phase 7 — iOS UI parity

**Goal:** Bring native nutrition plan editing and daily logging to parity with the redesigned web behavior.

**Depends on:** Phase 6

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/PlanEditorViews.swift` — mixed plan-entry editor and inline creation.
- `ios/NeoGym/App/Nutrition/PlanDetailView.swift` — mixed plan display.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — day suggestions and target totals.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — unified/cohesive logging sheet.
- `ios/NeoGym/App/Nutrition/MealEditorViews.swift` — inline private-food creation/edit.
- `ios/NeoGym/App/Nutrition/FoodPickerView.swift`, `MealPickerView.swift`, and related picker views — picker actions.
- `ios/NeoGym/project.yml` — update only if app files are added/removed.

**Implementation steps:**

1. Update plan detail and day suggestions to display mixed meal/food plan entries with correct totals.
2. Update plan editor rows to support Meal and Food entry kinds, labels, time, global per-slot order, and grams for food entries.
3. Add inline meal creation/editing and private-food creation/editing using existing native form style.
4. Replace or refactor logging sheets into one cohesive flow for food, meal, plan meal, and plan food sources.
5. Ensure native logging drafts support editable actual time defaulting to now, editable grams before save, macro review, and correct `nutritionPlanMealId` / `nutritionPlanFoodId` payloads.
6. Update meal editor to create/edit private foods inline while preserving deterministic fake-service tests.
7. Preserve `NeoGymTheme`, glass card/section primitives, keyboard Done toolbar, Dynamic Type/accessibility patterns, and keep SwiftUI/UIKit out of `NeoGymKit`.
8. Update iOS delete error copy for foods blocked by meal ingredients or plan foods.

**Tests and checks:**

- `cd ios/NeoGym && swift build`
- `cd ios/NeoGym && swift test`
- If app files are added/removed: `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- If feasible: `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Manual simulator checks for mixed plan creation, unified logging, editable time/grams, and snapshot-preserving history where feasible.

**Definition of done:**

- Native UI exposes the same supported nutrition capabilities as web.
- Logging and editors are intuitive, accessible, and deterministic under tests.
- iOS package and app build gates pass or skipped gates are explicitly justified.

**Phase commit message:** `feat(ios): redesign nutrition logging and planning UI`

**Implementation log**

- **Implementation notes:** Updated native plan lists, details, overview, and daily
  suggestions to display mixed meal/direct-food plan entries with mixed totals.
  Reworked native plan editing for mixed meal and food rows, direct-food grams,
  global per-slot ordering, and inline meal/private-food create/edit flows.
  Replaced split food/meal logging sheets with `LogIntakeSheet`, supporting food,
  meal, plan-meal, and plan-food sources with editable actual time, editable
  grams, macro preview, and correct provenance. Added inline private-food
  creation/editing in meal composition, updated delete copy, preview fixtures,
  and deterministic tests for shared positions and planned-day ad-hoc logging
  without accidental provenance.
- **Reviewer verdict:** Initial review `REJECT` for a provenance bug where ad-hoc
  Food/Meal modes could inherit a selected plan entry, plus a warning that Log
  meal opened on the Food tab. Follow-up review `ACCEPT` after gating plan-entry
  selection to locked/Plan mode, adding `adHocMeal`/`adHocFood` requests, and
  adding tests for ad-hoc planned-day logs without plan provenance.
- **Autonomous decisions:** Used `gpt-5.5` for reviewer passes because the
  requested Claude reviewer quota had recently failed. Justification:
  correctness and long-term maintenance — independent review was required before
  commit. Used a clean Xcode toolchain environment for gates after plain
  `swift build` failed in the inherited Nix SDK environment; justification:
  correctness and consistency with the repo's host Swift workflow.
- **Quality gate:** Clean-env `xcrun swift build`, `xcrun swift test`, and
  `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination
  'generic/platform=iOS Simulator' build` all passed. No app files were added or
  removed, so XcodeGen was not needed. Manual simulator smoke was not run and is
  left for Phase 8.

### Phase 8 — Cross-surface validation and cleanup

**Goal:** Verify the entire backend/web/iOS nutrition redesign works together and has no stale generated or dead-code artifacts.

**Depends on:** Phases 1 through 7

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- All touched backend, frontend, docs, generated GraphQL, and iOS files.
- `frontend/src/components/` — ensure old logging components are gone.
- `.nhost-code/plans/20260701-redesign-nutrition-logging-and-planning-ui.md` — update implementation logs if the implementer workflow requires it.

**Implementation steps:**

1. Re-run the full backend, frontend, and iOS gates.
2. Confirm generated GraphQL files are current and committed.
3. Confirm docs match the implemented schema, permissions, ordering, operations caveats, and UI behavior.
4. Confirm old `log-food-dialog.tsx` / `log-meal-dialog.tsx` components are deleted or intentionally absent with no imports.
5. Run the manual smoke path: create private food inline → create meal inline → create mixed plan → select plan today → log plan meal and plan food with edited actual time/grams → edit source food → verify historical logged totals remain snapshot-based.
6. Confirm user-facing delete errors explain food references from meal ingredients and plan foods.
7. Capture any skipped checks or known residual limitations in the final implementation log.

**Tests and checks:**

- `cd backend && make test`
- `cd frontend && nix develop ../ --command bun run codegen`
- `cd frontend && nix develop ../ --command bun run check`
- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` if feasible/app project changed.

**Definition of done:**

- All relevant automated checks pass or have explicit, reviewed skip rationale.
- Manual smoke path confirms intuitive end-to-end behavior and snapshot invariants.
- No stale dead-code logging components or stale generated GraphQL outputs remain.
- Documentation and plan implementation logs reflect final behavior.

**Phase commit message:** `chore(nutrition): validate redesigned logging and planning flows`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Backend supports direct food items in plans | 1 | Migration/metadata review, backend tests, codegen exposes `nutritionPlanFoods` |
| Correct ownership and food visibility for plan foods | 1 | User-role positive/negative tests for own/public/foreign foods and plans |
| Correct plan-food provenance | 1, 4, 6 | Tests for insert/select, update rejection, food/source consistency, no grouped plan-food provenance, web/iOS payload tests |
| Historical logs remain snapshot-based | 1, 4, 8 | Backend snapshot tests and manual smoke after editing source food |
| Mixed plan totals and ordering are deterministic | 2, 3, 6 | Frontend helper tests, native math tests, manual mixed reordering check |
| Web plan editor supports meal and direct food entries | 3 | `bun run check`, manual create/edit/view mixed plan |
| Unified web logger supports food/meal/plan meal/plan food | 4 | `bun run check`, manual logging paths and snapshot check |
| Meal editor inline private-food create/edit | 5 | Manual create/edit private food inside meal and totals refresh |
| Plan editor inline meal/private-food create/edit | 5 | Manual inline meal and food creation inside plan |
| iOS model/repository parity | 6 | `swift build`, `swift test`, deterministic model/repository tests |
| iOS UI parity | 7 | `swift build`, `swift test`, xcodebuild if feasible, simulator smoke |
| Docs and generated artifacts stay current | 1, 8 | Doc diff review, codegen, final validation |

---

## 6. Risks and mitigations

- **Risk:** False plan-food provenance could point to a different food or grouped meal entry. — **Mitigation:** Add DB trigger/check plus negative tests for food/source consistency and `nutrition_log_meal_id` incompatibility.
- **Risk:** Two sibling plan-entry tables can drift in mixed ordering. — **Mitigation:** Define global merged positions per plan/time slot, test the merge helper, and document fallback ordering.
- **Risk:** Hasura relationship ambiguity around `nutrition_log_entries` can regress. — **Mitigation:** Preserve manual relationships, add the new relationship deliberately, and document the footgun.
- **Risk:** Inline nested dialogs/sheets can be hard to use on mobile. — **Mitigation:** Scope them to private food/meal quick create/edit, validate focus/scroll/cancel behavior, and avoid public catalog admin complexity.
- **Risk:** iOS hand-written GraphQL documents can drift from backend/frontend generated contract. — **Mitigation:** Add native repository tests and run Swift build/test after contract changes.
- **Risk:** Food deletion failures become more common because plan foods also restrict deletes. — **Mitigation:** Update docs and user-facing error copy on web and iOS.
- **Risk:** Down migrations are less exercised than up migrations. — **Mitigation:** Write explicit drop order and run a down→up check when practical, otherwise document review-only constraints.

---

## 7. Follow-ups (out of scope for this plan)

- Serving sizes / household units beyond grams — tracked in: TBD.
- Public food catalog administration, curation, or copy-public-to-private workflow — tracked in: TBD.
- Snapshotting plan labels separately on direct plan-food log entries after provenance is deleted — tracked in: TBD if product needs label history beyond food snapshot names.
