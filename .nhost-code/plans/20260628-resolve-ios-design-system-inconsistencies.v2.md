# Resolve iOS Design System Inconsistencies

**Status:** ready
**Created:** 2026-06-28

---

## 1. Requirements

Captured from the design-guide extraction and follow-up discussion about the
native iOS inconsistencies.

### 1.1 Problem / motivation

The native SwiftUI app under `ios/NeoGym/App/` now has a documented design guide
in `ios/NeoGym/CLAUDE.md`, but the inspection surfaced several design-system,
form, keyboard, and accessibility inconsistencies. This plan turns those findings
into small, independently shippable iOS cleanup phases without changing product
flows, backend behavior, schema, or the web app.

### 1.2 Functional requirements

- Make `GlassPanel` and `.glassSurface(...)` truthful: declared styling
  parameters must either be honored or removed.
- Preserve existing call-site intent where safe, while avoiding accidental
  app-wide visual changes from previously ignored default parameters.
- Resolve `SecondaryTabSection.icon` being defined but not rendered by the
  segmented `SecondarySectionBar`.
- Add explicit accessibility labels to icon-only buttons that lack them.
- Standardize representative form error, mutation-progress, and disabled-submit
  presentation through small app-layer primitives.
- Improve decimal-pad/number-pad keyboard and focus affordances outside
  `OTPCodeField`.
- Keep nutrition glass helpers only if they are intentional denser wrappers over
  generic glass primitives; document that boundary.
- Add useful VoiceOver summaries to custom time-series charts without replacing
  the custom chart implementation.
- Keep `ios/NeoGym/CLAUDE.md` in sync with the conventions changed by each
  phase.

### 1.3 Non-functional requirements / constraints

- iOS app only. No backend, frontend web, schema, Hasura metadata, GraphQL
  permission, or domain-contract changes.
- Preserve the existing native visual language, tabs, navigation, and domain
  flows.
- Keep `Sources/NeoGymKit` host-testable and free of SwiftUI/UIKit where that is
  already required. Validation remains in `NeoGymKit` form models.
- Each phase must be self-contained, leave the app buildable and usable, and be
  testable before the next phase starts.
- iOS deployment target is `15.0` in `ios/NeoGym/project.yml`, so new SwiftUI
  APIs must be iOS 15-safe or availability-gated.
- Unit tests must remain deterministic against fakes; no live Nhost, real
  Keychain, or writable HealthKit dependencies.
- `swift build` and `swift test` do not compile `App/*.swift`; every app-layer
  phase requires the simulator `xcodebuild` gate.
- Visual and VoiceOver claims are manual-review gates unless a phase explicitly
  adds automation.

### 1.4 Surfaces in scope

- `ios/NeoGym/App/Components/GlassPrimitives.swift` — glass primitives.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — tokens only if needed.
- `ios/NeoGym/App/Components/SecondarySectionBar.swift` — secondary tab
  protocol and segmented control.
- `ios/NeoGym/App/WorkoutsShellView.swift`,
  `ios/NeoGym/App/Nutrition/NutritionShellView.swift`,
  `ios/NeoGym/App/MeShellView.swift` — secondary section enum conformers.
- `ios/NeoGym/App/Components/FeedbackBanner.swift`,
  `ios/NeoGym/App/Components/NeoGymButtonStyle.swift`, and a new component file
  if needed for form primitives.
- Representative forms: `SignInView.swift`, `SignUpView.swift`,
  `ChangeEmailSheet.swift`, `WorkoutFormViews.swift`, `BodyViews.swift`,
  `CardioMetricsFormView.swift`, `Nutrition/FoodDetailAndFormViews.swift`,
  `Nutrition/MealEditorViews.swift`, `Nutrition/PlanEditorViews.swift`,
  `Nutrition/LogFoodMealSheets.swift`, `Nutrition/FoodLogInputControls.swift`,
  `LabelInputView.swift`, and `JournalViews.swift` as needed by the selected
  phase scope.
