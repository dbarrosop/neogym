# Add ad-hoc nutrition log entries

**Status:** ready
**Created:** 2026-07-02

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

Users currently must pre-create a reusable food catalog item before logging anything eaten. That is too much ceremony for one-off items such as a restaurant meal or candy that the user likely never wants to see again in their reusable food picker.

### 1.2 Functional requirements

- Users can log a one-off/ad-hoc food directly on a nutrition day without creating a `foods` row.
- Ad-hoc foods are log-only snapshots: they display in the day log and contribute to totals, but never appear in reusable food lists or food pickers.
- Ad-hoc input uses the same nutrient model as catalog foods: food name, consumed grams, logged time, and kcal/fat/carbs/protein/fiber/sugar per 100g.
- Existing reusable food, meal-template, selected-plan meal, and selected-plan direct-food logging flows keep working.
- Existing food-backed logs continue to copy trusted snapshots from `foods` on insert.
- Ad-hoc entries can be edited after creation: name, grams, logged time, and snapshot macro fields.
- Daily totals continue to use logged `snapshot_*` columns, never live `foods` values.
- Deleting entries, logged meal groups, and clearing a day continue to behave as today.

### 1.3 Non-functional requirements / constraints

- Security: user-role permissions must keep nutrition log writes scoped to the caller's own `nutrition_days` rows.
- Integrity: the database must distinguish valid food-backed rows from valid ad-hoc rows, including after a source food is deleted and a food-backed row's `food_id` becomes `NULL`.
- Integrity: direct snapshot input must not allow forged plan-food provenance, grouped ad-hoc rows, cross-user writes, or food-backed snapshot tampering.
- Backwards compatibility: existing rows and existing clients remain valid through an additive migration.
- Deployment: schema and metadata changes require local Nhost restart/apply, backend tests, and frontend codegen through the repository pipeline.
- Documentation: keep `docs/developers/nutrition.md`, `docs/developers/database.md`, `docs/developers/permissions.md`, and root `CLAUDE.md` in sync with the new nutrition contract.
- Tooling gates: backend `make test`; frontend `nix develop ../ --command bun run check`; iOS `swift test`, `swift build`, and app build validation when feasible.

### 1.4 Surfaces in scope

- `backend/nhost/migrations/default/` — Postgres schema, trigger, and rollback contract.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — user-role column exposure and permission checks.
- `backend/tests/nutrition.test.ts` — proof of ownership, snapshot, source, and provenance invariants.
- `frontend/src/components/log-intake-dialog.tsx` — web add-intake UI for custom one-off entries.
- `frontend/src/components/daily-intake-log.tsx` — web day-log query/display/edit behavior.
- `frontend/src/lib/nutrition.ts` and frontend nutrition tests — shared macro parsing/preview helpers and payload-shape coverage where useful.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — checked-in generated GraphQL schema/types.
- `ios/NeoGym/Sources/NeoGymKit/` nutrition models, repository documents, repository, and view model — native API contract and validation.
- `ios/NeoGym/App/Nutrition/` — SwiftUI add/edit UI.
- `ios/NeoGym/Tests/NeoGymKitTests/NutritionDayTests.swift` — deterministic native model/repository/view-model coverage.
- `docs/developers/` and `CLAUDE.md` — domain contract documentation.

### 1.5 Out of scope

- External restaurant or food database integration.
- Barcode scanning, brand fields, package import, or catalog-enrichment features.
- Auto-creating reusable catalog foods for ad-hoc logs.
- Redesigning meal templates or nutrition plan templates.
- Grouped ad-hoc meal entries; this plan supports standalone ad-hoc food log entries only.

### 1.6 Success criteria

- A user can add an ad-hoc food to a nutrition day from web and iOS with name, consumed grams, time, and per-100g nutrients.
- The ad-hoc entry appears in the day log, contributes to macro totals immediately, and does not appear in reusable food pickers/lists.
- The user can edit an ad-hoc entry's name, snapshot macros, grams, and time afterward.
- Food-backed snapshots remain immutable to user-role updates, including after the source food is deleted.
- Existing food/meal/plan logging flows and tests remain green.
- Backend negative tests cover ad-hoc ownership, source/provenance shape, missing snapshots, and food-backed snapshot immutability.
- Backend, frontend, and iOS gates pass or any infeasible manual/app build check is explicitly reported.

---

## 2. Implementation strategy

### 2.1 Central design decision

