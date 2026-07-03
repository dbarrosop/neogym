# Native bottom tabs with top title menus and reliable bottom actions

**Status:** ready
**Created:** 2026-07-03

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

- The strict top-only-navigation plan is **discarded**. Native bottom tabs stay.
- The UI currently reads as **two tab bars**: the native bottom `Tab` roots plus the top segmented `SecondarySectionBar` (`ToolbarItem(placement: .principal)` hosting a `.segmented` `Picker`). The top secondary navigation should stop looking like a second tab bar.
- Some contextual actions are **hidden/crowded** under navigation/tab chrome (e.g. session Delete), and some feel **missing** (weight/body logging).
- The rest timer floats (`RestTimerOverlay`) and collides with content/action bars; it should live in reliable bottom action/status chrome.

### 1.2 Functional requirements

- Preserve native iOS 26 bottom tabs for the primary roots: Workouts, Nutrition, Me (`AppShellView.swift`).
- Redesign the secondary section selector so it no longer reads as a second tab bar. **Direction chosen in this plan: a native navigation-title menu** (`.toolbarTitleMenu`) anchored to the inline navigation title — see §2.1 for the title-menu-vs-chip-row decision.
- Keep top surfaces for hierarchy/context (title, back, section selection, search where already present), but make actions reliably reachable and not hidden/crowded.
- Make bottom contextual actions reliable above/with the native tab bar: Add/New, Save, Cancel, Delete, Edit, Start, Log, Clear, Add Exercise, weight/body logging, timer controls/status.
- Audit and fix perceived-missing actions: body/weight logging discoverability, and session Delete / Add Exercise crowding.
- Integrate the rest timer into bottom action/status chrome instead of the floating overlay.
- Preserve typed navigation paths and root/section state from the recent iOS 26 work.
- Do not reintroduce `.hidesBottomTabBarWhenPushed()` or custom tab/dock chrome unless native APIs truly fail a spike.
- Keep sheet-local flows sane and platform-conventional.

### 1.3 Non-functional requirements / constraints

- iOS 26-only; no older-OS fallbacks/availability branches.
- Scope is iOS app UI/navigation/action layout only — no backend, DB, GraphQL, auth, or web frontend changes.
- Each phase is self-contained, buildable, and testable, and leaves the app fully functional.
- Preserve accessibility: VoiceOver order/labels, Dynamic Type, Reduce Motion, Reduce Transparency, keyboard ergonomics, safe areas, 44pt hit targets.
- Primary gate is a sanitized Xcode 26 `xcodebuild` app build; add `swift test` only for extracted pure mapping/policy logic.
- Include concrete manual authenticated simulator validation.

### 1.4 Surfaces in scope

- `ios/NeoGym/App/AppShellView.swift` — preserve native bottom tabs and tab-minimize behavior; no global timer accessory unless a future plan chooses it.
- `ios/NeoGym/App/WorkoutsShellView.swift`, `ios/NeoGym/App/Nutrition/NutritionShellView.swift`, `ios/NeoGym/App/MeShellView.swift` — replace principal `SecondarySectionBar` with title-menu content, hoist root navigation title, and own shell-level root actions keyed on active section.
- `ios/NeoGym/App/Components/SecondarySectionBar.swift` — repurpose into `SectionTitleMenuContent` (buttons/checkmarks for `.toolbarTitleMenu`) or add that component and retire the segmented `Picker`; keep `SecondarySectionContentHost`.
- `ios/NeoGym/App/Components/HeaderActionButtonLabel.swift` — remove once root create actions migrate off it (if fully unused).
- `ios/NeoGym/App/Components/NavigationChrome.swift` — extend the shared bottom-action toolbar helpers if root list actions move to `.bottomBar`.
- Root lists with header create actions: `WorkoutsView.swift`, `BodyViews.swift`, `JournalViews.swift`, `Nutrition/FoodsViews.swift`, `Nutrition/MealsViews.swift`, `Nutrition/PlansViews.swift`.
- `ios/NeoGym/App/SessionsView.swift`, `ios/NeoGym/App/RestTimerOverlay.swift` — session bottom-action redesign + timer integration.
- `ios/NeoGym/App/Theme/NeoGymTheme.swift` — reconcile `topSectionBarContentClearance` after the title-menu change.
- `CLAUDE.md`, `ios/NeoGym/CLAUDE.md` — navigation/action conventions.
- Optional `ios/NeoGym/Sources/NeoGymKit/` + `ios/NeoGym/Tests/NeoGymKitTests/` — only for extracted pure logic (e.g. rest-timer formatting/policy).