- Nutrition helpers and consumers: `Nutrition/NutritionGlassHelpers.swift`,
  `Nutrition/FoodsViews.swift`, `Nutrition/MealsViews.swift`,
  `Nutrition/FoodPickerView.swift`, `Nutrition/MealPickerView.swift`.
- Charts and consumers: `Components/TimeSeriesChartView.swift`,
  `Components/TimeSeriesTrendChartView.swift`, `BodyViews.swift`,
  `ExerciseDetailSections.swift`.
- `ios/NeoGym/CLAUDE.md` — design-guide and inconsistency documentation.

### 1.5 Out of scope

- Replacing custom charts with Apple Charts.
- Redesigning the app shell, primary tabs, secondary navigation, domain flows, or
  visual brand.
- Broad `NavigationView` to `NavigationStack` migration.
- Complete app-wide form framework rewrite.
- Snapshot-test infrastructure, except as a future follow-up.
- Backend/frontend/schema/migration/metadata/codegen work.

### 1.6 Success criteria

- The original inconsistency list in `ios/NeoGym/CLAUDE.md` is either resolved or
  rewritten as intentional guidance.
- The app builds after every phase with the iOS app build gate.
- `NeoGymKit` still builds/tests on macOS and remains free of SwiftUI/UIKit-only
  form-presentation logic.
- Icon-only controls touched or discovered by the audit have meaningful
  accessibility labels.
- Representative forms share status/action primitives without changing domain
  validation or navigation behavior.
- Decimal/number-pad fields in the targeted forms have an explicit dismiss
  affordance outside OTP.
- Glass primitives no longer silently ignore parameters, and any visual change is
  pre-approved and baseline-reviewed.
- Custom charts expose a useful VoiceOver summary and do not announce decorative
  paths/markers redundantly.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use a low-risk-first cleanup sequence and keep the existing UI language. For the
secondary segmented bars, keep the current text-only design and remove the unused
`icon` requirement rather than adding icons to crowded segmented controls. For
glass primitives, make the API truthful, but first audit bare versus explicit
call sites and choose defaults that avoid unapproved app-wide shadow/stroke/tint
changes; explicit call-site styling should become honored, while bare call sites
should not unexpectedly bloom unless the user signs off on that visual change.

### 2.2 Key constraints and invariants

- Do not move validation logic out of `NeoGymKit` form models.
- Do not touch `OTPCodeField` for the keyboard/focus phase except to preserve its
  existing behavior.
- Do not change navigation semantics, app tab structure, or domain flows.
- Do not commit generated `.xcodeproj` output.
- Fold `ios/NeoGym/CLAUDE.md` updates into the same phase that changes the
  documented convention.
- For visual/accessibility claims, record manual-review evidence in the
  implementation log because app-layer regressions are not covered by unit tests.

### 2.3 Touched surfaces

- `ios/NeoGym/App/Components/` — new or updated app-only UI primitives.
- `ios/NeoGym/App/Nutrition/` — accessibility labels, keyboard affordances, and
  nutrition glass helper boundary.
- `ios/NeoGym/App/Components/GlassPrimitives.swift` — glass API behavior.
- `ios/NeoGym/App/Components/TimeSeriesChartView.swift` — chart accessibility.
- `ios/NeoGym/CLAUDE.md` — convention documentation.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No backend/API/schema compatibility concerns. UI changes
  are local to iOS app presentation.
- **Deployment:** Standard iOS app deployment. If app files are added/removed,
  regenerate the project with XcodeGen before app build validation.
- **Rollback:** Each phase should be revertible independently. Phase 5 is the
  highest visual-risk phase and must remain isolated so a standard revert can
  restore the prior look.

---

## 3. Phased plan of action

### Phase 1 — Discovery audit and icon-only accessibility labels