Add a persisted `nutrition_log_entries.source` discriminator with values `food` and `ad_hoc`. Do not infer ad-hoc status from `food_id IS NULL`, because food-backed historical rows intentionally set `food_id` to `NULL` when a source food is deleted. Food-backed rows keep trusted trigger-populated snapshots and immutable snapshot fields; ad-hoc rows store user-supplied snapshot fields and allow those fields to be edited.

### 2.2 Key constraints and invariants

- `source` is immutable after insert.
- Existing rows and existing insert paths default to `source = 'food'`.
- New food-backed inserts require `food_id IS NOT NULL` in the insert trigger only. Do not add a static CHECK requiring `source='food' -> food_id IS NOT NULL`, because existing food-backed rows must survive source-food deletion with `food_id = NULL`.
- Static constraints should cover valid source values, ad-hoc shape, and snapshot/name validity.
- Ad-hoc rows are standalone only: `food_id IS NULL`, `nutrition_plan_food_id IS NULL`, and `nutrition_log_meal_id IS NULL`.
- Food-backed inserts overwrite any client-supplied snapshot fields from the referenced `foods` row.
- Ad-hoc inserts require nonblank `snapshot_food_name` and all non-null, nonnegative snapshot nutrient fields.
- Food-backed snapshot/name fields are immutable to user/API updates; ad-hoc snapshot/name fields are editable.
- The snapshot immutability guard must compare protected columns with `OLD ... IS DISTINCT FROM NEW ...`; it must not reject unchanged snapshot fields and must preserve allowed edits to `grams`, `position`, and `slot_time`.
- Hasura may expose snapshot insert/update columns broadly to the `user` role only because the database trigger/checks enforce the source-specific boundary.
- Ad-hoc standalone positions reuse the existing per-day standalone-entry `nextEntryPosition` logic in web and iOS.

### 2.3 Touched surfaces

- `backend/nhost/migrations/default/1790000520000_nutrition_ad_hoc_log_entries/` — add `source`, constraints, trigger changes, and down migration.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — expose `source` and snapshot columns for user-role inserts/updates with safe row checks.
- `backend/tests/nutrition.test.ts` — add positive/negative coverage and update stale snapshot-immutability tests.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerate via `bun run codegen` after metadata/schema and later document changes.
- `frontend/src/components/log-intake-dialog.tsx` — add Custom/One-off mode and ad-hoc insert payload.
- `frontend/src/components/daily-intake-log.tsx` — query `source` and conditionally expose ad-hoc edit UI.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — decode source and model ad-hoc insert/update values.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — query source and build ad-hoc insert/update variables.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — expose ad-hoc repository method.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — validate and route ad-hoc logging/editing.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift`, `DailyIntakeViews.swift`, `PreviewNutritionFoodMealRepository.swift` — native UI and preview fake updates.
- `docs/developers/nutrition.md`, `docs/developers/database.md`, `docs/developers/permissions.md`, `CLAUDE.md` — update contract statements.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** `source DEFAULT 'food'` keeps existing rows and clients valid. Existing food-backed inserts can keep omitting `source` and snapshot columns.
- **Deployment:** Apply the migration and metadata together. Nhost CLI does not hot-reload metadata; restart with `make dev-env-down && make dev-env-up` for local verification, or apply through Hasura metadata API. Prefer the configured Nhost MCP for inspecting/applying metadata and local GraphQL checks when available.
- **Deployment:** Run `bun run codegen` from `frontend/` after Phase 1 schema/metadata changes and again after Phase 2 GraphQL document changes.
- **Rollback:** The down migration should drop the guard/source/checks and restore the food-only snapshot trigger. This is not a perfect semantic reversal if ad-hoc rows already exist, because those existing rows can survive as `food_id`-null snapshot rows; acceptable for development rollback, but production rollback should be treated as a data-aware revert.

---

## 3. Phased plan of action

### Phase 1 — Backend contract, metadata, tests, codegen, and docs

**Goal:** Establish the API/database contract for ad-hoc log entries while keeping existing clients functional.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/migrations/default/1790000520000_nutrition_ad_hoc_log_entries/up.sql` — additive schema/trigger migration.
- `backend/nhost/migrations/default/1790000520000_nutrition_ad_hoc_log_entries/down.sql` — rollback migration.
- `backend/nhost/metadata/databases/default/tables/public_nutrition_log_entries.yaml` — user-role insert/select/update permissions.
- `backend/tests/nutrition.test.ts` — positive/negative source/snapshot/provenance/ownership coverage.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — generated GraphQL outputs after schema/metadata changes.
- `docs/developers/nutrition.md`, `docs/developers/database.md`, `docs/developers/permissions.md`, `CLAUDE.md` — updated docs.

