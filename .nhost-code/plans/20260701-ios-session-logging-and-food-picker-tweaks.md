# iOS session logging and food picker tweaks

**Status:** ready
**Created:** 2026-07-01

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

The native iOS app has three small UX consistency/productivity issues: first strength sets in a session do not use available prior-session history as a starting point; the session `Recent` strength history uses reps × weight while the rest of the session UI uses weight × reps; and the Log food sheet exposes the food wheel immediately instead of only when the food input is engaged.

### 1.2 Functional requirements

- When adding a strength set, use the current session's highest-numbered/latest set as the editor seed if present.
- When adding the first strength set for an exercise in the current session, use the highest-numbered set from the newest loaded prior session entry for that same exercise that has sets.
- If prior history is unavailable, still loading, failed, contains no sets, or the loaded prior-history window does not include an older set, preserve current editor defaults.
- Keep inserted set numbering derived only from current-session sets.
- Render `Recent` strength history in weight × reps order with existing `BW` and per-side semantics preserved.
- In Log food, show a food search/input and selected-food summary first; reveal the wheel after the food input is tapped/focused or the user is filtering, and keep it revealed for the sheet lifetime.
- Preserve filtering, disabled state, auto-selection, selected summary behavior, and empty/no-match messaging. Preserve meal-editor default wheel behavior.

### 1.3 Non-functional requirements / constraints

- iOS-only, no backend/schema/API/codegen changes.
- Keep helper logic pure and testable in `NeoGymKit`; keep SwiftUI-specific focus/reveal logic in app views.
- Do not introduce SwiftUI/UIKit imports into `Sources/NeoGymKit`.
- Any new helpers in `NeoGymKit` that are called from `ios/NeoGym/App/*.swift` must be `public` or exposed through public model APIs.
- Avoid adding new `App/*.swift` files unless necessary, to avoid XcodeGen churn.

### 1.4 Surfaces in scope

- `ios/NeoGym/Sources/NeoGymKit/SessionModels.swift` or `ios/NeoGym/Sources/NeoGymKit/SessionStrengthSetHelpers.swift` — pure set seeding, next-set-number, and formatting helpers.
- `ios/NeoGym/App/SessionsView.swift` — wire set seed helper into `startAddingSet(for:)`; optionally reuse display helper in `StrengthSetsList`.
- `ios/NeoGym/App/SessionPriorHistoryViews.swift` — update Recent formatting to shared weight × reps summary formatter.
- `ios/NeoGym/App/Nutrition/FoodPickerView.swift` — add opt-in sticky on-demand wheel reveal state and keep selected summary visible only for the opt-in reveal mode while preserving default no-match behavior.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — opt Log food into on-demand reveal.
- `ios/NeoGym/Tests/NeoGymKitTests/SessionManagementTests.swift` — unit tests for pure helpers.

### 1.5 Out of scope

- Backend migrations, metadata, permissions, GraphQL schema changes, web frontend changes, and nutrition data-model changes.
- Redesigning session history beyond seed/display behavior.
- Redesigning food search beyond hiding/revealing the existing wheel.
- Increasing the existing prior-history query window beyond the current best-effort loaded history.

### 1.6 Success criteria

- First current-session strength set can prefill from prior-session last/highest-numbered set for that exercise when prior data exists in the loaded history.
- Later current-session sets still prefill from the current-session last/highest-numbered set.
- Recent history reads weight × reps consistently with current sets/editor.
- Log food initially hides the food wheel while showing the input and selected summary, then reveals a stable wheel when the input is engaged; meal editor still shows the wheel immediately and keeps its existing no-match rendering.
- `swift test`, `swift build`, and app `xcodebuild` pass, or any environment issue is explicitly documented.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use existing prior-history data already loaded by `SessionDetailViewModel` and avoid new backend/API work. Put set seed selection, current-session next-number calculation, and strength display formatting in pure `NeoGymKit` helpers so the behavior is deterministic and unit-testable. Keep `FoodPickerView` reveal behavior as an opt-in SwiftUI state change with a sticky reveal flag so shared call sites remain backward compatible and the wheel remains reachable after focus changes.

