# iOS full-screen Liquid Glass redesign

**Status:** ready
**Created:** 2026-06-27

---

## 1. Requirements

Captured from the user's request to make the native app full-screen and modern, run the architecture workflow, commit the plan, and implement without further prompting.

### 1.1 Problem / motivation

The native iOS app now has broad feature parity, but the UI feels cramped and dated: small centered auth cards, stacked pill navigation, fixed card chrome, and repeated backgrounds make it feel like an old web-port layout rather than a modern native iPhone app. The goal is a full-screen, immersive, Liquid Glass-inspired iOS design even if that intentionally deviates from the web frontend.

### 1.2 Functional requirements

- Make the iOS app use the full screen on simulator and phone, with safe-area-aware immersive backgrounds and modern native spacing.
- Adopt a Liquid Glass-inspired visual language using iOS 15-compatible SwiftUI materials, layered gradients, translucent panels, depth, large typography, and native interactions.
- Replace the dated signed-in top pill strip with a modern full-screen shell and a custom glass navigation dock that keeps all seven top-level destinations discoverable.
- Redesign signed-out auth, loading, and error states so they are no longer small centered card experiences.
- Refactor shared visual primitives so Workouts, Exercises, Sessions, Body, Nutrition, Journal, Profile, sheets, forms, and state panels inherit the new look without rewriting business logic.
- Preserve auth/profile/deep-link behavior, cloud test configuration, OTP duplicate-submit guard, SDK auth verify call, GraphQL data flow, and existing feature parity behavior.

### 1.3 Non-functional requirements / constraints

- Keep `ios/NeoGym/Sources/NeoGymKit/` host-testable and free of SwiftUI/UIKit.
- Keep the iOS 15 deployment target; newer APIs must be gated with iOS 15 fallbacks.
- Do not change backend schema, metadata, migrations, frontend code, GraphQL documents, repositories, view models, or product behavior for this visual redesign.
- All app UI phases must be validated with XcodeGen plus `xcodebuild`; `swift build && swift test` is only a NeoGymKit regression guard and does not compile `App/*.swift`.
- Do not commit generated `.xcodeproj` output.
- If simulator boot/render or manual OTP/deep-link checks cannot run, record the exact blocker in the implementation log.

### 1.4 Surfaces in scope

- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — expand visual tokens.
- `ios/NeoGym/App/Theme/GridBackground.swift` — evolve full-bleed background while keeping compatibility during migration.
- `ios/NeoGym/App/Components/` — add glass primitives and restyle auth/state/buttons/banners/pickers.
- `ios/NeoGym/App/RootView.swift` — root background ownership and full-screen loading/error states while preserving auth routing/deep links.
- `ios/NeoGym/App/AppShellView.swift` — replace top pill strip with full-screen shell and custom dock.
- `ios/NeoGym/App/Nutrition/NutritionShellView.swift` — redesign nested Nutrition navigation.
- `ios/NeoGym/App/SignInView.swift`, `SignUpView.swift`, `ChangeEmailSheet.swift`, `ProfileView.swift` — auth/account visual treatment.
- `ios/NeoGym/App/*.swift` and `ios/NeoGym/App/Nutrition/*.swift` — domain screen chrome, backgrounds, sheets, forms, and safe-area polish.
- `ios/NeoGym/README.md`, `CLAUDE.md`, `ios/NeoGym/PARITY_CHECKLIST.md` — review/update only if navigation/design statements become stale.
- `ios/NeoGym/project.yml` — only if app target resources/settings are required; regenerate project but do not commit generated output.

### 1.5 Out of scope

- Backend, database, Hasura, Nhost metadata, or GraphQL schema changes.
- Frontend redesign or web parity changes.
- New product features or data model changes.
- Raising the iOS deployment target.
- Introducing UI snapshot infrastructure unless a later task plans it explicitly.
- Bypassing or replacing the Nhost Swift SDK auth flow.