### 1.5 Out of scope

- Reinstating strict top-only navigation; removing native bottom tabs; custom vertical/expanding tab rail or dock.
- Backend/web/schema/auth changes.
- Broad product IA redesign; converting sheet editors to pushed routes.
- Adding `.searchable`/scope bars where search does not already exist (existing in-content filters stay as-is).
- Older-iOS support.

### 1.6 Success criteria

- Native bottom tabs preserved; the "two tab bars" feel is gone because secondary section selection moves into a title menu.
- Bottom actions are complete and reliable: root New/Log actions, session Delete + Add Exercise + timer, and all detail/form actions are reachable, labeled, and not obscured.
- Body/weight logging is discoverable as a labeled action, not a scroll-away glyph.
- Rest timer is integrated into bottom chrome; the floating overlay and its manual `.padding(.bottom, 120)` / `.padding(.bottom, 72)` hacks are removed.
- Typed navigation paths and independent root/section state are preserved.
- Sanitized `xcodebuild` passes; a documented authenticated simulator matrix is recorded; docs updated.

---

## 2. Implementation strategy

### 2.1 Central design decision — title menu vs compact chip row

Both were considered for replacing the segmented secondary bar:

- **Compact chip row** (horizontally scrollable pills under the title): still reads as a persistent horizontal selector row, i.e. the exact "second tab bar" perception the user objected to. It also competes vertically with the header eyebrow/large title on root list screens.
- **Navigation title menu** (`.toolbarTitleMenu` on the inline navigation title; the current section name is the title, a subtle chevron reveals a `Menu` of the sections): this is the native iOS pattern for switching a view's mode/scope, it occupies no persistent row, it cannot be mistaken for a tab bar, and it frees the top-trailing/bottom areas for real actions.

**Decision: navigation title menu.** Reasons: (1) removes the persistent second bar entirely, directly addressing the motivation; (2) fully native iOS 26 chrome with built-in VoiceOver/Dynamic Type behavior; (3) minimal churn — `SecondarySectionContentHost` (the visited-section keep-alive host) is retained; only the selector chrome and where the navigation title comes from change.

Implication: the root navigation title must be hoisted to the shell and driven by `selection.title`. The visible title-menu label is the shell `.navigationTitle(selection.title)`; the menu content is a helper that emits section buttons/checkmarks inside `.toolbarTitleMenu { ... }` (do not nest a visible `Menu` inside the title menu). Root section pages also need their in-scroll `.largeTitle` section headers reconciled so the section name is not duplicated as both inline nav title and content title; keep useful eyebrow/subtitle/help copy, but remove or demote duplicate large title rows. Pushed routes keep their own titles.

### 2.2 Route and bottom-state contract (extends the prior iOS 26 plan)

- **Root list (path empty):** top = navigation title menu (section switch) + optional existing search; **bottom = the root's single primary action** ("New workout", "New food", "New meal", "New plan", "New entry", "Log measurement"). Sessions and Exercises roots have no create action (unchanged). Nutrition Overview/Days have no root create; Days drills into the pushed DailyIntake which owns Clear/Log.
- **Pushed detail:** system back stays; bottom carries domain actions (Edit, Start, Add Exercise, Log, Clear). Rare/destructive actions (session Delete) move to a top-trailing overflow `Menu` to keep the bottom bar uncrowded.
- **Pushed form:** `nativeFormActionToolbar` Cancel / Save / optional Delete (unchanged).
- **Sheet:** actions stay sheet-local (unchanged).
- **Rest timer:** a session-scoped bottom status/control that sits with the session bottom bar and never floats over content.

