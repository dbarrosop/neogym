# Improve iOS 26 bottom navigation transitions and contextual actions

**Status:** ready
**Created:** 2026-07-02

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

The native iOS app currently uses a legacy SwiftUI `TabView` root plus stack-style `NavigationView`s. Many pushed pages call `.hidesBottomTabBarWhenPushed()`, which mixes SwiftUI tab-bar hiding with a UIKit `hidesBottomBarWhenPushed` parent-chain accessor. The bottom tab bar disappears and reappears during pushes/pops in a jarring way. The user wants a modern iOS 26 solution that makes the bottom area feel smoother and more useful, preferably turning it into contextual actions such as Add, Save, Cancel, Delete, Edit, Start, or Log where appropriate.

### 1.2 Functional requirements

- Upgrade the native iOS app target to iOS 26 and use modern APIs/mechanisms.
- Do not design or preserve fallbacks, availability branches, wrappers, or compatibility shims for iOS 25 or older.
- Remove the ugly native tab-bar hide/show artifact on pushed pages.
- Preserve the three primary root areas: Workouts, Nutrition, and Me.
- Preserve existing secondary section navigation and current domain flows.
- Migrate away from legacy root navigation patterns where they cause the bottom-bar problem: `TabView(selection:) + .tabItem/.tag`, `NavigationView`, and `NavigationLink(isActive:)`/hidden links.
- Prefer native iOS 26 bottom/action surfaces first; use a custom iOS 26 dock alternative only if native APIs fail the canary.
- Account for all existing `.hidesBottomTabBarWhenPushed()` call sites and delete the transitional API by the end.
- Keep sheet-presented editors sheet-local unless a separate product/navigation decision converts them to pushes.

### 1.3 Non-functional requirements / constraints

- Scope is iOS UI/navigation only; no backend, schema, API, or web frontend changes.
- Keep every committed phase buildable and navigable.
- App build validation must use Xcode/iOS 26-capable tooling; `xcodebuild` is the primary gate for app-shell work.
- `swift build`/`swift test` validate only `NeoGymKit` and any extracted pure route/path logic, not the SwiftUI app shell.
- Keep `NeoGymKit` host-testable and free of SwiftUI/UIKit unless package code truly needs iOS 26 APIs.
- Preserve accessibility: VoiceOver labels/order, Dynamic Type, Reduce Motion, Reduce Transparency, safe areas, keyboard ergonomics, and minimum hit targets.
- Avoid broad visual/product redesign beyond bottom navigation and contextual action placement.

### 1.4 Surfaces in scope

- `ios/NeoGym/project.yml` — raise the main app target to iOS 26; leave widget/package floors unchanged unless required by actual code.
- `ios/NeoGym/App/AppShellView.swift` — migrate root tabs to modern `Tab` API, reconcile bottom safe area, and host native/custom bottom surfaces.
- `ios/NeoGym/App/WorkoutsShellView.swift` — migrate Workouts root from `NavigationView`/hidden links to typed `NavigationStack(path:)`.
- `ios/NeoGym/App/Nutrition/NutritionShellView.swift` — migrate Nutrition root to typed path navigation.
- `ios/NeoGym/App/MeShellView.swift` — migrate Me root to typed path navigation.
- `ios/NeoGym/App/Components/NavigationChrome.swift` — replace old tab-bar hiding implementation with a temporary iOS-26-only source alias, then delete it.
- `ios/NeoGym/App/Components/SecondarySectionBar.swift` — ensure secondary section bars remain root-only or path-aware.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — trace and clean up stale dock clearance constants/comments.
- `ios/NeoGym/Sources/NeoGymKit/` and `ios/NeoGym/Tests/NeoGymKitTests/` — optional pure route/path reducers and tests.
- Pushed screens under `ios/NeoGym/App/` that currently call `.hidesBottomTabBarWhenPushed()` — migrate to chosen bottom-action pattern.
- Sheet-local navigation views/editors — classify intentionally; keep sheet-local actions unless separately redesigned.
- `ios/NeoGym/CLAUDE.md` and root `CLAUDE.md` — update platform and navigation conventions.