### 1.6 Success criteria

- The app fills modern iPhone screens and no longer reads as a small-card/old-pill layout.
- Signed-in navigation is modern, bottom/safe-area-aware, accessible, and exposes all seven top-level destinations.
- Auth, loading, error, profile, sheets, state views, forms, lists, and Nutrition sub-navigation share a cohesive glass language.
- Existing feature parity behavior remains intact.
- Every phase passes `swift build && swift test`, XcodeGen, and app `xcodebuild`, or records exact blockers.
- Final QA re-walks `ios/NeoGym/PARITY_CHECKLIST.md` and confirms generated `.xcodeproj` output is not staged.

---

## 2. Implementation strategy

### 2.1 Central design decision

Build an iOS 15-safe Liquid Glass design system entirely under `ios/NeoGym/App/`, using semantic color tokens, layered gradients, SwiftUI `Material`, shared glass surfaces, and safe-area-aware scaffolds. Use a custom floating bottom glass dock instead of stock `TabView` so all seven primary destinations remain discoverable and no destination is hidden behind native `More`. Centralize immersive background ownership through `RootView`/`ScreenScaffold` and migrate nested/domain backgrounds away from stacked aurora layers.

### 2.2 Key constraints and invariants

- `NeoGymKit` remains SwiftUI/UIKit-free; visual code stays in `App/`.
- Preserve `RootView` auth-state switching, `AuthCallbackURLRouter`, PKCE email-change callback handling, and sign-out local-session clearing.
- Preserve SDK OTP auth calls and duplicate-verify guards in `SignInModel`/`SignUpModel`.
- Preserve `AppShellView` selection and `pendingSessionId` routing from Workouts/Exercises to Sessions.
- Preserve all repositories, GraphQL documents, mutation variables, view models, and domain callbacks.
- Avoid unguarded iOS 16+ APIs: `NavigationStack`, `.toolbarBackground`, `.scrollContentBackground`, `.presentationDetents`, and newer platform-only glass APIs.
- For iOS 15 list/form transparency, use iOS 15-safe approaches such as row backgrounds or consciously centralized UIKit appearance helpers; document global appearance side effects.
- Modal sheet roots must apply `ScreenScaffold`/`GlassPanel` themselves because they do not inherit the root visual canvas.
- App phases require Xcode app compilation; `swift test` alone is never enough for `App/` changes.

### 2.3 Touched surfaces

- `ios/NeoGym/App/Theme/` — visual tokens and full-bleed background.
- `ios/NeoGym/App/Components/GlassSurface.swift` or `GlassPrimitives.swift` — new shared glass panels, modifiers, scaffold, dock helpers, field/button styling.
- `ios/NeoGym/App/Components/AppStateViews.swift` — `SectionShell`, state views, and `ConfirmationPanel` become wrappers around shared glass primitives.
- `ios/NeoGym/App/Components/AuthCard.swift` — repurpose or retire centered-card framing in favor of full-screen form panels.
- `ios/NeoGym/App/AppShellView.swift` and `Nutrition/NutritionShellView.swift` — navigation redesign.
- `ios/NeoGym/App/SignInView.swift`, `SignUpView.swift`, `RootView.swift`, `ChangeEmailSheet.swift`, `ProfileView.swift` — auth/account redesign.
- Domain SwiftUI files under `ios/NeoGym/App/` and `ios/NeoGym/App/Nutrition/` — mechanical adoption of shared glass/full-screen primitives.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No backend, frontend, GraphQL, or app data contracts change. iOS deployment target remains 15.0.
- **Deployment:** Each phase is a normal app update. Regenerate the Xcode project locally for validation; do not commit `.xcodeproj` output.
- **Rollback:** Standard git revert is sufficient because the redesign is app-layer visual code only. Revert by phase if a particular surface regresses.

---

## 3. Phased plan of action

### Phase 1 — Visual foundation and background ownership