### 2.3 Root `.bottomBar` coexistence — the key spike

Root screens live inside the `TabView`. The prior plan only used `.bottomBar` on **pushed** screens. Whether a `.bottomBar` toolbar renders cleanly **above the native tab bar on a root screen** (no overlap, no double inset, no clipping, correct with `.tabBarMinimizeBehavior(.onScrollDown)`) must be proven before migrating root actions. Phase 1 includes this spike.

- **If root `.bottomBar` passes:** root primary actions move to a shell-owned `.bottomBar` (consistent with detail/form screens). Because `SecondarySectionContentHost` keeps visited sections mounted, these root actions must be attached in the shell and keyed on `path.isEmpty && selection`, not inside individual section views.
- **If it fails:** fall back to a shell-owned `ToolbarItem(placement: .topBarTrailing)` with a **labeled** button (e.g. `Label("New workout", systemImage: "plus")`, or icon + accessibility label) instead of the in-scroll `HeaderActionButtonLabel`. Either way the action becomes reliable toolbar chrome rather than scroll content.

### 2.4 Key constraints and invariants

- No `#available`/UIKit fallbacks; no `.hidesBottomTabBarWhenPushed()`.
- `SecondarySectionContentHost` keep-alive + Reduce Motion suppression of scale/animation is preserved.
- Independent per-root path and section state is preserved across tab switches.
- Rest-timer background behavior (local notification + Live Activity, `scenePhase` refresh) is preserved; only its SwiftUI placement changes.
- `NeoGymKit` stays SwiftUI/UIKit-free; only pure logic is extracted there.

### 2.5 Compatibility, deployment, rollback

- iOS 26-only, no backend/codegen/deploy. Standard per-phase revert is sufficient. No long-lived shims.

---

## 3. Route / action inventory (current state)

Baseline for the audit. "Header +" = in-scroll `HeaderActionButtonLabel` icon (the discoverability problem).

**Root secondary sections** (all via principal `SecondarySectionBar`):

| Root | Sections | Root create/log action today |
| --- | --- | --- |
| Workouts (`WorkoutsShellView`) | Sessions, Workouts, Exercises | Sessions: none; Workouts: Header + "New workout" (`WorkoutsView.swift:63`); Exercises: none |
| Nutrition (`NutritionShellView`) | Overview, Days, Plans, Foods, Meals | Overview/Days: none; Plans/Foods/Meals: Header + (`PlansViews.swift:59`, `FoodsViews.swift:55`, `MealsViews.swift:59`) |
| Me (`MeShellView`) | Profile, Body, Journal | Profile: none; Body: Header + "New measurement" (`BodyViews.swift:62`); Journal: Header + (`JournalViews.swift:54`) |

**Pushed detail bottom bars (existing `.bottomBar`):**

| Screen | Actions today | Planned change |
| --- | --- | --- |
| `SessionDetailView` (`SessionsView.swift:568`) | Delete session, Add exercise | Delete → top-trailing overflow; bottom = timer control + Add exercise |
| `WorkoutDetailView` (`:54`) | Edit workout, Start session | Keep |
| `ExerciseDetailView` (`:35`) | Start session | Keep |
| `BodyMeasurementDetailView` (`BodyViews.swift:229`) | Edit measurement | Keep |
| `MealDetailView`, `PlanDetailView`, `FoodDetailView` | Edit / etc. | Keep |
| `DailyIntakeView` (`DailyIntakeViews.swift:255`) | Clear day log, Log | Keep (verify pushed-route top padding; see below) |

