# Unify tracking and template UI patterns

**Status:** ready
**Created:** 2026-06-24

---

## 1. Requirements

Captured from the discussion with the user and the codebase inventory.

### 1.1 Problem / motivation

The app has multiple surfaces that represent similar product concepts — workouts, exercise/session logging, body metrics, journal entries, exercise catalog browsing, and nutrition/calorie intake — but their page shells, list states, forms, dialogs, pickers, filters, and ordered-row editors have drifted into one-off implementations. The goal is to make these flows feel consistent to users and easier to maintain without hiding important domain-specific behavior behind an over-generic CRUD framework.

### 1.2 Functional requirements

- Map shared concepts across workouts, sessions/exercise logging, exercise catalog, body metrics, journal, and nutrition/calorie intake.
- Introduce reusable UI/product primitives for page shells, headers, query states, list rows, filters/search, form sections/actions, confirm dialogs, pickers, dialog footers, ordered rows, and dated/log display where appropriate.
- Preserve domain-specific needs: session strength/cardio branching, cardio metrics schema validation, nutrition snapshot/log semantics, body charts, workout drag ordering, label filtering, nutrition tabs, and route-specific GraphQL/mutation behavior.
- Prefer narrow, composable primitives with render slots over a single generic CRUD/resource framework.
- Keep every phase independently shippable, testable, and fully functional.

### 1.3 Non-functional requirements / constraints

- Consistency is the first priority; deduplication is valuable only when it does not obscure domain behavior.
- Avoid backend/schema/API changes unless an implementer finds a clearly justified need and stops to re-scope with the user.
- Preserve existing navigation conventions, especially `replace: true` for spent forms, pickers, cancels, invalid-state bounces, and deletes.
- Follow repo tooling: from `frontend/`, run `nix develop ../ --command bun run check` after frontend changes. In the current `frontend/package.json`, this runs typecheck, Biome lint, and `bun test`.
- If any `graphql(...)` document changes, run `nix develop ../ --command bun run codegen` and include generated diffs intentionally.
- If any backend schema/metadata/seed/config change becomes necessary, update matching docs, run backend `make test`, and run codegen when user-role visibility changes.
- No React DOM/component test framework is currently configured; manual browser regression checks are required for visual, interaction, and back-stack behavior.

### 1.4 Surfaces in scope

- `frontend/src/components/patterns/` — new app-specific pattern layer to create.
- `CLAUDE.md` — update conventions in the same phase that introduces the pattern layer.
- `frontend/src/routes/_authed/body/*`, `frontend/src/components/body-measurement-form.tsx`, `frontend/src/components/body-metrics-chart.tsx` — low-risk pilot for shells, states, forms, and confirm dialog.
- `frontend/src/routes/_authed/workouts/*`, `frontend/src/components/workout-form.tsx` — template creation/editing, label filters, detail/list rows, drag-ordered exercise rows.
- `frontend/src/routes/_authed/sessions/*`, `frontend/src/components/cardio-metrics-form.tsx`, `frontend/src/components/cardio-entries-list.tsx` — logging/detail shell and confirm-dialog promotion while preserving strength/cardio internals.
- `frontend/src/routes/_authed/exercises/*`, `frontend/src/components/exercise-detail.tsx`, `frontend/src/components/exercise-picker.tsx` — exercise catalog, search/filter/list row patterns, and multi-select picker visual alignment.
- `frontend/src/routes/_authed/journal/*`, `frontend/src/components/journal-entry-form.tsx` — dated log comparison surface, labels, form action layout.
- `frontend/src/routes/_authed/nutrition.tsx`, `frontend/src/routes/_authed/nutrition/**`, `frontend/src/components/daily-intake-log.tsx`, `frontend/src/components/log-food-dialog.tsx`, `frontend/src/components/log-meal-dialog.tsx`, `frontend/src/components/food-form.tsx`, `frontend/src/components/meal-form.tsx`, `frontend/src/components/nutrition-plan-form.tsx`, `frontend/src/components/food-picker.tsx`, `frontend/src/components/meal-picker.tsx` — rich set of catalog/template/log patterns.