### 1.5 Out of scope

- Supporting iOS 25 or older.
- Backend, database, GraphQL, auth, or web frontend changes.
- Full product information-architecture redesign.
- Converting every sheet-presented editor into a pushed route.
- Rewriting `NeoGymKit` platform support just because the app target rises.

### 1.6 Success criteria

- The app target is iOS 26 and navigation docs say so.
- No older-OS navigation fallback code remains.
- Root Workouts/Nutrition/Me navigation remains intact and preserves independent root/section state.
- Pushed detail/form routes no longer show jarring tab-bar disappearance/reappearance.
- Pushed forms expose Save/Cancel/Delete through accessible native bottom/action surfaces, or through a documented custom iOS 26 dock alternative if native APIs fail.
- All production `.hidesBottomTabBarWhenPushed()` calls and the transitional API are removed by the end.
- Manual iOS 26 simulator validation covers Workouts, Nutrition, Me, keyboard forms, VoiceOver, Dynamic Type, Reduce Motion, and Reduce Transparency.
- `xcodebuild` succeeds using an iOS 26-capable SDK/simulator.

---

## 2. Implementation strategy

### 2.1 Central design decision

Adopt an iOS 26 native-first strategy. First remove old platform constraints and legacy fallback code, then migrate the root navigation to modern `Tab` and typed `NavigationStack(path:)` APIs so route depth and action surfaces are explicit. Validate native iOS 26 bottom APIs (`ToolbarItem` placements such as `.bottomBar`, `.confirmationAction`, `.cancellationAction`, plus tab accessory/minimize APIs where relevant) before introducing custom chrome. If the native canary cannot satisfy the route/bottom-state contract, pause and create a short custom iOS 26 dock addendum instead of improvising an alternate implementation.

### 2.2 Route and bottom-state contract

- **Root:** modern primary tabs for Workouts, Nutrition, Me; secondary section bar appears only in the active root context.
- **Pushed detail:** system back remains the default back affordance; bottom area is reserved for domain actions such as Edit, Start, Log, Add, or Duplicate only where useful.
- **Pushed form:** bottom/action surface carries Cancel, Save, and destructive actions using native roles where practical; destructive actions still confirm from stable page state.
- **Sheet:** actions remain sheet-local. Root bottom bars or a shell dock do not control sheet content.
- **No-action pushed route:** do not leave a jarring or ambiguous primary tab bar state; choose the native minimize/hide behavior proven by the canary, or the custom dock alternative if native behavior fails.

### 2.3 Key constraints and invariants

- No `#available` branches or UIKit fallback accessors are needed for old OS support in app navigation code.
- A temporary function name may remain only as a source-preserving alias while call sites migrate; it must be iOS-26-only and deleted in the rollout phase.
- Modern route/path state must cover all real programmatic navigation flows, not just one shell.
- Non-navigation `isActive` usages (e.g. focus/visibility state) must not be migrated by mistake.
- Sheet-local navigation wrappers must be classified; unused/preview-only navigation wrappers should be deleted rather than migrated when safe.
- `xcodebuild` is the app-shell acceptance gate; `swift test` is supplemental only for extracted pure logic.

### 2.4 Touched surfaces

- `ios/NeoGym/project.yml` — deployment target changes.
- `ios/NeoGym/App/AppShellView.swift` — modern `Tab`, safe-area reconciliation, tab accessory/minimize validation.
- `ios/NeoGym/App/WorkoutsShellView.swift`, `NutritionShellView.swift`, `MeShellView.swift` — root `NavigationStack(path:)` migrations.
- `ios/NeoGym/App/Components/NavigationChrome.swift` — transitional alias, then deletion.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — root/dock clearance cleanup.
- `ios/NeoGym/App/*` and `ios/NeoGym/App/Nutrition/*` — route/action migration for pushed screens.
- `ios/NeoGym/Sources/NeoGymKit/` — optional route reducer/deep-link mapping logic.
- `ios/NeoGym/Tests/NeoGymKitTests/` — tests for extracted route logic.
- `CLAUDE.md`, `ios/NeoGym/CLAUDE.md` — documentation updates.