### 2.2 Key constraints and invariants

- Prior history must never affect inserted `setNumber`; it only seeds editor values.
- Current-session highest-numbered/latest set takes precedence over prior-session history.
- Prior history is decorative/best-effort; no blocking spinner or extra fetch should be added before opening the set editor.
- Prior seeding is best-effort over the loaded prior-history window from `SessionsRepository.priorSessionsPerExercise`, which currently fetches up to three prior session-exercise rows per exercise.
- `FoodPickerView` default behavior must remain always-visible wheel for existing meal-editor usage.
- Disabled/mutating state must also prevent tap/focus reveal handlers from bypassing disabled picker/search behavior.
- Selected food summary remains visible independent of wheel visibility in Log food reveal mode; default mode should preserve existing no-match behavior unless explicitly changed.
- Recent `/side` is a single trailing summary suffix when `doubleWeight` and any summarized set has weight > 0; current-set rows may keep per-set `/side`.

### 2.3 Touched surfaces

- Add public `StrengthSetSeeding`, `StrengthSetNumbering`, and `StrengthSetFormatting` helpers (or equivalent names) in `SessionModels.swift` or a new SwiftPM source file.
- Update `SessionDetailView.startAddingSet(for:)` to pass `viewModel.priorStrengthByExercise[row.exercise.id] ?? []` into the seed helper and keep next number current-only.
- Update `StrengthPriorSummary.setSummary` to use the shared weight × reps summary formatter and preserve trailing `/side` when appropriate.
- Optionally update `StrengthSetsList.setText` to use the shared single-set formatter with per-set `/side` to prevent future drift.
- Add `revealWheelOnDemand` (default `false`), sticky `wheelRevealed` state, and guarded focus/tap/query reveal logic in `FoodPickerView`; pass `true` from Log food only.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No API/schema/config changes. Existing food picker call sites are compatible because the new flag defaults to current behavior; special summary-hoisting behavior should be gated to `revealWheelOnDemand` so meal-editor no-match rendering does not change.
- **Deployment:** No migrations/codegen. XcodeGen regeneration only if implementer adds/removes `App/*.swift` files; preferred plan edits existing app files and only adds SwiftPM helper/test files.
- **Rollback:** Standard revert is sufficient; no data shape changes.

---

## 3. Phased plan of action

For this small iOS-only change, use a single self-contained phase.

### Phase 1 — Implement iOS session logging and food picker tweaks