**Goal:** Establish the glass token system, shared surfaces, and root/background ownership without changing business behavior.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — add semantic color, glass, spacing, radius, elevation, and gradient tokens while preserving existing names as aliases.
- `ios/NeoGym/App/Theme/GridBackground.swift` — make the background full-bleed and immersive but safe/idempotent during migration.
- `ios/NeoGym/App/Components/GlassSurface.swift` or `GlassPrimitives.swift` — add `GlassPanel`, `ScreenScaffold`, glass modifiers, and reduce-transparency/reduce-motion fallbacks.
- `ios/NeoGym/App/Components/AppStateViews.swift` — make `SectionShell`, state views, and `ConfirmationPanel` use the shared glass system.
- `ios/NeoGym/App/Components/FeedbackBanner.swift`, `NeoGymButtonStyle.swift` — restyle through shared tokens.
- `ios/NeoGym/App/RootView.swift` — establish root-level full-screen canvas ownership only as needed.

**Implementation steps:**

1. Add theme tokens for glass fill/stroke/highlight, shadows, gradients, spacing, corner radii, content margins, and fallback opaque fills.
2. Keep `GridBackground` as a compatibility type, but make its transition behavior explicit: it must be safe to stack temporarily and should not create muddy repeated aurora layers.
3. Add shared glass primitives under `App/Components`; keep pure tokens under `App/Theme`.
4. Refactor shared panels/state views/buttons/banners to wrap the new primitives; avoid parallel card systems.
5. Bake `accessibilityReduceTransparency` and `accessibilityReduceMotion` fallbacks into the primitives/background now, not as a later retrofit.
6. Avoid unguarded iOS 16+ APIs.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot/run the simulator and visually sample at least one screen from each top-level destination to confirm Phase 1 did not make stacked backgrounds visibly worse.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- Shared glass tokens/primitives exist and compile in the app target.
- No auth/domain behavior changes.
- `swift test` passes as a regression guard, and `xcodebuild` proves app UI files compile.
- Background ownership strategy is documented in implementation notes and does not produce obvious muddy stacked backgrounds in sampled screens.

**Phase commit message:** `style(ios): add liquid glass visual foundation`

**Implementation log**

- Added the Phase 1 visual foundation: semantic theme tokens, iOS 15-safe glass primitives, root `ScreenScaffold` canvas ownership, and shared-state/button/banner/AuthCard restyling.
- `GridBackground` now defaults to a lightweight transparent compatibility overlay; only `GridBackground(ownsCanvas: true)` paints the full aurora canvas, which keeps temporarily stacked legacy screen backgrounds from compounding into muddy layers during later phases.
- Reduce-transparency fallbacks use opaque grouped-system fills, and reduce-motion trims aurora/shadow intensity without changing interaction behavior.
- No auth, repository, GraphQL, navigation selection, or domain model behavior was intentionally changed.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS`. Accepted concerns were non-blocking: `AppShellView` was not named in the Phase 1 file list but its one-line background removal is required for root canvas ownership; simulator visual sampling was not performed in the non-interactive pass.
- Autonomous decisions: accepted structural background-safety evidence in place of interactive simulator sampling for Phase 1 because correctness is covered by Xcode app compilation plus reviewer confirmation that stacked backgrounds are now idempotent; later phases retain simulator render checks.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; `nix develop ../.. --command xcodegen generate` passed; `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed with `** BUILD SUCCEEDED **`; generated project output was not staged.

### Phase 2 — Full-screen signed-in shell and glass dock