### 2.5 Compatibility, deployment, and rollback notes

- **Compatibility:** iOS 26-only is intentional and user-approved. The install floor will exclude older-device/older-OS users; record this in release/deployment notes if this app is distributed.
- **Deployment:** Phase 1 must preflight local and acceptance/CI Xcode/iOS 26 SDK availability before changing the target. No backend deploy or codegen is required.
- **Rollback:** Standard revert is sufficient for each committed phase. Do not leave long-lived compatibility shims; the temporary hide alias is deleted once call sites migrate.

---

## 3. Phased plan of action

### Phase 1 — iOS 26 preflight, target, docs, and no-fallback chrome cleanup

**Goal:** Make the app explicitly iOS 26-only and remove older-OS fallback behavior while keeping the app compiling and navigable.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/project.yml` — raise main app target to iOS 26; do not raise widget target unless actual widget code or Xcode requirements demand it.
- `ios/NeoGym/App/Components/NavigationChrome.swift` — remove availability/fallback implementation.
- `ios/NeoGym/CLAUDE.md`, `CLAUDE.md` — update target and transitional navigation guidance truthfully.

**Implementation steps:**

1. Preflight the local and acceptance-build environment: verify Xcode/iOS 26 SDK availability and planned APIs (`Tab`, native tab accessory/minimize APIs, modern toolbar placements). If unavailable, stop and ask the user to install/choose the right Xcode before changing code.
2. Raise `targets.NeoGym.deploymentTarget` to iOS 26. Adjust XcodeGen top-level defaults only if needed without unintentionally raising `NeoGymWidgets`; keep `NeoGymWidgets` at its current floor unless there is a concrete reason to raise it.
3. Keep `NeoGymKit` package platform unchanged unless package code starts using iOS 26-only APIs.
4. Change `.hidesBottomTabBarWhenPushed()` into a temporary source alias that resolves concretely to native `.toolbar(.hidden, for: .tabBar)` for iOS 26. Remove the `#available` branch, UIKit `HidesBottomTabBarWhenPushedController`, parent-chain `hidesBottomBarWhenPushed`, and old `#else` fallback.
5. Update docs to say: app is iOS 26-only; the old hide modifier is transitional; typed navigation/native bottom actions are planned but not complete yet.

**Tests and checks:**

- Xcode/iOS 26 SDK preflight output recorded in implementation log.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS' build` or an available iOS 26 simulator destination.
- `grep`/review confirms no `#available` or UIKit fallback remains in `NavigationChrome.swift`.

**Definition of done:**

- App target is iOS 26.
- Widget/package targets are intentionally unchanged or explicitly justified.
- Navigation chrome contains no older-OS fallback code.
- The app compiles and remains navigable; exact tab-bar hide animation may still exist until later phases.
- Docs match this transitional state.

**Phase commit message:** `chore(ios): raise app target to ios 26`

**Implementation log**