**Implementation steps:**

1. Add migration directory `backend/nhost/migrations/default/1790000520000_nutrition_ad_hoc_log_entries/`.
2. In `up.sql`, add `nutrition_log_entries.source text NOT NULL DEFAULT 'food'`.
3. Add `nutrition_log_entries_source_check CHECK (source IN ('food', 'ad_hoc'))`.
4. Add an ad-hoc shape CHECK that enforces `source <> 'ad_hoc' OR (food_id IS NULL AND nutrition_plan_food_id IS NULL AND nutrition_log_meal_id IS NULL)`.
5. Add/adjust `snapshot_food_name` format validation to match `foods.name` (`length(btrim(...)) BETWEEN 1 AND 160`). Do not add any CHECK requiring `source='food'` rows to keep non-null `food_id` forever.
6. Replace `public.populate_nutrition_log_entry_food_snapshot()`:
   - For `source = 'food'` (including defaulted rows), require `NEW.food_id IS NOT NULL`, load the food, and overwrite all `snapshot_*` fields from `foods`.
   - For `source = 'ad_hoc'`, preserve user-supplied snapshots and rely on NOT NULL/CHECK constraints plus the ad-hoc shape CHECK. The trigger may normalize/validate `snapshot_food_name`, but avoid duplicating all ad-hoc shape rules if the CHECK is the source of truth.
   - Reject unknown source values defensively even though the CHECK also handles them.
7. Add `public.guard_nutrition_log_entry_snapshot_immutability()` and a `BEFORE UPDATE OF source, snapshot_food_name, snapshot_kcal_per_100g, snapshot_fat_per_100g, snapshot_carbs_per_100g, snapshot_protein_per_100g, snapshot_fiber_per_100g, snapshot_sugar_per_100g` trigger.
8. Implement the update guard so it:
   - rejects `source` changes for all rows;
   - rejects food-backed snapshot/name edits only when a protected column is actually distinct between `OLD` and `NEW`;
   - allows ad-hoc snapshot/name edits;
   - preserves allowed edits to `grams`, `position`, and `slot_time`.
9. Update table/function/comment text that currently says snapshots always come from `foods` and users can edit only grams/position/time.
10. In `down.sql`, drop the update guard trigger/function, drop the new constraints and `source`, and restore the previous food-only snapshot trigger. Note in comments that rollback is semantically lossy if ad-hoc rows already exist.
11. Update `public_nutrition_log_entries.yaml`:

- add `source` to `column_config` and `custom_column_names`;
- add `source` to select columns;
- add `source` and all snapshot columns to insert columns;
- add snapshot name/nutrient columns to update columns, but do not add `source`, `food_id`, `nutrition_plan_food_id`, `nutrition_day_id`, or `nutrition_log_meal_id` to update columns.
1. Make the insert permission's food visibility check concrete for nullable food:

   ```yaml
   - _or:
       - food_id:
           _is_null: true
       - food:
           _or:
             - user_id:
                 _eq: X-Hasura-User-Id
             - is_public:
                 _eq: true
   ```

   Keep the existing `nutritionDay.user_id = X-Hasura-User-Id`, optional owned `nutritionLogMeal`, and optional owned `nutritionPlanFood` checks. Let DB CHECKs/triggers reject null-food rows that are not valid `source='ad_hoc'` rows.
13. Update `backend/tests/nutrition.test.ts`:

- positive user-role ad-hoc insert with `source: "ad_hoc"`, null/omitted food/provenance/group IDs, snapshot name/nutrients, grams, position, and slot time;
- negative ad-hoc insert with non-null `foodId`;
- negative ad-hoc insert with `nutritionPlanFoodId`;
- negative ad-hoc insert with `nutritionLogMealId`;
- negative ad-hoc insert missing required snapshot/name values;
- negative default/`source:'food'` insert with null food;
- negative foreign-user insert into another user's day;
- positive ad-hoc update of snapshot name/nutrients plus grams/time;
- negative food-backed snapshot-only update via the DB guard;
- negative `source` update;
- food-backed forged snapshot insert still gets overwritten by the trigger;
- delete a source food, assert the log row remains `source='food'`, `foodId=null`, snapshots remain, and snapshot edits still fail.
1. Rewrite/split any existing test that currently proves snapshot immutability only because `foodId` is still blocked by the Hasura allowlist. It must include a snapshot-only update against a food-backed row and expect a DB-guard failure.
2. Apply locally with `cd backend && make dev-env-down && make dev-env-up` when migration/metadata are ready.
3. Run `cd backend && make test`.
4. Run `cd frontend && nix develop ../ --command bun run codegen` from `frontend/`. Phase 1's verifiable generated artifact is the updated `frontend/schema.user.graphqls`; TypeScript input helper types may only materialize after Phase 2 documents reference them.
5. Run `cd frontend && nix develop ../ --command bun run check` after codegen because checked-in generated files changed.
6. Update `docs/developers/nutrition.md`, `docs/developers/database.md`, `docs/developers/permissions.md`, and `CLAUDE.md` so they describe food-backed vs ad-hoc entries, the `source` discriminator, editable ad-hoc snapshots, immutable food-backed snapshots, and user-role permission boundaries.

**Tests and checks:**

- `cd backend && make dev-env-down && make dev-env-up`
- `cd backend && make test`
- `cd frontend && nix develop ../ --command bun run codegen`
- `cd frontend && nix develop ../ --command bun run check`

**Definition of done:**

- Fresh backend apply succeeds.
- Backend tests pass, including new positive/negative ad-hoc coverage and orphaned food-backed snapshot immutability.
- Existing reusable food/meal/plan logging API tests remain green.
- `frontend/schema.user.graphqls` reflects `source` and snapshot insert/update capability for the user role.
- Frontend check passes after codegen.
- Docs no longer claim every nutrition-log insert requires `food_id` or that snapshot columns are never user-updatable.
- System remains fully functional because existing clients still default to food-backed inserts and all existing flows are preserved.

**Phase commit message:** `feat(nutrition): add ad-hoc log entry backend contract`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 2 — Web ad-hoc logging and editing

**Goal:** Expose ad-hoc log entry creation and editing in the TanStack web frontend.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/log-intake-dialog.tsx` — add Custom/One-off mode and ad-hoc insert mutation path.
- `frontend/src/components/daily-intake-log.tsx` — query `source` and expose conditional ad-hoc edit UI.
- `frontend/src/lib/nutrition.ts` — add/reuse helper functions only if they reduce duplication.
- `frontend/src/components/quick-nutrition-dialogs.test.ts` or a new focused test file — payload and validation tests.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerated after changed GraphQL documents.

**Implementation steps:**

1. Add `source` to both log-entry selections in `DailyIntakeLogQuery` and to the local `DailyEntry` type.
2. Extend `DialogMode` in `LogIntakeDialog` with an `ad-hoc`/Custom/One-off mode.
3. Add a fourth tab/segment in `LogIntakeSourceTabs` for ad-hoc/custom logging.
4. Add ad-hoc form state and inputs: food name, grams consumed, logged time, and per-100g kcal/fat/carbs/protein/fiber/sugar.
5. Reuse `DECIMAL_INPUT_PATTERN`, `parseMacroInput`, numeric normalization, and macro-total helpers. Extract a small helper from `FoodForm`/nutrition utilities only if duplication becomes noisy.
6. Validate nonempty trimmed name, positive grams, and parseable nonnegative nutrient values.
7. Compute preview totals from the entered per-100g values and grams; do not look up `foods`.
8. Add ad-hoc insert mutation path using `nutritionLogEntries_insert_input` with `source: "ad_hoc"`, `nutritionDayId`, `snapshotFoodName`, all snapshot nutrient fields, `grams`, `position: nextEntryPosition`, and `slotTime`. Omit `foodId`, `nutritionPlanFoodId`, and `nutritionLogMealId`.
9. Keep `FoodPicker` unchanged so ad-hoc entries cannot appear in reusable food pickers/lists.
10. In `DailyIntakeLog`, add an edit affordance for `source === 'ad_hoc'` rows. The edit UI should allow name, snapshot nutrients, grams, and time.
11. Keep food-backed rows on the existing grams/time/position edit path and show snapshot details as read-only.
12. Reuse `UpdateNutritionLogEntryMutation` for ad-hoc edits with `_set` containing only allowed mutable columns.
13. Add tests for ad-hoc insert payload shape, ad-hoc update payload shape, validation, and preview totals.
14. Run `cd frontend && nix develop ../ --command bun run codegen` because GraphQL documents changed.
15. Run `cd frontend && nix develop ../ --command bun run check`.
16. Manually exercise in the browser if feasible: add ad-hoc food, verify totals/log display, edit ad-hoc details, confirm it is absent from food picker/list, and smoke-test existing food/meal/plan logging.

**Tests and checks:**

- Frontend tests for ad-hoc validation and payload builders.
- `cd frontend && nix develop ../ --command bun run codegen`
- `cd frontend && nix develop ../ --command bun run check`
- Manual browser smoke test when feasible; if not feasible, report why.

**Definition of done:**

- Web check passes.
- Ad-hoc entries can be added and edited from a nutrition day.
- Ad-hoc entries contribute to totals using snapshot fields.
- Ad-hoc entries do not appear in food picker/list.
- Existing reusable food, meal, selected-plan meal, and selected-plan food logging still work.
- System remains fully functional because the web UI only uses the Phase 1 API contract and preserves old paths.

**Phase commit message:** `feat(frontend): add ad-hoc nutrition logging UI`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — iOS ad-hoc logging and editing

**Goal:** Expose ad-hoc log entry creation and editing in NeoGymKit and the SwiftUI iOS app.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — source decoding and ad-hoc value/update models.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — GraphQL selections and variable builders.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — repository protocol/implementation.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — validation and mutation orchestration.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — add/edit UI.
- `ios/NeoGym/App/Nutrition/DailyIntakeViews.swift` — entry points and edit routing if needed.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` — preview fake protocol conformance.
- `ios/NeoGym/Tests/NeoGymKitTests/NutritionDayTests.swift` — deterministic native tests.
- `ios/NeoGym/project.yml` / generated project — only if file additions require XcodeGen source updates.