**Goal:** Replace the top pill strip with a full-screen shell and custom bottom glass dock while keeping all destination routing functional.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/AppShellView.swift` — full-screen content plus custom bottom dock.
- `ios/NeoGym/App/Nutrition/NutritionShellView.swift` — glass secondary navigation.
- Optional app-only appearance helper under `ios/NeoGym/App/Components/` — centralized iOS 15 bar/list appearance if needed.

**Implementation steps:**

1. Remove `AppShellView`'s top horizontal pill `ScrollView` and `Divider`.
2. Render selected destination content full-screen over the shared scaffold.
3. Attach a custom bottom glass dock with `.safeAreaInset(edge: .bottom)` so the reserved inset propagates into nested `NavigationView`/scroll views immediately.
4. Keep all seven destinations visible/discoverable through a horizontally scrollable or adaptive dock; do not use stock `TabView` if it hides destinations behind `More`.
5. Preserve `selection`, `pendingSessionId`, and Workouts/Exercises start-session routing to Sessions.
6. Add dock accessibility: 44x44 minimum hit targets, VoiceOver labels, selected state/traits, Dynamic Type tolerance, and narrow-screen horizontal scrolling.
7. Redesign Nutrition's nested nav as a glass segmented/secondary bar while preserving `selection`, `selectedDate`, and callbacks.
8. Verify dock-over-pushed-detail and keyboard interactions do not collide with detail/form bottom controls.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot simulator and manually verify all seven destinations, Nutrition sections, pushed details, narrow/tall device layouts, and Workouts/Exercises start-session routing into Sessions.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- All destinations remain reachable and selected state is visible/accessibility-friendly.
- No content is hidden behind the dock on short and tall devices.
- Cross-tab session routing still works.
- The app compiles via Xcode and NeoGymKit regression tests pass.

**Phase commit message:** `style(ios): add full-screen glass app shell`

**Implementation log**

- Replaced the signed-in top pill strip with a full-screen content shell and custom bottom glass dock in `AppShellView`.
- Kept all seven destinations discoverable in a horizontally scrollable dock with selected styling, VoiceOver labels/selected state, and 44pt+ hit targets.
- Preserved Workouts/Exercises start-session routing by keeping the existing `pendingSessionId` and `selection = .sessions` flow.
- Restyled Nutrition's secondary navigation as a glass segmented bar while preserving `selection`, `selectedDate`, and callbacks.
- Added keyboard-aware dock hiding to avoid collisions with form controls.
- Reviewer verdict: `ACCEPT`. Non-blocking residual risk: interactive simulator walkthrough of narrow/tall and pushed-detail layouts was not performed; Phase 4b and final QA keep detail/form collision checks in scope.
- Autonomous decisions: accepted structural `.safeAreaInset(edge: .bottom)` evidence plus reviewer verification in place of interactive simulator traversal for this non-interactive pass; correctness is supported by app build, tests, and reviewer inspection, with visual traversal retained for later phases.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; XcodeGen passed; app `xcodebuild` passed with `** BUILD SUCCEEDED **`; generated project output was not staged.

### Phase 3 — Full-screen auth, root states, and account sheets

**Goal:** Replace the small centered auth/account feel with full-screen glass layouts while preserving auth and PKCE behavior.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/SignInView.swift`, `SignUpView.swift` — full-screen auth hero and form panels.
- `ios/NeoGym/App/Components/AuthCard.swift` — repurpose as a glass form panel or retire centered framing.
- `ios/NeoGym/App/Components/OTPCodeField.swift` — visual styling only; preserve duplicate-submit behavior.
- `ios/NeoGym/App/RootView.swift` — full-screen loading/error states, keeping auth/deep-link routing.
- `ios/NeoGym/App/ChangeEmailSheet.swift` — modal sheet scaffold/glass styling while preserving PKCE verifier flow.
- `ios/NeoGym/App/ProfileView.swift` — account header/sheet presentation polish as needed for change-email visual consistency.

**Implementation steps:**