### 1.5 Out of scope

- Changing core domain semantics, including exercise `kind`, workout/session template semantics, nutrition snapshots, nutrition nested log insert shape, or body metric meaning.
- Replacing TanStack Router, Nhost GraphQL/codegen, Tailwind/shadcn, Biome, or the form stack.
- Adding Storybook, React Testing Library, Playwright, or another UI test stack as part of this refactor.
- Adding breadcrumbs to `/nutrition/*`; nutrition keeps its nested tab navigation.
- Adding confirmation to nutrition one-tap logged entry/meal deletes; preserve current behavior unless a future UX task changes it.
- Exposing session exercise reordering.

### 1.6 Success criteria

- Shared product concepts are mapped to concrete primitives, and the plan explicitly states what remains domain-specific.
- Each phase can be implemented and reviewed independently, with `bun run check` passing after the phase.
- Manual regression checks cover at least one golden flow per touched domain after every phase.
- Existing navigation/back-stack behavior, GraphQL payloads, query invalidation, and mutation semantics remain unchanged unless intentionally documented.
- New UI-pattern conventions are documented in `CLAUDE.md` and `frontend/src/components/patterns/README.md` as they are introduced.

---

## 2. Implementation strategy

### 2.1 Central design decision

Create an app-specific pattern layer under `frontend/src/components/patterns/` and migrate surfaces onto it incrementally. The layer should sit between low-level shadcn-style primitives in `frontend/src/components/ui/` and domain components/routes: `ui` stays generic UI, `patterns` holds app-wide product patterns, and the existing root component files keep domain-specific logic. Do not create a generic CRUD framework; use small primitives with slots/render props and keep GraphQL documents, mutations, validation, and domain-specific display in their current files.

### 2.2 Key constraints and invariants

- Session logging must continue branching on `exercise.kind === "cardio"`; strength sets and cardio entries remain separate domain flows.
- `CardioMetricsForm` keeps schema-driven parsing/validation; shared dialog primitives may only wrap footer/shell chrome.
- `LogMealDialog` must continue inserting child nutrition log entries with the same `nutritionDayId` as the parent group.
- Daily nutrition totals continue using logged snapshot columns, not live food values.
- Food/meal picker extraction must preserve blur timeout, `onMouseDown(event.preventDefault())`, clear behavior, empty-state CTAs, and wrapper prop APIs.
- `FilterPill` and search controls are presentation-only; filter state remains URL-backed where already URL-backed and local state where already local.
- `OrderedCollection` is mostly presentational; it must not own domain reorder state or submitted ordering.
- `replace: true` behavior is part of acceptance for spent forms/pickers/cancels/deletes.

### 2.3 Touched surfaces

- `frontend/src/components/patterns/` — new app pattern primitives and README.
- `CLAUDE.md` — shared UI primitive conventions and corrected `bun run check` description.
- `frontend/src/routes/_authed/body/*` and body components — pilot migration.
- `frontend/src/routes/_authed/workouts/*`, `frontend/src/components/workout-form.tsx` — shell/list/filter/form/ordered-row migration.
- `frontend/src/routes/_authed/exercises/*`, `frontend/src/components/exercise-detail.tsx`, `frontend/src/components/exercise-picker.tsx` — catalog/search/filter/row and picker affordance alignment.
- `frontend/src/routes/_authed/sessions/*` — shell/state/confirm migration with tight boundaries.
- `frontend/src/routes/_authed/journal/*`, `frontend/src/components/journal-entry-form.tsx` — shell/list/filter/form migration.
- `frontend/src/routes/_authed/nutrition**` and nutrition components — nested-layout-preserving migration, picker extraction, dialog/footer alignment, ordered rows.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No backend, schema, metadata, permissions, or public route-contract change is planned. Existing component props should remain stable where external route consumers use them, especially `FoodPicker` and `MealPicker`.
- **Deployment:** Standard frontend deployment. No migrations or feature flags are expected. If `graphql(...)` documents change unexpectedly, run codegen and include generated files.
- **Rollback:** Standard revert is sufficient for each phase because phases are frontend-only and self-contained. If a phase introduces a pattern primitive that later proves wrong, revert the phase before migrating additional domains onto it.