**Goal:** establish implementation evidence for all later phases and fix the
lowest-risk accessibility gaps first.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/FoodsViews.swift` — clear-search label.
- `ios/NeoGym/App/Nutrition/MealsViews.swift` — clear-search label.
- `ios/NeoGym/App/Nutrition/FoodPickerView.swift` — clear-search label.
- `ios/NeoGym/App/Nutrition/MealPickerView.swift` — clear-search label.
- `ios/NeoGym/CLAUDE.md` — mark icon-only label inconsistency resolved or refine
  guidance.

**Implementation steps:**

1. Before editing, inventory and record in the implementation log:
   - every `Button` whose resolved label is image-only or icon-only, not just
     grep hits;
   - all `GlassPanel` / `.glassSurface(...)` call sites, split into bare calls
     and explicit-parameter calls;
   - all `SecondaryTabSection` conformers;
   - all `.decimalPad` / `.numberPad` fields in app-layer forms;
   - all `TimeSeriesChartView` consumers.
2. Add `.accessibilityLabel("Clear search")` to the known nutrition search clear
   buttons.
3. Add similarly concise labels to any other unlabeled image-only buttons found
   by the audit. Do not relabel controls that already expose text through
   `Label` or already have an accessibility label.
4. Update `ios/NeoGym/CLAUDE.md` to remove or reword the icon-only-buttons
   inconsistency.

**Tests and checks:**

- From `ios/NeoGym/`: `swift build`.
- From `ios/NeoGym/`: `swift test`.
- From `ios/NeoGym/`: run `nix develop ../.. --command xcodegen generate` only
  if the project is missing or app files were added/removed.
- From `ios/NeoGym/`: `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Manual VoiceOver or Accessibility Inspector pass over the touched nutrition
  clear buttons.
- `git status --short` to confirm no generated project files or out-of-scope
  files are staged.

**Definition of done:**

- Audit inventory is captured in the implementation log.
- All discovered unlabeled icon-only controls in this phase's scope have
  meaningful labels.
- App compiles through the simulator build.
- Documentation reflects the resolved accessibility-label inconsistency.

**Phase commit message:** `fix(ios): label icon-only controls`

**Implementation log**

- **Implementation notes:** Added accessibility labels to image-only controls discovered in Phase 1: nutrition search clear buttons, picker removal controls, filter clear buttons, reorder arrows, trash/delete icons, and workout exercise move/remove buttons. Updated `ios/NeoGym/CLAUDE.md` to remove the resolved icon-only-button inconsistency and added a troubleshooting note for Nix SDK/Xcode compiler mismatch observed during validation.
- **Audit inventory:** Image-only controls needing labels were found in `ExercisePickerView`, `ExercisesView`, `DailyIntakeViews`, `FoodPickerView`, `FoodsViews`, `MealPickerView`, `MealsViews`, `PlansViews`, `MealEditorViews`, `PlanEditorViews`, and `WorkoutFormViews`. Already-labeled controls included header create buttons, edit buttons, label-chip removals, rest timer controls, and session exercise removal. Glass call audit found 11 `GlassPanel(...)` and 47 `.glassSurface(...)` call sites, all with explicit parameters and no bare calls. `SecondaryTabSection` conformers are `WorkoutAreaSection`, `NutritionSection`, and `MeSection`. Decimal/number-pad forms are `CardioMetricsFormView`, `FoodDetailAndFormViews`, `MealEditorViews`, `FoodLogInputControls`, `BodyViews`, plus `OTPCodeField`. `TimeSeriesChartView` is directly used by `TimeSeriesTrendChartView` and downstream by `BodyViews` and `ExerciseDetailSections`.
- **Reviewer verdict:** `ACCEPT_WITH_CONCERNS`. Concerns accepted as non-blocking: manual VoiceOver/Accessibility Inspector pass was not run in this non-interactive session; the Nix SDK troubleshooting note is accurate but slightly opportunistic for this phase.
- **Autonomous decisions:** Treated the implementer/reviewer acceptance-wrapper failures as non-blocking because both reports explicitly documented that no tests were added for this app-layer accessibility-label pass, which satisfies correctness and long-term maintenance better than adding low-value tests without an accessibility test harness. Accepted the CLAUDE.md troubleshooting note because it explains the repeated validation environment failure and improves future maintenance.
- **Quality gate:** Initial `swift build` attempt failed due inherited Nix SDK/compiler mismatch. Reran in clean Xcode environment with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`: `xcrun swift build` passed, `xcrun swift test` passed, `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed, `git diff --check` passed, and `git status --short` showed only expected phase files plus this living-plan update.

