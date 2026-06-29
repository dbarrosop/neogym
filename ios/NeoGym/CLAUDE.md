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

- **App shell and navigation**: the signed-in app is a three-tab `TabView`
  (Workouts, Nutrition, Me). Each tab owns a stack-style `NavigationView`; broad
  areas use the top `SecondarySectionBar` segmented control rather than adding
  more primary tabs. Secondary bars are intentionally text-only to keep crowded
  segmented controls compact and stable. Use hidden `NavigationLink` state only
  for programmatic follow-up navigation after creating/opening a record, and
  reload parent lists through `onCreated`/`onSaved`/`onDeleted`/`onMutated`
  callbacks.
- **Screen structure**: list and detail screens are usually `ScrollView` →
  leading `VStack(spacing: 18)` → max width around `700–760` →
  `NeoGymTheme.screenHorizontalPadding` and `screenVerticalPadding`. Top-level
  list headers use an uppercase caption eyebrow, a `.largeTitle.bold()` title
  with slight negative tracking, muted explanatory copy, and
  `HeaderActionButtonLabel` for icon-only create actions.
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
  axes/legend, and tap/drag callouts. Nutrition totals use `MacroSummaryView`
  grids with monospaced digits and optional target totals. Do not introduce a new
  chart or macro tile style unless these primitives cannot express the need.
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
- Custom time-series charts are visual-first today; add VoiceOver summaries when
  changing chart code.