**Pushed forms (`nativeFormActionToolbar`, Cancel/Save/Delete):** `WorkoutFormViews`, `BodyViews` (measurement form), `JournalViews` (entry form), `Nutrition/PlanEditorViews`, `Nutrition/MealEditorViews`, `Nutrition/FoodDetailAndFormViews`. **Keep unchanged.**

**Sheet-local (keep sheet-local):** `ChangeEmailSheet`, `ExercisePickerView`, `StrengthSetEditorView`, `CardioMetricsFormView`, `Nutrition/LogFoodMealSheets`, `SessionStartedAtEditorSheet`.

**Rest timer:** `RestTimerOverlay(timer:)` floated bottom-trailing in `SessionDetailView` (`SessionsView.swift` `ZStack(alignment: .bottomTrailing)`), with `.padding(.bottom, 120)` on content and `.padding(.bottom, 72)` on the overlay.

**Clearance note:** root section list pages currently use `topSectionBarContentClearance` to account for the segmented secondary bar. `Nutrition/DailyIntakeViews.swift:82` belongs to the root `NutritionDaysView` list, so it is not a pushed-route bug. Phase 1 should re-evaluate all root-list clearance after replacing the segmented bar with a title menu, and should verify pushed routes do not retain root-only clearance.

---

## 4. Phased plan of action

### Phase 1 — Title-menu secondary selector + root `.bottomBar` spike

**Goal:** Replace the segmented secondary bar with a native title menu across all three roots, and prove (or disprove) root `.bottomBar` coexistence so Phase 2 is de-risked. App stays fully functional.

**Depends on:** none

**Routed implementer:** `nhost-implementer` · **Routed reviewer:** `nhost-reviewer`

**Scope / files:** `WorkoutsShellView.swift`, `Nutrition/NutritionShellView.swift`, `MeShellView.swift`, `Components/SecondarySectionBar.swift`, `Theme/NeoGymTheme.swift`, root section pages that set their own `.navigationTitle` (`SessionsView`, `WorkoutsView`, `ExercisesView`, `BodyViews`, `JournalViews`, `Nutrition/*` list views, `ProfileView`).

**Implementation steps:**

1. Before edits, run a non-production iOS 26 simulator spike: (a) `.toolbarTitleMenu` on an inline-titled `NavigationStack` root inside a `TabView` with `.tabBarMinimizeBehavior(.onScrollDown)`; (b) a root screen carrying `ToolbarItemGroup(placement: .bottomBar)` while the native tab bar is visible — check no overlap/clipping/double inset, and behavior on scroll-minimize. Record OS/build, device class, and both outcomes in the implementation log.
2. Add a `SectionTitleMenuContent` helper (repurpose `SecondarySectionBar.swift` or add a sibling): it emits one `Button` per `SecondaryTabSection` for use inside `.toolbarTitleMenu { ... }`, with SF Symbol + title and a checkmark/current-state indication. Retire the `.segmented` `Picker` and its `pickerWidth` sizing. Keep `SecondarySectionContentHost` untouched.
3. In each shell, remove `ToolbarItem(placement: .principal) { SecondarySectionBar(...) }` and instead set `.navigationTitle(selection.title)` at the shell root (still `.navigationBarTitleDisplayMode(.inline)`) and attach `.toolbarTitleMenu { SectionTitleMenuContent(...) }`, gated on `path.isEmpty` so pushed routes keep their own titles/back. Preserve the `withAnimation` section-transition semantics currently in `SecondarySectionBar`/shells.
4. Reconcile root section content headers in the same pass: remove or demote duplicate in-scroll `.largeTitle` section-name headers now represented by the inline title menu, while preserving useful eyebrow/subtitle/help copy. This applies across Workouts, Nutrition, and Me root list pages (Sessions, Workouts, Exercises, Overview, Days, Plans, Foods, Meals, Profile, Body, Journal). Remove latent root `.navigationTitle(...)` modifiers where present; leave pushed-route titles intact.
5. Reconcile `NeoGymTheme.topSectionBarContentClearance`: the title menu is standard nav-title height (no extra segmented row), so reduce or zero the extra top clearance and update the constant's doc comment. Verify root list top spacing on small + large devices and verify pushed routes do not use root-only clearance.
6. Do **not** move any actions yet — root create actions stay as-is this phase so the app remains functional; only the selector chrome changes.