### Phase 2 — Remove unused secondary section icons

**Goal:** resolve the `SecondaryTabSection.icon` mismatch with no visual change.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Components/SecondarySectionBar.swift` — remove `icon` from the
  protocol.
- `ios/NeoGym/App/WorkoutsShellView.swift` — remove `WorkoutAreaSection.icon`.
- `ios/NeoGym/App/Nutrition/NutritionShellView.swift` — remove
  `NutritionSection.icon`.
- `ios/NeoGym/App/MeShellView.swift` — remove `MeSection.icon`.
- `ios/NeoGym/CLAUDE.md` — document text-only secondary bars.

**Implementation steps:**

1. Remove `var icon: String { get }` from `SecondaryTabSection`.
2. Delete the corresponding enum `icon` implementations.
3. Keep `SecondarySectionBar` rendering `Text(section.title)` and preserve its
   accessibility label and Dynamic Type cap.
4. Verify there are no remaining references to `section.icon` or conformer icon
   implementations.
5. Update `ios/NeoGym/CLAUDE.md` to state secondary bars are intentionally
   text-only.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual navigation check for Workouts, Nutrition, and Me secondary bars.

**Definition of done:**

- No defined-but-unused `icon` protocol requirement remains.
- Secondary bars look and behave as before.
- Docs no longer list unused secondary icons as an inconsistency.

**Phase commit message:** `refactor(ios): remove unused secondary section icons`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — Shared representative form status and action primitives

**Goal:** standardize representative form progress, error, and primary-submit
presentation without changing validation or flows.

**Depends on:** Phase 1 preferred for audit context, but not code-dependent.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- New file under `ios/NeoGym/App/Components/`, e.g.
  `FormStatePrimitives.swift` — shared app-layer primitives.
- `ios/NeoGym/App/SignInView.swift` — replace duplicated private progress view.
- `ios/NeoGym/App/SignUpView.swift` — replace duplicated private progress view.
- `ios/NeoGym/App/ChangeEmailSheet.swift` — adopt shared progress/error/action
  convention where it fits.
- `ios/NeoGym/App/WorkoutFormViews.swift` — representative domain form adoption.
- `ios/NeoGym/App/BodyViews.swift` — representative domain form adoption.
- `ios/NeoGym/App/Nutrition/FoodDetailAndFormViews.swift` — representative
  nutrition form adoption.
- `ios/NeoGym/CLAUDE.md` — document the primitive names and representative
  adoption boundary.

**Implementation steps:**

1. Add small app-only primitives, likely:
   - `InlineProgressLabel(title:)`;
   - `PrimaryActionButton(title:busyTitle:isBusy:isEnabled:action:)` wrapping
     `NeoGymPrimaryButtonStyle`;
   - a documented convention to use `FeedbackBanner` for form-level errors.
2. Replace the duplicated private sign-in/sign-up progress labels.
3. Adopt the primary action/error convention only in the named representative
   forms.
4. Preserve any existing per-call-site modifiers and behavior when wrapping
   buttons, including accessibility labels, keyboard shortcuts if present,
   disabled conditions, and submit/focus behavior.
5. Do not move validation logic from `NeoGymKit`; views should still call
   `valuesForSubmit()` and read model `canSubmit`/`errorMessage` state.
6. Do not change domain flow, navigation, mutation order, or callback order.
7. Update `ios/NeoGym/CLAUDE.md` with the chosen primitive names and note that
   full app-wide form migration is out of scope.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual checks: sign-in send/verify, sign-up, change-email, workout form, body
  measurement form, and food form render disabled/progress/error states without
  changing navigation or mutation flow.

**Definition of done:**

- Shared primitives exist under `ios/NeoGym/App/Components`.
- No validation logic moved from `NeoGymKit`.
- Named forms use consistent submit disabled/progress/error rendering.
- No domain flow or navigation behavior changed.
- Docs reflect the convention and the intentionally limited adoption scope.

**Phase commit message:** `refactor(ios): standardize representative form actions`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 4 — Keyboard Done and focused numeric fields outside OTP

**Goal:** targeted decimal/number-pad forms can dismiss the keyboard and, where
useful, manage focus locally.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- New helper under `ios/NeoGym/App/Components/`, e.g.
  `KeyboardDoneToolbar.swift`.
- `ios/NeoGym/App/BodyViews.swift` — body measurement decimal fields.
- `ios/NeoGym/App/CardioMetricsFormView.swift` — scalar/duration text fields.
- `ios/NeoGym/App/Nutrition/FoodDetailAndFormViews.swift` — nutrient fields.
- `ios/NeoGym/App/Nutrition/FoodLogInputControls.swift` — grams input.
- `ios/NeoGym/App/Nutrition/LogFoodMealSheets.swift` — logging/editing grams or
  position fields where appropriate.
- `ios/NeoGym/App/Nutrition/MealEditorViews.swift` and
  `ios/NeoGym/App/Nutrition/PlanEditorViews.swift` — numeric/time fields where
  the helper applies safely.
- `ios/NeoGym/CLAUDE.md` — document the keyboard Done convention.

**Implementation steps:**

1. Add an opt-in app-layer helper using `@FocusState` and
   `ToolbarItemGroup(placement: .keyboard)` for actual `.decimalPad` and
   `.numberPad` `TextField`s.
2. Apply it only to text fields that show decimal/number pads. Do not attach the
   toolbar to wheel pickers or non-text controls.
3. Explicitly exclude `OTPCodeField` from this phase; preserve its current focus,
   one-time-code, and accessibility behavior.
4. Keep focus state local to SwiftUI views. Do not add focus state or UI types to
   `NeoGymKit`.
5. Verify nested `NavigationView` sheet behavior on iOS 15 simulators where
   keyboard toolbars can be finicky.
6. Update `ios/NeoGym/CLAUDE.md`.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual iPhone SE or similarly small simulator pass: focus each touched numeric
  field, confirm Done dismisses keyboard and content remains reachable.
- Manual OTP sign-in sanity check that OTP behavior was not changed.

**Definition of done:**

- Targeted decimal/number-pad fields outside OTP have a Done dismissal affordance.
- `OTPCodeField` remains unchanged or behavior-equivalent.
- No validation logic moved from `NeoGymKit`.
- App builds and manual keyboard checks pass.

**Phase commit message:** `feat(ios): add keyboard done affordances`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 5 — Glass API honesty with baseline and sign-off

**Goal:** stop silently ignoring glass styling parameters while avoiding
unapproved app-wide visual changes.

**Depends on:** Phase 1 audit inventory recommended.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Components/GlassPrimitives.swift` — core implementation.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — only if a named token is needed.
- Potentially targeted call sites from the bare-vs-explicit audit.
- `ios/NeoGym/CLAUDE.md` — update glass guidance.