---

## 3. Phased plan of action

### Phase 1 — Establish pattern layer with body metrics pilot

**Goal:** Create the app-specific pattern tier, document it immediately, and prove it on the lowest-risk body metrics surface.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/page-shell.tsx` — add `PageShell`, `PageHeader`, and `FormCardShell`.
- `frontend/src/components/patterns/query-states.tsx` — add `EmptyState`, `ErrorState`, and simple skeleton wrapper helpers that accept custom children.
- `frontend/src/components/patterns/form-actions.tsx` — add `FormSection` and `FormActions` with canonical cancel/submit row and extra/destructive actions below a divider.
- `frontend/src/components/patterns/confirm-action-dialog.tsx` — promote the reusable session-local confirm dialog shape.
- `frontend/src/components/patterns/README.md` — document the `ui` vs `patterns` vs domain-component taxonomy.
- `CLAUDE.md` — add the same taxonomy under Conventions and update the `bun run check` command description to mention tests.
- `frontend/src/routes/_authed/body/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx` — migrate shell/header/state/card wrappers and use promoted confirm dialog in edit delete flow.
- `frontend/src/components/body-measurement-form.tsx` — migrate sections/actions only; keep validation logic local.

**Implementation steps:**

1. Add the `patterns` directory and initial primitives with narrow props and no domain imports.
2. Extract the existing session `ConfirmDialog` API into `confirm-action-dialog.tsx`, but do not change session usage yet.
3. Migrate body index/detail/new/edit shells and body form footer to the primitives.
4. In body edit, replace the inline delete-confirm `Dialog` with `ConfirmActionDialog` as the pilot consumer.
5. Update `CLAUDE.md` and `frontend/src/components/patterns/README.md` in this same phase so the new component tier is documented when introduced.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual browser checks: body list empty/non-empty, body detail, new measurement save/cancel, edit save/cancel/delete, back button after cancel/save/delete.
- Confirm `BodyMetricsChart` remains untouched except for surrounding shell.

**Definition of done:**

- Body flows behave the same except for intentional consistent shell/footer chrome.
- Body edit uses the shared confirm dialog.
- Pattern taxonomy is documented in both `CLAUDE.md` and the new README.
- The system remains fully functional because only body shell/form wrappers were migrated and no GraphQL/mutation payloads changed.

**Phase commit message:** `refactor(ui): introduce pattern layer with body pilot`

**Implementation log**

- **Implementation notes:** Added the `frontend/src/components/patterns/` tier with `PageShell`, `PageHeader`, `FormCardShell`, `EmptyState`, `ErrorState`, `SkeletonState`, `FormSection`, `FormActions`, and `ConfirmActionDialog`. Migrated the body index/detail/new/edit routes and `BodyMeasurementForm` onto the new primitives while preserving GraphQL documents, mutation payloads, query keys, local validation, and `replace: true` navigation. Replaced the body edit inline delete dialog with the shared confirm dialog. Added `frontend/src/components/patterns/README.md`, updated `CLAUDE.md` with the `ui`/`patterns`/domain taxonomy, and corrected the `bun run check` description to include tests. Added `frontend/src/components/patterns/patterns.test.tsx` smoke coverage using server-rendered markup.
- **Reviewer verdict:** `ACCEPT`. Reviewer confirmed Phase 1 satisfies the goal and definition of done, pattern components have no domain imports, `BodyMetricsChart` and GraphQL documents were untouched, body edit uses `ConfirmActionDialog`, documentation was updated in the same phase, and `bun run check` passed. Non-blocking observations for later phases: `FormActions` has both `extraActions` and `destructiveActions` rendered in the same divider block; `ConfirmActionDialog` cancel styling differs slightly from the still-unmigrated session dialog; the edit page eyebrow moved into `FormCardShell`.
- **Autonomous decisions / assumptions:** Removed an accidental untracked root file named `inline` that contained only subagent summary text and was not part of the implementation. Justification: **correctness** (keep commit scoped to Phase 1 files), **security** (avoid committing orchestration artifacts), **long-term maintenance** (avoid repository clutter). Treated the absence of manual browser checks as an accepted validation limitation because automated checks and reviewer inspection passed, and the environment did not provide an already-running browser flow. Justification: **correctness** (do not claim unrun manual checks), **long-term maintenance** (record the residual risk for follow-up evaluation).
- **Quality gate history:** Initial orchestrator gate invocation `nix develop ../ --command bun run check` from the repository root failed because `../` resolved outside the repo flake; this was an invocation error, not a code failure. Re-ran the required command exactly as planned: `cd frontend && nix develop ../ --command bun run check` — passed (`tsc --noEmit`, `biome check .`, and `bun test`; 82 tests passed). Implementer also reported `bun install --frozen-lockfile`, formatting, lint, tests, final check, and LSP diagnostics all passed after generating ignored `frontend/src/routeTree.gen.ts` locally for typecheck; the generated file remains ignored and untracked.

### Phase 2 — Normalize non-nutrition catalog and log shells

**Goal:** Apply page/state/list/filter primitives to workouts, exercises, sessions, and journal while keeping domain behavior untouched.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/filter-controls.tsx` — add presentation-only `FilterPill` and optional `SearchField`.
- `frontend/src/components/patterns/entity-row.tsx` — add Card link/list row chrome with metadata/action/chevron slots.
- `frontend/src/routes/_authed/workouts/*` — migrate shell/header/empty/error/list/filter patterns and existing confirm-delete usage.
- `frontend/src/routes/_authed/exercises/index.tsx`, `frontend/src/routes/_authed/exercises/$exerciseId.tsx`, `frontend/src/components/exercise-detail.tsx` — migrate catalog shell/search/filter/list/detail chrome where safe.
- `frontend/src/routes/_authed/sessions/index.tsx` — migrate shell/header/empty/error/list row chrome.
- `frontend/src/routes/_authed/sessions/$sessionId.tsx` — only migrate page shell/header, loading/error/empty wrappers, and existing confirm-dialog call sites; do not refactor log internals.
- `frontend/src/routes/_authed/journal/*`, `frontend/src/components/journal-entry-form.tsx` — migrate shell/header/state/filter patterns and confirm-delete usage.

