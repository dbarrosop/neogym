# Add calorie intake tracking

**Status:** ready
**Created:** 2026-06-23

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

NeoGym currently tracks workouts, sessions, body measurements, and journal entries, but has no way to track calories or daily nutrition intake. Add a nutrition domain so signed-in users can define foods, compose meals, build reusable daily meal plans, and log what they actually consumed each day.

### 1.2 Functional requirements

- Users can create, list, view, edit, and delete private foods.
- Users can browse and use public/admin-managed foods.
- Food nutrition is stored per 100 grams with these fields: kcal, fat, carbs, protein, fiber, and sugar.
- Users can create, list, view, edit, and delete private meals.
- A meal is a reusable template made of foods and gram amounts.
- Users can create, list, view, edit, and delete private reusable daily plans.
- A plan is a reusable one-day template made of ordered meal slots with required times of day.
- Plans are suggestions/templates only; they are not scheduled calendar assignments and do not bind the logged day.
- Users can open a daily intake log, choose a plan as suggestions, quickly log a planned meal, log any meal ad hoc, or log any individual food ad hoc.
- Logging a meal materializes individual food rows into the day log.
- Logged food rows can be edited independently, especially grams, without changing the source meal template.
- The daily log shows totals for kcal, fat, carbs, protein, fiber, and sugar.
- The initial UI includes full CRUD and edit/delete flows for foods, meals, plans, and daily intake.

### 1.3 Non-functional requirements / constraints

- Use existing Hasura permission patterns from `docs/developers/permissions.md`:
  - Pattern A: private per-user rows.
  - Pattern B: owner-or-public catalog rows.
  - Pattern C: ownership inherited from a parent relationship.
- Users must not read or mutate another user's private nutrition data.
- Public foods are readable by authenticated users and admin-managed; normal users must not create public foods or promote private foods to public.
- Backend changes require migrations, Hasura metadata, docs, and backend integration tests.
- Frontend changes use existing TanStack Start + typed GraphQL + `gqlRequest` patterns.
- Regenerate codegen after user-role schema or GraphQL document changes.
- Run `cd backend && make test` after backend changes.
- Run `cd frontend && nix develop ../ --command bun run check` after frontend changes.
- Keep `CLAUDE.md` and `docs/developers/*` in sync with the schema, permissions, navigation, and codegen behavior.
- Nhost MCP was unavailable during planning; implementers should prefer MCP if available later, otherwise follow repo-local migrations/metadata/codegen workflows.

### 1.4 Surfaces in scope

- `backend/nhost/migrations/default/` — add nutrition schema, constraints, indexes, triggers, and down migration.
- `backend/nhost/metadata/databases/default/tables/` — add tracked tables, relationships, custom names, and role permissions.
- `backend/nhost/seeds/default/` — add required local public food seed rows with stable UUIDs.
- `backend/tests/` — add nutrition integration tests using the existing `gql(...)` / `gqlAsUser(...)` pattern.
- `frontend/schema.user.graphqls` and `frontend/src/gql/` — regenerate user-role schema/types.
- `frontend/src/components/navbar.tsx` — add a Nutrition entry and verify the mobile tab bar still works.
- `frontend/src/routes/_authed/nutrition.tsx` — new nutrition layout route with tabs and an `Outlet`.
- `frontend/src/routes/_authed/nutrition/` — food, meal, plan, and daily intake routes.
- `frontend/src/components/` — nutrition forms, pickers, macro summaries, and log UI components.
- `frontend/src/lib/nutrition.ts` — macro normalization, math, and formatting helpers.
- `docs/developers/database.md`, `docs/developers/permissions.md`, `docs/developers/nutrition.md`, `CLAUDE.md` — schema, permission, trigger, navigation, and operational docs.

### 1.5 Out of scope

- Barcode scanning, OCR, restaurant/external food databases, or import integrations.
- Weekly/monthly plan scheduling or assigning plans to calendar dates.
- Serving-based nutrition as the source of truth. Per-100g remains the canonical storage model.
- Nutrition goals/targets, recommendations, trends, or analytics beyond daily totals.
- Public user-created meals or public user-created plans.
- Deriving kcal from fat/carbs/protein. Store and display kcal independently.

### 1.6 Success criteria