**Implementation steps:**

1. Add `source` to `NutritionLogEntry`. Prefer a small typed representation or constants if practical; at minimum provide `isAdHoc`.
2. Decode missing `source` defensively as food-backed/default food semantics so existing fixtures or older query payloads do not crash unnecessarily.
3. Add `LogAdHocFoodValues` with day id, name, grams, slot time, position, and six per-100g macro strings.
4. Extend `LogEntryUpdateValues` with optional `snapshotFoodName` and six optional snapshot macro fields.
5. Add `source` to every iOS GraphQL selection that decodes `NutritionLogEntry`, including `nutritionDaysIndexQuery` and `dailyIntakeLogQuery`.
6. Add `logAdHocFoodObject(_:)` in `NutritionDayRepositoryDocuments.swift` that sends `source: "ad_hoc"`, snapshot fields, grams, position, slot time, and day id, with no food/plan provenance.
7. Leave `logFoodObject(_:)` food-backed behavior as-is; it can rely on server default `source='food'`.
8. Extend `logEntryUpdateSet(_:)` to include snapshot fields when provided.
9. Add `logAdHocFood(_:)` to `NutritionFoodMealRepositoryProtocol`, concrete `NutritionFoodMealRepository`, and `PreviewNutritionFoodMealRepository`.
10. Add `DailyIntakeViewModel.logAdHocFood(...)` with validation for nonempty name, positive grams, nonnegative parseable macros, valid time, and existing standalone `nextEntryPosition`.
11. Add an ad-hoc update path that sends snapshot fields only for ad-hoc rows.
12. Add `.adHoc` mode to `LogIntakeSheet`, with inputs for name, grams, time, and per-100g nutrients. Wire save to `logAdHocFood`.
13. Extend `EditLogEntrySheet`: if `item.entry.isAdHoc`, render editable name and macro fields along with grams/time/position; otherwise keep current food-backed grams/position/time behavior.
14. Update `DailyIntakeViews.swift` only as needed to expose an obvious add-custom-food entry point and route edit actions.
15. Add/update tests in `NutritionDayTests.swift`:
    - ad-hoc insert variables include `source:'ad_hoc'` and snapshots and omit food/provenance;
    - ad-hoc update variables include snapshot fields;
    - view-model validation rejects invalid ad-hoc name/grams/macros;
    - decoding `source` round-trips and missing source defaults safely;
    - existing food/meal/plan logging tests remain green.