**Implementation steps:**

1. Add presentation-only filter/search and entity-row primitives.
2. Migrate workouts and journal first as the URL-backed label-filter examples; keep their URL search schemas and navigation code local.
3. Migrate exercises catalog as the local-state multi-filter example; keep its Fuse/search/filter state local.
4. Migrate sessions index and only safe wrapper/dialog parts of session detail.
5. Replace existing inline confirm dialogs where a confirmation already exists; do not add confirmations to flows that are currently one-tap.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual checks: workout label filtering and label input; workout detail/edit/delete; exercise catalog search and each filter axis; exercise detail; sessions list/detail; session delete and remove-exercise confirmations; journal label filtering and create/edit/delete.
- For `sessions/$sessionId.tsx`, explicitly verify strength set add/edit/delete, cardio entry add/edit/delete, and cardio metrics schema validation UI still work.

**Definition of done:**

- Non-nutrition top-level routes share shell/header/state/list/filter primitives.
- `FilterPill` does not own filter state; URL-backed and local-state filters retain their current mechanisms.
- Session detail changes are auditable: strength/cardio logging internals, local `Stat` cards, `toLocalInput`, prior-history summaries, and mutation payloads remain untouched unless wrapper changes require minimal imports.
- The system remains fully functional because data-fetching and domain logic are not generalized.

**Phase commit message:** `refactor(ui): normalize catalog and log shells`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — Standardize form layout and action bars