**Implementation steps:**

1. Before editing, enumerate all `GlassPanel` and `.glassSurface(...)` call
   sites, split into:
   - bare calls that rely entirely on defaults;
   - explicit calls that pass `tint`, `stroke`, `shadow`, `material`, or
     `cornerRadius`.
2. Capture baseline screenshots, or equivalent simulator visual notes if
   screenshots are not practical, for auth, section cards, nutrition cards,
   chart callouts, `FeedbackBanner`, and representative Workouts/Sessions/Body/
   Profile screens.
3. Stop and ask the user for Phase 5 sign-off before making an app-wide visual
   change. Present the key choice:
   - **Safer default-preserving option (recommended):** honor explicit call-site
     parameters, but tune default values so bare calls remain visually close to
     today's flat rendering unless they explicitly opt in to stroke/shadow/tint;
   - **Full-intent option:** honor all declared defaults too, accepting broader
     new tint/stroke/shadow across bare calls.
4. Implement the approved option. In either case, no parameter should remain
   silently ignored: if a parameter is retained, it must affect rendering; if not
   retained, remove it and update all call sites.
5. For retained glass rendering, ensure the reduce-transparency fallback also
   applies the intended tint/stroke behavior and maintains sufficient contrast.
6. Rework `GlassPanel` so its declared parameters affect rendering while
   preserving content padding and sizing as much as possible.