- A signed-in user can manage private foods and browse/use public foods.
- A signed-in user can manage private meals composed of food + grams and see computed meal totals.
- A signed-in user can manage private daily plans composed of time-of-day meal slots and see planned totals.
- A signed-in user can open a daily log by date, choose a plan, log planned meals, log ad-hoc meals/foods, edit grams, delete entries/groups, delete/clear the day, and see totals update from logged snapshots.
- Logging a meal creates editable per-day food entries and does not mutate the meal template.
- Backend tests prove permission boundaries, snapshot stability, and FK/cascade invariants.
- Generated user-role SDL exposes only intended tables/columns.
- Frontend typecheck/lint/tests pass via `bun run check`.

---

## 2. Implementation strategy

### 2.1 Central design decision

Add a relational nutrition domain that mirrors the app's existing ownership and permission patterns. Foods are owner-or-public catalog rows; meals, plans, nutrition days, log groups, and log entries are private per-user data. Meals and plans remain editable templates, while daily intake rows are historical facts: logged food entries snapshot food name and per-100g nutrients at insertion time so historical totals remain stable after food edits or deletes.

### 2.2 Key constraints and invariants

- `foods` uses pattern B: users select public foods plus their private foods, but mutate only private foods they own.
- `meals`, `nutrition_plans`, and `nutrition_days` use pattern A.
- Child tables use pattern C and must walk parent relationships in Hasura permissions.
- `foods.is_public = true` rows have `user_id IS NULL`; private rows have `user_id IS NOT NULL`.
- `foods` has exact-name uniqueness by `(user_id, name)` using `UNIQUE NULLS NOT DISTINCT`, consistent with existing catalog tables. Do not add `brand` in v1; it is deferred to avoid uniqueness ambiguity and scope creep.
- Public food seed rows are required for local development/testing. If production needs initial public foods, follow the repo's existing production path for public catalog data; do not assume local Nhost seeds deploy to cloud.
- `meal_ingredients.food_id` uses `ON DELETE RESTRICT`; a food used in a meal template cannot be deleted until references are removed. This also means public foods referenced by any user can be blocked from deletion by admins; document this operations caveat.
- `nutrition_plan_meals.meal_id` uses `ON DELETE RESTRICT`; a meal used by a plan cannot be deleted until plan slots are removed.
- `nutrition_days.nutrition_plan_id` uses `ON DELETE SET NULL`; a selected plan is a template link, not a contract.
- `nutrition_log_meals.meal_id` and `nutrition_log_meals.nutrition_plan_meal_id` use `ON DELETE SET NULL`; historical log provenance detaches, logs remain.
- `nutrition_log_entries.food_id` uses `ON DELETE SET NULL`; historical entries retain trusted trigger-populated snapshots.
- `nutrition_log_entries` snapshot columns are `NOT NULL`, selectable by the user role, and not user-writable.
- `nutrition_log_entries` has a `BEFORE INSERT` snapshot trigger that rejects `food_id IS NULL` on insert and copies food name/nutrients from `foods`. It does not run on food delete/nulling.
- `nutrition_log_meals.name` and `slot_time` are client-supplied display snapshots copied by the UI from the meal/plan slot; they are not trigger-verified trusted snapshots.
- Grouped log entries use a default `MATCH SIMPLE` composite FK `(nutrition_log_meal_id, nutrition_day_id) -> nutrition_log_meals(id, nutrition_day_id) ON DELETE CASCADE`. Standalone entries rely on `MATCH SIMPLE` skipping the composite FK when `nutrition_log_meal_id IS NULL` and still use the direct `nutrition_day_id` FK.
- Ordered children use stable sort indexes instead of unique position constraints to avoid reorder swap friction: `(meal_id, position, id)`, `(nutrition_plan_id, slot_time, position, id)`, `(nutrition_day_id, position, id)`.
- Daily totals are computed client-side from logged snapshot columns: `grams / 100 * snapshot_per_100g`.
- Hasura `numeric` values may arrive as strings; frontend helpers must normalize before math.
- Daily date routes use local calendar-date formatting, not `toISOString().slice(0, 10)`, to avoid timezone off-by-one bugs.

### 2.3 Touched surfaces