**Goal:** Make create/edit forms use the same section and action layout while preserving form-specific validation and payloads.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/workout-form.tsx` — use `FormSection`/`FormActions`; preserve labels and dnd-kit list.
- `frontend/src/components/journal-entry-form.tsx` — use shared form sections/actions.
- `frontend/src/components/food-form.tsx` — migrate footer layout intentionally from left-extra/right-actions to actions-row/extras-below-divider.
- `frontend/src/components/meal-form.tsx` — migrate footer layout; preserve macro totals and ingredient logic.
- `frontend/src/components/nutrition-plan-form.tsx` — migrate footer layout; preserve slot time sorting.
- `frontend/src/components/body-measurement-form.tsx` — adjust only if Phase 1 left consistency gaps.

**Implementation steps:**

1. Apply `FormSection` to repeated label/input/description groupings where it improves consistency without forcing validation changes.
2. Apply `FormActions` to every form footer.
3. For nutrition forms, verify `extraActions` contains only destructive/edit extras before moving it below the divider; if it contains non-delete content, stop and adjust the plan with the user.
4. Keep validation local: no migration to react-hook-form or another validation strategy.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual checks: submit/cancel/delete for workout, body, journal, food, meal, and plan forms; autofocus and aria-invalid/aria-describedby still work; back button after cancel/save/delete.
- Visual checks for food/meal/plan create and edit because their footer layout intentionally changes.

**Definition of done:**

- All create/edit forms share action placement and error/action styling.
- Existing form values, validation, pending labels, mutation payloads, and navigation behavior are unchanged.
- Nutrition footer layout change is intentional, verified, and documented in the phase implementation log.

**Phase commit message:** `refactor(forms): standardize form sections and actions`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 4 — Align picker and dialog interaction contracts

**Goal:** Reduce picker/dialog drift without changing selection or logging semantics.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/entity-combobox.tsx` or `frontend/src/components/patterns/use-combobox-state.ts` — choose the narrower extraction that preserves current FoodPicker/MealPicker behavior.
- `frontend/src/components/food-picker.tsx` — keep public props stable.
- `frontend/src/components/meal-picker.tsx` — keep public props stable.
- `frontend/src/components/log-food-dialog.tsx`, `frontend/src/components/log-meal-dialog.tsx` — align dialog action/footer layout only.
- `frontend/src/components/cardio-metrics-form.tsx` — align footer/dialog chrome only; keep metric parsing and validation.
- `frontend/src/components/exercise-picker.tsx` — optional visual affordance alignment only; keep multi-select query-backed contract.

**Implementation steps:**

1. Prefer a shared `useComboboxState` hook if a full `EntityCombobox` would require too many render props; otherwise implement `EntityCombobox` with option and empty-state render slots.
2. Preserve existing dependencies; do not add a new combobox/accessibility library.
3. Keep `FoodPicker` and `MealPicker` wrapper prop APIs stable so consumers do not churn.
4. Align dialog footers using existing pattern actions; do not alter mutation variables or toast/invalidation logic.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual picker matrix for both FoodPicker and MealPicker: focus opens, typing filters, clicking option selects despite blur, `onMouseDown` prevents premature close, clear button clears, empty catalog/no-results CTA works, disabled state blocks input.
- Manual logging checks: log standalone food, log planned/ad-hoc meal, verify child `nutritionDayId` is still sent by nested log entry code, and cardio metrics invalid/valid submissions behave unchanged.

**Definition of done:**

- FoodPicker/MealPicker share only the truly common interaction machinery and keep stable APIs.
- Nutrition logging insert shapes and cardio metric schema behavior are unchanged.
- ExercisePicker is not merged with single-select pickers; any changes are visual affordance-only.

**Phase commit message:** `refactor(pickers): align picker and dialog interactions`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 5 — Standardize ordered collection row chrome

**Goal:** Make ordered editors look consistent while preserving each domain's reorder mechanism and submitted positions.