7. Audit explicit call sites after implementation. If an explicit parameter now
   causes a contrast/layout regression, fix that call site's argument rather than
   muting the global primitive.
8. Update `ios/NeoGym/CLAUDE.md` to state which glass parameters are honored and
   whether defaults are intentionally conservative.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual simulator visual comparison against the Phase 5 baseline for auth,
  section cards, nutrition cards, chart callouts, `FeedbackBanner`, Workouts,
  Sessions, Body, Profile, Journal, and representative detail/form screens.
- Simulator Accessibility setting check for Reduce Transparency: no transparency
  leaks, tint/stroke contrast remains acceptable.
- Manual contrast/shadow sanity check for dark and light mode where practical.

**Definition of done:**

- No retained `GlassPanel` / `.glassSurface` parameter is ignored.
- Bare and explicit call-site behavior is documented in the implementation log.
- User sign-off for the chosen default strategy is recorded before the change.
- Baseline and post-change visual review evidence is recorded.
- App builds; docs reflect the shipped behavior.

**Phase commit message:** `fix(ios): make glass surface parameters truthful`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 6 — Nutrition glass helper audit and documentation

**Goal:** make the nutrition glass helper boundary intentional after the glass
primitive behavior is truthful.

**Depends on:** Phase 5

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/NutritionGlassHelpers.swift` — helper review.
- Representative nutrition consumers under `ios/NeoGym/App/Nutrition/`.
- `ios/NeoGym/CLAUDE.md` — document the boundary.

**Implementation steps:**

1. Re-review `NutritionGlassSection`, `.nutritionGlassField()`, and
   `.nutritionGlassCard(...)` after Phase 5. They currently carry distinct
   denser defaults and are expected to remain.
2. If a helper has become a pure alias with no distinct defaults/structure,
   collapse that helper into generic primitives. Otherwise keep it and document
   why it exists.
3. Adjust only helper defaults that visibly regress after Phase 5. Avoid broad
   nutrition visual refactors.
4. Update `ios/NeoGym/CLAUDE.md` to state nutrition helpers are intentionally
   denser wrappers over generic glass primitives.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual nutrition visual pass: Foods, Meals, Plans, Day, FoodPicker, MealPicker,
  and representative nutrition forms.

**Definition of done:**

- Each nutrition glass helper either has a documented distinct purpose or is
  removed.
- No broad nutrition redesign occurs.
- App builds; docs reflect the intentional boundary.

**Phase commit message:** `docs(ios): clarify nutrition glass helpers`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 7 — Time-series chart accessibility summaries

**Goal:** custom time-series charts expose a useful VoiceOver summary while
preserving current drawing and gestures.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Components/TimeSeriesChartView.swift` — accessibility summary.
- `ios/NeoGym/App/Components/TimeSeriesTrendChartView.swift` — pass-through
  label/summary if needed.
- `ios/NeoGym/App/BodyViews.swift` — domain label for body charts.
- `ios/NeoGym/App/ExerciseDetailSections.swift` — domain labels for exercise
  progress charts.
- `ios/NeoGym/CLAUDE.md` — update chart accessibility guidance.

**Implementation steps:**

1. Add chart-level accessibility label/value support to `TimeSeriesChartView`.
2. Collapse custom chart drawing into a single accessibility element using
   `.accessibilityElement(children: .ignore)` or equivalent so decorative paths,
   legends, axes, markers, and callouts are not redundantly announced.
3. Generate a default value summary from visible series: series names, point
   count, visible date range, latest value, and min/max using each series'
   `valueFormatter`.
4. Allow consumers to pass a clearer domain label where needed, e.g. body trend
   or exercise progress phrasing.
5. Leave the empty-state text naturally accessible.
6. Defer per-point `AccessibilityChartDescriptor` navigation unless it is cheap
   and does not destabilize the custom chart.