**Tests / checks:**

- Spike evidence recorded (title menu + root `.bottomBar` outcomes).
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` (if files added).
- Sanitized `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`.
- Manual: each root switches sections via the title menu; independent root/section state survives tab switches; VoiceOver announces the menu and current section; Dynamic Type + Reduce Motion behave.

**Definition of done:**

- No principal segmented `SecondarySectionBar` remains; all three roots switch sections via the title menu.
- Root navigation title reflects the active section; no title conflicts from the keep-alive host and no duplicate in-scroll large section title directly underneath the inline title menu.
- Root `.bottomBar` coexistence outcome is recorded and drives Phase 2's placement choice.
- Root top clearance is reconciled; pushed routes do not use root-only section clearance. Build passes.

**Phase commit message:** `feat(ios): replace secondary tab bar with title menus`

#### Phase 1 implementation log

- Spike environment: Xcode 26.6 (17F113), iOS Simulator runtime 26.5
  (23F77), iPhone 17 Pro simulator (1206×2622 screenshot); temporary
  non-production project at `/tmp/NeoGymBottomBarSpike`, not committed.
- Title-menu outcome: `.toolbarTitleMenu` on an inline-titled
  `NavigationStack` root inside a `TabView` with
  `.tabBarMinimizeBehavior(.onScrollDown)` compiled, launched, and rendered as
  the native inline title with chevron.
- Root `.bottomBar` outcome: `ToolbarItemGroup(placement: .bottomBar)` on the
  root screen rendered while the native tab bar remained visible. The root
  action buttons were not clipped; they flanked the floating tab bar as one
  native bottom chrome cluster, with content visible behind the material.
- Limitation: headless simulator tooling did not provide an automated scroll
  gesture for verifying tab-bar minimize after launch. The spike records the
  at-rest coexistence screenshot (`/tmp/neogym-bottom-bar-spike.png`) plus
  build/launch evidence; Phase 2 should still manually verify scroll-minimize
  before committing to root `.bottomBar` placement.

- Implementation notes: replaced the principal segmented picker with `SectionTitleMenuContent`, hoisted inline root titles/title menus into the three shell views, removed duplicate root large-title headers, and zeroed `topSectionBarContentClearance` while preserving root actions for Phase 2.
- Reviewer verdict: `ACCEPT` (nhost-reviewer). Non-blocking concerns: empty accessibility value on non-current menu rows is harmless; zero-valued clearance call sites can be cleaned later; authenticated accessibility/scroll-minimize validation remains manual.
- Quality gate: `git diff --check` passed; targeted LSP diagnostics for changed shell/component/theme Swift files passed; sanitized `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` passed.
- Autonomous decision: accepted the implementer pass despite the wrapper reporting a missing tests-added evidence failure, because the returned report documented that no automated tests were appropriate for this SwiftUI chrome-only phase and the reviewer/build gates independently verified correctness (correctness > long-term maintenance).

### Phase 2 — Reliable, discoverable root primary actions

**Goal:** Move root create/log actions out of scroll content into reliable toolbar chrome, and fix body/weight logging discoverability.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer` · **Routed reviewer:** `nhost-reviewer`

**Scope / files:** `WorkoutsShellView.swift`, `Nutrition/NutritionShellView.swift`, `MeShellView.swift`, `WorkoutsView.swift`, `BodyViews.swift`, `JournalViews.swift`, `Nutrition/FoodsViews.swift`, `Nutrition/MealsViews.swift`, `Nutrition/PlansViews.swift`, `Components/NavigationChrome.swift` (shared root-action helper if useful), `Components/HeaderActionButtonLabel.swift` (remove if unused after).

