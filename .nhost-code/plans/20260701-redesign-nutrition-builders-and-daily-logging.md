# Redesign nutrition builders and daily logging

**Status:** ready
**Created:** 2026-07-01

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

The nutrition flows are too narrow and fragmented: food and meal logging are split into small dead-end dialogs, meal and plan forms do not help users complete common tasks in-place, and nutrition plans are meal-only even though one-day templates should be able to include direct foods as first-class planned items.

### 1.2 Functional requirements

- Add first-class direct planned foods to nutrition plans alongside planned meal slots.
- Render, create, edit, and delete one-day nutrition plans as a single timed mixed item list.
- Support live macro totals for mixed plans and keep existing meal/template totals accurate.
- Redesign daily logging around a full builder that can stage foods and meal templates, edit grams/time/name/contents before save, and materialize logs through snapshot-triggered inserts.
- Let selected-plan suggestions show both planned meals and planned foods; quick-log suggestions at actual logged time defaulting to now, with template time used only as suggestion/provenance.
- Add post-save editing for standalone entry grams, time, and user-facing display label; add logged meal group editing for group name/time and child contents.
- Improve meal creation/editing with clearer ingredient rows, live totals, and hybrid inline food creation from food pickers while preserving full food pages.
- Preserve historical display and totals for existing logs using logged snapshot columns.
- Continue using `replace: true` when navigating away from spent forms/builders.

### 1.3 Non-functional requirements / constraints

- Follow existing Nhost/Hasura patterns: schema changes via migrations with down migrations, tracked metadata, relationships, permissions, tests, codegen, and docs.
- Preserve per-user security boundaries for private meals/plans/days/logs and owner-or-public food visibility.
- Logged totals must use trusted `snapshot_*` columns; live food/template edits must never rewrite historical nutrition.
- `nutrition_days.nutrition_plan_id` remains suggestion/provenance only, not a scheduled assignment or binding contract.
- Nested meal logging must explicitly set each child `nutritionLogEntry.nutritionDayId` to the parent group day.
- Keep UI mobile-friendly, accessible, explicit/domain-specific, and consistent with the repository's component tier rules.
- Do not introduce a generic CRUD framework or widen into catalog/admin tooling.

### 1.4 Surfaces in scope

- `backend/nhost/migrations/default/*_nutrition_plan_foods/` — planned food table and log-entry provenance/display fields.
- `backend/nhost/metadata/databases/default/tables/*.yaml` — new table registration, relationships, and user-role permissions.
- `backend/tests/nutrition.test.ts` — security, integrity, provenance, and logging tests for the new backend contract.
- `docs/developers/nutrition.md` — mixed plan and logging contract updates.
- `docs/developers/database.md` — ER diagram/schema documentation updates for the added table/relationships.
- `CLAUDE.md` — nutrition/tooling guidance updates for future agents.
- `frontend/schema.user.graphqls` and `frontend/src/gql/` — regenerated user-role GraphQL outputs.
- `frontend/src/lib/nutrition.ts` and nutrition helper tests — mixed totals, ordering, and display-name helpers.
- `frontend/src/components/nutrition-plan-form.tsx` — mixed timed plan builder.
- `frontend/src/components/meal-form.tsx` — meal builder UX and inline food creation wiring.
- `frontend/src/components/food-picker.tsx` and `frontend/src/components/meal-picker.tsx` — picker affordances used by builders.
- `frontend/src/components/daily-intake-log.tsx` and new daily builder components/routes — unified logging and post-save editing.
- `frontend/src/routes/_authed/nutrition/{days,meals,plans}/**/*.tsx` — route wiring, mutations, and spent navigation.

### 1.5 Out of scope

- Food brand fields, public catalog/admin tooling, and production public-food bootstrapping.
- Multi-day plans or calendar-scheduled nutrition assignments.
- Changing the per-100g macro model.
- Rewriting nutrition flows into a generic CRUD framework.
- Drag-and-drop ordering libraries unless the implementer explicitly determines existing button controls cannot meet usability needs.

### 1.6 Success criteria

