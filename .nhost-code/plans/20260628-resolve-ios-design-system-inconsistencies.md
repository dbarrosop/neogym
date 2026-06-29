# Resolve iOS Design System Inconsistencies

**Status:** planned
**Created:** 2026-06-28

---

## 1. Requirements

### 1.1 Problem / motivation

The native SwiftUI app under `ios/NeoGym/App/` has a documented set of
design-system and accessibility inconsistencies (captured in
`ios/NeoGym/CLAUDE.md` → "Inconsistencies worth fixing when touching nearby
code"). This plan turns those into concrete, independently shippable cleanup
phases that preserve the existing visual language and all domain flows, with no
backend/frontend/schema/contract changes.

### 1.2 Functional requirements

1. Make `GlassPanel` / `.glassSurface(...)` honest: parameters (`cornerRadius`,
   `tint`, `stroke`, `shadow`, `material`) must be either honored or removed.
   Preserve existing call-site intent where safe.
2. Resolve `SecondaryTabSection.icon` being defined but never rendered by
   `SecondarySectionBar` — render icons or drop the protocol requirement +
   enum implementations, accounting for segmented-control space / dynamic type.
3. Add accessibility labels to icon-only buttons that lack them (nutrition
   search clear buttons and similar plain icon controls).
4. Standardize form error / mutation-progress / disabled-state presentation via
   small shared app-level primitives, with targeted adoption (no broad rewrite).
5. Improve keyboard/focus affordances for long forms and decimal-pad inputs
   outside OTP (a Done affordance and/or focused-field conventions), keeping
   model validation authoritative.
6. Decide whether nutrition-specific glass helpers stay as intentionally denser
   wrappers or converge with generic primitives; pick a low-risk path.
7. Add VoiceOver/accessibility summaries to the custom time-series charts
   without replacing the custom chart implementation.
8. Keep `ios/NeoGym/CLAUDE.md` in sync with any convention changes, in the same
   phase that changes the behavior.

### 1.3 Non-functional requirements / constraints

- iOS app only. No backend, frontend web, schema, Hasura metadata, or GraphQL
  permission changes.
- Preserve the existing visual language and domain flows; no navigation/brand
  redesign.
- Keep `Sources/NeoGymKit` host-testable and free of SwiftUI/UIKit (validation
  stays in form models).
- Each phase is self-contained, leaves the app buildable and usable, and is
  testable before the next phase starts.
- iOS app deployment target is **15.0** (`ios/NeoGym/project.yml:29`). Any new
  SwiftUI API must be iOS 15-safe or `#available`-gated. `FocusState`,
  `ToolbarItemGroup(placement: .keyboard)`, and `Material` are all iOS 15+ and
  safe to use unguarded.
- Existing unit tests stay deterministic against fakes (no live Nhost / real
  Keychain / writable HealthKit).
- After code changes run, at minimum, `swift build` and `swift test` from
  `ios/NeoGym`. When `App/*.swift` changes (everything except the chart-data
  models if they migrate, see Phase 7), also run
  `nix develop ../.. --command xcodegen generate` then
  `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
  Note: `swift build`/`swift test` only cover `NeoGymKit`; they do **not**
  compile `App/*.swift`, so the `xcodebuild` step is the real gate for every
  app-layer phase.

### 1.4 Surfaces in scope

- `ios/NeoGym/App/Components/GlassPrimitives.swift`,
  `Theme/NeoGymTheme.swift` (tokens only).
- `ios/NeoGym/App/Components/SecondarySectionBar.swift` and section enums in
  `WorkoutsShellView.swift`, `Nutrition/NutritionShellView.swift`,
  `MeShellView.swift`.
- Representative forms + shared components: `SignInView.swift`,
  `SignUpView.swift`, `ChangeEmailSheet.swift`, `WorkoutFormViews.swift`,
  `BodyViews.swift`, `CardioMetricsFormView.swift`,
  `Nutrition/FoodDetailAndFormViews.swift`, `Nutrition/MealEditorViews.swift`,
  `Nutrition/PlanEditorViews.swift`, `Nutrition/LogFoodMealSheets.swift`,
  `Nutrition/FoodLogInputControls.swift`, `LabelInputView.swift`,
  `JournalViews.swift`, `Components/FeedbackBanner.swift`,
  `Components/NeoGymButtonStyle.swift`.
- Nutrition helpers: `Nutrition/NutritionGlassHelpers.swift`,
  `Nutrition/FoodsViews.swift`, `Nutrition/MealsViews.swift`,
  `Nutrition/FoodPickerView.swift`, `Nutrition/MealPickerView.swift`.
- Charts: `Components/TimeSeriesChartView.swift`,
  `Components/TimeSeriesTrendChartView.swift`, `BodyViews.swift`,
  `ExerciseDetailSections.swift`.
- `ios/NeoGym/Tests/NeoGymKitTests` only where model-level behavior changes.
- `ios/NeoGym/CLAUDE.md`.

### 1.5 Out of scope

- No redesign of navigation, tabs, domain flows, or visual brand.
- No replacement of the custom charts with Apple Charts.
- No migrations/backend/frontend work.
- No broad `NavigationView` → `NavigationStack` conversion.
- No app-wide form rewrite; prefer shared primitives + targeted adoption.

---

## 2. Current-state findings (grounding)

- **`GlassPanel`** (`App/Components/GlassPrimitives.swift`) declares
  `cornerRadius`, `material`, `tint`, `shadow` init params but stores only
  `contentPadding` and renders a plain `GroupBox` — `cornerRadius`, `material`,
  `tint`, `shadow` are all dropped. 10 call sites use `GlassPanel`.
- **`.glassSurface(...)`** declares `cornerRadius`, `material`, `tint`,
  `stroke`, `shadow`; `GlassSurfaceModifier` honors only `cornerRadius` and
  `material` (plus a `reduceTransparency` fallback that also ignores `tint`).
  `tint`, `stroke`, and `shadow` are silently dropped. ~26 files call it, and
  many pass non-default `tint:`/`stroke:`/`shadow:` values (e.g.
  `SessionsView.swift:235`, `BodyViews.swift:236`, `FeedbackBanner.swift`,
  `TimeSeriesChartView.swift` callout) — i.e. real intent is being lost, so the
  app currently renders flatter (no tint overlay, no hairline stroke, no
  shadow) than the call sites imply.
- **`SecondaryTabSection.icon`** is a protocol requirement implemented by all
  three section enums (`WorkoutsShellView.swift:19`,
  `Nutrition/NutritionShellView.swift:23`, `MeShellView.swift:20`) but
  `SecondarySectionBar` renders only `Text(section.title)` in a segmented
  `Picker`. The bar already caps growth with `.dynamicTypeSize(...large)`.
- **Icon-only buttons missing labels**: nutrition search clear buttons at
  `Nutrition/FoodsViews.swift:85`, `Nutrition/FoodPickerView.swift:68`,
  `Nutrition/MealPickerView.swift:74`, `Nutrition/MealsViews.swift:85` are plain
  `Image(systemName: "xmark.circle.fill")` buttons with no `accessibilityLabel`.
  (Header create actions like `FoodsViews.swift:68` already have labels.)
- **Form-state duplication**: `ProgressViewLabel` is privately re-declared in
  `SignInView.swift:157` and `SignUpView.swift:176` (as
  `SignUpProgressViewLabel`). Inline `ProgressView` + ad-hoc disabled/opacity
  and error treatment vary across forms; `FeedbackBanner` is adopted in only 6
  files. Form models in `NeoGymKit` already expose `canSubmit` / `isSubmitting`
  / `errorMessage`-style state (used heavily — 61 `isSubmitting` refs).
- **Keyboard/focus**: `FocusState` is used only in `OTPCodeField.swift`. No file
  uses `ToolbarItemGroup(placement: .keyboard)`. Decimal/number pads with no
  Done affordance appear in `BodyViews.swift`, `CardioMetricsFormView.swift`,
  `Nutrition/FoodDetailAndFormViews.swift`, `Nutrition/FoodLogInputControls.swift`,
  `Nutrition/MealEditorViews.swift`.
- **Charts**: `TimeSeriesChartView` is custom drawing with axes/legend/callouts
  and no accessibility summary; consumed by `BodyViews.swift`,
  `ExerciseDetailSections.swift`, and wrapped by `TimeSeriesTrendChartView.swift`.

---

## 3. Phasing strategy

Ordered low-risk-first. Phases 1–4 are additive/local and visually safe;
Phase 5 carries the only real visual risk and is gated behind simulator review;
Phase 6 depends on Phase 5; Phase 7 is additive accessibility. Each phase folds
its own `ios/NeoGym/CLAUDE.md` update into the same change (per the repo's
docs-in-sync rule) rather than deferring to a trailing doc phase.

```
Phase 1  Icon-only accessibility labels        (req 3)   low risk, no deps
Phase 2  Shared form-state primitives          (req 4)   low risk, no deps
Phase 3  Keyboard "Done" / focus affordances   (req 5)   low risk, no deps
Phase 4  SecondaryTabSection icon resolution   (req 2)   low risk, no deps
Phase 5  Glass API honesty                     (req 1)   visual risk; review gate
Phase 6  Nutrition glass helper convergence    (req 6)   depends on Phase 5
Phase 7  Chart accessibility summaries         (req 7)   low risk, additive
```

---

## 4. Phases

### Phase 1 — Icon-only accessibility labels

**Goal:** every icon-only / plain-image button has a VoiceOver label. Pure
additive; zero visual change.

**Files:**

- `App/Nutrition/FoodsViews.swift` (search clear, ~line 85)
- `App/Nutrition/FoodPickerView.swift` (search clear, ~line 68)
- `App/Nutrition/MealPickerView.swift` (search clear, ~line 74)
- `App/Nutrition/MealsViews.swift` (search clear, ~line 85)
- Any other plain icon buttons surfaced by the audit below.

**Strategy:**

1. Add `.accessibilityLabel("Clear search")` to each search clear button.
2. Audit for other unlabeled icon-only controls:
   `grep -rn "Image(systemName:" App | grep -i button` and review buttons whose
   only content is an `Image`. Add concise labels (e.g. "Remove", "Clear",
   "Decrease", "Increase"). Do **not** relabel buttons that already render text
   or already have a label (e.g. `HeaderActionButtonLabel` sites).
3. Where a clear/remove button sits next to a `TextField`, keep the 44pt target
   guidance from the design guide in mind but do not resize layouts in this
   phase (size tweaks belong to a later visual phase if needed).

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- Manual: VoiceOver on (simulator: Accessibility Inspector or device) over the
  Foods, Foods picker, Meals, Meals picker screens; confirm each clear button
  announces a label.

**Definition of done:**

- All four named clear buttons + any audit-found icon-only buttons have labels.
- App builds; no visual diff. CLAUDE.md "Inconsistencies" bullet for icon-only
  labels updated to "resolved" (or removed) in this commit.

---

### Phase 2 — Shared form-state primitives

**Goal:** one set of small app-level primitives for inline progress, error
banners, and disabled primary actions; adopt them in representative forms. No
broad rewrite, no change to `NeoGymKit` validation.

**Files:**

- New: `App/Components/FormStatePrimitives.swift` (or extend
  `Components/FeedbackBanner.swift` / `Components/NeoGymButtonStyle.swift`).
- Adopt in: `SignInView.swift`, `SignUpView.swift`, `ChangeEmailSheet.swift`,
  and one representative domain form each from workouts/body/nutrition
  (`WorkoutFormViews.swift`, `BodyViews.swift`,
  `Nutrition/FoodDetailAndFormViews.swift`).

**Strategy:**

1. Extract the duplicated `ProgressViewLabel` (`SignInView.swift:157`) /
   `SignUpProgressViewLabel` (`SignUpView.swift:176`) into a single shared
   `InlineProgressLabel(title: String)` view. Replace both private copies.
2. Standardize error presentation on the existing `FeedbackBanner` (already the
   de-facto error primitive). For the representative domain forms that surface
   `errorMessage` as ad-hoc danger `Text`, switch them to `FeedbackBanner`.
3. Add a shared submit-action convention so disabled state looks consistent.
   Options: (a) a `submitting`-aware view modifier
   `.primaryActionState(isBusy:)` that owns `ProgressView` swap + `.disabled` +
   any opacity, or (b) a thin `PrimaryActionButton(title:isBusy:isEnabled:action:)`
   wrapper over `NeoGymPrimaryButtonStyle`. **Recommended: (b)** — it removes the
   repeated "if isSubmitting { InlineProgressLabel } else { Text }" branch and
   the `.disabled(isSubmitting || !canSubmit)` boilerplate from call sites and
   keeps one definition of disabled opacity. Keep `NeoGymPrimaryButtonStyle` as
   the underlying style.
4. Validation stays in `NeoGymKit` form models. Primitives read
   `canSubmit`/`isSubmitting`/`errorMessage`; they do not introduce new
   validation.

**Tests / checks:**

- `swift build` + `swift test` (no NeoGymKit behavior change expected; guards
  regressions).
- `xcodegen generate` + `xcodebuild ... build`.
- Manual: sign-in send/verify, sign-up, change-email, and one domain form —
  confirm progress spinner, disabled-while-busy, and error banner all render
  consistently and that double-submit is still blocked.

**Definition of done:**

- No duplicate `ProgressViewLabel`/`SignUpProgressViewLabel`.
- Representative forms use the shared progress + error + primary-action
  primitives; disabled appearance is identical across them.
- App builds; `swift test` green. CLAUDE.md "Forms and validation" /
  "Inconsistencies" bullets updated to name the shared primitives.

---

### Phase 3 — Keyboard "Done" / focus affordances

**Goal:** decimal/number-pad forms get a dismissable keyboard and (where it
helps) field-to-field focus. Validation stays in form models.

**Files:**

- New shared helper in `App/Components/` (e.g.
  `KeyboardDoneToolbar.swift`): a `.keyboardDoneToolbar(isFocused:)` modifier or
  a `View` extension that adds `ToolbarItemGroup(placement: .keyboard)` with a
  trailing `Spacer()` + `Done` button that resigns focus.
- Adopt in: `BodyViews.swift`, `CardioMetricsFormView.swift`,
  `Nutrition/FoodDetailAndFormViews.swift`, `Nutrition/FoodLogInputControls.swift`,
  `Nutrition/MealEditorViews.swift`.

**Strategy:**

1. Add a single `FocusState`-driven Done toolbar helper. Minimum viable: a Done
   button in the keyboard accessory that sets the bound `FocusState` to `nil`.
   `.decimalPad`/`.numberPad` have no return key, so this is the primary
   dismissal affordance.
2. For multi-field decimal forms (e.g. cardio metrics, body measurements), add a
   `@FocusState` enum per form and wire `.focused(...)` on each numeric field so
   Done dismisses and (optionally) so the form can advance focus. Keep this
   per-view and local; do not push focus state into `NeoGymKit`.
3. Leave `OTPCodeField` untouched — it already owns focus/one-time-code.
4. Do not change keyboard types or validation; only add dismissal/focus.

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- Manual: open each touched form on a small device sim (e.g. iPhone SE), focus a
  decimal field, confirm Done dismisses the keyboard and that content under the
  keyboard is reachable. Confirm no regression to scroll/safe-area insets.

**Definition of done:**

- Every listed decimal/number-pad form can dismiss the keyboard via Done.
- App builds. CLAUDE.md "Inputs" / "Inconsistencies" bullets updated to document
  the Done-toolbar convention.

---

### Phase 4 — `SecondaryTabSection.icon` resolution

**Goal:** eliminate the defined-but-unused `icon` mismatch.

**Files:** `App/Components/SecondarySectionBar.swift`,
`App/WorkoutsShellView.swift`, `App/Nutrition/NutritionShellView.swift`,
`App/MeShellView.swift`.

**Decision (recommended): render icons.** Change the segmented `Picker` content
from `Text(section.title)` to `Label(section.title, systemImage: section.icon)`
so the existing `icon` values become meaningful. The bar already caps dynamic
type at `.large` and there are only 3 segments per bar, so width is manageable.

- Keep `.accessibilityLabel("Section")` and ensure each segment still announces
  its title (Label exposes the text to VoiceOver).
- Verify on the narrowest supported device + `.large` type that labels are not
  clipped. **Fallback if clipping is unacceptable:** drop the `icon` requirement
  from the `SecondaryTabSection` protocol and delete the three enum `icon`
  implementations instead (removes dead code, keeps text-only bar). Pick this
  fallback only if rendering review fails; record which path shipped.

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- Manual: Workouts / Nutrition / Me secondary bars on iPhone SE at default and
  `.large` type; confirm no truncation and correct selection behavior.

**Definition of done:**

- `SecondaryTabSection.icon` is either rendered everywhere or fully removed —
  no defined-but-unused requirement remains.
- App builds. CLAUDE.md "App shell and navigation" / "Inconsistencies" bullets
  updated to match the shipped path.

---

### Phase 5 — Glass API honesty (`GlassPanel` / `.glassSurface`)

**Goal:** parameters are honored or removed; existing call-site intent preserved
where safe. This is the one phase with real visual impact, so it is gated behind
a simulator review.

**Files:** `App/Components/GlassPrimitives.swift`,
`Theme/NeoGymTheme.swift` (tokens only if a default needs a named token), and a
diff-audit pass over all `.glassSurface`/`GlassPanel` call sites.

**Decision (recommended): honor the parameters** rather than strip them, because
~26 call sites already encode deliberate `tint`/`stroke`/`shadow`/`cornerRadius`
choices (pill vs card radii, per-tone error tint in `FeedbackBanner`, elevated
callout shadow in the chart). Honoring them restores the intended depth/border/
tint the design language implies, and keeps call sites unchanged.

**Strategy:**

1. Rework `GlassSurfaceModifier.body` to layer, inside the rounded `shape`:
   - background fill: `material.swiftUIMaterial` (or
     `glassFallbackFill`/`secondarySystemBackground` when
     `reduceTransparency`), then a `tint` overlay fill on top;
   - `.overlay(shape.stroke(stroke, lineWidth: NeoGymTheme.hairline))`;
   - conditional shadow when `shadow == true`, using existing
     `NeoGymTheme.glassShadow` + elevation tokens.
   Honor `tint` in the `reduceTransparency` branch too (currently dropped).
2. Rework `GlassPanel` to stop delegating to `GroupBox` and instead apply the
   same surface (reuse `.glassSurface(cornerRadius:material:tint:shadow:)`) so
   its declared params take effect, keeping `contentPadding` behavior. Confirm
   the GroupBox removal doesn't change intrinsic sizing at the 10 call sites.
3. Diff-audit pass: for each call site, the new honored values should match the
   original design intent. Where honoring a param would visibly regress a
   specific surface, fix it at the call site (pass the intended value), not by
   re-muting the API.
4. Provide sensible named defaults in `NeoGymTheme` if any default literal is
   introduced; reuse existing tokens (`glassFill`, `glassStrokeSecondary`,
   `glassShadow`).

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- **Required visual review** on simulator across: auth (Sign in/up,
  Change email sheet), Workouts/Sessions/Exercises lists + a detail, Body trend,
  Journal, Profile, Nutrition Foods/Meals/Plans/Day, the chart callout, and
  `FeedbackBanner` error tint. Compare against pre-change screenshots; confirm
  the change is an intentional restoration of tint/stroke/shadow, not a
  regression (muddy overlays, doubled shadows, contrast loss).
- Verify `accessibilityReduceTransparency` mode in simulator Accessibility
  settings (per CLAUDE.md it can't be forced in previews): tint still applies,
  no transparency leaks.

**Definition of done:**

- `GlassPanel` and `GlassSurfaceModifier` honor every declared parameter (or any
  removed param is gone from the API and all call sites).
- No call site passes an argument the API ignores.
- App builds; visual review sign-off recorded. CLAUDE.md "Theme primitives" /
  "Inconsistencies" bullets updated to state the params are now honored.

---

### Phase 6 — Nutrition glass helper convergence

**Goal:** make the nutrition glass helpers an intentional, documented thin layer
over the now-honest generic primitives (or converge them), avoiding a large
visual refactor.

**Files:** `App/Nutrition/NutritionGlassHelpers.swift`, and a read-only audit of
its consumers (`FoodsViews.swift`, `MealsViews.swift`, `FoodPickerView.swift`,
`MealPickerView.swift`, `FoodDetailAndFormViews.swift`, etc.).

**Decision (recommended): keep them as documented denser wrappers.**
`NutritionGlassSection`, `.nutritionGlassField()`, and `.nutritionGlassCard()`
are already thin wrappers over `.glassSurface(...)` with denser
padding/radius/tint defaults. After Phase 5 they automatically inherit honored
params, so the only work is to confirm they still look right and to document the
intent so the fork is deliberate, not accidental drift.

**Strategy:**

1. After Phase 5, re-review the nutrition surfaces that use these helpers; adjust
   the helper default `tint`/`stroke`/`cornerRadius` only if Phase 5's honored
   rendering changed them undesirably.
2. Confirm the helpers add value beyond a single `.glassSurface` call (denser
   defaults, the titled `NutritionGlassSection` container). If a helper is now a
   pure 1:1 alias of `.glassSurface` with identical args, collapse that one to
   the generic call; keep the ones that carry distinct defaults/structure.
3. Document the intentional density difference in CLAUDE.md.

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- Manual: Nutrition Foods/Meals/Plans/Day + Food/Meal pickers visual check.

**Definition of done:**

- Each nutrition glass helper either carries a distinct, documented purpose or is
  collapsed into the generic primitive. App builds; CLAUDE.md "Theme primitives"
  / "Inconsistencies" bullet for the nutrition fork updated.

---

### Phase 7 — Chart accessibility summaries

**Goal:** VoiceOver users get a useful spoken summary of each chart without
replacing the custom drawing.

**Files:** `App/Components/TimeSeriesChartView.swift`,
`App/Components/TimeSeriesTrendChartView.swift`, and consumers that have the
domain context to phrase a good label (`BodyViews.swift`,
`ExerciseDetailSections.swift`).

**Strategy:**

1. On `TimeSeriesChartView`, collapse the drawing into a single accessibility
   element: `.accessibilityElement(children: .ignore)` plus
   `.accessibilityLabel` (chart name / series names) and `.accessibilityValue`
   summarizing per series: point count, min/max (reuse the existing
   `valueFormatter`), latest value, and first→last trend direction. Derive these
   from the already-computed `nonEmptySeries` / `metricRange` logic.
2. Keep the empty-state `Text(emptyMessage)` naturally accessible.
3. Let consumers pass an optional `accessibilityLabel`/summary override where the
   surrounding screen has better domain phrasing (e.g. "Body weight, last 90
   days"); default to a generic summary built from series names.
4. Optionally expose per-point detail via `AXChart`/`AccessibilityChartDescriptor`
   (iOS 15+) only if cheap; the single-element summary is the required baseline.
   Do not alter the visual rendering, gestures, or callout behavior.

**Tests / checks:**

- `xcodegen generate` + `xcodebuild ... build`.
- Manual: VoiceOver over Body trend chart and an exercise-detail chart; confirm a
  meaningful summary is spoken and the chart is a single, navigable element.

**Definition of done:**

- Both chart entry points expose a VoiceOver summary; custom drawing unchanged.
- App builds. CLAUDE.md "Graphs and summaries" / "Inconsistencies" bullet
  updated to note charts now carry accessibility summaries.

---

## 5. Acceptance criteria

| Criterion | Phase(s) | Verification |
|---|---|---|
| Icon-only buttons have a11y labels | 1 | VoiceOver over nutrition search/clear + audited buttons |
| Shared form-state primitives, targeted adoption, no NeoGymKit change | 2 | No dup progress views; consistent progress/error/disabled; `swift test` green |
| Decimal/number-pad forms dismissable; validation unchanged | 3 | Manual Done-toolbar check; form models untouched |
| `SecondaryTabSection.icon` rendered or removed | 4 | No defined-but-unused requirement; SE + `.large` type check |
| `GlassPanel`/`.glassSurface` honor or drop all params | 5 | No ignored args; simulator visual review + reduceTransparency check |
| Nutrition glass helpers intentional/converged | 6 | Helper audit; nutrition visual check |
| Charts expose VoiceOver summaries; drawing unchanged | 7 | VoiceOver over body + exercise charts |
| Existing visual language + domain flows preserved | all | Per-phase simulator review; diff audit |
| `NeoGymKit` stays SwiftUI/UIKit-free + host-testable | all | `swift build` + `swift test` from `ios/NeoGym` |
| No backend/frontend/schema changes | all | Diff confined to `ios/NeoGym/` |
| Docs kept in sync | all | CLAUDE.md updated in the same phase |
| No generated `.xcodeproj` committed | all | `git status --short` after XcodeGen |

---

## 6. Risks and mitigations

- **Phase 5 silently changes the whole app's look.** Honoring `tint`/`stroke`/
  `shadow` restores depth on ~26 files at once. — *Mitigation:* gate Phase 5
  behind a required simulator visual review across the listed screens; fix
  regressions at the offending call site, not by re-muting the API; keep Phase 5
  isolated from other phases for easy revert.
- **`GlassPanel` GroupBox removal changes layout/sizing.** — *Mitigation:*
  re-check the 10 `GlassPanel` call sites for intrinsic-size/padding shifts.
- **Segmented control truncation in Phase 4 at large type / SE width.** —
  *Mitigation:* test at `.large` on the narrowest device; documented fallback is
  to remove the `icon` requirement instead of rendering.
- **Keyboard toolbar conflicts with existing safe-area insets / sheets.** —
  *Mitigation:* per-form manual check; keep the helper local and opt-in.
- **`swift build`/`swift test` don't compile `App/*.swift`.** — *Mitigation:*
  every app-layer phase's DoD requires the `xcodebuild` simulator build, not
  just package tests.
- **Doc drift.** — *Mitigation:* each phase updates CLAUDE.md in the same commit;
  final pass confirms the "Inconsistencies" section reflects shipped reality.

---

## 7. Open questions

1. **Phase 5 direction confirmation:** honor params (recommended, restores
   intended tint/stroke/shadow — a deliberate but app-wide visual change) vs.
   strip params (keeps today's flatter look, edits all call sites). The plan
   assumes *honor*; confirm this is acceptable given it changes the rendered
   look across many screens.
2. **Phase 4 direction confirmation:** render icons in the segmented bar
   (recommended) vs. delete the `icon` requirement as dead code. Either resolves
   the mismatch; which is preferred?
3. **Phase 2 primitive shape:** a `PrimaryActionButton` wrapper (recommended) vs.
   a `.primaryActionState(isBusy:)` modifier — any house preference?
4. **Phase 7 depth:** is the single-element VoiceOver summary sufficient, or is
   per-point `AccessibilityChartDescriptor` navigation desired now?
5. **"Representative forms" for Phase 2/3 adoption:** the plan picks one form per
   domain area; confirm that's the intended scope vs. adopting across all forms
   immediately.

---

## 8. Follow-ups (out of scope for this plan)

- App-wide adoption of the Phase 2/3 primitives in every remaining form.
- Native UI snapshot tests to lock the Phase 5 visual change.
- Per-point chart accessibility navigation if the Phase 7 baseline proves
  insufficient.

---

<!-- Plan authored by model: claude-opus-4-8 (NeoGym planning architect). -->
**Plan authored by:** claude-opus-4-8 (planning architect). No code was edited;
this document is the deliverable.