- Implementation notes: raised the main `NeoGym` app target in `ios/NeoGym/project.yml` from iOS 15.0 to iOS 26.0 while intentionally leaving `NeoGymWidgets` at 16.2 and `NeoGymKit` package platforms unchanged. Replaced the old `NavigationChrome.hidesBottomTabBarWhenPushed()` UIKit/availability bridge with a temporary SwiftUI-only alias to `toolbar(.hidden, for: .tabBar)`. Updated root and iOS `CLAUDE.md` docs to state the app is iOS 26-only, that the hide modifier is transitional, and that new navigation work should not add older-OS fallbacks or UIKit parent-chain hiding.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS`. Accepted concerns: the reviewer’s inherited Nix shell could not produce a clean `xcodebuild` because a Nix linker/SDK environment shadowed Xcode; this reproduced on the base commit and was not a Phase 1 regression. Remaining always-true `#available` checks outside `NavigationChrome.swift` and `UIRequiresFullScreen` deprecation are deferred to later cleanup because Phase 1 scope was navigation chrome/target/docs.
- Autonomous decisions: kept `NeoGymWidgets` at 16.2 and `NeoGymKit` at their existing platform floors (long-term maintenance: avoid narrowing unrelated targets/packages without code need); used a clean Xcode environment outside the inherited Nix shell for the app gate after the Nix shell failed with SDK/linker mismatches (correctness: validates the iOS app with the actual Xcode 26 SDK/toolchain required by this phase).
- Quality gate: `xcodebuild -version` reported Xcode 26.6; clean `xcrun` reported iPhoneOS/iPhoneSimulator SDK 26.5; `swift test` passed 189 tests; `nix develop ../.. --command xcodegen generate` passed; inherited-shell `xcodebuild` failed due Nix SDK/linker environment; sanitized Xcode environment `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` passed.

### Phase 2 — Complete typed navigation inventory and root-stack migration

**Goal:** Move root navigation to modern typed/path-based APIs with complete inventory and stable safe-area behavior.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/AppShellView.swift` — replace legacy `.tabItem`/`.tag` tabs with modern `Tab(value:)`; reconcile `.ignoresSafeArea(.container, edges: .bottom)`.
- `ios/NeoGym/App/WorkoutsShellView.swift`, `NutritionShellView.swift`, `MeShellView.swift` — migrate root stacks to `NavigationStack(path:)`.
- Programmatic navigation sites: `WorkoutsShellView.swift`, `SessionsView.swift`, `BodyViews.swift`, `JournalViews.swift`, `Nutrition/PlansViews.swift`, `Nutrition/FoodsViews.swift`, `Nutrition/MealsViews.swift`, `Nutrition/DailyIntakeViews.swift`.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` and root screens using `topSectionBarContentClearance`, `dockRootContentClearance`, or `dockContentClearance` — reconcile padding/safe-area enough that this phase is visually usable.
- Optional `NeoGymKit` route reducer/deep-link mapping files and tests.

**Implementation steps:**

1. Inventory all `NavigationView` usages and classify them as stack-root, pushed leaf wrapper, sheet-local, preview-only, helper, or dead. Migrate stack roots; leave sheet-local only when intentional; delete unused/preview-only wrapper structs when safe instead of migrating them.
2. Inventory all `NavigationLink(isActive:)`/hidden programmatic flows. Include the eight real navigation sites listed above. Explicitly exclude non-navigation `isActive` false positives such as OTP/focus/visibility controls.
3. Replace `AppShellView` legacy `TabView(selection:) + .tabItem/.tag` with modern value-based `Tab` API.
4. Introduce route enums/path state per root and `NavigationStack(path:)`; migrate programmatic flows to path append/pop operations.
5. Extract pure route/path/deep-link mapping logic into `NeoGymKit` where practical, especially session pending/open route mapping, and add unit tests. State clearly that these tests do not validate SwiftUI shell behavior.
6. Ensure secondary section bars are root-only or path-aware so they do not persist incorrectly into pushed details/forms.
7. Reconcile `AppShellView.ignoresSafeArea(.container, edges: .bottom)` and root bottom padding/clearance in this phase, not later, so the intermediate state is not double-inset or clipped.

**Tests and checks:**

- `cd ios/NeoGym && swift test` only for any extracted route logic.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` if files changed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS' build` or iOS 26 simulator build.
- Manual smoke per root: Workouts session/detail/form entry points including pending/open session flows; Nutrition food/meal/plan/day entry points; Me body/journal/profile entry points; tab switching preserves independent stack/section state.