- Users can build/edit meals and plans intuitively, including plans that mix meal slots and direct food slots.
- Users can log and later correct daily intake through a unified builder/editing flow without losing snapshot/provenance semantics.
- Plan suggestions include both planned meals and planned foods and can quick-log or customize at actual logged time.
- Backend tests prove new permission/FK/security invariants, including negative cases.
- `frontend/schema.user.graphqls` and `frontend/src/gql/` are regenerated after user-role schema changes.
- `cd backend && make test` and `cd frontend && nix develop ../ --command bun run check` pass when relevant phases are complete.
- Docs and `CLAUDE.md` remain consistent with the implemented schema and UI contract.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use an additive relational model. Add `nutrition_plan_foods` as a sibling table to `nutrition_plan_meals`, rather than hiding direct foods as synthetic meals or JSON. Add nullable `nutrition_log_entries.nutrition_plan_food_id` and nullable `display_name` so planned-food logs can preserve provenance and a user-facing label without changing immutable trusted snapshots. Frontend work then proceeds from shared helpers to mixed plan editing, improved meal editing, a dedicated daily logging route, and post-save correction flows.

### 2.2 Key constraints and invariants

- `nutrition_plan_foods.food_id` uses `ON DELETE RESTRICT`, mirroring `meal_ingredients.food_id` and protecting templates from deleted source foods.
- `nutrition_plan_foods.food_id` is immutable to the `user` role; changing a planned food source is delete+insert.
- User-role insert of `nutrition_log_entries.nutrition_plan_food_id` must allow `NULL` or require the referenced `nutritionPlanFood.nutritionPlan.user_id` to equal `X-Hasura-User-Id`; add a negative test for foreign provenance.
- `display_name` is a user-facing label/display override for standalone and grouped entries. It is not trusted nutrition data; `snapshot_food_name` and `snapshot_*` remain immutable historical source fields.
- Mixed plan UI persists `position` from the merged meal+food item list, not separate per-table counters, so cross-table ordering remains stable and user-controllable.
- Quick-log for planned foods sets `nutritionPlanFoodId`, uses planned grams, uses actual `slotTime = now`, and sets `displayName` from the planned-food label when present; otherwise display falls back to `snapshotFoodName`.
- Full-builder saves and group edits may require multiple GraphQL mutations. Prefer a single GraphQL operation where practical; otherwise make partial-save risk user-visible with clear error, invalidation, and retry behavior.
- Existing manual relationships around `nutrition_log_entries.nutrition_day_id` must remain explicit to avoid the documented Nhost/Hasura FK ambiguity.

### 2.3 Touched surfaces

- `backend/nhost/migrations/default/1790000510000_nutrition_plan_foods/{up.sql,down.sql}` — new planned-food table and log-entry columns.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plan_foods.yaml` — new table metadata and permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plans.yaml` — `nutritionPlanFoods` array relationship.
- `backend/nhost/metadata/databases/default/tables/public_foods.yaml` — optional `nutritionPlanFoods` array relationship if following existing reverse relationship patterns.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — provenance/display columns, relationship, and permission checks.
- `backend/nhost/metadata/databases/default/tables/tables.yaml` — table registration.
- `backend/tests/nutrition.test.ts` — new backend proof cases.
- `docs/developers/nutrition.md`, `docs/developers/database.md`, `CLAUDE.md` — domain docs.
- `frontend/src/lib/nutrition.ts` and tests — shared helpers.
- `frontend/src/components/*` and `frontend/src/routes/_authed/nutrition/**/*` — builders, routes, queries, mutations, and cleanup.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** New backend columns are nullable; the new table has only its own required columns. Existing data and existing frontend queries remain valid after the backend phase.
- **Deployment:** Apply schema and metadata before frontend code that reads/writes `nutritionPlanFoods`, `nutritionPlanFoodId`, or `displayName`. Nhost CLI does not hot-reload metadata; apply via a fresh local stack (`make dev-env-down && make dev-env-up`) or metadata API before tests. Run `bun run codegen` after metadata/schema changes that affect the `user` role.
- **Rollback:** Before dependent frontend code ships, rollback is migration down plus metadata revert. After frontend uses the new fields, use a standard commit revert/deployment rollback so schema, metadata, generated files, and UI change together.