**Implementation steps:**

1. Using the Phase 1 spike outcome, choose placement: **shell-owned root `.bottomBar`** (preferred) or **shell-owned `.topBarTrailing` labeled button** (fallback). Add a small shared helper in `NavigationChrome.swift` if useful, but the toolbar item must be attached in `WorkoutsShellView`, `NutritionShellView`, and `MeShellView`, keyed on `path.isEmpty && selection`; do not attach root toolbar actions inside individual kept-alive section list views.
2. Migrate each root create action off the in-scroll `HeaderActionButtonLabel` `NavigationLink(value:)` into the chosen shell chrome, preserving the existing `WorkoutsRoute`/`NutritionRoute`/`MeRoute` create routes and accessibility labels:
   - Workouts → "New workout"; Foods → "New food"; Meals → "New meal"; Plans → "New plan"; Journal → "New entry".
   - **Body → relabel to "Log measurement"** (the metric users think of as "weight"; the form covers weight + body fat + notes) as a labeled primary action. Keep the empty-state CTA "Log your first measurement" and the section named "Body".
3. Remove the now-empty header trailing `Spacer()`/`HeaderActionButtonLabel` from each root header `HStack`; keep the eyebrow/title/subtitle copy.
4. If `HeaderActionButtonLabel` has no remaining consumers, delete it and its file; otherwise leave it and note remaining consumers.
5. Keep Sessions/Exercises/Overview/Days roots without a create action (unchanged). Do not touch pushed DailyIntake Clear/Log.
6. Validate the kept-alive host explicitly: visit every section in a root, switch among them, and confirm only the active section's shell-owned action appears.

**Tests / checks:**

- If any Swift App file is added, removed, or renamed (including deleting `HeaderActionButtonLabel.swift`): `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` before building.
- Sanitized `xcodebuild` build.
- Manual: every root create/log action is visible without scrolling, labeled, VoiceOver-labeled, ≥44pt; navigates to the correct create route; `replace: true` semantics on the create flows are unaffected.
- If root `.bottomBar` was chosen: confirm no overlap/clipping with the tab bar and correct behavior under scroll-minimize.

**Definition of done:**

- All six root primary actions are reliable toolbar chrome, consistently placed, and discoverable without scrolling.
- Body logging reads as an obvious "Log measurement" action.
- `HeaderActionButtonLabel` deleted or its remaining use justified. Build passes.

**Phase commit message:** `feat(ios): move root create actions into reliable toolbar chrome`

### Phase 3 — Session bottom actions + rest-timer integration