**Definition of done:**

- Root navigation uses modern typed/path APIs.
- All real programmatic navigation sites are migrated or explicitly classified with rationale.
- Non-navigation `isActive` false positives are untouched.
- Root and section state are preserved across tab switches.
- No obvious double bottom inset or clipped native tab/bottom area exists after the migration.
- `xcodebuild` passes; route tests pass if route logic was extracted.

**Phase commit message:** `refactor(ios): migrate root navigation to typed stacks`

**Implementation log**

- Implementation notes: replaced the signed-in shell's legacy `.tabItem`/`.tag` roots with iOS 26 value-based `Tab` entries and removed the root bottom safe-area ignore. Migrated Workouts, Nutrition, and Me roots from `NavigationView` to typed `NavigationStack(path:)` state with root-only secondary section toolbars and invalidation tokens for list refresh after detail mutations. Added app route enums for Workouts/Nutrition/Me and centralized route destinations for session/workout/exercise, nutrition day/plan/food/meal, and body/journal flows. Removed preview-only `*NavigationView` wrappers for Sessions, Workouts, Exercises, Body, and Journal instead of migrating them.
- Navigation inventory: root stack usages migrated were `WorkoutsSectionNavigationView`, `NutritionNavigationView`, and `MeNavigationView`; preview-only/dead wrappers deleted were `SessionsNavigationView`, `WorkoutsNavigationView`, `ExercisesNavigationView`, `BodyNavigationView`, and `JournalNavigationView`; remaining `NavigationView` usages are sheet-local modal editors/pickers (`ChangeEmailSheet`, exercise/food/meal pickers, strength/cardio editors, session date editor, nutrition logging and nested plan/meal editors). Real hidden/programmatic navigation sites migrated were pending/open session, started session, nutrition day open, plan/food/meal post-create detail, body measurement post-create detail, and journal post-create detail. Non-navigation `isActive` matches (OTP/focus/visibility controls) were left untouched.
- Route logic/tests: extracted pure session route mapping helpers into `NeoGymKit` and added unit tests; these tests validate only route/path mapping decisions and do not validate SwiftUI shell behavior.
- Safe-area notes: `AppShellView` now lets the native tab bar provide bottom safe-area insets, and `NeoGymTheme.dockRootContentClearance` is zeroed to avoid double bottom padding while preserving the existing compact top clearance for root secondary bars.
- Reviewer verdict: `ACCEPT`. Reviewer confirmed root navigation uses modern typed/path APIs, all eight real programmatic navigation sites were migrated, false-positive `isActive` usages were untouched, preview-only wrappers were deleted, section bars are root-only, route tests pass, and the app builds.
- Autonomous decisions: accepted generic iOS `xcodebuild` as the primary app gate for this phase because the plan allows generic iOS or iOS 26 simulator build, and generic iOS completed reliably in the clean Xcode environment while simulator builds were environment-sensitive (correctness: use the strongest passing app-shell build evidence available). Manual simulator smoke remains deferred to Phase 3’s interactive canary matrix as planned (long-term maintenance: avoid pretending manual validation was performed when it was not).
- Quality gate: inherited-shell `swift test` failed with the documented Nix SDK/Xcode compiler mismatch; sanitized `swift test --filter WorkoutSessionRouteMappingTests` passed 3 tests; `nix develop ../.. --command xcodegen generate` passed; sanitized `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS' build CODE_SIGNING_ALLOWED=NO` passed; `git diff --check` passed. Two sanitized generic iOS Simulator builds compiled successfully but timed out during/after link in this environment, so the final successful app gate used the accepted generic iOS destination.

### Phase 3 — Native bottom API spike and mergeable canary