7. Update `ios/NeoGym/CLAUDE.md`.

**Tests and checks:**

- `swift build` and `swift test` from `ios/NeoGym/`.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/`.
- Manual VoiceOver pass over Body trend chart and at least one exercise progress
  chart: confirm one useful chart summary is announced and visual behavior is
  unchanged.

**Definition of done:**

- Chart containers expose meaningful summaries.
- Decorative chart internals are not noisy to VoiceOver.
- Existing visual rendering, selection gestures, legends, and callouts remain.
- App builds; docs reflect resolved chart accessibility inconsistency.

**Phase commit message:** `feat(ios): summarize charts for voiceover`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase
   while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`,
   `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance`
   gate, no `worktree`, and the implementer listed for the phase. The prompt
   must include the full plan, the current phase, and the requirement that tests
   be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use
   `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`,
   `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and
   the reviewer listed for the phase. The reviewer must inspect the actual diff,
   verify consistency with the full plan and surrounding phases, and run the
   tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to
   address it. Keep feedback scoped to the current phase unless fixing it safely
   requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the
   phase or no blocking concerns remain. If the loop stalls or the reviewer
   raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit
   message, after the relevant checks pass or any skipped checks are explicitly
   justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer the relevant language/surface guidance from the files
in scope and must read `ios/NeoGym/CLAUDE.md` before changing iOS code.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Icon-only controls labeled | 1 | Audit log, VoiceOver/manual check, xcodebuild |
| Secondary icon mismatch resolved | 2 | No `icon` requirement/impls remain, navigation manual check |
| Form state/action consistency | 3 | Representative flows, no validation moved, swift test + xcodebuild |
| Numeric keyboard dismissal outside OTP | 4 | Small-simulator keyboard manual checks, OTP sanity check |
| Glass parameters truthful | 5 | Bare/explicit audit, user sign-off, baseline/post visual review |
| Nutrition helpers intentional | 6 | Helper audit, nutrition visual pass, docs updated |
| Chart VoiceOver summaries | 7 | VoiceOver body/exercise chart pass, xcodebuild |
| Docs in sync | all | `ios/NeoGym/CLAUDE.md` updated in each relevant phase |
| App remains buildable | all | exact commands below |
| No out-of-scope/generated files | all | `git status --short` |

Required commands from `ios/NeoGym/` for app-layer phases:

```sh
swift build
swift test
nix develop ../.. --command xcodegen generate # if project missing or App files added/removed
xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build
git status --short
```

---

## 6. Risks and mitigations

- **Risk:** Phase 5 creates unexpected app-wide visual bloom because defaults that
  were previously ignored become visible. — **Mitigation:** split bare vs.
  explicit call sites, prefer default-preserving behavior for bare calls unless
  the user approves the broader visual change, capture baselines, and isolate the
  phase for easy revert.
- **Risk:** `GlassPanel` moving away from `GroupBox` changes layout. —
  **Mitigation:** preserve padding/alignment and manually inspect all `GlassPanel`
  call sites.
- **Risk:** Form wrappers swallow call-site modifiers or alter submit flow. —
  **Mitigation:** preserve per-call-site modifiers and restrict adoption to named
  representative forms.
- **Risk:** Keyboard toolbar behaves inconsistently in sheets on iOS 15. —
  **Mitigation:** apply only to text fields, check nested `NavigationView` sheets
  manually, and keep helper opt-in.
- **Risk:** App-layer correctness is mostly manual-review gated. —
  **Mitigation:** make manual checks explicit per phase, keep phases small, and
  defer snapshot/accessibility automation as follow-up.
- **Risk:** Doc drift. — **Mitigation:** docs update is part of each phase DoD.

---

## 7. Follow-ups (out of scope for this plan)

- App-wide adoption of form primitives beyond the named representative forms.
- Native UI snapshot testing for the glass visual system.
- Automated accessibility tests or accessibility snapshot checks.
- Per-point chart accessibility navigation if the summary baseline is
  insufficient.