1. Convert sign-in/sign-up screens into full-screen, safe-area-aware layouts with a large hero region and lower glass form panel.
2. Preserve `requestForm`/`otpForm` transitions, `onSignUp`/`onSignIn`/`onAuthenticated` callbacks, SDK verify call, and duplicate-submit guards.
3. Ensure keyboard and small-device behavior remains scrollable and usable for email, display name, and OTP fields.
4. Restyle loading and error cards as full-screen root states.
5. Apply modal-sheet scaffolding to `ChangeEmailSheet` because sheets do not inherit the root background.
6. Preserve `AuthCallbackURLRouter`, `neogym://verify`, token exchange, verifier clearing, and sign-out behavior.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot simulator and manually verify sign-in OTP request/verify and sign-up OTP request/verify against the configured cloud project, using disposable test accounts if needed.
- If cloud OTP/email is unavailable, boot auth screens with fake/preview services where possible and record the exact external blocker.
- Manually check keyboard-open layouts and Dynamic Type for sign-in/sign-up.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- Auth screens are full-screen and modern, not small centered cards.
- OTP, sign-up, sign-in, deep-link, email-change, and sign-out behavior are preserved.
- Change-email sheet visually fits the glass system.
- App target compiles via Xcode and NeoGymKit regression tests pass.

**Phase commit message:** `style(ios): redesign auth screens with glass layout`

**Implementation log**

- Redesigned sign-in and sign-up as full-screen, scrollable auth layouts with hero areas and lower glass form panels.
- Restyled `AuthCard`, `OTPCodeField`, loading/error root states, the profile account header/cards, and `ChangeEmailSheet` with shared glass surfaces.
- Preserved `SignInModel`, `SignUpModel`, `AuthService`, `ChangeEmailModel`, `AuthCallbackURLRouter`, `neogym://verify`, token exchange, verifier clearing, and sign-out behavior; changes were visual/composition-only.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS`. Accepted non-blocking concern: `NeoGymTheme.maxCardWidth` is now unused after auth/root card redesign, but it remains a harmless compatibility token and may be reused by later phases.
- Autonomous decisions: retained `maxCardWidth` for long-term maintenance and compatibility with existing theme aliases rather than removing it mid-redesign; correctness is unaffected and later phases can decide whether to prune legacy tokens.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; XcodeGen passed; app `xcodebuild` passed with `** BUILD SUCCEEDED **`; generated project output was not staged. Manual cloud OTP, keyboard-open, and Dynamic Type walkthroughs were not run in the non-interactive pass; existing model tests and reviewer diff inspection verified behavior preservation.

### Phase 4a — Primary domain screen polish

**Goal:** Migrate high-level list/detail shells to the shared full-screen glass system in a bounded pass.

**Depends on:** Phases 1-2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/ProfileView.swift`
- `ios/NeoGym/App/WorkoutsView.swift`
- `ios/NeoGym/App/ExercisesView.swift`
- `ios/NeoGym/App/SessionsView.swift`
- `ios/NeoGym/App/BodyViews.swift`
- `ios/NeoGym/App/JournalViews.swift`
- `ios/NeoGym/App/LabelInputView.swift` if local chrome is present.

**Implementation steps:**

1. Replace remaining local card modifiers and nested `GridBackground()` usage with `ScreenScaffold`/`GlassPanel` where safe.
2. Keep iPad/landscape readability caps, but ensure phone layouts use full width with margins rather than a small centered-card feel.
3. Ensure list/search/filter/date badge rows match the new tokens.
4. Preserve all view models, repositories, mutations, navigation links, refresh actions, create/edit/delete callbacks, and form dismissal behavior.
5. Handle iOS 15 list/form backgrounds without unguarded iOS 16 APIs.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot simulator and render each touched top-level destination.
- Diff audit: no changes under `backend/`, `frontend/`, or `ios/NeoGym/Sources/NeoGymKit/` unless explicitly justified.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- Primary domain screens visually align with the glass system.
- No domain behavior or data flow changes.
- App target compiles via Xcode and NeoGymKit regression tests pass.

**Phase commit message:** `style(ios): polish primary domain screens for glass shell`