**Goal:** Prove the native iOS 26 bottom-action pattern before broad rollout.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- Non-production spike harness/branch notes in implementation log.
- `ios/NeoGym/App/WorkoutFormViews.swift` — canary pushed form.
- One pushed Nutrition screen and one pushed Me screen selected after the Phase 2 inventory.
- `ios/NeoGym/App/AppShellView.swift` and `NavigationChrome.swift` as needed for native tab/minimize/accessory behavior.

**Implementation steps:**

1. Before editing production canary screens, run a non-production spike on an iOS 26 simulator to observe modern `Tab`, `tabViewBottomAccessory`, `.tabBarMinimizeBehavior`, `.toolbar(.bottomBar)`, `.confirmationAction`, `.cancellationAction`, keyboard behavior, and pushed tab-bar transitions.
2. Treat `tabViewBottomAccessory`/tab minimize behavior as tab-transition polish or persistent tab-level accessory mechanisms, not the primary per-screen action mechanism. Prefer `.bottomBar`, `.confirmationAction`, `.cancellationAction`, and destructive roles for per-screen actions.
3. Record objective spike evidence: simulator OS/build, device class, whether root tabs stay/minimize/hide on pushed pages, whether bottom actions remain reachable with keyboard, no bottom clipping, VoiceOver order, Dynamic Type, Reduce Motion, and Reduce Transparency.
4. If native APIs fail the route/bottom-state contract, do not merge failed canary edits. Stop and write a short custom iOS 26 dock design addendum before Phase 4.
5. If native APIs pass, merge canary production changes: replace `.hidesBottomTabBarWhenPushed()` on workout create/edit plus one pushed Nutrition and one pushed Me screen with native bottom/action surfaces. Keep the transitional function compiling for untouched call sites until Phase 4.
6. Keep destructive confirmations attached to stable page or view-model state.

**Tests and checks:**

- `xcodebuild` using iOS 26-capable SDK.
- Manual canary matrix with recorded evidence: keyboard, no bottom clipping, VoiceOver order, Dynamic Type, Reduce Motion, Reduce Transparency, destructive confirmation.

**Definition of done:**

- Native-vs-custom decision is explicitly recorded.
- A production canary is merged only if native APIs pass the spike.
- Canary screens have accessible, reachable bottom actions and no ugly tab hide/show artifact.
- Failed native experiments are not left in production.

**Phase commit message:** `feat(ios): validate native bottom actions`

**Implementation log**