**Goal:** Declutter the session bottom bar and integrate the rest timer into reliable bottom chrome, removing the floating overlay and manual padding hacks.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer` · **Routed reviewer:** `nhost-reviewer`

**Scope / files:** `SessionsView.swift`, `RestTimerOverlay.swift`, optionally `Sources/NeoGymKit/` + `Tests/NeoGymKitTests/` for extracted timer formatting/policy.

**Implementation steps:**

1. In `SessionDetailView`, remove the `ZStack(alignment: .bottomTrailing)` floating `RestTimerOverlay`, the content `.padding(.bottom, 120)`, and the overlay `.padding(.bottom, 72)`. Restore normal `.padding(.vertical, NeoGymTheme.screenVerticalPadding)`.
2. Redesign `sessionBottomActionToolbar` (`SessionDetailBottomToolbar`): leading = **rest-timer control** (idle: "Start rest" stopwatch button; running: a compact pill with monospaced remaining time + a stop/clear control), trailing = **"Add exercise"** (primary). Keep both `.disabled(isMutating)` where appropriate. The running pill must live-update from `RestTimerController` and stay pinned above the tab bar.
3. Move **Delete session** to a top-trailing overflow `Menu` (`ellipsis.circle`) with a destructive `Button` that still triggers the existing `isConfirmingDelete` alert from stable state. (Optionally also relocate "Edit date" into that menu; keep it in the summary card if preferred — pick one and note it.)
4. Refactor `RestTimerOverlay.swift`: keep `RestTimerController` and its notification/Live Activity behavior intact. Because the current overlay view hosts `@Environment(\.scenePhase)`, `.onChange(of: scenePhase) { timer.refresh() }`, and the preset `confirmationDialog`, explicitly re-host the scene-phase refresh and confirmation dialog on a surviving view such as `SessionDetailView` or the new timer control. Split presentation into (a) a toolbar-friendly control view usable inside `.bottomBar`, and (b) preset selection via the existing confirmation dialog. Ensure duration selection and Clear remain reachable from the toolbar control.
5. Preserve the per-exercise inline "Add set"/"Add entry" buttons inside `SessionExerciseCard` (they are card-scoped, not session-scoped) — unchanged.
6. Optional: extract `formattedRemaining` and any preset/label mapping into a pure `NeoGymKit` helper and add a unit test; keep it SwiftUI-free.

**Tests / checks:**

- `cd ios/NeoGym && swift test` if timer logic was extracted.
- Sanitized `xcodebuild` build.
- Manual (authenticated): start/stop/clear the timer from the bottom bar; confirm it never floats over content, survives scroll, and updates live; Add exercise opens the picker; Delete lives in the overflow menu and still confirms; VoiceOver order is timer → Add exercise (bottom) and Delete (overflow); Reduce Motion respected; no bottom clipping with keyboard-less content.

**Definition of done:**

- No floating rest-timer overlay and no manual `.padding(.bottom, 120)`/`72` remain in `SessionsView.swift`.
- Session bottom bar shows timer control + Add exercise; Delete is in an accessible overflow menu with its confirmation intact.
- Timer background behavior unchanged. Build (and any extracted tests) pass.

**Phase commit message:** `feat(ios): integrate rest timer into session bottom actions`

### Phase 4 — Consistency audit, accessibility, and docs

**Goal:** Sweep all detail/form/root action surfaces for consistency, resolve stale clearance/inconsistencies, and update documentation.

**Depends on:** Phase 3

**Routed implementer:** `nhost-implementer` · **Routed reviewer:** `nhost-reviewer`

**Scope / files:** all in-scope action-bearing screens (§3), `Theme/NeoGymTheme.swift`, `Nutrition/DailyIntakeViews.swift`, `CLAUDE.md`, `ios/NeoGym/CLAUDE.md`.

**Implementation steps:**

1. Walk the §3 inventory and confirm every detail/form/root screen matches the §2.2 contract: primary actions bottom/labeled, destructive confirmed, back via system, sheets sheet-local. Fix any drift.
2. Verify root-vs-pushed top clearance after Phase 1: `DailyIntakeViews.swift:82` is the root `NutritionDaysView` list and should only change if the title-menu clearance redesign requires it; pushed `DailyIntakeView` should keep normal screen padding and no root-only clearance.
3. Verify accessibility across converted surfaces: VoiceOver order/labels for the title menu, root actions, session bottom bar + overflow, and timer control; Dynamic Type; Reduce Motion; Reduce Transparency; ≥44pt targets; safe areas on small/large devices.
4. Update `CLAUDE.md` and `ios/NeoGym/CLAUDE.md`: replace the "root secondary section bars are a top segmented control" guidance with the title-menu convention; document root primary actions living in `.bottomBar`/`.topBarTrailing` (whichever won the spike); document the session bottom bar (timer + Add exercise) with Delete in overflow; document that the rest timer is bottom-integrated (no floating overlay); reaffirm no `.hidesBottomTabBarWhenPushed()`/custom dock. Keep docs and code in the same commit.

**Tests / checks:**

- Sanitized `xcodebuild` build.
- Full manual authenticated matrix (see §5) across Workouts, Nutrition, Me, forms, and accessibility modes.
- Grep confirms no stale `SecondarySectionBar` segmented usage, no leftover floating-overlay padding, and docs contain no contradictory secondary-tab-bar language.

**Definition of done:**

- All action surfaces consistent with the contract; the stale clearance is resolved.
- Accessibility verified and recorded. Docs match the shipped behavior. Build passes.

**Phase commit message:** `docs(ios): document title-menu nav and reliable bottom actions`

---

## 5. Validation

### 5.1 Build gate

Sanitized Xcode 26 environment (unset Nix `SDKROOT`/`CC`/`CXX`/`LD`/`AR`/`LDFLAGS` per `ios/NeoGym/CLAUDE.md`):
`cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`.
`swift test` only if pure logic is extracted in Phase 3.

### 5.2 Manual authenticated simulator matrix

Boot an iOS 26 simulator, sign in with email OTP (MailHog via local backend if used), then verify:

- **Workouts:** title menu switches Sessions/Workouts/Exercises; "New workout" reachable without scrolling; open a session → bottom bar shows timer + Add exercise, Delete in overflow (confirms), rest timer starts/stops/clears without floating; workout/exercise detail Start/Edit reachable.
- **Nutrition:** title menu across Overview/Days/Plans/Foods/Meals; New food/meal/plan reachable; Days → DailyIntake Clear/Log reachable and not clipped.
- **Me:** title menu across Profile/Body/Journal; "Log measurement" obvious and reachable; body/journal create → detail flows; measurement detail Edit reachable.
- **Cross-cutting:** tab switches preserve per-root path/section state; sheets keep local actions; keyboard forms keep Done + Save/Cancel reachable.
- **Accessibility:** VoiceOver order/labels for title menu, root actions, session bottom bar + overflow, timer; Dynamic Type (largest); Reduce Motion (no scale/animation); Reduce Transparency; safe areas on a small and a large device; no bottom clipping.

Record simulator OS/build, device class, and pass/fail per row in each phase's implementation log. If interactive authenticated validation cannot be completed headlessly, record it honestly as a residual manual item rather than claiming it.

---

## 6. Risks and mitigations

- **Root `.bottomBar` overlaps/clips the tab bar.** — Phase 1 spike decides; `.topBarTrailing` labeled fallback keeps actions reliable either way.
- **`.toolbarTitleMenu` discoverability (users miss the chevron).** — Current-section-as-title + chevron is the native pattern; validate in the manual matrix; the chip-row alternative is documented if it truly fails.
- **Title conflicts from the keep-alive host.** — Hoist the title to the shell and strip per-section root titles (Phase 1 step 4).
- **Timer hoisted incorrectly / loses background behavior.** — Keep `RestTimerController` and its notification/Live Activity/`scenePhase` logic byte-for-byte; only change presentation.
- **Section transition/Reduce Motion regressions.** — Preserve the existing `withAnimation`/scale suppression from `SecondarySectionBar`/`SecondarySectionContentHost`.
- **Headless simulator can't authenticate.** — Record as residual manual validation, as prior phases did.

## 7. Open questions / implementation choices

No blocking open questions remain.

- **Rest timer scope:** this plan intentionally keeps the timer session-scoped in the session bottom bar. A global `tabViewBottomAccessory` timer (Apple Music-style) is deferred as a follow-up because it requires hoisting `RestTimerController` ownership to `AppShellView`.
- **"Edit date" placement:** keep it in the summary card unless the implementer finds the session overflow menu cleaner; either is acceptable if recorded in the phase log and reviewed.

---

## 8. Implementation execution protocol

Per phase, starting at the first unimplemented one: **Implement** (routed implementer, fresh context, full plan + current phase, write/adjust tests for extracted logic) → **Review** (routed reviewer, inspect the diff, run checks) → **Improve** (scoped to the phase) → **Repeat** until accepted → **Commit** with the phase commit message after checks pass or skips are justified → **Continue**. If the loop stalls or a plan-level issue surfaces, stop and ask the user.

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

---

_Planned by Claude Opus 4.x (claude-opus-4-8) acting as planning architect._