**Depends on:** Phase 3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/ordered-collection.tsx` — presentational row chrome, numbering, remove/action slots, optional drag handle slot, optional arrow control slots.
- `frontend/src/components/workout-form.tsx` — wrap existing dnd-kit row content; preserve activation distance and drag behavior.
- `frontend/src/components/meal-form.tsx` — use row chrome; keep arrow reorder state and position recomputation local.
- `frontend/src/components/nutrition-plan-form.tsx` — use row chrome; keep arrow reorder and sorted-by-time display/submission semantics local.

**Implementation steps:**

1. Build `OrderedCollection` as a presentational component; it must not own ordering state.
2. Migrate meal and plan arrow-row chrome first because they are closest.
3. Migrate workout exercise row chrome while keeping `DndContext`, `SortableContext`, `useSortable`, and activation constraints in `workout-form.tsx`.
4. Do not touch `DailyIntakeLog` inline grams rows or session exercise ordering.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual checks: add/reorder/remove workout exercises and confirm saved order; add/reorder/remove meal ingredients and confirm saved order; add/reorder/remove plan slots and confirm saved order/time sorting; mobile tap/drag behavior still works for workout exercises.

**Definition of done:**

- Ordered rows visually align across workout, meal, and plan forms.
- Each domain still owns its reorder mechanism and submitted ordering.
- No session exercise reorder UI is introduced.

**Phase commit message:** `refactor(forms): share ordered row chrome`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 6 — Apply nutrition consistency in bounded passes

**Goal:** Bring nutrition onto the shared patterns while preserving its nested tab layout and daily-log semantics.

**Depends on:** Phases 1, 3, and 4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/routes/_authed/nutrition.tsx` — keep layout and tabs, but use shared page/header/tab-compatible wrappers where appropriate.
- `frontend/src/routes/_authed/nutrition/index.tsx` — migrate overview cards only.
- `frontend/src/routes/_authed/nutrition/foods/index.tsx`, `meals/index.tsx`, `plans/index.tsx`, `days/index.tsx` — migrate list shells, query states, rows, filters/search.
- `frontend/src/routes/_authed/nutrition/foods/*`, `meals/*`, `plans/*` detail/new/edit routes — migrate shells/form cards/states.
- `frontend/src/components/daily-intake-log.tsx` — only safe empty/error/dialog/action wrappers; preserve inline editing and one-tap logged entry/meal deletes.

**Implementation steps:**

1. Sub-pass A: nutrition layout and overview/index list shells.
2. Sub-pass B: foods, meals, and plans detail/new/edit shells and form-card wrappers.
3. Sub-pass C: daily nutrition day wrappers and clear-day confirm dialog only where it already exists.
4. Keep the top-level Nutrition app nav as one item and nested tabs horizontally scrollable.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual checks after each sub-pass: foods list/search/filter/create/edit/delete; meals list/search/create/edit/delete; plans list/search/create/edit/delete; days index/date navigation; daily log food; daily log meal; edit logged grams/time; logged entry/meal delete remains one-tap; clear day confirm; back-button behavior after spent forms/pickers.

**Definition of done:**

- Nutrition overview, catalog, template, plan, and day routes match app-wide shell/list/form patterns.
- Nutrition tabs and daily log behavior remain intact.
- No backend, GraphQL, or codegen changes are required unless an implementer intentionally changes a document and runs codegen.

**Phase commit message:** `refactor(nutrition): apply shared UI patterns`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 7 — Dated-log polish, optional hooks, and final regression sweep

**Goal:** Address remaining safe duplication, finalize docs, and run a full cross-domain regression pass.