**Goal:** Deliver all three localized UX tweaks with unit-tested pure helper behavior and app build validation.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/SessionModels.swift` or `ios/NeoGym/Sources/NeoGymKit/SessionStrengthSetHelpers.swift` — add public pure helpers.
- `ios/NeoGym/App/SessionsView.swift` — wire seeding and optional shared formatter.
- `ios/NeoGym/App/SessionPriorHistoryViews.swift` — change Recent formatting.
- `ios/NeoGym/App/Nutrition/FoodPickerView.swift` — opt-in sticky on-demand wheel reveal and reveal-mode summary placement.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — enable on-demand reveal for Log food.
- `ios/NeoGym/Tests/NeoGymKitTests/SessionManagementTests.swift` — add helper tests.

**Implementation steps:**

1. Add a public `StrengthSetSeeding.seedSet(currentSets:priorEntries:) -> SessionStrengthSet?` helper. It should return the current set with the greatest `setNumber` when any current sets exist; otherwise sort/filter prior entries defensively by parsed `startedAt` descending (or explicitly test the newest-first contract) and return the greatest-`setNumber` set from the newest non-empty prior entry; otherwise nil.
2. Add a public current-only `StrengthSetNumbering.nextSetNumber(currentSets:) -> Int` helper (or equivalent) returning `(max current setNumber ?? 0) + 1`. Use it where practical for display/editor next set number and `SessionDetailViewModel.addStrengthSet`; do not pass prior entries into this helper.
3. Add public `StrengthSetFormatting` helpers that format single sets as spaced weight × reps (`100 kg × 5`, `42.5 kg × 8`, `BW × 5`) and accept an explicit `includeSideSuffix` argument for per-set `/side` use. Add a summary helper for Recent that formats each set with `includeSideSuffix: false`, comma-joins them, returns `no sets` for empty input, and appends one trailing `/side` only when `doubleWeight` and any set has weight > 0.
4. Update `startAddingSet(for:)` to compute `priorEntries` from `viewModel.priorStrengthByExercise[row.exercise.id] ?? []`, pass the seed helper result as `previousSet`, and leave `nextSetNumber` based only on current-session sets via the numbering helper or existing current-only calculation.
5. Update `StrengthPriorSummary.setSummary` to use the shared summary helper so Recent is weight × reps. Remove now-unused private formatters.
6. Optionally route `StrengthSetsList.setText` through the shared single-set formatter with `includeSideSuffix: true`, preserving its existing volume display and list layout.
7. Add `revealWheelOnDemand: Bool = false`, `@FocusState`, and sticky `@State private var wheelRevealed = false` in `FoodPickerView`. Set `wheelRevealed = true` on first tap/focus of the input and whenever `query` becomes non-empty, but guard any explicit tap gesture with `!disabled`. Render the wheel with the simple condition `!revealWheelOnDemand || wheelRevealed`; do not auto-reset it while the sheet is open.
8. Restructure `FoodPickerView` so `searchField` always renders. For `revealWheelOnDemand == true`, render `selectedSummary` as a sibling of the conditional wheel so Log food keeps the selected summary visible while hidden. For the default path, preserve existing behavior during no-match searches: do not show the retained selected summary when `visibleFoods.isEmpty` unless the existing branch would have shown it. Keep the empty-catalog message visible even before reveal; show the no-match message when searching/filtering or revealed. Preserve disabled propagation, clear button, and `syncSelectionWithFilter()` behavior; acknowledge that auto-selection may select the first food while the wheel is hidden so the summary is visible in Log food.
9. Pass `revealWheelOnDemand: true` from `LogFoodSheet`; do not opt in meal-editor call sites.

**Tests and checks:**

- Unit-test `StrengthSetSeeding`: current set wins; no current sets uses newest prior entry's greatest-numbered set; empty newest prior entry is skipped; no sets returns nil; unsorted current/prior inputs still choose the newest prior entry and greatest `setNumber` if the helper sorts defensively, or otherwise add an explicit test pinning the newest-first input contract.
- Unit-test `StrengthSetNumbering`: empty current sets returns 1 even when a prior seed has `setNumber` 5; current sets return max+1.
- Unit-test `StrengthSetFormatting`: weighted integer, weighted fractional, bodyweight, per-set double-weight suffix, comma-joined Recent summary, empty summary, and mixed weighted + BW double-weight Recent summary with a single trailing `/side`.
- Existing session mutation tests should still prove inserted set numbering is current-session-only.
- Manual verification: Log food opens with wheel hidden and selected summary visible; tapping/focusing input reveals the wheel; tapping/scrolling the wheel after keyboard/focus changes does not hide it; disabled/mutating state prevents field interaction and does not reveal through a container gesture; filtering works; empty-catalog and no-match messages are sensible; meal editor still shows wheel immediately and does not gain a selected summary during no-match searches.
- Run from `ios/NeoGym`: `swift test`; `swift build`; `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.

**Definition of done:**

- The helper tests pass and cover all seed/number/format cases.
- The three user-facing behaviors are implemented as specified.
- Shared FoodPicker default behavior remains unchanged outside Log food, including the meal-editor no-match behavior.
- The app remains fully functional because no backend/API contracts change and the validation commands pass or any environment-only failure is documented with exact output.

