# Improve calorie intake day view

**Status:** ready
**Created:** 2026-06-25

---

## 1. Requirements

Captured from the user's request to improve the Nutrition / calorie intake UX.

### 1.1 Problem / motivation

The Nutrition calorie-intake area does not participate in the global breadcrumbs used elsewhere in the app. The daily log also groups by time but still nests logged meal groups with per-meal aggregate rows; the desired experience is time-slot-first, showing collapsed slot totals first and flat food rows only when expanded.

### 1.2 Functional requirements

- Add breadcrumbs for all Nutrition routes: `/nutrition`, `/nutrition/days`, `/nutrition/days/$date`, `/nutrition/foods`, `/nutrition/foods/new`, `/nutrition/foods/$foodId`, `/nutrition/foods/$foodId/edit`, `/nutrition/meals`, `/nutrition/meals/new`, `/nutrition/meals/$mealId`, `/nutrition/meals/$mealId/edit`, `/nutrition/plans`, `/nutrition/plans/new`, `/nutrition/plans/$planId`, and `/nutrition/plans/$planId/edit`.
- In the day view, group displayed logged intake by time slot.
- Within each time slot, show individual food entries directly; do not aggregate or nest display rows by logged meal.
- Show macro totals for each time slot.
- Allow each time slot to collapse/expand, with all slots collapsed by default.
- Preserve existing behavior for logging meals/foods, editing grams, deleting individual entries, deleting logged meal groups, selecting/clearing plans, plan suggestions, clearing a day, and day navigation.

### 1.3 Non-functional requirements / constraints

- Keep the change frontend-only except for generated frontend GraphQL operation artifacts needed by new breadcrumb documents.
- Do not change database migrations, Hasura metadata/permissions, Nhost config, seeds, or GraphQL schema contracts.
- Preserve the nutrition domain contract: daily totals use logged snapshot columns; grouped entries display under their parent logged meal's `slotTime`; standalone entries display under their own `slotTime`.
- Keep the mobile-friendly layout and keyboard/accessibility behavior.
- Follow existing React, TanStack Query, TanStack Router, shadcn-style UI, and Biome conventions.
- After code changes, run `cd frontend && nix develop ../ --command bun run check`.

### 1.4 Surfaces in scope

- `frontend/src/components/breadcrumbs.tsx` — add Nutrition route definitions and dynamic breadcrumb labels.
- `frontend/src/gql/` — regenerate generated GraphQL operation artifacts after adding breadcrumb queries.
- `frontend/src/lib/nutrition.ts` — add a pure tested helper for flat time-slot grouping.
- `frontend/src/lib/nutrition.test.ts` — add helper tests.
- `frontend/src/components/daily-intake-log.tsx` — render collapsible time slots and flat entry rows.

### 1.5 Out of scope

- Backend schema, metadata, migrations, permissions, Nhost config, seed data, or GraphQL schema contract changes.
- Redesigning nutrition plans, foods, meals, CRUD routes, or logging dialogs.
- Persisting expanded/collapsed slot state across navigation or reloads.
- Documentation updates unless implementation changes a documented nutrition contract.

### 1.6 Success criteria

- Nutrition breadcrumbs appear on every in-scope route with sensible parent trails.
- Food, meal, and plan detail crumbs show dynamic names after loading and fallback labels while loading; day crumbs show a short date label.
- The day view initially shows collapsed time-slot headers with time labels, entry/group context, and slot macro totals.
- Expanding a time slot reveals flat individual food rows without per-meal aggregate cards.
- Grouped entries appear under the parent logged meal's slot time; standalone entries appear under their own slot time.
- Individual entry edit/delete, logged meal group delete, plan selection/suggestions, clear day, and day navigation still work.
- `cd frontend && nix develop ../ --command bun run check` passes.

### 1.7 Open questions / blockers (optional)

None.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use the existing data and keep this as a frontend-only UI/modeling change. Add Nutrition breadcrumbs through the existing global `Breadcrumbs` route map and dynamic label query pattern. For the day log, introduce a pure `groupIntakeByTimeSlot` helper that transforms existing logged meal groups plus standalone entries into a slot-first render model: grouped child entries are bucketed by parent meal time, standalone entries by their own time, slot totals are computed from flattened snapshot entries, and source-meal metadata is carried only for provenance and group-delete controls.