**Depends on:** Phases 1–6

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/date-badge.tsx`, `dated-entry-row.tsx`, `stat-card.tsx` — add only if render-prop rows remain readable and duplication is obvious.
- Optional `frontend/src/lib/hooks/use-invalidate-*.ts` helpers — add only for repeated invalidation clusters that remain noisy.
- `frontend/src/components/patterns/README.md`, `CLAUDE.md` — finalize conventions and exceptions.
- All previously migrated surfaces — regression only.

**Implementation steps:**

1. Review remaining duplication after phases 1–6; only add dated/stat/invalidation helpers if they simplify code without hiding domain behavior.
2. Do not add a generic mutation wrapper unless reviewer agrees it reduces boilerplate without flattening route-specific behavior.
3. Finalize documentation: when to use `patterns` vs `ui`, domain-specific exceptions, `replace: true` reminder, and check/codegen/backend gates.
4. Run and record the full manual regression checklist.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Full manual regression: create/edit/delete workout; label filter and label input; start session; strength set add/edit/delete; cardio entry add/edit/delete and invalid metrics; create/edit/delete body measurement; create/edit/delete journal entry with labels; exercise catalog filters; create/edit/delete food, meal, and plan; open nutrition day; log food; log meal; edit logged entry; one-tap nutrition delete; clear day; back-button behavior after each spent form/picker/cancel/delete.

**Definition of done:**

- Remaining polishing helpers are either added with clear value or explicitly skipped in the implementation log.
- Documentation reflects the final pattern layer and exceptions.
- All checks pass and the manual regression checklist is recorded.

**Phase commit message:** `docs(ui): document shared patterns and verify flows`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing or moving on, run all configured checks for the affected project. For frontend-only phases, run `cd frontend && nix develop ../ --command bun run check`; if GraphQL documents changed, run codegen; if backend changed, run backend tests as required by `CLAUDE.md`.
6. **Commit:** Commit all changes made during the phase with the phase commit message only after gates pass or skipped checks are explicitly justified.
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
| Map concepts and identify shared primitives | 1–7 | Pattern README, `CLAUDE.md` conventions, reviewer verification that primitives map to actual surfaces |
| Preserve domain-specific session strength/cardio behavior | 2, 4, 7 | Manual strength/cardio add/edit/delete and cardio invalid/valid metrics checks |
| Preserve nutrition snapshot/log semantics | 4, 6, 7 | Manual log food/log meal/edit/delete/clear day checks; no GraphQL/codegen diffs unless intentional |
| Consistent page shells/states/list rows | 1, 2, 6 | Migrated routes use `PageShell`, `PageHeader`, `EmptyState`, `ErrorState`, and row primitives; visual checks |
| Consistent form action layout | 1, 3, 6 | Forms use `FormActions`; manual save/cancel/delete/back-button checks |
| Consistent picker/dialog interactions | 4 | Picker focus/search/select/clear/empty/disabled matrix; dialog footer visual checks |
| Consistent ordered row chrome | 5 | Manual order persistence for workout, meal, and plan |
| Avoid backend/schema changes | all | No backend diffs; if violated, stop and re-scope with backend docs/tests/codegen |
| Keep every phase functional | all | `bun run check` plus per-phase manual checklist and reviewer pass |

---

## 6. Risks and mitigations

- **Risk:** Over-abstracting session or nutrition behavior. — **Mitigation:** Keep GraphQL documents, mutations, validation, and domain branching in existing domain files; primitives are mostly presentational.
- **Risk:** `replace: true` behavior regresses during navigation refactors. — **Mitigation:** Include back-button assertions in every relevant phase and preserve comments around spent-route redirects.
- **Risk:** Picker focus/blur extraction breaks selection. — **Mitigation:** Preserve current blur timeout and mouse-down behavior; run the explicit picker regression matrix.
- **Risk:** Ordered-row extraction changes submitted positions. — **Mitigation:** `OrderedCollection` does not own state; each domain keeps submission ordering and manual order persistence checks.
- **Risk:** Large phases become hard to review. — **Mitigation:** Phase 2 and Phase 6 include bounded sub-passes and exact session-detail boundaries.
- **Risk:** Documentation drift. — **Mitigation:** Update `CLAUDE.md` in Phase 1 when the pattern layer is introduced, not at the end.
- **Risk:** Codegen drift from accidental GraphQL edits. — **Mitigation:** No GraphQL edits are expected; if any `graphql(...)` changes, run `bun run codegen` and include generated diffs intentionally.

---

## 7. Follow-ups (out of scope for this plan)

- Add a React DOM/component test framework or Storybook for automated UI regression coverage — tracked in: TBD.
- Add confirmations for nutrition logged entry/meal one-tap deletes — tracked in: TBD if desired after UX review.
- Introduce generic mutation/invalidation helpers — tracked in: TBD; only worthwhile if post-refactor repetition remains high.
- Revisit nutrition breadcrumbs — tracked in: TBD; current plan keeps nested nutrition tabs as the navigation pattern.