- `backend/nhost/migrations/default/1790000500000_nutrition/` — greenfield nutrition schema and down migration.
- `backend/nhost/metadata/databases/default/tables/public_*.yaml` — table metadata, relationships, custom names, permissions.
- `backend/nhost/metadata/databases/default/tables/tables.yaml` — include new table metadata.
- `backend/nhost/seeds/default/` — public food seeds.
- `backend/tests/nutrition.test.ts` — backend integration tests.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — generated GraphQL artifacts.
- `frontend/src/components/navbar.tsx` — Nutrition nav entry and mobile behavior.
- `frontend/src/routes/_authed/nutrition.tsx` and `frontend/src/routes/_authed/nutrition/**` — nutrition routes.
- `frontend/src/components/*nutrition*`, `food-form.tsx`, `meal-form.tsx`, pickers, dialogs — reusable UI.
- `frontend/src/lib/nutrition.ts` — macro helpers.
- `docs/developers/database.md`, `docs/developers/permissions.md`, `docs/developers/nutrition.md`, `CLAUDE.md` — docs.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** The change is additive: new tables, metadata, seeds, routes, and generated GraphQL types. Existing workout/body/journal flows should not change.
- **Deployment:** Use a migration timestamp greater than the current maximum (`1790000460000`), e.g. `1790000500000_nutrition`. Apply metadata before user-role codegen. Local public foods come from Nhost seeds; production public-food availability must either follow the app's existing public-catalog deployment mechanism or be explicitly accepted as initially empty until admins seed it.
- **Rollback:** Standard revert is sufficient before production data exists. After production data exists, rollback requires dropping dependent nutrition tables in reverse order and accepting loss of nutrition data. `down.sql` must drop dependencies carefully: log entries → log meals → days → plan meals → plans → meal ingredients → meals → foods, plus triggers/functions/metadata references.

---

## 3. Phased plan of action

### Phase 1 — Backend nutrition contract, metadata, seeds, docs, and codegen