### 2.2 Key constraints and invariants

- Slot totals and full-day totals must use logged snapshot nutrition values, never live food values.
- Grouped log entries must display in the parent `nutritionLogMeal.slotTime` bucket even if a child entry has a different `slotTime` value.
- Standalone entries must display in their own `slotTime` bucket.
- Logged meal groups with zero child entries must still produce a slot/group affordance so the user can delete the group.
- The empty-state condition in the day log must account for both flat entries and childless logged meal groups.
- Within a slot, ordering must be deterministic and tested: sort contributing sources by `position`, tie-break source kind consistently, render grouped source children by child `position`, and sort by stable IDs as final tie-breakers where available.
- New `graphql(...)` breadcrumb documents require regenerated `frontend/src/gql/` operation artifacts.

### 2.3 Touched surfaces

- `frontend/src/components/breadcrumbs.tsx` — additive Nutrition route mappings and dynamic Food/Meal/Plan/date labels.
- `frontend/src/gql/` — generated operation artifacts for new breadcrumb queries.
- `frontend/src/lib/nutrition.ts` — exported structural types and `groupIntakeByTimeSlot` helper.
- `frontend/src/lib/nutrition.test.ts` — unit coverage for grouping, totals, ordering, and childless logged meal groups.
- `frontend/src/components/daily-intake-log.tsx` — consume the helper, remove local nested meal grouping renderer, add collapsible slots.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No persisted data, API, schema, or permission contract changes. Existing query shapes already provide all data needed.
- **Deployment:** Regenerate and commit frontend GraphQL artifacts after adding breadcrumb documents. Since the schema is unchanged and checked in, `cd frontend && nix develop ../ --command bun run codegen:graphql` is sufficient for operation generation; full `bun run codegen` is also acceptable if the local backend is up.
- **Rollback:** Standard revert is sufficient because the change is frontend-only and does not migrate data or metadata.

---

## 3. Phased plan of action

### Phase 1 — Add Nutrition breadcrumbs

**Goal:** Add global breadcrumb trails for all Nutrition routes.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/breadcrumbs.tsx` — add route mappings and dynamic label components.
- `frontend/src/gql/` — regenerate generated operation artifacts for new breadcrumb GraphQL documents.

**Implementation steps:**

1. Add `ROUTES` entries for every in-scope Nutrition path, rooted at `/nutrition` with labels `Nutrition`, `Days`, `Foods`, `Meals`, `Plans`, `New`, and `Edit`, plus fallback labels `Day`, `Food`, `Meal`, and `Plan` for dynamic nodes.
2. Add `CrumbLabel` cases:
   - `/nutrition/days/$date` renders a short date using the existing date-only formatter already available in `breadcrumbs.tsx`.
   - `/nutrition/foods/$foodId` renders a new `FoodName` label component.
   - `/nutrition/meals/$mealId` renders a new `MealName` label component.
   - `/nutrition/plans/$planId` renders a new `NutritionPlanName` label component.
3. Add breadcrumb queries mirroring existing `WorkoutName`/`ExerciseName` patterns:
   - `food(id: $id) { id name }`
   - `meal(id: $id) { id name }`
   - `nutritionPlan(id: $id) { id name }`
4. Use stable query keys, `enabled: Boolean(id)`, `staleTime: 60_000`, and fallback labels while queries load or records are unavailable.
5. Regenerate generated operation artifacts with `cd frontend && nix develop ../ --command bun run codegen:graphql` (or full `bun run codegen` if backend is up and schema introspection is desired).

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen:graphql` after adding breadcrumb documents.
- `cd frontend && nix develop ../ --command bun run check`.
- Manual/browser check when practical: navigate each Nutrition route and verify crumb trails, fallback labels, dynamic names, and static `new` routes not being matched as `$id` routes.

**Definition of done:**

- All in-scope Nutrition paths show breadcrumb trails.
- Dynamic Food/Meal/Plan crumbs show names after load and safe fallback labels while pending.
- Day crumbs show a short date label without timezone shifting.
- Generated GraphQL operation artifacts are committed.
- The app remains fully functional because this phase is additive to the global breadcrumb dispatcher.

**Phase commit message:** `feat(nutrition): add breadcrumbs`

**Implementation log**