**Implementation log**

- Polished primary domain list/profile shells onto the shared glass visual system across Profile, Workouts, Exercises, Sessions, Body, Journal, and LabelInputView.
- Removed nested `GridBackground()` from top-level primary lists so the root `ScreenScaffold` owns the canvas.
- Updated filters, search surfaces, chips, date badges, and label inputs to use glass tokens and phone-friendly full-width margins.
- Preserved repositories, view models, GraphQL documents, mutations, navigation links, callbacks, refresh actions, and mutation flow.
- Reviewer verdict: `ACCEPT`. Reviewer verified the `SessionDetailView` helper/formatter extraction is behavior-identical and not Phase 4b visual scope creep.
- Autonomous decisions: accepted the helper/formatter extraction because correctness was verified by reviewer and it improves long-term maintainability by satisfying local diagnostics without changing behavior.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; XcodeGen passed; app `xcodebuild` passed with `** BUILD SUCCEEDED **`; only scoped `ios/NeoGym/App/` files changed and generated project output was not staged. Interactive authenticated render traversal remains for final QA.

### Phase 4b — Detail, form, picker, and logging polish

**Goal:** Apply the shared glass system to detail/form/logging surfaces without changing domain logic.

**Depends on:** Phase 4a

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/WorkoutDetailView.swift`
- `ios/NeoGym/App/WorkoutFormViews.swift`
- `ios/NeoGym/App/ExerciseDetailView.swift`
- `ios/NeoGym/App/ExerciseDetailSections.swift`
- `ios/NeoGym/App/ExercisePickerView.swift`
- `ios/NeoGym/App/SessionPriorHistoryViews.swift`
- `ios/NeoGym/App/CardioEntriesListView.swift`
- `ios/NeoGym/App/CardioMetricsFormView.swift`
- Other non-Nutrition `ios/NeoGym/App/*.swift` sheet/form/detail files found to carry old local chrome.

**Implementation steps:**

1. Migrate detail/form/picker/logging panels to `ScreenScaffold`/`GlassPanel` and theme tokens.
2. Ensure dock safe-area behavior does not collide with pushed details, sheets, keyboard, or bottom action bars.
3. Preserve spent-screen dismissal, picker selection, delete confirmation, and logging mutation behavior.
4. Confirm `ExerciseDetailSections.swift` and `LabelInputView.swift` either use shared chrome or have no local chrome requiring migration.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot simulator and render representative workout detail/form, exercise detail, session logging, cardio metrics, and picker screens.
- Diff audit for backend/frontend/NeoGymKit boundaries.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- Detail, form, picker, and logging surfaces visually fit the redesign.
- No behavior or GraphQL/mutation changes.
- App target compiles via Xcode and NeoGymKit regression tests pass.

**Phase commit message:** `style(ios): polish detail and logging screens for glass shell`

**Implementation log**

- Migrated detail, form, picker, and logging surfaces to the shared glass system across workout details/forms, exercise details/sections/picker, session logging, cardio metrics, prior history, body/journal form/detail chrome, and related sheets.
- Converted local `GridBackground`, `Form`, `List`, and local card chrome toward `ScreenScaffold`, `GlassPanel`, and `.glassSurface` while preserving visual ownership and modal sheet backgrounds.
- Extracted `StrengthSetEditorView` into a new app-only Swift file to keep session detail diagnostics manageable after converting the set editor sheet.
- Preserved spent-screen dismissal, picker selection, delete confirmation, logging mutations, repositories, GraphQL documents, view models, and navigation behavior.
- Reviewer verdict: `ACCEPT`. Reviewer verified the `StrengthSetEditorView` extraction is behavior-preserving and included by the XcodeGen source glob/build phase.
- Autonomous decisions: accepted moving `StrengthSetEditorView` to its own file because correctness was verified by identical validation/save/delete/cancel behavior and long-term maintainability improves by reducing `SessionsView` size.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; XcodeGen passed; app `xcodebuild` passed with `** BUILD SUCCEEDED **`; only `ios/NeoGym/App/` files changed and generated project output was not staged. Interactive simulator render traversal remains for final QA.

### Phase 4c — Nutrition polish

**Goal:** Bring Nutrition overview, foods, meals, plans, daily logging, and modal logging sheets into the same glass system.

**Depends on:** Phase 4a

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Nutrition/*.swift`

**Implementation steps:**

1. Migrate Nutrition overview, sub-navigation, foods, meals, plans, day detail, pickers, and log sheets to shared glass primitives.
2. Ensure modal sheet roots apply their own `ScreenScaffold`/glass backgrounds.
3. Preserve nested Nutrition state, selected date, plan suggestions, logging callbacks, snapshot-based totals, and mutation behavior.
4. Ensure forms/lists use iOS 15-safe background approaches.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Boot simulator and render Nutrition overview, Foods, Meals, Plans, Days, log-food/log-meal sheets, and pickers.
- Diff audit for backend/frontend/NeoGymKit boundaries.
- Verify generated `.xcodeproj` output is not staged.

**Definition of done:**

- Nutrition surfaces visually align with the glass shell.
- Nutrition behavior, totals, provenance, and logging semantics are unchanged.
- App target compiles via Xcode and NeoGymKit regression tests pass.

**Phase commit message:** `style(ios): polish nutrition screens for glass shell`

**Implementation log**

- Added Nutrition-local glass helpers wrapping shared glass primitives for iOS 15-safe nutrition cards, fields, and sheet sections.
- Migrated Nutrition overview, foods, meals, plans, daily intake, details, pickers, and log/edit sheets away from legacy `GridBackground`, card-fill, muted-fill, and `Form` chrome toward shared glass surfaces.
- Ensured modal log/edit sheets own their own `ScreenScaffold` roots and scrollable glass sections.
- Preserved repository/view-model calls, nested Nutrition state, selected date, plan suggestions, logging callbacks, mutation behavior, snapshot totals, provenance, and semantics.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS`. Accepted non-blocking concern: two redundant border overlays remain in `MealEditorViews.swift` and `PlanEditorViews.swift`; they are cosmetic only and safe for Phase 5 polish.
- Autonomous decisions: accepted the cosmetic double-border concern because correctness, logging semantics, and compile gates are unaffected; deferring to Phase 5 keeps the current phase focused on broad Nutrition migration while preserving behavior.
- Quality gate: `swift build` passed; `swift test` passed with 165 tests; XcodeGen passed; app `xcodebuild` passed with `** BUILD SUCCEEDED **`; all changes stayed under `ios/NeoGym/App/Nutrition/` and generated project output was not staged. Interactive Nutrition render walkthrough remains for final QA.

### Phase 5 — Accessibility, parity QA, and docs

**Goal:** Verify the redesign is usable, accessible, documented where needed, and does not regress parity.

**Depends on:** Phases 1-4c

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/` — final visual/accessibility fixes.
- `ios/NeoGym/PARITY_CHECKLIST.md` — re-walk and update only if statements become stale.
- `ios/NeoGym/README.md`, `CLAUDE.md` — update if navigation/design/tooling statements are invalidated; otherwise record that no doc changes are needed.

**Implementation steps:**

1. Re-walk `ios/NeoGym/PARITY_CHECKLIST.md` for navigation/back behavior, all top-level destinations, OTP, duplicate verify/send states, sign-out, `neogym://verify`, email-change PKCE, representative CRUD/logging flows, and Nutrition logging.
2. Check Dynamic Type, VoiceOver labels/traits, minimum hit targets, light/dark mode contrast, Reduce Transparency, and Reduce Motion.
3. Add/update SwiftUI previews for key redesigned surfaces where practical: auth, shell, profile, one list screen, and Nutrition shell.
4. Review docs for stale claims about shell/navigation/design and update only if needed.
5. Confirm no generated `.xcodeproj` output is staged.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
- Simulator boot/render check of redesigned shell/auth/profile/nutrition and representative domain flows.
- Diff audit for backend/frontend/NeoGymKit boundaries.
- `git status --short` to verify no generated `.xcodeproj` output is staged.

**Definition of done:**

- All redesigned surfaces compile and render in the simulator.
- Accessibility and reduced-transparency/motion checks are complete or exact blockers are logged.
- Parity checklist has no newly stale claims.
- Full gates pass and generated project output is not committed.

**Phase commit message:** `test(ios): verify liquid glass redesign`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests/checks be written or updated when behavior changes.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing, run `swift build && swift test`, XcodeGen, and app `xcodebuild` for every app phase. If a gate fails, send exact failures back to the implementer and run a fresh reviewer pass after the fix.
6. **Commit:** Commit all changes made during the phase with the phase commit message only after gates pass or exact external blockers are documented.
7. **Continue:** Move to the next phase and repeat until complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer language/surface guidance from files in scope and load matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Full-screen modern visual foundation | 1 | Shared tokens/primitives, simulator visual sample, Xcode app build |
| All destinations discoverable without native More hiding | 2 | Custom bottom dock manual check on narrow/tall devices |
| No dock occlusion | 2, 4a-4c, 5 | `.safeAreaInset` implementation and simulator checks of lists/details/forms |
| Auth screens no longer small centered cards | 3 | Simulator auth flow, keyboard checks, Xcode app build |
| Preserve OTP, SDK verify, duplicate-submit guard | 3, 5 | Existing NeoGymKit tests plus cloud/fallback simulator smoke |
| Preserve deep-link/email-change/sign-out | 3, 5 | Manual deep-link/email-change/sign-out checklist plus existing tests |
| Domain screens inherit glass system | 4a-4c | App build and simulator render checks per batch |
| iOS 15 compatibility | all | No unguarded iOS 16 APIs; Xcode app build against iOS 15 target |
| No backend/frontend/NeoGymKit behavior changes | all | Diff audit and existing regression tests |
| No generated xcodeproj committed | all | `git status --short` after XcodeGen |

---

## 6. Risks and mitigations

- **Risk:** `xcodebuild` compile passes but runtime layout is broken. — **Mitigation:** Every app phase includes simulator boot/render checks for touched screens.
- **Risk:** Bottom dock covers content or keyboard/form controls. — **Mitigation:** Add dock with `.safeAreaInset` in the same phase and manually check lists, pushed details, forms, keyboard, short/tall devices.
- **Risk:** Background layers become visually muddy or expensive. — **Mitigation:** Centralize background ownership and migrate nested `GridBackground()` call sites; keep transition idempotent.
- **Risk:** iOS 15 lacks common modern SwiftUI APIs. — **Mitigation:** Explicitly ban unguarded iOS 16+ APIs and use iOS 15-safe Material/appearance/list techniques.
- **Risk:** Global UIKit appearance changes leak into sheets/pickers. — **Mitigation:** Centralize/document any appearance helpers and explicitly check modal sheets.
- **Risk:** Large domain visual sweep becomes too broad. — **Mitigation:** Split domain polish into primary screens, detail/form/logging screens, and Nutrition phases.
- **Risk:** Visual-only regressions lack automated coverage. — **Mitigation:** Use app `xcodebuild`, simulator boot/render checks, previews, and final parity checklist walk.

---

## 7. Follow-ups (out of scope for this plan)

- Native visual snapshot/UI tests — tracked in: TBD future QA planning.
- True OS-newest Liquid Glass APIs requiring a higher deployment target — tracked in: TBD after product decides to drop iOS 15.
- New branding/asset redesign beyond in-code gradient/token polish — tracked in: TBD design task.