---

## 3. Phased plan of action

For this big change, each phase is self-contained, leaves the system fully functional, includes a definition of done, and is testable before the next phase starts.

### Phase 1 — Add mixed-plan backend contract

**Goal:** Land direct planned-food support and log-entry provenance/display fields without changing frontend behavior.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/migrations/default/1790000510000_nutrition_plan_foods/up.sql` — create `nutrition_plan_foods`; add log-entry provenance/display columns.
- `backend/nhost/migrations/default/1790000510000_nutrition_plan_foods/down.sql` — reverse the schema changes.
- `backend/nhost/metadata/databases/default/tables/*.yaml` — register the table, relationships, custom names/root fields, and user permissions.
- `backend/tests/nutrition.test.ts` — add backend positive/negative tests.
- `docs/developers/nutrition.md` — document mixed plans, planned-food logging, delete restrictions, display labels, and ordering.
- `docs/developers/database.md` — update ER diagrams/schema notes.
- `CLAUDE.md` — update nutrition guidance.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerate after applying metadata.

**Implementation steps:**

1. Add migration folder `backend/nhost/migrations/default/1790000510000_nutrition_plan_foods/`.
2. In `up.sql`, create `public.nutrition_plan_foods` with:
   - `id uuid PRIMARY KEY DEFAULT uuidv7()`.
   - `nutrition_plan_id uuid NOT NULL REFERENCES public.nutrition_plans(id) ON UPDATE CASCADE ON DELETE CASCADE`.
   - `food_id uuid NOT NULL REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
   - `slot_time time NOT NULL`.
   - `label text` with trimmed 1–160 length check when non-null.
   - `grams numeric(8,2) NOT NULL CHECK (grams > 0)`.
   - `position integer NOT NULL CHECK (position >= 0)`.
   - `created_at`, `updated_at`, updated-at trigger, and comments matching existing table style.
   - indexes on `nutrition_plan_id`, `food_id`, and `(nutrition_plan_id, slot_time, position, id)`.
3. In the same migration, add nullable `nutrition_log_entries.nutrition_plan_food_id uuid REFERENCES public.nutrition_plan_foods(id) ON UPDATE CASCADE ON DELETE SET NULL` and nullable `display_name text` with trimmed 1–160 check.
4. In `down.sql`, drop the updated-at trigger, drop log-entry columns, and drop the new table in dependency-safe order.
5. Add metadata for `nutrition_plan_foods` with object relationships `nutritionPlan` and `food`, array relationships from `nutritionPlans` and `foods` where consistent, and root fields matching project naming.
6. Add `nutritionLogEntry.nutritionPlanFood` while preserving the existing manual `nutrition_log_entries` relationships.
7. Define user permissions:
   - Insert planned food only when `nutritionPlan.user_id = X-Hasura-User-Id` and `food` is visible (`owned by user` or `is_public = true`). Insert columns: `nutrition_plan_id`, `food_id`, `grams`, `slot_time`, `label`, `position`.
   - Select/delete planned food by plan owner.
   - Update planned food only for `grams`, `slot_time`, `label`, and `position`; do not allow `nutrition_plan_id` or `food_id` updates.
   - Log entries expose select/insert for `nutrition_plan_food_id` and select/insert/update for `display_name` if `display_name` editing is implemented. Do not allow updating `nutrition_plan_food_id`, `food_id`, `nutrition_day_id`, `nutrition_log_meal_id`, or snapshot columns.
   - Extend log-entry insert checks so `nutrition_plan_food_id` is either null or references a planned food whose plan belongs to the same user.
8. Apply metadata/schema locally, regenerate user-role GraphQL outputs, and update docs.

**Tests and checks:**

- Add backend tests that a user can insert planned foods with own and public foods.
- Add negative tests for using another user's private food and another user's plan.
- Add negative tests proving `foodId` on a planned food is not user-updatable.
- Add `ON DELETE RESTRICT` test for a food referenced only by `nutrition_plan_foods`.
- Add plan deletion test proving planned foods cascade and existing selected days detach as already expected.
- Add planned-food logging tests: own provenance succeeds, actual slot time is used, grams/display/provenance/snapshots are stored correctly.
- Add negative test that a user cannot insert a log entry on their own day with another user's `nutritionPlanFoodId`.
- Add test that deleting a plan nulls historical `nutrition_log_entries.nutrition_plan_food_id` through `ON DELETE SET NULL` while snapshots remain.
- Run `cd backend && make dev-env-down && make dev-env-up` or apply equivalent migration/metadata through approved tooling.
- Run `cd backend && make test`.
- Run `cd frontend && nix develop ../ --command bun run codegen`.
- Run `cd frontend && nix develop ../ --command bun run check`.

**Definition of done:**

- Fresh local backend applies and rolls back the migration cleanly.
- User-role GraphQL schema exposes `nutritionPlanFoods`, `nutritionPlanFoodId`, and `displayName` as intended.
- Backend tests cover ownership, visibility, immutability, delete semantics, and provenance security.
- Docs and `CLAUDE.md` match the new backend contract.
- Existing frontend behavior remains unchanged except generated schema/type additions.

**Phase commit message:** `feat(nutrition): add planned food backend contract`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 2 — Add frontend nutrition foundations

**Goal:** Add shared helper primitives for mixed plan totals, ordering, display labels, and inline food creation without changing existing screens that do not opt in.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/lib/nutrition.ts` — mixed plan helpers and display helper.
- `frontend/src/lib/nutrition.test.ts` or equivalent existing test file — helper tests.
- `frontend/src/components/inline-food-create.tsx` or similarly named domain component — compact inline private-food creation.
- `frontend/src/components/food-picker.tsx` — optional create affordance.

**Implementation steps:**

1. Add a discriminated mixed plan item type/helper that sums both `{ kind: "meal"; meal }` and `{ kind: "food"; food; grams }` using existing macro normalization functions.
2. Add a shared deterministic plan-item sort helper based on `(slotTime, position, kind, id)` and document that saved positions should be assigned from the merged list index.
3. Add `loggedEntryDisplayName(entry)` or equivalent returning `displayName || snapshotFoodName` and use this helper consistently in later phases for standalone and grouped entries.
4. Add tests for mixed totals, merged ordering, and display fallback.
5. Add a domain inline-food creation dialog/component that can create a simple private food, invalidate food picker queries, and return the created food to the caller.
6. Extend `FoodPicker` with an optional `onCreateFood(draftName)` callback displayed in no-match/empty states alongside the full `/nutrition/foods/new` path. Keep `FoodPicker` presentation-focused; callers own mutation/cache behavior.

**Tests and checks:**

- Helper unit tests for mixed totals, ordering, and display fallback.
- `cd frontend && nix develop ../ --command bun run check`.

**Definition of done:**

- Existing screens behave the same unless a caller opts into inline creation.
- Shared helper tests pass.
- Frontend check passes.

**Phase commit message:** `feat(nutrition): add mixed plan frontend foundations`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — Build mixed nutrition plan UI

**Goal:** Users can create, edit, and view plans containing both meal slots and direct food slots.

**Depends on:** Phases 1 and 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/nutrition-plan-form.tsx` — mixed item form.
- `frontend/src/routes/_authed/nutrition/plans/new.tsx` — create mixed plans.
- `frontend/src/routes/_authed/nutrition/plans/$planId_.edit.tsx` — edit mixed plans.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` — render mixed plan detail.
- `frontend/src/lib/nutrition.ts` — remove/replace meal-only plan total usage when no longer needed.

**Implementation steps:**

1. Refactor `NutritionPlanFormValues` from `slots` to mixed `items` with `kind: "meal" | "food"`, shared `slotTime`, `label`, and merged-list `position`; meal items carry `mealId`; food items carry `foodId` and `grams`.
2. Query both meals and foods. Add "Add meal slot" and "Add food slot" actions.
3. Render meal rows with `MealPicker`; render food rows with `FoodPicker`, inline create, grams input, optional label, and row macro summary.
4. Use merged-list positions when saving both tables. Do not reset positions independently per table. When a user changes item kind or immutable source id (`mealId`/`foodId`), treat it as delete+insert across the relevant table(s).
5. Use the mixed helper for daily planned totals and deterministic sorting.
6. Update the new-plan mutation to nested insert `nutritionPlanMeals` and `nutritionPlanFoods` from the split mixed list.
7. Update the edit route to query, diff, update, insert, and delete both child tables separately while preserving immutable-source semantics.
8. Update the detail route to render one merged timed list and mixed macro totals.
9. Keep `replace: true` on save, cancel, invalid-state, and delete navigations.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual browser test: create meal-only plan, create mixed plan, edit mixed plan, change a food source (delete+insert), change only grams/time/label (update), view detail totals/order.

**Definition of done:**

- Existing meal-only plans still render and edit correctly.
- Mixed plans can be created, edited, viewed, and deleted end-to-end.
- Cross-table ordering remains stable because positions come from the merged list.
- Frontend check passes.

**Phase commit message:** `feat(nutrition): support mixed meal and food plans`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 4 — Improve meal builder and inline food creation

**Goal:** Meal creation/editing becomes easier without changing the meal data contract.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/meal-form.tsx` — ingredient UX and inline food creation wiring.
- `frontend/src/components/food-picker.tsx` and inline food component — integration fixes as needed.

**Implementation steps:**

1. Wire each ingredient `FoodPicker` to the inline food creation component.
2. On inline food creation, invalidate the meal-form foods query and select the created food into the active ingredient row.
3. Polish ingredient rows with clearer selected-food macro summaries and validation states while preserving current add/remove/up/down controls, grams input, and live totals.
4. Preserve full `/nutrition/foods/new` navigation as an alternative path.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual browser test: create a meal using an inline-created food; edit a meal and add another inline-created food; verify the foods persist as private foods.

**Definition of done:**

- Users can create a missing food without abandoning a meal form.
- Existing meal creation/editing behavior remains intact.
- Frontend check passes.

**Phase commit message:** `feat(nutrition): improve meal ingredient builder`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 5 — Add dedicated daily logging builder and mixed suggestions

**Goal:** Replace normal logging with a full builder and make selected-plan suggestions complete for both meals and foods.

**Depends on:** Phases 1, 2, and 3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/routes/_authed/nutrition/days/$date.log.tsx` or verified equivalent — dedicated builder route for `/nutrition/days/$date/log`.
- `frontend/src/components/daily-intake-log.tsx` — replace inline logging dialogs with route navigation, quick-log suggestions, mixed target totals, and updated query shape.
- New focused daily builder components under `frontend/src/components/` — draft item/group editing.
- Shared day-opening helper module if extracted from `daily-intake-log.tsx` — `openDay`, `createDay`, unique-conflict handling, and `ensureDay` usage.
- `frontend/src/lib/nutrition.ts` — mixed target totals/display helper usage.

**Implementation steps:**

1. Add and verify a route that generates exactly `/nutrition/days/$date/log`; if the TanStack dot-route filename does not produce that path, adjust route file naming and document the verified path.
2. Extract `openDay`, `createDay`, `isUniqueConflictError`, or equivalent day-opening logic from `daily-intake-log.tsx` into shared code so the day view and builder route do not diverge.
3. Implement a full-page/mobile-friendly builder with draft standalone food items (`foodId`, grams, actual `slotTime` defaulting to now, optional `displayName`, optional `nutritionPlanFoodId`) and draft meal groups (`mealId?`, `nutritionPlanMealId?`, name, actual `slotTime` defaulting to now, child food entries with grams/display labels as needed). Require at least one child entry per meal group draft.
4. Seed meal group drafts from selected meal templates but allow users to edit group name, time, entries, grams, and added/removed foods before save.
5. Save standalone entries via `insertNutritionLogEntry`; save meal groups via one nested `insertNutritionLogMeal` with every child carrying matching `nutritionDayId`, `slotTime`, and `position`.
6. Prefer a single GraphQL operation for a save batch where practical. If multiple mutations are required, implement clear pending/error/retry behavior, invalidate affected queries after errors/successes, and do not claim the save is atomic.
7. Navigate back to `/nutrition/days/$date` with `replace: true` after successful save or cancel.
8. Refactor `daily-intake-log.tsx` to stop normal use of `LogFoodDialog` and `LogMealDialog`; replace action buttons with navigation to the builder route.
9. Extend `DailyIntakeLogQuery` to fetch `nutritionPlanFoods`; switch `MacroSummary` target totals from meal-only `planMacroTotals(selectedPlan.nutritionPlanMeals)` to the mixed helper.
10. Merge plan meal suggestions and planned food suggestions by `(slotTime, position, kind, id)`. For each suggestion, provide quick "Log now" and "Customize".
11. Planned-food quick-log sets `nutritionPlanFoodId`, `foodId`, planned grams, actual current `slotTime`, `position`, and `displayName` from the planned-food label when present; otherwise display falls back to snapshot name. Planned-meal quick-log preserves `nutritionPlanMealId` and actual current time.
12. Leave old dialog files in place until cleanup, but ensure `daily-intake-log.tsx` has no unused imports or lingering type imports from them.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual browser tests: ad-hoc food log, ad-hoc meal log with edited entries/name/time, planned meal quick-log, planned meal customize, planned food quick-log, planned food customize, empty states, cancel navigation with `replace: true`.
- Manual verification that later food edits do not change historical logged totals or trusted snapshot fields.

**Definition of done:**

- Normal logging no longer depends on separate dead-end food/meal dialogs.
- Day target totals include direct planned foods.
- Planned meal and planned food suggestions both log at actual current time by default.
- Snapshot/provenance/display semantics are preserved.
- Frontend check passes.

**Phase commit message:** `feat(nutrition): add unified daily logging builder`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 6 — Add post-save logged intake editing

**Goal:** Users can correct logged intake after saving within backend permission boundaries.

**Depends on:** Phase 5

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/daily-intake-log.tsx` — entry/group edit affordances and updated rendering.
- Daily builder/editor components from Phase 5 — reuse group editor patterns where practical.
- `frontend/src/lib/nutrition.ts` — display helper usage for standalone and grouped entries.
- GraphQL documents in affected components/routes — update entry/group mutations.

**Implementation steps:**

1. Extend standalone entry rows so users can edit grams, `slotTime`, and `displayName`. Keep source food, provenance IDs, day/group IDs, and snapshot fields immutable.
2. Render standalone and grouped entries through the same display-name helper (`displayName || snapshotFoodName`).
3. Add an edit affordance for logged meal groups. Reuse builder-style group editing for group `name`, group `slotTime`, and child rows.
4. For existing child rows, allow updates only to permitted fields such as `grams`, `position`, `slotTime`, and `displayName`.
5. For new child foods, insert new `nutritionLogEntry` rows with matching `nutritionDayId`, `nutritionLogMealId`, `slotTime`, and positions so snapshots are captured at insert time.
6. For removed child rows, delete entries. Treat changing an existing child source food as delete+insert, not a `foodId` update.
7. Keep existing delete entry, delete group, and clear day flows.
8. If multiple mutations are needed for a group edit, use clear pending/error states, invalidate after failure/success, and avoid implying transactionality.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual browser tests: edit standalone entry time/grams/display label; rename logged group; change group time; add, remove, and edit group child entries; verify display names and snapshots behave correctly.
- Run `cd backend && make test` only if metadata permissions change after Phase 1.

**Definition of done:**

- Existing and new logs display correctly.
- Supported corrections persist and obey user-role permissions.
- Source/provenance/snapshot fields remain immutable from the user UI.
- Frontend check passes.

**Phase commit message:** `feat(nutrition): support logged intake corrections`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 7 — Cleanup, docs finalization, and full validation

**Goal:** Remove replaced code, finalize docs, and verify the full stack.

**Depends on:** Phases 1–6

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/log-food-dialog.tsx` — delete if fully unused.
- `frontend/src/components/log-meal-dialog.tsx` — delete if fully unused.
- Remaining nutrition components/routes — remove dead imports/exports/types.
- `docs/developers/nutrition.md`, `docs/developers/database.md`, `CLAUDE.md` — final consistency pass.
- Generated GraphQL outputs — final no-drift check.

**Implementation steps:**

1. Delete obsolete log dialog files after confirming builder and suggestions fully replace normal logging.
2. Remove dead exports/imports/types such as old `LogMealOption`/`LogPlanSlot` if no longer needed.
3. Grep for stale references to the removed dialogs and old meal-only plan assumptions.
4. Finalize docs for mixed plan contract, planned-food logging, unified builder flow, post-save editing scope, inline food creation, and delete restrictions.
5. Run full backend and frontend gates, including codegen.
6. Inspect generated-file drift and confirm only intended generated changes remain.

**Tests and checks:**

- `cd backend && make test`.
- `cd frontend && nix develop ../ --command bun run codegen`.
- `cd frontend && nix develop ../ --command bun run check`.
- Grep for stale `log-food-dialog`, `log-meal-dialog`, `LogMealDialog`, `LogFoodDialog`, and meal-only `planMacroTotals(selectedPlan.nutritionPlanMeals)` assumptions.

**Definition of done:**

- Dead dialog code is removed.
- Docs match implemented behavior.
- Generated files are current.
- Backend and frontend gates pass.
- Repository is ready for final review/commit sequence.

**Phase commit message:** `chore(nutrition): finalize redesigned nutrition flows`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing or moving to another phase, run all configured linters and the full test suite for the affected project/repository. If any command fails, send exact failures back to the implementer, run a fresh reviewer pass after the fix, and rerun the full gate.
6. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
7. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Direct foods in plans | 1, 3 | Backend tests, codegen, manual create/edit/detail for mixed plans |
| Mixed plan totals and stable order | 2, 3, 5 | Helper tests, frontend check, manual order/total verification |
| Unified daily logging builder | 5 | Frontend check and manual ad-hoc/planned/customized logging tests |
| Plan suggestions include meals and foods | 5 | Manual quick-log/customize tests; target totals include planned foods |
| Post-save corrections | 1, 6 | Permission checks from Phase 1, frontend check, manual edit tests |
| Snapshot/provenance invariants | 1, 5, 6 | Backend planned-food logging tests, manual verification after food edits |
| Inline food creation | 2, 4 | Helper/picker behavior, frontend check, manual meal builder test |
| Security boundaries | 1 | Backend negative tests for foreign foods, foreign plans, and foreign provenance |
| Docs/codegen consistency | 1, 7 | Codegen, docs review, final backend/frontend gates |
| Spent navigation uses replace | 3, 5 | Manual navigation verification and route code review |

---

## 6. Risks and mitigations

- **Risk:** Missing ownership checks on `nutrition_plan_food_id` could create a cross-user provenance/existence leak — **Mitigation:** Explicit insert permission condition plus negative backend test in Phase 1.
- **Risk:** Mixed plan ordering could be unstable across two child tables — **Mitigation:** Save merged-list positions across both tables and use a deterministic sort helper tested in Phase 2.
- **Risk:** `display_name` may blur trusted snapshot semantics — **Mitigation:** Docs and helper naming treat it as display-only; totals and historical nutrition continue using `snapshot_*`.
- **Risk:** Full-builder saves and group edits may partially persist when implemented as multiple mutations — **Mitigation:** Prefer one GraphQL operation where practical; otherwise provide explicit failure/retry/invalidation behavior and avoid claiming atomicity.
- **Risk:** Hasura metadata may auto-track ambiguous log-entry relationships — **Mitigation:** Preserve existing manual relationships and test user-role queries.
- **Risk:** Route filename may not generate the intended TanStack path — **Mitigation:** Phase 5 explicitly verifies `/nutrition/days/$date/log` and adjusts filename if needed.
- **Risk:** Large UI scope increases review burden — **Mitigation:** Phases are small enough to leave the app functional and checkable after each pass.

---

## 7. Follow-ups (out of scope for this plan)

- Multi-day or scheduled nutrition plans — tracked in: TBD if requested later.
- Food brand/catalog/admin tooling — tracked in: TBD if requested later.
- Drag-and-drop plan/meal item ordering — tracked in: TBD if arrow/button controls prove insufficient.