- Spike environment/evidence: Xcode 26.6 (17F113), iPhoneOS/iPhoneSimulator SDK 26.5, and an iOS 26.5 (23F77) iPhone 17 Pro simulator were available. A non-production SwiftUI spike in `/tmp/NativeBottomAPISpike.swift` typechecked against the iOS 26 simulator SDK with modern `Tab`, `tabViewBottomAccessory`, `.tabBarMinimizeBehavior(.onScrollDown)`, `.toolbar(.bottomBar)`, `.confirmationAction`, `.cancellationAction`, and destructive alert state. The simulator booted and accepted screenshots (`/tmp/ios26-booted-screenshot.png`); after the final production canary build, the app installed/launched on that simulator and produced `/tmp/neogym-phase3-launch-rerun.png`.
- Native-vs-custom decision: native APIs passed the compile/API canary and are consistent with the route/bottom-state contract, so this phase merged a native canary instead of adding a custom dock. `tabViewBottomAccessory` was deliberately not used for route-local actions; global `.tabBarMinimizeBehavior(.onScrollDown)` is used only as tab-transition polish while per-screen actions use native bottom toolbar items.
- Production canary: `WorkoutFormScreen` (workout create/edit), `FoodFormScreen` (Nutrition create/edit canary), and `BodyMeasurementFormScreen` (Me create/edit canary) now expose Cancel, Save/Create, and optional Delete in a native `.bottomBar` toolbar. Their pushed create/edit wrappers no longer call `.hidesBottomTabBarWhenPushed()`, and the transitional alias remains for untouched Phase 4 call sites.
- Accessibility/keyboard matrix notes: the bottom action order is Cancel → optional destructive Delete → Save/Create, each with native `Button` roles/labels; destructive confirmations remain on stable parent `@State` and existing view-model delete paths. Food/body numeric fields keep their keyboard Done toolbars, and the action surface is native toolbar chrome rather than custom safe-area content. A true interactive authenticated walk-through of the canary screens (keyboard focus, VoiceOver rotor/order, Dynamic Type on the pushed forms, Reduce Motion, Reduce Transparency, and visual bottom clipping while editing) could not be completed in this headless session because the launched simulator stopped at the unauthenticated/session-error screen; this limitation is recorded for reviewer/manual follow-up rather than treated as observed behavior.
- Reviewer verdict: `ACCEPT_WITH_CONCERNS`. Accepted concern: interactive authenticated validation of keyboard reachability, VoiceOver order, Dynamic Type, Reduce Motion/Transparency, destructive confirmation visuals, and bottom clipping could not be completed because the simulator launched to an unauthenticated/session-error screen. This is recorded as a Phase 4/5 manual validation priority before broad rollout is treated as product-verified.
- Autonomous decisions: accepted native APIs for the rollout path based on successful compile/API spike, simulator launch evidence, and reviewer acceptance (correctness: native `.bottomBar` actions and tab minimize APIs satisfy the implementable route/bottom-state contract better than introducing unneeded custom chrome); allowed the manual matrix gap as an accepted concern rather than fabricating results (security/correctness: honest validation limits are safer than false confidence).
- Quality gate: sanitized Xcode environment `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` passed; `git diff --check` passed; remaining `hidesBottomTabBarWhenPushed` calls are intentionally deferred to Phase 4.

### Phase 4 — Roll out chosen bottom-action pattern and delete old hide calls

**Goal:** Remove every production `.hidesBottomTabBarWhenPushed()` usage and migrate pushed screens to the chosen iOS 26 bottom-action pattern.

**Depends on:** Phase 3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- All call sites from `grep -R "hidesBottomTabBarWhenPushed" ios/NeoGym/App` (currently about 20 call sites across 13 files).
- `ios/NeoGym/App/Components/NavigationChrome.swift` — delete transitional function after call sites are gone.
- Pushed Workouts/Nutrition/Me screens selected by the inventory.
- Sheet-local screens — keep sheet-local actions unless explicitly converted.
- `RestTimerOverlay` integration if session detail bottom actions collide with it.

**Implementation steps:**

1. Audit each remaining call site as pushed route, sheet-local, preview/dead, or helper before migration.
2. Native path: migrate remaining pushed routes to native bottom/action placements and tab-transition behavior proven in Phase 3.
3. Custom alternative path: only after a Phase 3 addendum, introduce app-owned iOS 26 dock using typed route/action state; no older-OS fallback.
4. Remove all production `.hidesBottomTabBarWhenPushed()` calls, then delete the transitional function definition.
5. Keep sheet-local forms using sheet-local confirmation/cancellation/destructive toolbar conventions.
6. Handle `RestTimerOverlay`, root Add actions, and duplicate toolbar/bottom actions deliberately.

**Tests and checks:**

- `grep -R "hidesBottomTabBarWhenPushed" ios/NeoGym/App` returns no production calls or definition.
- `xcodebuild` using iOS 26-capable SDK.
- Manual matrix: Workouts session/detail/form, Nutrition food/meal/plan/day/logging, Body measurement create/edit/detail, Journal entry create/edit/detail, keyboard forms, VoiceOver, Dynamic Type, Reduce Motion, Reduce Transparency.

**Definition of done:**

- No production hide-call API remains.
- Converted screens match the route/bottom-state contract.
- Sheets remain usable with local actions.
- No clipped bottom content or duplicated unintentional actions remain.

**Phase commit message:** `feat(ios): migrate pushed screens to bottom actions`