**Goal:** Add the complete backend nutrition contract and prove permissions/invariants before frontend UI work begins.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/migrations/default/1790000500000_nutrition/up.sql` — create tables, indexes, triggers, constraints.
- `backend/nhost/migrations/default/1790000500000_nutrition/down.sql` — drop in reverse dependency order.
- `backend/nhost/metadata/databases/default/tables/public_foods.yaml` — foods metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_meals.yaml` — meals metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_meal_ingredients.yaml` — meal ingredient metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plans.yaml` — plan metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_plan_meals.yaml` — plan slot metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_days.yaml` — day metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_meals.yaml` — logged meal group metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — log entry metadata/permissions.
- `backend/nhost/metadata/databases/default/tables/tables.yaml` — include new metadata files.
- `backend/nhost/seeds/default/<timestamp>_public_foods.sql` — required public food seed rows with stable UUIDs.
- `backend/tests/nutrition.test.ts` — integration tests, organized by concern.
- `docs/developers/database.md` — add nutrition ER/model and trigger notes.
- `docs/developers/permissions.md` — document all nutrition Hasura permissions.
- `docs/developers/nutrition.md` — new focused domain doc.
- `CLAUDE.md` — add nutrition model/tooling/navigation guidance.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerate after backend stack applies metadata.

**Implementation steps:**

1. Create `foods` without `brand` for v1. Include `UNIQUE NULLS NOT DISTINCT (user_id, name)` and a migration comment referencing existing catalog-table precedent.
2. Create private template tables: `meals`, `meal_ingredients`, `nutrition_plans`, `nutrition_plan_meals`.
3. Create daily log tables: `nutrition_days`, `nutrition_log_meals`, `nutrition_log_entries`.
4. Add `created_at`, `updated_at`, and `set_current_timestamp_updated_at` triggers to all mutable tables.
5. Add the insert-only food snapshot trigger for `nutrition_log_entries`; document it as a new trusted snapshot pattern.
6. Add indexes for ownership filters, public-food lookups, FK columns, and stable ordering.
7. Add Hasura custom names/root fields/camelCase column mappings consistent with existing metadata.
8. Add relationships needed for GraphQL and permission checks.
9. Add user-role permissions:
   - `foods`: select own-or-public; insert/update/delete only own private; set `user_id`; exclude `is_public`.
   - `meals`, `nutrition_plans`, `nutrition_days`: private per-user; `nutrition_days` checks `nutrition_plan_id IS NULL OR plan.user_id = self`; delete own days.
   - `meal_ingredients`: select/insert/update/delete through owned meal; insert checks food is own-or-public; update only `grams`/`position`; change food by delete+insert.
   - `nutrition_plan_meals`: select/insert/update/delete through owned plan; insert checks meal is owned; update `slot_time`/`label`/`position`; change meal by delete+insert.
   - `nutrition_log_meals`: select/insert/update/delete through owned day; insert checks nullable source meal and plan slot through explicit `_or` branches; delete cascades entries.
   - `nutrition_log_entries`: select/delete through owned day; insert checks day owned, optional group owned/same-day, food visible; update only `grams`/`position`; snapshot columns selectable but not writable.
10. Add public food seeds required for local tests and manual browsing.
11. Add backend tests in `describe` groups: food visibility, template ownership, logging snapshots, FK/cascade behavior, and user-role allowlists.
12. Update docs in the same change, including the admin footgun that public food deletion is restricted after any user's template reference.
13. Bring up a fresh local backend, run tests, run frontend codegen, and ensure frontend check still passes without adding frontend documents for not-yet-built UI.

**Tests and checks:**

- `cd backend && make dev-env-down && make dev-env-up` after migration/metadata edits when validating a fresh stack.
- `cd backend && make test`.
- `cd frontend && nix develop ../ --command bun run codegen` with backend up.
- `cd frontend && nix develop ../ --command bun run check`.
- Tests must cover:
  - user can read public foods and own foods but not another user's private foods;
  - user cannot create public foods or mutate public/foreign foods;
  - user cannot add another user's private food to a meal or log entry;
  - user cannot add another user's meal to a plan;
  - user cannot use another user's day, meal, or plan slot in log groups/entries;
  - nullable permission checks use explicit `_or` branches;
  - wrong-day grouped entry insertion fails via composite FK;
  - inserting a log entry with null `food_id` fails;
  - user cannot write snapshot columns or update `food_id`;
  - snapshot columns remain stable after source food update/delete and after grams update;
  - food deletion is blocked by `meal_ingredients` but not by historical log entries;
  - meal deletion is blocked by plan slots but not by historical log provenance;
  - plan deletion detaches days;
  - group deletion cascades grouped entries;
  - standalone entry deletion works;
  - day deletion cascades log groups/entries;
  - nested meal logging shape is proven early or a tracked SQL function fallback is documented.

**Definition of done:**

- Fresh local stack applies migration, metadata, and seeds.
- Backend tests pass and cover the listed security/invariant cases.
- User-role schema/types regenerate and expose only intended columns.
- Frontend check passes with no partially added UI GraphQL documents.
- Docs and `CLAUDE.md` accurately describe the model, triggers, permissions, and operational caveats.
- The existing app remains functional because this phase is additive and has no frontend navigation changes.

**Phase commit message:** `feat(nutrition): add backend nutrition contract`

**Implementation log**

- Implemented the Phase 1 backend nutrition contract: added the `foods`, `meals`, `meal_ingredients`, `nutrition_plans`, `nutrition_plan_meals`, `nutrition_days`, `nutrition_log_meals`, and `nutrition_log_entries` schema; Hasura metadata/relationships/permissions; public-food and test-user seeds; nutrition integration tests; regenerated user-role GraphQL artifacts; and updated `CLAUDE.md` plus developer docs.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS` after a cleanup pass. C1 (whitespace-only churn in `backend/tests/kind-enforcement.test.ts`) was sent back to the implementer and resolved. Accepted concerns: tests deliberately target Hasura directly instead of the Constellation proxy, and `schema.user.graphqls` has large fallback-printer formatting churn until `rover` is available in the devshell.
- Autonomous decisions recorded:
  - No skill arguments were provided, so the latest non-architect plan in `.nhost-code/plans/` was selected. Correctness: it was the only candidate and had `Status: ready`.
  - All phase commit messages were absent from `git log`, so Phase 1 was treated as the first unimplemented phase. Correctness: implementing dependencies in plan order avoids frontend work before the backend contract exists.
  - The accepted C1 reviewer concern was still sent to the implementer. Long-term maintenance: removing whitespace-only churn reduces merge friction while preserving correctness/security.
  - The direct-Hasura backend test endpoint was accepted. Correctness/security: these tests assert Hasura permissions/error behavior and are safer against proxy normalization; the decision is documented in `CLAUDE.md`.
  - `bun run codegen` failed because `rover` is not present in the Nix devshell, so the strongest available equivalent was used: the already-regenerated SDL from GraphQL introspection plus `bun run codegen:graphql`. Correctness/long-term maintenance: generated TypeScript artifacts typecheck against the new user-role SDL, and the tooling limitation is documented for a later devshell/script fix.
- Quality-gate history:
  - `cd backend && make dev-env-down && make dev-env-up` — passed; fresh local stack applied migrations, metadata, and seeds.
  - `cd backend && make test` — passed after review cleanup: 64 tests, 0 failures, 281 expectations.
  - `cd frontend && nix develop ../ --command bun run codegen` — failed with `rover: command not found`; recorded as a toolchain limitation.
  - `cd frontend && nix develop ../ --command bun run codegen:graphql` — passed using the regenerated SDL.
  - `cd frontend && nix develop ../ --command bun run check` — passed: typecheck, Biome, and 68 frontend tests.