**Phase commit message:** `fix(ios): tune session set seeding and food picker`

**Implementation log**

- **Implementation notes:** Added public pure `NeoGymKit` helpers in `SessionStrengthSetHelpers.swift` for strength-set seeding, current-only next-set numbering, and weight × reps formatting. Wired session add-set flows to seed from current highest-numbered set first, then newest loaded prior entry with sets, while keeping insert numbering current-session-only. Updated Recent strength formatting to shared weight × reps output with a single trailing `/side` summary suffix. Made Log food opt into sticky on-demand `FoodPickerView` wheel reveal while preserving default meal-editor behavior, including no-match rendering. Added `StrengthSetHelperTests` coverage for seeding, numbering, and formatting.
- **Reviewer verdict:** `ACCEPT` from `nhost-reviewer`; residual non-blocking concern is that SwiftUI tap/focus behavior around the Log food search field should still be manually verified on simulator/device.
- **Autonomous decisions:** Ran all remaining phases by default because only Phase 1 exists and no matching completion commit existed (correctness: fulfills the user's requested plan). Used the plan's iOS quality gate (`swift test`, `swift build`, app `xcodebuild`) plus `git diff --check`; no separate Swift linter is configured (correctness/maintenance: strongest available validation for Swift package and app-view changes). Used a clean Xcode environment for Swift/Xcode commands after the inherited Nix shell failed with an SDK/toolchain mismatch (correctness: validates the code with the usable local Xcode toolchain while preserving the failure record).
- **Quality gate:** Initial `swift test` in the inherited Nix shell failed before tests due to SDK/toolchain mismatch (`SDK is built with Apple Swift 5.10 ... compiler is Apple Swift 6.3.3`). Clean Xcode env `xcrun swift test` passed: 179 tests, 0 failures, including 6 `StrengthSetHelperTests`. Clean Xcode env `xcrun swift build` passed. Clean Xcode env `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed (`BUILD SUCCEEDED`). `git diff --check` passed.

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
| First set seeds from prior history | Phase 1 | Seeding tests plus manual Add set verification |
| Later sets seed from current session | Phase 1 | Seeding current-precedence tests |
| Set numbering unchanged/current-only | Phase 1 | Numbering tests, existing mutation tests, review of `startAddingSet`/view-model logic |
| Recent uses weight × reps | Phase 1 | Formatting tests plus manual session view check |
| `/side` and `BW` preserved | Phase 1 | Formatting tests including mixed weighted + BW double-weight summary |
| Log food reveals stable wheel on input | Phase 1 | Manual simulator verification and app build |
| Selected food summary visible in Log food while wheel hidden | Phase 1 | Manual simulator verification of Log food initial state |
| Meal editor unchanged | Phase 1 | Default flag behavior plus manual regression check, including no-match summary behavior |
| Disabled mutation state respected | Phase 1 | Manual Log food mutation/disabled-state check |

---

## 6. Risks and mitigations

- **Risk:** Prior history load timing or the `limit: 3` prior-history query window may mean an older useful set is not available when the user taps Add set. — **Mitigation:** Treat prior seeding as best-effort over loaded history and preserve existing defaults when no loaded prior set is available.
- **Risk:** Shared FoodPicker changes regress meal-editor behavior. — **Mitigation:** Make reveal opt-in, gate summary-hoisting behavior to reveal mode, keep default no-match behavior unchanged, and manually verify the meal editor.
- **Risk:** SwiftUI focus behavior in a `Form` hides the wheel after the field loses focus. — **Mitigation:** Use sticky reveal state and verify the tap-input → scroll-wheel path in simulator.
- **Risk:** Formatting drift or `/side` double-application. — **Mitigation:** Centralize helper logic, define per-set vs Recent `/side` semantics explicitly, and cover mixed weighted/bodyweight double-weight summaries in tests.

---

## 7. Follow-ups (out of scope for this plan)

Deferred items the user agreed to handle separately.

- None.