16. Run `cd ios/NeoGym && swift test`.
17. Run `cd ios/NeoGym && swift build`.
18. Because SwiftUI app files changed, run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` if sources/project inputs changed, then if feasible run `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`. If not feasible, report the reason.

**Tests and checks:**

- `cd ios/NeoGym && swift test`
- `cd ios/NeoGym && swift build`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` when project inputs/sources require it.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` when feasible.

**Definition of done:**

- Swift package tests and build pass.
- App build validation passes or infeasibility is explicitly documented.
- iOS can add and edit ad-hoc entries.
- Existing iOS food/meal/plan logging behavior remains covered and green.
- System remains fully functional because the native app uses the Phase 1 API contract and preserves old paths.

**Phase commit message:** `feat(ios): add ad-hoc nutrition logging`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing or moving to another phase, run all phase checks. If a command fails, send exact failures back to the implementer, run a fresh reviewer pass after the fix, and rerun the gate.
6. **Commit:** Commit all changes made during the phase with the phase commit message only after the relevant checks pass or any skipped checks are explicitly justified.
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
| Log one-off food without creating a catalog food | 1, 2, 3 | Backend ad-hoc insert test; web/iOS add flows; absence from `foods` writes |
| Ad-hoc rows are log-only snapshots and absent from pickers | 1, 2, 3 | DB stores only `nutrition_log_entries`; web `FoodPicker` unchanged; native food picker continues to read `foods` |
| Input uses grams plus per-100g nutrients | 2, 3 | Web/native form validation tests and manual smoke tests |
| Existing food/meal/plan logging keeps working | 1, 2, 3 | Existing backend/frontend/iOS tests; manual web smoke test |
| Food-backed snapshots remain trusted/immutable | 1 | Forged snapshot overwritten test; food-backed snapshot-only update fails; orphaned food-backed edit fails |
| Ad-hoc snapshots editable after creation | 1, 2, 3 | Backend update success test; web/iOS edit tests/manual checks |
| Daily totals use logged snapshots | 2, 3 | Existing macro total helpers plus ad-hoc preview/edit tests |
| User can only write own day entries | 1 | `gqlAsUser` foreign-day negative test |
| Forged plan provenance blocked | 1 | Ad-hoc with `nutritionPlanFoodId` negative test; existing provenance trigger tests |
| Backwards-compatible migration | 1 | Fresh apply, existing tests, default source food behavior |
| Docs updated | 1 | Review changed docs for no stale `food_id`-required/snapshot-never-updatable claims |
| Web generated files current | 1, 2 | `bun run codegen`; `bun run check` |
| iOS native behavior current | 3 | `swift test`, `swift build`, app build validation when feasible |

---

## 6. Risks and mitigations

- **Risk:** Hasura object-relationship checks over null `food_id` reject ad-hoc inserts. — **Mitigation:** Use explicit `food_id IS NULL OR visible food` check and cover with a user-role positive insert test.
- **Risk:** Broad snapshot update columns let food-backed rows be tampered with. — **Mitigation:** DB update guard rejects actual snapshot/name changes for `source='food'`; backend tests include food-backed and orphaned-food cases.
- **Risk:** `food_id IS NULL` rows are misclassified after source food deletion. — **Mitigation:** Persist immutable `source` and test delete-source-food behavior.
- **Risk:** Naive update guard breaks existing grams/time updates because unchanged snapshot columns are present in `NEW`. — **Mitigation:** Compare protected columns with `IS DISTINCT FROM`; keep grams/position/time tests green.
- **Risk:** Existing tests become false-green after metadata changes. — **Mitigation:** Rewrite snapshot/food-provenance update tests to separately assert allowlist and DB-guard behavior.
- **Risk:** Codegen drift or large generated diffs from ad-hoc introspection. — **Mitigation:** Use only the repository's `bun run codegen` pipeline.
- **Risk:** Swift package checks do not compile SwiftUI app files. — **Mitigation:** Include XcodeGen/app build validation when feasible for Phase 3.
- **Risk:** Down migration cannot cleanly reclassify existing ad-hoc rows. — **Mitigation:** Document rollback as data-aware; standard dev rollback remains acceptable before production data is introduced.

---

## 7. Follow-ups (out of scope for this plan)

- Grouped ad-hoc meal entries — tracked in: TBD if users need one-off multi-food restaurant meals as a grouped object.
- Brand/barcode/import or external restaurant food database integration — tracked in: TBD.
- Reusable cross-platform nutrient form abstraction — tracked in: TBD if web/iOS duplication grows.
