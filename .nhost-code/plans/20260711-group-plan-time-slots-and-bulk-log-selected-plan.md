# Group plan time slots and bulk log selected plan

**Status:** ready
**Created:** 2026-07-11

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

Nutrition daily intake already groups logged foods and meal groups by eaten time slot, but nutrition plan viewing, plan editing, and logging from plan still feel flat and entry-by-entry. Make the plan surfaces time-slot oriented in the same spirit, and let users materialize the whole already-selected daily plan in one explicit action.

### 1.2 Functional requirements

- Apply the change to both the native iOS Nutrition flow and the web frontend Nutrition flow.
- Group nutrition plan entries by time slot in plan detail/viewing screens.
- Group nutrition plan entries by time slot in plan create/edit screens while preserving mixed meal/direct-food ordering and global per-slot positions across `nutrition_plan_meals` and `nutrition_plan_foods`.
- Logging from plan must only use the already-selected plan on the day.
- If no plan is selected for the day, there must be no “From plan” tab, action, suggestion list, or plan entries shown anywhere.
- If a plan is selected for the day, only time slots and entries from that selected plan may be shown for plan logging.
- Add one-shot bulk logging for all entries from the selected plan.
- Preserve individual selected-plan entry logging.
- Bulk logging v1 logs the whole selected plan: no include/exclude checkboxes, no duplicate detection, and no separate per-slot bulk action.
- Bulk logging must show a confirmation step with editable logged times per plan time slot, defaulting to the plan slot times. Every entry in a confirmed plan time slot receives that edited actual logged time.
- Individual planned-entry logging must continue defaulting actual eaten time to now and only show planned slot time as a suggestion.
- Preserve provenance and snapshot semantics:
  - planned meals log as `nutritionLogMeal` rows with `nutritionPlanMealId` and nested child `nutritionLogEntries`;
  - direct planned foods log as standalone `nutritionLogEntry` rows with matching `nutritionPlanFoodId` and `foodId`;
  - food-backed snapshots remain database-populated and historical logs are not rewritten by later template/food edits.
- Existing standalone food, meal-template, and ad-hoc logging must keep working.

### 1.3 Non-functional requirements / constraints

- Avoid backend schema or metadata changes unless implementation proves they are necessary.
- Prefer existing Hasura/Nhost nested and plural insert shapes.
- Bulk logging must be atomic from each client’s perspective: one combined mutation/request containing both plural insert roots, not sequential per-entry network calls.
- Keep `docs/developers/nutrition.md` and `CLAUDE.md` synchronized in the same phase as behavior changes that make current prose stale.
- Add/update pure helper, view-model/repository, and UI-adjacent tests where practical.
- Run required iOS Swift package/app checks and frontend checks before phase commits.
- Maintain existing native navigation conventions, accessibility expectations, shadcn/Tailwind conventions, and Biome formatting.

### 1.4 Surfaces in scope

- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` or sibling host-testable model files — plan grouping and draft grouping helpers.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — selected-plan bulk materialization orchestration.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — bulk plan log value types if needed.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` and `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — combined bulk insert repository method/document.
- `ios/NeoGym/App/Nutrition/PlanDetailView.swift` — grouped plan detail presentation.
- `ios/NeoGym/App/Nutrition/PlanEditorViews.swift` — grouped plan editor presentation and within-slot movement.
- `ios/NeoGym/App/Nutrition/DailyIntakeViews.swift`, `DailyIntakeRows.swift`, `LogFoodMealSheets.swift` — grouped selected-plan suggestions, no-plan gating, and bulk confirmation UI.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` and any iOS fakes/mocks — protocol conformance for new bulk repository method.
- `ios/NeoGym/Tests/NeoGymKitTests/*Nutrition*` — grouping, renumbering, materialization, and repository payload tests.
- `frontend/src/lib/nutrition.ts` and `frontend/src/lib/nutrition.test.ts` — plan grouping and bulk materialization helpers/tests.
- `frontend/src/components/daily-intake-log.tsx` — grouped selected-plan suggestions and bulk logging mutation/UI.
- `frontend/src/components/log-intake-dialog.tsx` — individual plan picker no-plan tab removal and optional grouped picker sections.
- `frontend/src/components/nutrition-plan-form.tsx` — grouped plan editor presentation and within-slot movement.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` and related plan routes — grouped plan detail display.
- `frontend/src/gql/` — regenerated outputs after new web GraphQL operations.
- `docs/developers/nutrition.md` and `CLAUDE.md` — durable behavior and workflow documentation.

### 1.5 Out of scope

- New scheduling or binding semantics for `nutrition_days.nutritionPlanId`.
- New backend invariants, migrations, permissions, actions, or RPCs unless an implementation blocker proves they are required.
- Public food catalog changes or macro math redesign.
- Removing individual planned-entry logging.
- Bulk include/exclude checkboxes, duplicate detection/skip behavior, or “log this slot” as a separate v1 action.

### 1.6 Success criteria

- Plan detail and plan editor on iOS and web present entries grouped by formatted time slots with slot-level macro/count summaries.
- Editor save round-trips preserve current variable shapes and per-slot positions.
- Day logging exposes no plan logging affordance when no plan is selected.
- Day logging for a selected plan shows grouped plan slots and still allows individual planned-entry logging.
- User can bulk log the entire selected plan in one action after confirming/editing per-slot logged times.
- Bulk logs use correct meal-group vs standalone-food insert shapes, provenance IDs, child `nutritionDayId`, snapshot behavior, and deterministic top-level ordering.
- Tests cover grouping, sorting, renumbering, within-slot movement, bulk materialization, position calculation, empty arrays, and key edge cases.
- Required iOS, frontend, and codegen checks pass.

### 1.7 Open questions / blockers (optional)

No blocking open questions remain. The following edge decisions are part of the plan:

- No-time legacy/imported plan slots: current plan validation requires slot time. If a legacy no-time slot appears, the bulk confirmation defaults that slot’s logged time to current time and requires a non-empty time before saving. Owner: implementer; blocking: no.
- Empty meal template in a selected plan: bulk logging fails the whole transaction before sending, with a clear message naming the empty meal. This keeps “log the whole plan” all-or-nothing and matches the existing individual meal logging failure. Owner: implementer; blocking: no.
- Re-logging the whole selected plan appends duplicates, matching existing individual logging behavior. Owner: implementer; blocking: no.

---

## 2. Implementation strategy

### 2.1 Central design decision

Build a shared plan-time-slot abstraction on both platforms, mirroring existing intake grouping (`groupIntakeByTimeSlot` on web and `IntakeGrouping` on iOS), layered over the existing mixed plan entry ordering `(slot_time, position, kind, id)`. Use that abstraction in plan detail, plan editor, and selected-plan daily logging. Keep persistence on the existing schema: bulk logging is client-side materialization of the selected day plan through one combined Hasura mutation/request that inserts planned meal groups and direct planned foods atomically.

### 2.2 Key constraints and invariants

- `nutrition_days.nutritionPlanId` remains a suggestion/target, not a schedule contract.
- Individual planned-entry logging must not hardcode/copy the plan slot time as the logged time; it defaults to now and displays planned time only as a suggestion.
- Bulk logging may default to plan slot times only inside an explicit confirmation UI where the user can edit each plan time slot’s logged time before saving.
- Every entry in a confirmed plan time slot receives that edited actual logged time.
- Each nested planned-meal child entry must explicitly include the same `nutritionDayId` as the parent group.
- Direct plan-food logs must be standalone and carry matching `nutritionPlanFoodId` and `foodId`.
- Food-backed snapshots remain database-populated; clients must not send snapshot fields for food-backed bulk rows.
- Plan per-slot `position` values are not daily-log positions. Bulk materialization computes new daily-log top-level positions from existing day rows and flattened selected-plan order.
- Bulk logging must use one combined mutation document/request per platform with both plural insert roots. Sequential per-entry network calls are not acceptable.
- Empty `objects: []` arrays are the chosen implementation for meals-only/foods-only cases; implementation must verify they return `affected_rows: 0` for the user role. If runtime rejects empty arrays, the fallback must still be a single combined document using `@include` booleans, not sequential calls.
- Grouped editor move controls reorder within the current normalized time slot only; cross-slot movement is done by editing the row’s time.

### 2.3 Touched surfaces

- `frontend/src/lib/nutrition.ts` — `PlanTimeSlot`, `groupPlanEntriesByTimeSlot`, bulk input builder, and movement/renumber helpers if useful.
- `frontend/src/lib/nutrition.test.ts` — helper tests.
- `frontend/src/components/nutrition-plan-form.tsx` — grouped editor and within-slot move UI.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` — grouped plan detail.
- `frontend/src/components/daily-intake-log.tsx` — selected-plan grouped suggestions, bulk mutation/hook, bulk confirmation UI.
- `frontend/src/components/log-intake-dialog.tsx` — hide plan tab when no selected plan; optional grouped plan picker sections when selected.
- `frontend/src/gql/` — regenerated GraphQL artifacts after new operation documents.
- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` or sibling model file — plan grouping and draft movement helpers.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — bulk log value types if needed.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — bulk orchestration and validation.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` and `NutritionDayRepositoryDocuments.swift` — combined bulk mutation method/document.
- `ios/NeoGym/App/Nutrition/PlanDetailView.swift`, `PlanEditorViews.swift`, `DailyIntakeViews.swift`, `DailyIntakeRows.swift`, `LogFoodMealSheets.swift` — grouped UI and bulk confirmation.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` plus test fakes — new protocol method support.
- `ios/NeoGym/Tests/NeoGymKitTests/*` — unit and repository/view-model tests.
- `docs/developers/nutrition.md` and `CLAUDE.md` — docs sync.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No schema, metadata, permission, or migration change is planned. Existing individual logging paths remain intact.
- **Deployment:** Web Phase 3 adds new GraphQL operation documents, so `bun run codegen` is mandatory with the backend available (`backend make dev-env-up` if local stack is not already running). `schema.user.graphqls` should not change unless the schema changed independently; generated operation types under `frontend/src/gql/` will.
- **Rollback:** Standard revert is sufficient because the feature is client-side over existing tables. Reverting Phase 4 removes the user-facing bulk path; historical logs created by the feature remain ordinary `nutrition_log_meals`/`nutrition_log_entries` rows.

---

## 3. Phased plan of action

### Phase 1 — Add shared plan grouping helpers

**Goal:** Add pure plan time-slot grouping and draft grouping helpers with tests and no UI behavior change.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/lib/nutrition.ts` — add `PlanTimeSlot`, `groupPlanEntriesByTimeSlot`, and draft grouping helpers.
- `frontend/src/lib/nutrition.test.ts` — add plan grouping and renumbering tests.
- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` or sibling host-testable file — add `NutritionPlanTimeSlot` and persisted/draft grouping helpers.
- `ios/NeoGym/Tests/NeoGymKitTests/NutritionPlanTests.swift` or `IntakeGroupingTests.swift` — add equivalent Swift tests.

**Implementation steps:**

1. Add `PlanTimeSlot`/`NutritionPlanTimeSlot` with `key`, `label`, `sortKey`, `entries`, `totals`, `mealCount`, and `foodCount`, explicitly mirroring the existing `IntakeTimeSlot` shape where useful.
2. Implement persisted plan grouping over existing sorted/merged entries; do not replace `mergePlanEntriesByTime`, `sortAndRenumberPlanEntriesByTime`, or `NutritionPlan.sortedEntries`.
3. Implement draft plan grouping over existing sorted/renumbered draft entries; do not change submit payload shapes.
4. Preserve existing no-time fallback for grouping, even though current validation requires plan slot time.
5. It is acceptable for these helpers/types to be exported but unused until Phase 2.

**Tests and checks:**

- Test multi-slot bucketing and slot sort order.
- Test mixed meal/food ordering inside one slot.
- Test no-time fallback grouping and ordering.
- Test slot-level totals and meal/food counts.
- Test per-slot position renumbering remains stable.
- Run `cd ios/NeoGym && swift test`.
- Run `cd frontend && nix develop ../ --command bun run check`.

**Definition of done:**

- Grouping helpers exist and are covered by tests.
- Existing app behavior is unchanged because no UI consumes the helpers yet.
- Phase is testable entirely through Swift and frontend helper tests.

**Phase commit message:** `feat(nutrition): add plan time-slot grouping helpers`

**Implementation log**

- **Implementation notes:** Added pure plan time-slot grouping helpers on web (`PlanTimeSlot`, `groupPlanEntriesByTimeSlot`, `groupPlanDraftEntriesByTimeSlot`) and iOS (`NutritionPlanTimeSlot`, `NutritionPlanGrouping`) without wiring them into UI. Helpers preserve existing merge/sort/renumber APIs, support the no-time fallback, and expose slot labels/sort keys, totals, and meal/food counts.
- **Tests added/updated:** Extended `frontend/src/lib/nutrition.test.ts` and `ios/NeoGym/Tests/NeoGymKitTests/NutritionPlanTests.swift` for multi-slot bucketing, mixed intra-slot ordering, no-time-last fallback, totals/counts, and draft per-slot renumbering.
- **Reviewer verdict:** `ACCEPT` — reviewer verified the Phase 1 diff is limited to the four planned files, helpers are covered, and no UI consumes them yet so behavior is unchanged.
- **Autonomous decisions:** Used `xcrun swift test` with conflicting inherited Nix SDK variables unset after plain `swift test` failed before package compilation due an SDK/toolchain mismatch. Pillar justification: correctness — this uses the intended Xcode Swift toolchain for the iOS package and matches the implementer’s successful validation without changing code.
- **Quality gates:**
  - `cd ios/NeoGym && swift test` failed before compiling because inherited Nix `SDKROOT`/`DEVELOPER_DIR` pointed Xcode Swift at an incompatible Nix macOS SDK.
  - `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET xcrun swift test` passed: 241 XCTest tests plus 4 Swift Testing tests, 0 failures.
  - `cd frontend && nix develop ../ --command bun run check` passed: Biome/typecheck/test, 114 tests, 0 failures.

### Phase 2 — Group plan detail and editor UIs

**Goal:** Render grouped time slots in plan viewing and create/edit on both platforms while preserving save semantics.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/PlanDetailView.swift` — grouped slot detail cards.
- `ios/NeoGym/App/Nutrition/PlanEditorViews.swift` — grouped editor sections and within-slot movement.
- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` — model-level `canMoveWithinSlot`/slot-local movement guard if needed.
- `frontend/src/routes/_authed/nutrition/plans/$planId.tsx` — grouped plan detail sections.
- `frontend/src/components/nutrition-plan-form.tsx` — grouped editor sections and within-slot movement.
- `frontend/src/lib/nutrition.ts` / `frontend/src/lib/nutrition.test.ts` — helper tests for slot-local movement if useful.
- `docs/developers/nutrition.md` and `CLAUDE.md` — update grouping/display/editor wording if current docs would be stale after this phase lands independently.

**Implementation steps:**

1. Replace flat plan detail lists with grouped slot cards/sections showing slot label, macro summary, meal/food counts, and existing entry row content.
2. Render editor entries grouped from sorted/renumbered draft entries.
3. Keep row time inputs; changing a row’s time moves it between groups on re-render.
4. Make movement enforceably slot-local below the UI, not just visually disabled:
   - add helper/model checks such as `canMoveWithinSlot` or explicit slot-local move functions;
   - prevent keyboard/programmatic move calls from crossing normalized slot boundaries.
5. Disable move controls at slot boundaries.
6. Submit using existing sorted/renumbered form values so create/save diff code remains unchanged.
7. Update grouping/ordering docs in this phase if Phase 2 is committed independently from the later bulk logging phase.

**Tests and checks:**

- Test within-slot move changes only intra-slot order.
- Test boundary moves are disallowed and cannot cross slots through helper/model methods.
- Test submit values and renumbered per-slot positions remain unchanged by grouped presentation.
- Run `cd ios/NeoGym && swift test`.
- If new Swift app files are added, run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` before the app build.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Run `cd frontend && nix develop ../ --command bun run check`.
- Manual web/iOS create/edit/detail smoke if practical.

**Definition of done:**

- Plan detail and editor UIs are grouped by time slot on both platforms.
- Move controls are within-slot only and enforced by helper/model logic.
- Save round trips preserve existing variable shapes and ordering.
- SwiftUI app compilation and frontend checks pass.
- If docs would otherwise be stale after the phase commit, docs are updated in the same phase.

**Phase commit message:** `feat(nutrition): group plan detail and editor slots`

**Implementation log**

- **Implementation notes:** Grouped plan detail and editor UIs by normalized time slot on web and iOS. Web plan detail and `NutritionPlanForm` now render slot sections/cards with slot counts and macro summaries; iOS `PlanDetailView` and `PlanEditorViews` do the same. Added slot-local move helpers/guards on web and in `NutritionPlanFormModel` so moves cannot cross normalized time slots, while preserving existing sorted/renumbered submit payloads. Updated `docs/developers/nutrition.md` and `CLAUDE.md` to describe grouped plan display/editing and slot-local movement semantics.
- **Tests added/updated:** Extended web and Swift nutrition plan tests for within-slot movement, boundary rejection, and per-slot renumber preservation.
- **Reviewer verdict:** `ACCEPT` — reviewer inspected `git diff b4c35b77`, verified grouped detail/editor behavior on both platforms, model/helper-enforced slot-local movement, preserved submit shape, synced docs, and passing gates. Accepted concern: slot-level editor macro summaries for newly added draft entries may be zero until save/reload; reviewer judged this non-blocking and not a regression from pre-existing per-card behavior.
- **Autonomous decisions:** Used Xcode toolchain commands with conflicting inherited Nix linker/SDK variables unset for Swift and xcodebuild gates. Pillar justification: correctness — inherited Nix SDK/linker variables cause unrelated SwiftPM/Xcode failures with the vendored Nhost Swift dependency, while the clean Xcode environment validates the actual iOS package/app. Ran XcodeGen because `NeoGym.xcodeproj` was absent before the app build; correctness requires regenerating the project from `project.yml` before `xcodebuild`.
- **Quality gates:**
  - `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH xcrun swift test` passed: 242 XCTest tests plus 4 Swift Testing tests, 0 failures.
  - `cd frontend && nix develop ../ --command bun run check` passed: Biome/typecheck/test, 116 tests, 0 failures.
  - `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` passed.
  - `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed. Xcode emitted a pre-existing iOS 26 `UIRequiresFullScreen` deprecation warning.

### Phase 3 — Add bulk selected-plan materialization core

**Goal:** Add pure bulk materialization and repository/network support with tests, but no user-facing bulk button yet.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/lib/nutrition.ts` — `buildPlanLogInputs` and supporting types/helpers.
- `frontend/src/lib/nutrition.test.ts` — materialization, positions, empty arrays, and request-shape tests.
- `frontend/src/components/daily-intake-log.tsx` or a small helper module — combined mutation support only if it can stay referenced/tested without user-facing UI.
- `frontend/src/gql/` — regenerated generated operation types.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — bulk value types if needed.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — bulk method and validation.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — repository protocol and implementation method.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — combined mutation document/variables.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` and all test fakes/mocks — protocol conformance and payload recording.
- `ios/NeoGym/Tests/NeoGymKitTests/*` — materialization and repository/view-model tests.

**Implementation steps:**

1. Reuse or extract existing single-log input builders so bulk planned meal children and direct planned foods match current individual logging shapes.
2. Define `buildPlanLogInputs` / `PlanLogMaterialization` accepting:
   - selected plan;
   - day id;
   - existing logged meal groups and standalone entries;
   - `slotTimeByKey` from the confirmation UI contract.
3. Validate before network calls:
   - selected plan exists;
   - plan has at least one entry;
   - planned meal references are present;
   - each planned meal has at least one ingredient; if any is empty, fail the whole bulk action with a clear message naming the meal;
   - planned food references are present;
   - every target logged time is non-empty. For legacy no-time plan slots, default to current time in the eventual UI and require non-empty here.
4. Flatten selected-plan entries by grouped slot and mixed entry order.
5. Compute daily-log positions per target logged time:
   - plan per-slot positions are inputs only for flattening order, not copied;
   - find the maximum existing top-level source-unit `position` across both existing meal groups and standalone entries whose effective logged time normalizes to the target time;
   - append from `max + 1` in flattened selected-plan order within that target time;
   - use strictly increasing distinct positions so same-time food-before-meal and meal-before-food selected-plan order survives intake grouping’s meal-first tie-breaker;
   - meal child entries keep ingredient-order positions.
6. Add one combined GraphQL document/request per platform with both plural roots:
   - `insertNutritionLogMeals(objects: $mealObjects)`;
   - `insertNutritionLogEntries(objects: $entryObjects)`.
7. Always pass arrays, including `objects: []`, and assert empty arrays produce `affected_rows: 0` in tests/runtime verification. If runtime rejects empty arrays, switch to `@include` booleans in a single combined document; do not switch to sequential calls.
8. Ensure the web combined mutation/helper is referenced in Phase 3 (exported and tested or otherwise consumed) so Biome does not fail on unused code.
9. Add web tests that mock the request seam and assert one combined request, not sequential calls.
10. Add iOS fake repository support that records one combined payload.

**Tests and checks:**

- Test meals-only bulk materialization.
- Test foods-only bulk materialization.
- Test mixed same-time food-before-meal order is preserved after materialization and intake grouping.
- Test mixed same-time meal-before-food order is preserved after materialization and intake grouping.
- Test mixed pre-existing logged meal groups and standalone entries are not overwritten and new positions append deterministically after the max existing top-level position for the target time.
- Test overridden slot times apply to every entry in that plan slot.
- Test correct `nutritionPlanMealId` / `nutritionPlanFoodId` provenance.
- Test each nested meal child re-states `nutritionDayId`.
- Test empty meal/entry arrays are accepted as `affected_rows: 0`, or that the single-document `@include` fallback is used without partial writes.
- Test web uses one combined request by mocking `gqlRequest` or the request wrapper.
- Test iOS fake repository records one combined payload.
- Run `cd ios/NeoGym && swift test`.
- Ensure local backend is running when needed, e.g. `cd backend && make dev-env-up` if not already up.
- Run `cd frontend && nix develop ../ --command bun run codegen` (mandatory after adding new GraphQL documents).
- Run `cd frontend && nix develop ../ --command bun run check`.
- Run backend `make test` only if backend metadata/schema/invariants change; this is not expected.

**Definition of done:**

- Pure helpers and repository/view-model methods can materialize and send the entire selected plan in one atomic combined request under tests.
- No user-facing bulk button is shipped in this phase.
- Individual logging still works.
- Web and iOS tests enforce atomic request shape and daily-log ordering semantics.
- Codegen and checks pass.

**Phase commit message:** `feat(nutrition): materialize selected plans into logs`

**Implementation log**

- **Implementation notes:** Added Phase 3 bulk selected-plan materialization core on web and iOS without shipping a user-facing bulk button. Web now has pure `buildPlanLogInputs` logic plus `frontend/src/lib/nutrition-plan-log.ts` for the combined `LogSelectedPlan` request and generated GraphQL operation types. iOS now has `PlanLogMaterializer`, `logSelectedPlan` repository/view-model support, a combined mutation document, preview/fake support, and tests. Materialization validates selected plan/day/references/empty meals/target times, flattens selected-plan entries by grouped slot and mixed order, computes strict per-target-time daily-log positions from max existing top-level positions, preserves provenance IDs, restates child `nutritionDayId`, and sends no food-backed snapshot fields.
- **Tests added/updated:** Extended web nutrition tests for meals-only, foods-only, mixed same-time ordering after intake grouping, append-after-max, overridden slot times, validation failures, and one combined request with arrays. Added/updated iOS nutrition day/materializer/repository tests for equivalent ordering, provenance, child day IDs, empty arrays, and one combined payload.
- **Reviewer verdict:** `ACCEPT` after the initial review and a fresh gate-resolution review. Reviewer verified Phase 3 DoD, no UI files were touched, the mutation is referenced/tested so Biome is clean, deleted iOS tests were relocated, and offline generated GraphQL outputs are consistent with the checked-in schema. Accepted concerns: local live schema introspection and live empty-array Hasura verification were unavailable because the local Nhost endpoint/secrets are unavailable; reviewer judged this acceptable because the checked-in user SDL already exposes both plural roots and no backend/schema/permission change was made.
- **Autonomous decisions:** Treated failed `bun run codegen` introspection as an environmental validation limitation rather than a code defect after confirming local Nhost/GraphQL was unreachable and `codegen:graphql` was idempotent against the checked-in schema. Pillar justification: correctness — the strongest available validation for a client-only operation using existing SDL roots is offline operation generation plus full typecheck/tests; security — no schema/permission widening was introduced; long-term maintenance — the limitation is recorded for future live verification. Used the clean Xcode environment for Swift tests as in prior phases.
- **Quality gates:**
  - `cd ios/NeoGym && env -u SDKROOT -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swift test` passed: 248 XCTest tests plus 4 Swift Testing tests, 0 failures.
  - `cd frontend && nix develop ../ --command bun run codegen` failed at `codegen:graphql-schema` because `https://local.graphql.local.nhost.run/v1` was unavailable.
  - Gate-fix pass ran `cd frontend && nix develop ../ --command bun run codegen:graphql` successfully from checked-in `schema.user.graphqls`, verified generated-file hash idempotence across another offline run, and confirmed local schema fetch failed with connection refused.
  - `cd frontend && nix develop ../ --command bun run check` passed: Biome/typecheck/test, 123 tests, 0 failures.
  - Backend `make test` was not run because no backend schema, metadata, permission, or invariant changed.

### Phase 4 — Add selected-plan grouped logging UX and docs

**Goal:** Finish user-facing daily logging behavior and synchronize documentation.

**Depends on:** Phases 1 and 3; Phase 2 for grouped presentation consistency

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/DailyIntakeViews.swift` — selected-plan plan section and bulk sheet presentation.
- `ios/NeoGym/App/Nutrition/DailyIntakeRows.swift` — reusable grouped slot display if useful.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — remove plan segment when no selected plan; preserve individual planned-entry logging.
- `frontend/src/components/daily-intake-log.tsx` — grouped selected-plan suggestions and bulk dialog.
- `frontend/src/components/log-intake-dialog.tsx` — hide plan tab when no selected plan; optional grouped selected-plan picker when selected.
- `docs/developers/nutrition.md` — grouped plan and bulk logging semantics.
- `CLAUDE.md` — update durable “Nutrition GraphQL/logging shape” and iOS/web nutrition guidance.

**Implementation steps:**

1. Hide/remove the “From plan” tab/segment entirely when no selected day plan exists on both platforms. A disabled-but-present tab is not acceptable.
2. Ensure no selected plan also means no plan action, suggestion list, or entries anywhere on the day.
3. When a plan is selected, show grouped plan suggestions by time slot.
4. Preserve per-entry planned logging with actual time defaulting to now and planned time displayed only as a suggestion.
5. Add a “Log selected plan” dialog/sheet showing grouped plan slots.
6. In the bulk confirmation UI:
   - default each normal plan slot’s logged time to the plan slot time;
   - for any legacy no-time slot, default to current time and require a non-empty time before confirm;
   - allow editing each slot’s logged time;
   - apply each edited slot time to every entry in that plan slot.
7. On confirm, call the Phase 3 bulk materialization/mutation method.
8. Document that bulk re-logging appends duplicates, matching existing individual logging.
9. Update `docs/developers/nutrition.md` to describe grouped plan display/editing and explicit bulk selected-plan logging.
10. Explicitly reconcile `CLAUDE.md`’s “Nutrition GraphQL/logging shape” bullet that says not to hardcode/copy planned slot time blindly: scope that warning to individual planned logging and document the explicit editable bulk confirmation flow.

**Tests and checks:**

- Add/adjust component/helper tests where feasible for hidden no-plan tab/action behavior.
- Add tests for bulk dialog no-time default/validation if the UI logic is testable as a helper.
- Run `cd ios/NeoGym && swift build`.
- Run `cd ios/NeoGym && swift test`.
- If new Swift app files are added, run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` before app build.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Run `cd frontend && nix develop ../ --command bun run codegen` if GraphQL outputs changed in this phase.
- Run `cd frontend && nix develop ../ --command bun run check`.
- Manual verification:
  - no selected plan shows no plan logging UI;
  - selected plan shows grouped suggestions;
  - individual planned entry logging still defaults to now;
  - bulk confirmation edits apply to all entries in the edited slot;
  - bulk logging refreshes the day and shows deterministic order.

**Definition of done:**

- No selected plan means no plan logging UI at all.
- Selected plan shows grouped slots and both individual planned-entry logging and whole-plan bulk logging.
- Bulk confirmation time edits apply to every entry in the edited slot.
- Empty planned meals fail before sending with a clear all-or-nothing message.
- Docs match behavior.
- Full iOS and frontend gates pass.

**Phase commit message:** `feat(nutrition): add grouped selected-plan logging`

**Implementation log**

- **Implementation notes:** Completed the user-facing selected-plan logging flow on web and iOS. Both platforms now remove/hide “From plan” logging affordances entirely when no day plan is selected, render selected-plan suggestions grouped by plan time slot, preserve individual planned-entry logging with actual time defaulting to now, and provide a whole-plan “Log selected plan” confirmation flow with editable per-slot logged times. Normal plan slots default to their plan times; legacy/no-time slots default to current time and require a non-empty time before confirmation. Confirming calls the Phase 3 bulk materialization path so each edited slot time applies to every entry in that plan slot and empty planned meals fail before sending.
- **Tests added/updated:** Added web tests for selected-plan bulk slot-time defaults and no-selected-plan defaults; added Swift tests for the same default behavior in `NutritionDayGroupingTests`. Existing Phase 3 materialization tests continue to cover empty-meal failure, provenance, ordering, and one combined request.
- **Docs:** Updated `docs/developers/nutrition.md` and `CLAUDE.md` to document grouped selected-plan suggestions, explicit editable whole-plan bulk logging, duplicate-append semantics, no-plan gating, and the distinction between individual planned logging (defaults to now; plan time suggestion only) and bulk logging (editable plan-time defaults).
- **Reviewer verdict:** `ACCEPT` — reviewer inspected `git diff a00ca3e2`, verified hidden no-plan affordances, grouped selected-plan suggestions, individual planned logging time behavior, bulk confirmation wiring, no-time default/validation, docs reconciliation, and passing frontend check. Accepted concern: manual UI smoke was not run; automated gates and app build passed.
- **Autonomous decisions:** Did not run `bun run codegen` in Phase 4 because no GraphQL documents, schema, or generated outputs changed in this phase. Pillar justification: correctness and maintenance — avoids requiring unavailable live backend introspection for no GraphQL changes while preserving Phase 3 generated outputs. Used clean Xcode environment for iOS gates as in prior phases.
- **Quality gates:**
  - `cd ios/NeoGym && env -u SDKROOT -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swift build` passed.
  - `cd ios/NeoGym && env -u SDKROOT -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swift test` passed.
  - `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_ENFORCE_NO_NATIVE -u NIX_DONT_SET_RPATH -u NIX_DONT_SET_RPATH_FOR_BUILD -u NIX_HARDENING_ENABLE -u MACOSX_DEPLOYMENT_TARGET -u LD -u LD_DYLD_PATH xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed.
  - `cd frontend && nix develop ../ --command bun run check` passed: Biome/typecheck/test, 125 tests, 0 failures.

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
| Group plan detail by time slot on iOS and web | 1, 2 | Plan grouping helper tests; SwiftUI/web detail manual smoke; app/frontend checks |
| Group plan editor by time slot while preserving mixed positions | 1, 2 | Draft grouping/renumber tests; within-slot movement tests; create/edit save round-trip/manual smoke |
| No selected day plan means no plan logging UI | 4 | UI/helper tests where feasible; manual no-plan verification; reviewer inspection of `LogIntakeDialog`/`LogIntakeSheet` |
| Selected plan shows only selected plan slots/entries | 4 | Grouped suggestions derived from `selectedPlan`; manual selected-plan verification |
| Bulk log all selected plan entries in one action | 3, 4 | `buildPlanLogInputs`/`PlanLogMaterialization` tests; repository/request tests; manual bulk verification |
| Bulk logging is atomic and not sequential per-entry calls | 3 | Web mocked request test; iOS fake repository payload test; reviewer inspection of one combined mutation document |
| Preserve provenance and snapshot semantics | 3, 4 | Tests assert `nutritionPlanMealId`, `nutritionPlanFoodId`, child `nutritionDayId`, no food-backed snapshot fields sent; backend tests only if schema changes |
| Preserve actual eaten time semantics | 3, 4 | Tests for overridden slot times; manual individual planned logging defaults to now; docs update |
| Existing food/meal/ad-hoc logging still works | 3, 4 | Existing tests and manual smoke; reviewer inspection that existing paths remain |
| Docs stay in sync | 2, 4 | Docs updated in same phase as changed behavior; reviewer checks `docs/developers/nutrition.md` and `CLAUDE.md` |

---

## 6. Risks and mitigations

- **Risk:** Daily-log position calculation could conflate plan positions with log positions, breaking same-time mixed order. — **Mitigation:** Compute a shared per-target-time append sequence across meal groups and standalone foods; test food-before-meal, meal-before-food, and mixed pre-existing rows after intake grouping.
- **Risk:** Cross-platform atomicity could diverge, especially on iOS where current single-log methods are separate. — **Mitigation:** Require one combined document/request per platform and add fake/mock tests proving one payload/request.
- **Risk:** Empty array handling in plural insert roots could differ at runtime. — **Mitigation:** Verify `objects: []` returns `affected_rows: 0`; if not, use `@include` booleans inside a single combined document.
- **Risk:** Grouped editor movement could regress save diffs or confuse users. — **Mitigation:** Make movement slot-local and enforce it in helper/model logic; cross-slot movement happens through time edits; test submit values.
- **Risk:** Phase 3 could introduce unused GraphQL constants and fail Biome. — **Mitigation:** Export/reference and test the request seam in the same phase.
- **Risk:** Docs could contradict actual slot-time semantics. — **Mitigation:** Update `docs/developers/nutrition.md` and the specific `CLAUDE.md` “Nutrition GraphQL/logging shape” bullet in the same phase as UX.
- **Risk:** Large plans create large mutations. — **Mitigation:** Accept for realistic v1 plan sizes; no pagination/batching is planned because atomicity is more important.

---

## 7. Follow-ups (out of scope for this plan)

- Optional include/exclude checkboxes in the bulk confirmation dialog — tracked in: TBD.
- Duplicate detection/skip behavior for already-logged planned entries — tracked in: TBD.
- Per-slot “Log this slot” action — tracked in: TBD.
- Backend action/RPC for server-side plan materialization if more clients duplicate the client-side logic — tracked in: TBD.