### Phase 2 — Nutrition shell and foods CRUD

**Goal:** Add the Nutrition navigation/shell and complete private/public foods UI.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/navbar.tsx` — add Nutrition nav item; verify mobile tab behavior.
- `frontend/src/routes/_authed/nutrition.tsx` — layout route with `Outlet` and phase-appropriate tabs.
- `frontend/src/routes/_authed/nutrition/index.tsx` — landing route.
- `frontend/src/routes/_authed/nutrition/foods/index.tsx` — foods list/search/filter.
- `frontend/src/routes/_authed/nutrition/foods/new.tsx` — create food.
- `frontend/src/routes/_authed/nutrition/foods/$foodId.tsx` — food detail.
- `frontend/src/routes/_authed/nutrition/foods/$foodId_.edit.tsx` — edit food.
- `frontend/src/components/food-form.tsx` — food form.
- `frontend/src/lib/nutrition.ts` — numeric normalization and macro formatting helpers.
- `frontend/src/gql/` — regenerated after adding GraphQL documents.

**Implementation steps:**

1. Add one top-level Nutrition nav item; do not add separate top-level Foods/Meals/Plans/Days items.
2. Verify the mobile tab bar still renders acceptably with the added item. If it does not, choose a minimal grouping/overflow adjustment and document it in `CLAUDE.md`.
3. Create a real layout route at `_authed/nutrition.tsx` with `Outlet` and tabs/links only to routes implemented in this phase.
4. Implement foods list with private/public badges and filtering/search similar to existing list pages.
5. Implement create/edit/detail/delete flows for private foods.
6. Hide or bounce edit/delete affordances for public or non-owned foods.
7. Show friendly toasts for food-in-use FK restriction failures.
8. Use local form patterns, `toast`, TanStack Query invalidation, typed `graphql(...)`, and `gqlRequest`.
9. Use `replace: true` on submit/cancel/delete redirects from spent pages.
10. If a missing UI primitive is needed, copy/adapt handwritten shadcn code manually; do not run the shadcn CLI.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen` after adding frontend GraphQL documents, or `bun run codegen:graphql` if SDL is known unchanged and backend availability is the only blocker.
- `cd frontend && nix develop ../ --command bun run check`.
- Verify `git diff frontend/schema.user.graphqls` is empty in this frontend-only phase; schema drift means an accidental metadata/schema change leaked in.
- Reviewer/best-effort manual smoke: private food CRUD, public food read-only browsing, food-in-use error toast, mobile tab bar layout.

**Definition of done:**

- Codegen and frontend check pass.
- No dead nutrition tabs/links exist.
- Private food CRUD works by code review and best-effort manual smoke.
- Public foods are visible but not editable/deletable by users.
- Mobile nav remains usable with the Nutrition item.
- The hard automated gate is codegen + `bun run check`; manual smoke evidence should be captured when practical.

**Phase commit message:** `feat(nutrition): add foods UI`

**Implementation log**

- Implemented the Phase 2 nutrition shell and foods UI: added a single top-level Nutrition nav item, a nutrition layout with only Overview/Foods tabs, foods list/search/filter, private-food create/detail/edit/delete routes, a reusable `FoodForm`, and nutrition numeric/macro helpers with tests.
- Reviewer verdict: `ACCEPT`. Public foods are visible/read-only, private CRUD is implemented by code review, spent-page redirects use `replace: true`, no dead tabs/links were introduced, and no Phase 3+ meals/plans/days UI was added.
- Autonomous decisions recorded:
  - Continued to Phase 2 after committing Phase 1 because no phase argument was provided and Phase 2 is the next unimplemented dependency-order phase. Correctness: frontend foods UI depends on the committed backend contract.
  - The mobile nav was made horizontally scrollable for seven top-level entries instead of removing or grouping links. Long-term maintenance: this is the smallest reversible change that preserves existing navigation semantics; documented in `CLAUDE.md`.
  - Full `bun run codegen` failure due missing `rover` was accepted again, with `bun run codegen:graphql` used against unchanged SDL. Correctness: `git diff -- frontend/schema.user.graphqls --exit-code` proved no backend schema drift in this frontend-only phase.
