# CLAUDE.md

Guidance for future Claude Code sessions working inside `ios/NeoGym`.

## What this is

Native SwiftUI shell for NeoGym plus the host-testable `NeoGymKit` package.
The app uses the same email OTP auth shape as the web app for sign-in/sign-up.
`NeoGymKit` owns validators, auth/session models, repositories, domain view
models, and testable form validation; SwiftUI under `App/` owns layout,
navigation, and presentation.

## Commands

Run these from `ios/NeoGym/`:

The `NeoGym` app target is iOS 26-only. Keep `NeoGymWidgets` and the
host-testable `NeoGymKit` package at their lower deployment floors unless their
own code needs newer APIs.

- `swift build` — build the host-compatible `NeoGymKit` package. Keep
  SwiftUI/UIKit out of `Sources/NeoGymKit` so this works on macOS.
- `swift test` — run deterministic package tests against fakes; do not require
  a live Nhost backend, real Keychain, or writable HealthKit data for unit
  tests.
- `nix develop ../.. --command xcodegen generate` — regenerate
  `NeoGym.xcodeproj` from `project.yml` after adding/removing Swift app files.
  Keep `project.yml` as the source of truth and do not commit generated
  `.xcodeproj` output.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — build the SwiftUI app for a simulator
  destination.

If an inherited Nix shell exports `DEVELOPER_DIR`/`SDKROOT` to an older
`apple-sdk` and `swift build`/`swift test` fail with an SDK/compiler mismatch,
rerun the Swift/Xcode checks from a clean Xcode environment (for example via
`xcrun swift ...` with Xcode's `DEVELOPER_DIR`) rather than treating it as an app
compile failure. For `xcodebuild`, also unset Nix toolchain overrides such as
`SDKROOT`, `CC`, `CXX`, `LD`, `AR`, and `LDFLAGS`; leaving `LD=ld` can make the
simulator link step fail with `ld: -objc_abi_version '-Xlinker' not supported`.
When invoking `xcodebuild` through `nix develop --command`, put the cleanup `env
-u ...` both before `nix develop` and immediately after `--command` if the shell
reintroduces linker variables.

Keep `App/LaunchScreen.storyboard` wired through `UILaunchStoryboardName` in
both `App/Info.plist` and `project.yml`. Removing it can make the app run
letterboxed on current devices.

The package depends on the local Nhost Swift SDK at
`../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
directory. Update `Package.swift` and docs together if that workspace assumption
changes.

## Auth and app-shell invariants

- Sign-in/sign-up use email OTP, no password. Native email change uses app-side
  PKCE with `redirectTo = "neogym://verify"`, a Keychain-backed verifier,
  `.onOpenURL` deep-link handling, token exchange, and verifier clearing on all
  callback outcomes.
- The native callback must be allowed by `auth.redirections.allowedUrls` in both
  `backend/nhost/nhost.toml` and the production overlay. Restart local Nhost
  after redirect config edits because the CLI does not hot-reload `nhost.toml`.
- Sign-out must always call `clearSession()` after attempting remote sign-out so
  local persisted sessions are removed even when the network request fails.
- SwiftUI previews can set Dynamic Type with
  `.environment(\.dynamicTypeSize, ...)`, but Xcode 17 treats
  `accessibilityReduceTransparency` and `accessibilityReduceMotion` as read-only
  environment values; verify those modes in simulator Accessibility settings.

## Native iOS design guide

When editing SwiftUI under `App/`, keep the existing native design language
intact instead of inventing one-off styles.

- **App shell and navigation**: the signed-in app has three primary root areas
  (Workouts, Nutrition, Me). There is NO `TabView`: `AppShellView` hosts the
  three areas keep-warm as a ZStack of per-area `NavigationStack(path:)` views
  keyed by `@State selection: AppDestination`. The active area is shown; the
  others stay mounted but `opacity(0)`, `accessibilityHidden(true)`, and
  `allowsHitTesting(false)` so each area's typed stack path survives area
  switches. New pushed flows should use the existing root route enums instead of
  hidden `NavigationLink` state. Areas are switched with a segmented `Picker`
  (`.pickerStyle(.segmented)`, 44pt) bound to the shell
  `selection`; it is shown at each area's stack root only and disappears when a
  route is pushed. **Workouts (Phase 2a, shipped):** `WorkoutsSectionNavigationView`
  is now a HUB — its root is a native `List` of glass rows (Sessions / Workouts /
  Exercises, each with SF Symbol + title + chevron, ≥44pt, accessibility labels)
  that PUSH subsection-list routes (`WorkoutsRoute.sessionsList` /
  `.workoutsList` / `.exercisesList`) rendered through
  `.navigationDestination(for:)`, each with its own inline `navigationTitle`. The
  area segmented `Picker` lives in the hub's nav-bar **principal** slot (chosen
  over `.safeAreaInset` so there is exactly one top row: the segmented control
  replaces the inline title text, while `navigationTitle("Workouts")` still labels
  the back button on pushed subsections). No area uses
  `SecondarySectionContentHost` or `SectionTitleMenu` anymore (both types, along
  with `AppAreaSwitcher` and the interim `.safeAreaInset` switcher, have been
  deleted). "New workout" lives on
  the `.workoutsList` route's own `.bottomBar` via `RootPrimaryActionToolbar`.
  The `pendingSessionId` deep link is consumed at the `WorkoutsSectionNavigationView`
  root (`.task` initial check + `.onChange`) calling `openSession(...)`, so a
  pending session opens regardless of which subsection (if any) is showing;
  `SessionsListView` no longer takes that binding. **Nutrition (Phase 2b,
  shipped):** `NutritionNavigationView` mirrors the Workouts hub — its root is a
  native `List` of the same glass rows (`NutritionHubRow`: Overview / Days /
  Plans / Foods / Meals, each SF Symbol + title + chevron, ≥44pt, accessibility
  labels) that PUSH subsection-list routes (`NutritionRoute.overview` /
  `.daysList` / `.plansList` / `.foodsList` / `.mealsList`) via
  `.navigationDestination(for:)`, each with its own inline `navigationTitle`. The
  area segmented `Picker` lives in the Nutrition hub's nav-bar **principal**
  slot, matching 2a exactly. New plan / New food / New meal live on their
  subsection list's own `.bottomBar` via `RootPrimaryActionToolbar` (not
  shell-owned). The Overview screen (a pushed route) cross-links by PUSHing
  routes: `openSection(section)` appends that section's subsection-list route and
  `openDay(date)` appends `.day(date)` (DailyIntakeView) directly — there is no
  more `selectedDate` handoff, so `NutritionDaysView` no longer takes a
  `selectedDate` binding. Post-create, the create view pops itself via
  `dismiss()` (removing the top create route) and the shell's
  `openRouteAfterCurrentTransition(_:)` appends the detail route on the next
  runloop tick (e.g. `[.foodsList, .foodCreate]` → `[.foodsList]` →
  `[.foodsList, .foodDetail(id)]`) so Back returns to the subsection list, not
  the hub. Do not re-add a `removeLast()` there — the create view's `dismiss()`
  already removes the create route, so an extra pop would strand Back on the hub. **Me (hub, shipped):**
  `MeNavigationView` mirrors the Workouts/Nutrition hubs — its root is a native
  `List` of the same glass rows (`MeHubRow`: Profile / Body / Journal, each SF
  Symbol + title + chevron, ≥44pt, accessibility labels) that PUSH
  subsection-list routes (`MeRoute.profile` / `.bodyList` / `.journalList`) via
  `.navigationDestination(for:)`, each with its own inline `navigationTitle`. The
  area segmented `Picker` lives in the Me hub's nav-bar **principal** slot,
  matching 2a/2b exactly. Log measurement lives on the `.bodyList` subsection
  list's own `.bottomBar` and New entry on `.journalList`'s, both via
  `RootPrimaryActionToolbar` (not shell-owned). Post-create, the create view pops
  itself via `dismiss()` (removing the top create route) and the shell's
  `openRouteAfterCurrentTransition(_:)` appends the detail route on the next
  runloop tick (e.g. `[.bodyList, .bodyMeasurementCreate]` → `[.bodyList]` →
  `[.bodyList, .bodyMeasurementDetail(id)]`) so Back returns to the subsection
  list, not the hub. Do not re-add a `removeLast()` there. Pushed form
  routes put Cancel in the top-leading `.cancellationAction` and Save in the
  top-trailing `.confirmationAction`; there is no top-trailing overflow menu.
  Destructive Delete is a full-width `FormDeleteButton` (bordered, `.destructive`
  role, `NeoGymTheme.danger` tint) rendered at the bottom of the scroll content,
  shown only when deletion applies (edit-mode `deleteAction != nil` on forms, or
  a loaded record on detail routes such as session detail or the nutrition day
  view's "Clear day log"), and still opens the screen's existing confirm
  `.alert`/`.confirmationDialog`. In the nutrition day view the logged intake
  rows (`EntryRow` food entries and `MealGroupRow` logged meal groups in
  `DailyIntakeRows`) carry no inline Edit/trash buttons — the whole glass row is
  a `.buttonStyle(.plain)` `Button` (trailing `chevron.right`) that opens the
  `EditLogEntrySheet` / `EditMealGroupSheet`, and each of those modal editors
  holds its own Delete as a native destructive `Button(role: .destructive)` in a
  trailing `Section` (matching `StrengthSetEditorView`, not the scroll-content
  `FormDeleteButton` used on pushed forms/detail routes) wired to a
  `.confirmationDialog` that deletes via the view model and dismisses. Detail routes otherwise use native iOS 26
  bottom toolbar actions (`.bottomBar`, plus confirmation/destructive roles where
  appropriate). A session detail's single `.bottomBar` holds the rest timer as
  its **leading** item, a `Spacer()`, then Add exercise trailing — Delete is the
  in-content `FormDeleteButton`, not a bottom-bar or overflow action. The rest timer is a
  shell-owned `@StateObject RestTimerController` in `AppShellView` (survives area
  switches and drill navigation), injected down through
  `WorkoutsSectionNavigationView` into `SessionDetailView`, which renders
  `RestTimerToolbarControl(timer:)` in that leading bottom-bar slot. With no
  `TabView` there is no minimized tab pill, so a leading bottom-bar control
  cannot be covered — this is why the rest timer now lives in the session
  `.bottomBar` rather than a tab-view accessory. If the user navigates off the
  session detail while the timer runs, the on-screen pill disappears but the
  timer keeps running via its Live Activity + local notification. Every hub's
  subsection lists own their create/log in the single `.bottomBar` (New workout on
  `.workoutsList`; New plan/food/meal on `.plansList`/`.foodsList`/`.mealsList`;
  Log measurement on `.bodyList`; New entry on `.journalList`). There is exactly
  one bottom band (create/log + rest timer + detail actions) and no tab bar.
  Root list
  pages rely on standard navigation-title spacing and native safe-area insets; do
  not add custom dock clearance constants or extra bottom padding for custom
  bottom chrome. Reduce Motion should suppress custom section scaling polish
  while preserving native navigation structure. Sheet-local `NavigationView`
  wrappers are still intentional for modal editors/pickers until those sheets are
  separately revisited. Do not reintroduce a `TabView`,
  `.tabViewBottomAccessory`, `.tabBarMinimizeBehavior`, `SectionTitleMenu`,
  `SecondarySectionContentHost`, `AppAreaSwitcher`, the interim `.safeAreaInset`
  area switcher, older-OS availability branches, UIKit parent-chain tab-bar
  hiding, the removed `.hidesBottomTabBarWhenPushed()` alias, custom dock chrome,
  or new hidden-link navigation. Parent lists reload from root invalidation tokens and detail
  callbacks after create/save/delete/mutation flows.
- **Screen structure**: list and detail screens are usually `ScrollView` →
  leading `VStack(spacing: 18)` → max width around `700–760` →
  `NeoGymTheme.screenHorizontalPadding` and `screenVerticalPadding`. Top-level
  list headers use an uppercase caption eyebrow plus muted explanatory copy.
  For all three areas (hub model) the subsection title is the pushed route's own
  `navigationTitle` and create/log lives on that subsection's `.bottomBar`.
- **Theme primitives**: use `NeoGymTheme` spacing, radius, palette, and semantic
  colors. Full-screen/auth surfaces sit inside `ScreenScaffold`/`GridBackground`.
  Cards and grouped content should use `SectionShell`, `GlassPanel`,
  `.glassSurface(...)`, or the nutrition-specific `NutritionGlassSection`,
  `.nutritionGlassCard()`, and `.nutritionGlassField()` helpers rather than
  hard-coded backgrounds. The nutrition helpers are intentional denser wrappers:
  they use ultra-thin, shadowless glass with smaller padding/radii for nested
  nutrition lists, picker shells, macro tiles, and form inputs instead of the
  broader generic glass defaults.
  `GlassPanel` honors `cornerRadius`, `material`, `tint`, `shadow`, and
  `contentPadding`; `.glassSurface(...)` honors `cornerRadius`, `material`,
  `tint`, `stroke`, and `shadow`. Bare/default glass calls intentionally use the
  declared glass defaults (regular material, glass fill, subtle stroke, and
  shadow) rather than preserving the old flat rendering, and the Reduce
  Transparency fallback keeps the tint and stroke over an opaque fallback fill.
- **Loading, empty, and error states**: wrap fetch states in `SectionShell` and
  reuse `AppLoadingStateView`, `AppErrorStateView`, and `AppEmptyStateView`.
  Preserve stale data while refreshing when the view model exposes a previous
  value, and wire retry buttons to `Task { await viewModel.load() }`.
- **Lists and rows**: rows are typically custom `HStack` labels inside
  `NavigationLink`, grouped in a `VStack(spacing: 0)` with `Divider()` between
  rows. Use `.subheadline.weight(.semibold)` for primary row text, muted
  `.caption`/`.caption2` metadata, a trailing chevron for drill-in rows, and
  compact badges/cards for dates, visibility, labels, or counts.
- **Buttons and destructive actions**: primary full-width actions use
  `NeoGymPrimaryButtonStyle`; secondary/cancel/load-more actions use
  `NeoGymSecondaryButtonStyle`; header icons must keep a 44×44 touch target and
  an accessibility label. Destructive deletes should use `role: .destructive`
  and an `.alert`/`.confirmationDialog` that states what will cascade or be
  retained.
- **Forms and validation**: non-trivial forms keep field state and validation in
  `NeoGymKit` `ObservableObject` form models (`valuesForSubmit()`, `canSubmit`,
  `errorMessage`) and keep SwiftUI views focused on layout. Representative
  forms use the app-layer `PrimaryActionButton` for primary submit actions,
  `InlineProgressLabel` for inline busy copy, and `FeedbackBanner` for
  form-level errors near the actions. Disable submit while saving or invalid,
  call parent callbacks before dismissing, and keep unit tests around
  model-level validation rather than live services; a full app-wide form
  migration is intentionally out of scope unless a view is already being
  refactored.
- **Inputs**: label fields with `.subheadline.weight(.semibold)`. Use `.words`
  autocapitalization for names/titles, `.never` plus disabled autocorrection for
  emails, IDs, labels, and numeric text; use `.decimalPad` for weights/grams and
  macro fields, `.numberPad` for integer/cardio duration parts, compact
  `DatePicker` for dates, and wheel time pickers in modal logging sheets. Actual
  `.decimalPad`/`.numberPad` `TextField`s outside OTP should opt in to local
  `@FocusState` plus `KeyboardDoneToolbar`/`numericFieldFocus` so the keyboard
  has a Done dismissal affordance without moving validation into `NeoGymKit`.
  Multi-line notes/descriptions use `TextEditor` with a minimum height and muted
  helper text where useful. OTP entry uses the custom `OTPCodeField` so paste,
  one-time-code autofill, six-digit filtering, focus, and accessibility stay
  consistent.
- **Pickers and composite editors**: workouts add exercises through
  `ExercisePickerView`; nutrition uses searchable wheel `FoodPickerView` and
  `MealPickerView`; workout labels and journal labels use chip inputs with
  normalized typed creation and suggestions. Strength set editing intentionally
  uses a sheet with native `Form` + wheel pickers for kg/grams/reps; cardio entry
  editing is schema-driven and highlights the invalid metric row.
- **Graphs and summaries**: body trends use `TimeSeriesTrendChartView` /
  `TimeSeriesChartView` with a period menu, custom date pickers, sampled points,
  axes/legend, and tap/drag callouts. Non-empty custom charts collapse their
  decorative drawing, axes, legends, markers, and callouts into one VoiceOver
  element with a domain label plus a summary of visible series, point counts,
  date range, latest values, and min/max values; empty-state text remains
  naturally accessible. Nutrition totals use `MacroSummaryView` grids with
  monospaced digits and optional target totals. Do not introduce a new chart or
  macro tile style unless these primitives cannot express the need.
- **Accessibility and previews**: add accessibility labels for icon-only actions,
  preserve 44-point hit targets for tappable chips/buttons where practical, and
  keep dynamic type in mind. Previews can set `dynamicTypeSize`, color scheme,
  and fake repositories/services; do not depend on live Nhost, real Keychain, or
  writable HealthKit data in previews/tests.

## Inconsistencies worth fixing when touching nearby code

- Some forms outside the representative migration still use local error,
  mutation-progress, or submit-button presentation. Prefer
  `PrimaryActionButton`, `InlineProgressLabel`, and `FeedbackBanner` when
  refactoring those forms.