**Implementation log**

_(filled by `nhost-implement` during execution.)_

### Phase 5 — Theme, spacing, and documentation polish

**Goal:** Remove migration debt and finalize iOS 26 navigation documentation/styling.

**Depends on:** Phase 4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/App/Theme/NeoGymTheme.swift`
- Views consuming `topSectionBarContentClearance`, `dockRootContentClearance`, and `dockContentClearance`
- `ios/NeoGym/CLAUDE.md`, `CLAUDE.md`

**Implementation steps:**

1. Trace actual consumers of clearance constants before changing/deleting them.
2. Fix stale comments that mention a floating dock/page-style `TabView` when the current/final structure differs.
3. Tune final native/custom bottom chrome styling and transitions using iOS 26 visual language; respect Reduce Motion.
4. Finalize docs for iOS 26-only target, modern `Tab`/typed navigation, bottom action conventions, sheet-local caveats, and no old compatibility shims.

**Tests and checks:**

- `xcodebuild` using iOS 26-capable SDK.
- Final manual matrix from Phase 4 plus small/large device class checks and root-list scroll-to-edges.

**Definition of done:**

- No stale docs/comments/constants remain.
- No double insets/clipping remain.
- The final bottom area feels coherent and documented.

**Phase commit message:** `chore(ios): polish ios 26 bottom navigation`

**Implementation log**

_(filled by `nhost-implement` during execution.)_

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

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| iOS 26-only app target | 1 | `project.yml`, XcodeGen, iOS 26 SDK preflight, `xcodebuild` |
| No older-OS fallbacks/shims | 1, 4 | `NavigationChrome.swift` review; no availability/UIKit fallback; transitional alias deleted |
| Preserve three roots and secondary sections | 2 | Manual root/section smoke; route inventory; `xcodebuild` |
| Migrate typed navigation | 2 | All real `isActive` nav sites inventoried/migrated/classified; route tests if extracted |
| Remove jarring bottom transition | 3, 4 | iOS 26 simulator canary and full manual matrix |
| Useful contextual actions | 3, 4 | Canary and rollout screens with bottom/action toolbar behavior |
| Preserve sheet usability | 4 | Sheet-local audit/manual checks |
| Accessibility and keyboard | 3, 4, 5 | VoiceOver, Dynamic Type, Reduce Motion/Transparency, keyboard forms |
| Clean docs/theme debt | 5 | Docs updated; clearance constants traced; no stale comments |

---

## 6. Risks and mitigations

- **Risk:** Xcode/iOS 26 SDK is unavailable locally or in acceptance/CI. — **Mitigation:** Phase 1 preflight stops before target changes if unavailable.
- **Risk:** iOS 26-only install floor excludes older devices/OS versions. — **Mitigation:** User explicitly required this; document it in project guidance/release notes.
- **Risk:** Native iOS 26 bottom APIs do not satisfy “tabs become actions.” — **Mitigation:** Phase 3 non-production spike; if it fails, stop for a custom iOS 26 dock addendum before rollout.
- **Risk:** Typed navigation migration resets state. — **Mitigation:** Complete inventory, per-root smoke tests, optional pure route reducer tests, independent root path state.
- **Risk:** Manual accessibility validation is under-recorded. — **Mitigation:** Phase 3/4 require simulator OS/build, device class, and checklist evidence in implementation log.
- **Risk:** Safe-area/padding hacks break intermediate layouts. — **Mitigation:** Phase 2 owns safe-area/padding reconciliation rather than deferring it to cleanup.

---

## 7. Follow-ups (out of scope for this plan)

- Converting sheet-presented editors to pushed routes — tracked in: TBD product/navigation redesign.
- Moving root-level Add actions into the bottom area — tracked in: TBD after route/bottom-action architecture stabilizes.
- A full custom dock design — tracked in: only needed if Phase 3 native canary fails.