- Quality-gate history:
  - `cd frontend && nix develop ../ --command bun run codegen` — failed with `rover: command not found`; recorded as the existing toolchain limitation.
  - `cd frontend && nix develop ../ --command bun run codegen:graphql` — passed.
  - `cd frontend && nix develop ../ --command bun run check` — passed: typecheck, Biome, and 73 frontend tests.
  - `git diff -- frontend/schema.user.graphqls --exit-code` — passed; user-role SDL unchanged.
- Accepted concerns/follow-ups: browser manual smoke was not run; reviewer accepted code review plus automated gate per the plan. The friendly food-in-use error matcher is intentionally broad and can be narrowed later if it mislabels unrelated FK failures.

### Phase 3 — Meals CRUD

**Goal:** Add private meal template management with live computed totals.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/routes/_authed/nutrition.tsx` — add Meals tab now that routes exist.
- `frontend/src/routes/_authed/nutrition/meals/index.tsx` — meals list.
- `frontend/src/routes/_authed/nutrition/meals/new.tsx` — create meal.
- `frontend/src/routes/_authed/nutrition/meals/$mealId.tsx` — meal detail.
- `frontend/src/routes/_authed/nutrition/meals/$mealId_.edit.tsx` — edit meal.
- `frontend/src/components/meal-form.tsx` — repeatable ingredients form.
- `frontend/src/components/food-picker.tsx` — own/public food picker.
- `frontend/src/components/macro-summary.tsx` — macro summary display.
- `frontend/src/lib/nutrition.ts` — reuse/extend live-food total helpers.
- `frontend/src/gql/` — regenerated after adding GraphQL documents.

**Implementation steps:**

1. Add Meals tab only when the Meals routes are added.
2. Implement meals list/detail/create/edit/delete for the signed-in user's private meals.
3. Build a meal form with repeatable rows: food picker, grams, stable position/reorder.
4. Allow only own/private meals; foods picked for ingredients may be own private or public.
5. Compute meal totals from live food nutrition using normalized numeric values.
6. On editing ingredients, prefer simple delete+insert for changing `food_id`; update only grams/position where appropriate.
7. Show friendly FK toasts when meal deletion is blocked by plan slots.
8. Make clear that historical log provenance detaches via `ON DELETE SET NULL` and does not block meal deletion.
9. Use `replace: true` on spent redirects.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen` or `bun run codegen:graphql` if SDL is unchanged.
- `cd frontend && nix develop ../ --command bun run check`.
- Verify `git diff frontend/schema.user.graphqls` is empty.
- Reviewer/best-effort manual smoke: create meal with multiple foods, edit grams/reorder, see totals, delete, and see friendly blocked-delete behavior when used by a plan.

**Definition of done:**

- Codegen and frontend check pass.
- No dead nutrition tabs/links exist.
- Meal CRUD and computed totals are implemented.
- Meal deletion semantics match backend constraints.
- The hard automated gate is codegen + `bun run check`; manual smoke evidence should be captured when practical.

**Phase commit message:** `feat(nutrition): add meals UI`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 4 — Daily plan CRUD

**Goal:** Add private reusable daily nutrition plan templates.

**Depends on:** Phase 3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/routes/_authed/nutrition.tsx` — add Plans tab now that routes exist.
- `frontend/src/routes/_authed/nutrition/plans/index.tsx` — plans list.
- `frontend/src/routes/_authed/nutrition/plans/new.tsx` — create plan.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` — plan detail.
- `frontend/src/routes/_authed/nutrition/plans/$planId_.edit.tsx` — edit plan.
- `frontend/src/components/nutrition-plan-form.tsx` — plan slots form.
- `frontend/src/components/meal-picker.tsx` — own-meal picker.
- `frontend/src/components/macro-summary.tsx` and `frontend/src/lib/nutrition.ts` — planned totals.
- `frontend/src/gql/` — regenerated after adding GraphQL documents.

**Implementation steps:**