- Implementation notes: Added Nutrition breadcrumb route mappings for all in-scope days, foods, meals, and plans routes; added dynamic Food/Meal/NutritionPlan breadcrumb label queries plus short date labels; added route matching tests for Nutrition trails and static `new` precedence; regenerated frontend GraphQL operation artifacts.
- Reviewer verdict: `ACCEPT` from `nhost-reviewer`; reviewer verified route coverage, dynamic fallbacks, timezone-safe day labels, generated artifacts, additive scope, and `new` route precedence.
- Autonomous decisions: Accepted the implementer's `CrumbLabel` renderer-map refactor as in-scope because it preserves behavior while reducing complexity after adding new dynamic cases (long-term maintenance). Manual browser navigation was not run; accepted unit tests plus reviewer route-file cross-check and full check as sufficient for this additive routing/helper phase (correctness).
- Quality gate: `cd frontend && nix develop ../ --command bun run codegen:graphql` passed in the implementer pass; `cd frontend && nix develop ../ --command bun run check` passed in both implementer and orchestrator runs (89 tests, 0 failures).

### Phase 2 — Render daily log as collapsible time slots

**Goal:** Replace nested logged-meal display with collapsed-by-default time slots containing flat food rows and per-slot totals.

**Depends on:** none; can follow Phase 1 for workflow simplicity.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/lib/nutrition.ts` — add pure helper and exported structural types.
- `frontend/src/lib/nutrition.test.ts` — add unit tests.
- `frontend/src/components/daily-intake-log.tsx` — consume helper and render collapsible slots.

**Implementation steps:**

1. In `frontend/src/lib/nutrition.ts`, define minimal exported structural types/interfaces for intake entries, logged meal groups, flat slot entries with source meal metadata, source meal delete metadata, and grouped time slots. Keep these types React-free and do not import component-local types from `daily-intake-log.tsx`.
2. Add `groupIntakeByTimeSlot` accepting logged meal groups and standalone entries. It should normalize slot keys using existing time helpers, use `"no-time"` with a last-sort sentinel for missing times, and return slots containing at least `key`, `label`, `sortKey`, flat `entries`, `mealGroups`, and `totals`.
3. Apply these helper rules:
   - Standalone entries bucket by `entry.slotTime`.
   - Grouped child entries bucket by parent `meal.slotTime`, not child `entry.slotTime`.
   - Each logged meal contributes source metadata to `mealGroups` even when it has zero child entries.
   - Slot totals are `loggedMacroTotals` over the slot's flat entries; childless groups contribute no macro values but remain visible/deletable.
   - Within a slot, sort source units deterministically by `position`, then source kind consistently, then stable IDs; render meal child entries by child `position` with ID tie-breakers.
4. Add tests in `frontend/src/lib/nutrition.test.ts` for:
   - Grouped child entries using parent meal time even when child `slotTime` differs.
   - Standalone entries using their own time.
   - No-time bucket sorting last.
   - Source `mealId`/`mealName` metadata on grouped entries and `null` metadata on standalone entries.
   - `mealGroups` listing each contributing logged meal once, including childless groups.
   - Slot totals matching `loggedMacroTotals` over flat entries.
   - Deterministic within-slot ordering.
5. In `frontend/src/components/daily-intake-log.tsx`, replace local `groupLoggedFoodByTime` usage with `groupIntakeByTimeSlot(loggedMeals, standaloneEntries)`.
6. Remove obsolete local `LoggedFoodTime*` types, `groupLoggedFoodByTime`, and `LoggedMealGroup` after reimplementing the group-delete affordance in the slot UI.
7. Add `expandedSlots` state initialized to an empty `Set<string>` so all slots start collapsed. Toggle via a full-width accessible button header with `aria-expanded`, `aria-controls`, time label, compact `macroTotalsSummary(slot.totals)`, optional counts, and chevron.
8. When expanded, render a single flat list of `EntryRow`s with `showTime={false}` and optional muted provenance text like `From {meal.name}` for grouped entries. Keep grams update and individual delete callbacks unchanged.
9. Render compact logged-meal group delete controls inside expanded slots for every `slot.mealGroups` entry, including groups with no child entries. Ensure the day empty state does not claim there is nothing logged when childless groups remain visible/deletable.
10. Preserve add/log dialogs, plan select/clear, plan suggestions, clear-day dialog, previous/next day navigation, loading/error/skeleton states, and full-day `MacroSummary` calculation.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Manual/browser check when practical: collapse/expand slots, edit grams, delete an individual entry, delete a logged meal group (including if its entries are gone), select/clear a plan, log via plan suggestion, clear day, and navigate previous/next day.

**Definition of done:**

- Day view initially shows collapsed time-slot headers with slot totals.
- Expanding a slot shows flat individual food rows with no per-meal aggregate card/nesting.
- Grouped entries appear under the parent meal time; standalone entries under their own time.
- Childless logged meal groups remain visible enough to delete.
- Full-day totals and plan suggestions are unchanged.
- Existing mutations and navigation continue to work.
- Unit tests cover the helper behavior and `bun run check` passes.

**Phase commit message:** `feat(nutrition): group day log by collapsible slots`

**Implementation log**

- Implementation notes: Added React-free intake slot structural types and `groupIntakeByTimeSlot` in `frontend/src/lib/nutrition.ts`; added unit tests for parent-time bucketing, standalone-time bucketing, no-time sorting, source metadata, childless logged meal groups, snapshot totals, and deterministic ordering; replaced nested logged-meal cards in `DailyIntakeLog` with collapsed-by-default time-slot sections, flat entry rows, provenance text, and compact group-delete controls.
- Reviewer verdict: `ACCEPT` from `nhost-reviewer`; reviewer verified helper/types, rules, tests, removal of obsolete grouping code, accessible collapsed slot headers, flat entry rendering, group-delete controls including childless groups, and preservation of full-day totals/plan/day behavior.
- Autonomous decisions: Accepted two reviewer notes as non-blocking: collapsed buttons may reference a panel id that only exists while expanded, but `aria-expanded` still conveys state and there is no correctness/security issue; childless slots show all-zero totals plus counts, which is correct and preserves deletability (correctness). Manual browser checks were not run; accepted helper tests, reviewer diff inspection, LSP diagnostics, and full check as sufficient automated evidence in this non-persistent UI refactor (correctness).
- Quality gate: `cd frontend && nix develop ../ --command bun test src/lib/nutrition.test.ts` passed in the implementer pass; `cd frontend && nix develop ../ --command bun run check` passed in both implementer and orchestrator runs (93 tests, 0 failures); LSP diagnostics for the touched Phase 2 files reported no diagnostics.

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
| Nutrition breadcrumbs on all in-scope routes | Phase 1 | Route map review, manual navigation, `bun run check` |
| Dynamic Food/Meal/Plan/date crumb labels | Phase 1 | Breadcrumb query components, generated GraphQL artifacts, manual loading/fallback check |
| Group daily intake by time slot | Phase 2 | `groupIntakeByTimeSlot` tests and day-view manual check |
| Flat entries without per-meal aggregate nesting | Phase 2 | Component diff review and manual expanded-slot check |
| Per-slot macro totals | Phase 2 | Helper totals tests and manual header check |
| Collapsed by default with expand/collapse | Phase 2 | Component implementation and manual keyboard/mouse check |
| Preserve entry edit/delete and group delete | Phase 2 | Existing callback preservation, manual mutation checks, reviewer diff inspection |
| Preserve plan/day behavior | Phase 2 | `bun run check` and manual checks for plan selection/suggestions, clear day, day nav |

---

## 6. Risks and mitigations

- **Risk:** Breadcrumb dynamic queries add generated file diffs and can fail typecheck if artifacts are stale. — **Mitigation:** Run and commit `bun run codegen:graphql` output in Phase 1.
- **Risk:** Logged-meal group delete becomes less discoverable after removing meal aggregate cards. — **Mitigation:** Show compact provenance and delete controls inside expanded slots for each contributing logged meal.
- **Risk:** Childless logged meal groups disappear from the UI. — **Mitigation:** Make childless groups create slots and test the delete-affordance case.
- **Risk:** Flattening accidentally buckets grouped entries by child `slotTime`. — **Mitigation:** Add an explicit helper test where child and parent times differ.
- **Risk:** Within-slot ordering appears arbitrary. — **Mitigation:** Define and test a deterministic source/entry comparator, then visually review.

---

## 7. Follow-ups (out of scope for this plan)

- Persist expanded/collapsed slot state across navigation or reloads — tracked in: TBD.
- Larger nutrition day-view redesign beyond time-slot grouping — tracked in: TBD.