1. Add Plans tab only when the Plans routes are added.
2. Implement plans list/detail/create/edit/delete for private plans.
3. Build a plan form with repeatable rows: required local time-of-day, meal picker, optional label, position.
4. Sort and display slots by `(slot_time, position, id)`.
5. Compute slot totals and daily planned totals from live meal ingredient/food nutrition.
6. Keep plans as reusable templates only; do not add calendar scheduling.
7. Show friendly FK toasts when meal deletion is blocked by plan use.
8. Use `replace: true` on spent redirects.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen` or `bun run codegen:graphql` if SDL is unchanged.
- `cd frontend && nix develop ../ --command bun run check`.
- Verify `git diff frontend/schema.user.graphqls` is empty.
- Reviewer/best-effort manual smoke: create/edit/delete a plan with timed meal slots and verify planned totals.

**Definition of done:**

- Codegen and frontend check pass.
- No dead nutrition tabs/links exist.
- Plan CRUD and planned totals are implemented.
- Plans remain daily reusable templates only.
- The hard automated gate is codegen + `bun run check`; manual smoke evidence should be captured when practical.

**Phase commit message:** `feat(nutrition): add plans UI`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 5 — Daily intake logging

**Goal:** Add daily intake logging from plans, meals, and foods with editable historical entries and totals.

**Depends on:** Phase 4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/routes/_authed/nutrition.tsx` — add Today/Days tab now that routes exist.
- `frontend/src/routes/_authed/nutrition/days/index.tsx` — recent days and today shortcut.
- `frontend/src/routes/_authed/nutrition/days/$date.tsx` — day log route.
- `frontend/src/components/daily-intake-log.tsx` — main log UI.
- `frontend/src/components/log-meal-dialog.tsx` — log meal flow.
- `frontend/src/components/log-food-dialog.tsx` — log food flow.
- `frontend/src/lib/nutrition.ts` — logged snapshot totals and local date/time helpers.
- `frontend/src/gql/` — regenerated after adding GraphQL documents.

**Implementation steps:**

1. Add Today/Days tab only when day routes are added.
2. Implement local-date validation for `$date`; redirect invalid dates with `replace: true`.
3. Open/create days via query-by-date then insert-if-missing; on unique-conflict race, re-query. Do not rely on `on_conflict update_columns: []` because Hasura returns zero rows on conflict.
4. Add plan picker/clearer for the day; plan selection updates `nutrition_days.nutrition_plan_id`.
5. Display selected plan slots as suggestions, sorted by slot time/position, with quick Log actions.
6. Implement meal logging as one Hasura nested mutation for `nutrition_log_meal` plus child `nutrition_log_entries`, or use a tracked SQL function fallback if nested insert cannot be made permission-safe.
7. In nested meal logging, explicitly pass the same `nutrition_day_id` on every child entry; Hasura nested insert only auto-populates `nutrition_log_meal_id`, not `nutrition_day_id`.
8. Copy group `name`/`slot_time` client-side from the meal/plan slot at log time.
9. Let the database trigger populate food snapshots on each log entry.
10. Implement standalone food logging.
11. Allow editing entry grams and deleting individual entries.
12. Allow deleting logged meal groups; child entries cascade.
13. Allow deleting/clearing an entire day; groups/entries cascade.
14. Compute daily totals client-side from logged snapshot nutrient columns, not live food rows.
15. Use `replace: true` on spent redirects/picker exits.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen` or `bun run codegen:graphql` if SDL is unchanged.
- `cd frontend && nix develop ../ --command bun run check`.
- Verify `git diff frontend/schema.user.graphqls` is empty.
- Reviewer/best-effort manual smoke: create food → meal → plan → day → select plan → log planned meal → tweak grams → verify source meal unchanged → totals update → log ad-hoc food → delete entry/group → delete/clear day.

**Definition of done:**

- Codegen and frontend check pass.
- No dead nutrition tabs/links exist.
- Daily logs can be created/opened by local date.
- Plan suggestions, meal logging, food logging, entry edits/deletes, group deletes, day deletes, and totals are implemented.
- Totals use snapshot nutrients and remain independent of later food/template edits.
- The hard automated gate is codegen + `bun run check`; manual smoke evidence should be captured when practical.

**Phase commit message:** `feat(nutrition): add daily intake logging`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 6 — Final validation and review readiness

**Goal:** Run the full project gates and prepare the completed nutrition feature for review.

**Depends on:** Phase 5

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- Entire branch — final validation only; avoid new feature scope.

**Implementation steps:**

1. Run backend tests.
2. Regenerate frontend GraphQL artifacts from the final backend/user schema.
3. Run frontend check.
4. Review `git status --short` and generated file diffs for stale or unintended changes.
5. Verify docs still match migrations/metadata/UI conventions.
6. Verify no out-of-scope features slipped in.

**Tests and checks:**

- `cd backend && make test`.
- `cd frontend && nix develop ../ --command bun run codegen`.
- `cd frontend && nix develop ../ --command bun run check`.
- `git status --short`.

**Definition of done:**

- Backend tests pass.
- Frontend codegen/check pass.
- Docs and generated artifacts are up to date.
- Review-ready diff has no scope creep, stale schema, dead links, or permission leaks.

**Phase commit message:** `chore(nutrition): validate calorie tracking feature`

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
| Private/public foods with per-100g kcal/fat/carbs/protein/fiber/sugar | 1, 2 | Backend permission tests; generated SDL; foods CRUD UI; frontend check; manual smoke |
| Public foods readable but user-not-mutable | 1, 2 | Backend negative tests; UI hides/bounces edit/delete; manual smoke |
| Meals as reusable food+grams templates | 1, 3 | Backend ownership/FK tests; meals CRUD UI; computed totals smoke |
| Plans as reusable daily time-of-day meal templates | 1, 4 | Backend ownership/FK tests; plans CRUD UI; planned totals smoke |
| Plans are suggestions, not binding/scheduled assignments | 1, 5 | `nutrition_days.nutrition_plan_id ON DELETE SET NULL`; no scheduling UI; day can log ad hoc items |
| Log planned meal quickly | 1, 5 | Nested insert/prototype test; daily log UI smoke |
| Log ad-hoc meal or food | 1, 5 | Backend log permissions; log dialogs; manual smoke |
| Logging a meal materializes editable ingredient rows | 1, 5 | Backend nested insert/snapshot tests; edit grams smoke |
| Logged entries independent of meal templates | 1, 5 | Backend test that grams update does not mutate meal ingredient; smoke |
| Historical day totals stable after food edits/deletes | 1, 5 | Snapshot trigger tests; daily totals use snapshot columns |
| Full daily intake CRUD | 1, 5 | Delete day permission/cascade tests; delete/clear day UI smoke |
| Security boundaries prevent cross-user private access | 1 | `gqlAsUser` negative tests across foods/templates/logs |
| Docs remain accurate | 1, 6 | Review docs with migrations/metadata and `CLAUDE.md` |
| Frontend compiles/lints/tests | 2–6 | `bun run check`; generated GraphQL types |
| Backend tests pass | 1, 6 | `make test` |

---

## 6. Risks and mitigations

- **Risk:** The insert-only snapshot trigger is a new pattern in this codebase. — **Mitigation:** Add focused backend tests and document the trigger in `database.md` and `nutrition.md`.
- **Risk:** Hasura nested insert for log meal groups and entries may be finicky with composite FKs and permissions. — **Mitigation:** Prove the mutation shape early; if it cannot be made permission-safe, switch to a tracked SQL function for the log-meal operation.
- **Risk:** Public food seeds may not populate production. — **Mitigation:** Make production public-food bootstrap explicit during implementation: existing production seed mechanism, migration/admin bootstrap, or documented acceptance of an initially empty public catalog.
- **Risk:** A 7th top-level nav item may crowd the mobile tab bar. — **Mitigation:** Verify mobile layout in Phase 2 and adjust minimally if needed.
- **Risk:** Frontend phases have limited automated feature verification. — **Mitigation:** Treat codegen + `bun run check` as the hard gate and capture reviewer/best-effort manual smoke evidence for flows.
- **Risk:** Hasura `numeric` values may be strings. — **Mitigation:** Normalize numeric values in `frontend/src/lib/nutrition.ts` before macro math.
- **Risk:** Local date routes can be off by one if UTC formatting is used. — **Mitigation:** Use explicit local calendar-date helpers and validate route params.
- **Risk:** Codegen drift in frontend-only phases could hide accidental metadata/schema changes. — **Mitigation:** In Phases 2–5, verify `frontend/schema.user.graphqls` does not change unless the phase intentionally changes backend metadata.
- **Risk:** `ON DELETE RESTRICT` on public foods can block admin cleanup after users reference public foods. — **Mitigation:** Document the operations caveat; curated public foods should be edited/deprecated rather than deleted once in use.

---

## 7. Follow-ups (out of scope for this plan)

- Barcode scanning, OCR, external food database import — tracked in: TBD.
- Serving-size conveniences on top of per-100g source-of-truth — tracked in: TBD.
- Nutrition goals/targets and trend analytics — tracked in: TBD.
- Weekly/monthly scheduling or calendar assignment for plans — tracked in: TBD.
- Public user-created meals/plans — tracked in: TBD.
- Automated frontend/e2e tests for nutrition flows — tracked in: TBD.
- Optional server-side aggregate/generated total columns if daily log row counts grow large — tracked in: TBD.
