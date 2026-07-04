# iOS 26 navigation redesign v2 — no bottom tab bar; nav on top, one bottom action bar

Status: accepted (Paradigm 2 chosen by user 2026-07-04)
Date: 2026-07-04

## Decisions locked (2026-07-04)

- **Paradigm 2** (area segmented + per-area hub drill-down) chosen. Q1 resolved.
- Q2 area control: segmented `Picker` for the 3 areas (as assumed).
- Q3 Phase 1 interim area-switcher placement: implementer's discretion; must be removed/folded by Phase 3.
- Q4 hub content: pure navigation index of subsections for v2 (no recent/quick items).
- Q5 area-switch-from-depth: accepted — area switch only at the hub root.
- Q6 iPad/`NavigationSplitView`: later follow-up, out of scope.
- Phase 0 (throwaway spike) is folded into Phase 1; the human visual acceptance happens
  on the Phase 1 build rather than a separate spike branch.
Area: `ios/NeoGym/App/` (SwiftUI shell; iOS 26.0-only app target)
Supersedes the *recommended paradigm* of `.nhost-code/plans/20260704-ios26-nav-tabs-actions-redesign.md`
(that plan kept the bottom `TabView`; **v2 removes it entirely**). The prior plan's
`.bottomBar` inventory and its already-shipped **Phase 1** (`nativeFormActionToolbar` → top
Cancel/Save/overflow, commit `e82794dd`) are still valid and are **carried forward, not redone**.

## Hard constraint (supersedes the old paradigm)

Remove the bottom tab bar. Primary navigation (the three areas: **Workouts / Nutrition / Me**)
**and** secondary-section navigation both move to the **top**. The **bottom** becomes a **single
contextual action bar only** (create/log/primary actions + the rest timer). Exactly **one** bottom
band, and it holds **actions, not tabs**. User's reasoning: a bottom tab bar *plus* a second bottom
action band is "overkill and ugly" regardless of iOS 26 minimize/collapse behavior.

**Native-convention honesty up front:** iOS convention is *bottom = primary nav, top = actions*.
Inverting to *nav-on-top + actions-on-bottom* runs against that convention. The two places this
risks feeling non-native are called out per paradigm: (1) primary destinations no longer persist
across navigation depth the way a bottom tab bar does (top nav bars are replaced on push), and
(2) a bottom bar that carries a persistent utility (rest timer) *and* a primary create action is
unusual. Both are addressed below.

---

## Current architecture (verified against the repo, 2026-07-04)

- **`App/AppShellView.swift`** — `TabView(selection: $selection)` of three value-based `Tab`s for
  `AppDestination` `.workouts` / `.nutrition` / `.me`. `.tabBarMinimizeBehavior(reduceMotion ?
  .never : .onScrollDown)` (line 80). A single `.tabViewBottomAccessory { … }` (line 81, iOS 26.0
  content-only overload) renders `RestTimerToolbarControl(timer: restTimer)` gated on `selection ==
  .workouts && workoutsHasSessionDetail`. `restTimer` is a shell-owned `@StateObject
  RestTimerController`. This entire `TabView` (and its accessory) is what must go away.
- **Three area shells**, each with the same shape:
  - `App/WorkoutsShellView.swift` (`WorkoutsSectionNavigationView`) — sections
    `WorkoutAreaSection` = sessions / workouts / exercises; also owns the
    `workoutsHasSessionDetail` binding, synced via `.onChange(of: path)`.
  - `App/Nutrition/NutritionShellView.swift` (`NutritionNavigationView`) — sections
    `NutritionSection` = overview / days / plans / foods / meals.
  - `App/MeShellView.swift` (`MeNavigationView`) — sections `MeSection` = profile / body / journal.
  - Each holds `@State selection: <Section>`, `@State path: [<Route>]`, a `NavigationStack(path:)`
    with `.navigationDestination(for:)`, a keep-warm `SecondarySectionContentHost(selection:)` that
    mounts visited sections (opacity/scale), a principal `SectionTitleMenu` shown only when
    `path.isEmpty` (the "hidden, undiscoverable" menu), and a `RootPrimaryActionToolbar`
    (`.bottomBar`) shown at `path.isEmpty && selection == <section-with-a-create-action>`.
- **`App/Components/SecondarySectionBar.swift`** — `SecondaryTabSection` protocol,
  `SecondarySectionContentHost` (keep-warm ZStack, `accessibilityHidden` on non-selected,
  Reduce-Motion-gated scale/opacity), `SectionTitleMenu` + `SectionTitleMenuContent`.
- **`App/Components/NavigationChrome.swift`** — `RootPrimaryActionToolbar` (still `.bottomBar`,
  `Spacer()`-then-trailing, line 9). `nativeFormActionToolbar` was **already migrated** to
  top-leading `.cancellationAction` Cancel + top-trailing `.confirmationAction` Save + top-trailing
  overflow Delete (prior Phase 1). **Pushed forms already use top actions — keep as-is.**
- **`App/AppNavigationRoutes.swift`** — typed route enums per area (`WorkoutsRoute`,
  `NutritionRoute`, `MeRoute`). Sections render **inline** via `SecondarySectionContentHost`; they
  are **not** routes today.
- **Detail `.bottomBar` sites** (the single-bottom-band inventory to reconcile):

  | Site | Current `.bottomBar` contents | Has a leading control? |
  |---|---|---|
  | `SessionsView.swift:581` (`SessionDetailBottomToolbar`) | Add exercise (trailing); Delete session in top overflow (`:557`) | no |
  | `WorkoutDetailView.swift:54` | **Edit workout (leading)** · Start session (trailing) | yes |
  | `ExerciseDetailView.swift:35` | Start session (trailing) | no |
  | `Nutrition/DailyIntakeViews.swift:255` | **Clear day log (leading, destructive)** · Log (trailing) | yes |
  | `Nutrition/FoodDetailAndFormViews.swift:38` | Edit food (trailing) | no |
  | `Nutrition/MealDetailView.swift:35` | Edit meal (trailing) | no |
  | `Nutrition/PlanDetailView.swift:35` | Edit plan (trailing) | no |
  | `BodyViews.swift:218` | Edit measurement (trailing) | no |
  | `JournalViews.swift:293` | Edit entry (trailing) | no |
  | `Components/NavigationChrome.swift:9` (`RootPrimaryActionToolbar`) | root create/log (trailing) | no |
  | `AppShellView.swift:81` rest timer | `tabViewBottomAccessory` (separate band above tab bar) | — |

- **`project.yml`** collects the app target's sources as a **directory glob** (`- path: App` with
  `excludes`), so new `App/*.swift` files are picked up automatically — but `xcodegen generate` must
  still run **before** `xcodebuild` after any add/remove (a stale project omits new sources →
  misleading "cannot find type" errors).

**Consequence of removing `TabView`:** `.tabViewBottomAccessory`, `.tabBarMinimizeBehavior`, and the
`workoutsHasSessionDetail` + `.onChange(of: path)` plumbing all disappear. The old
minimized-tab-pill collision risk disappears too — with no tab pill, a **leading** `.bottomBar`
control (needed to host the rest timer) is safe again. That is the key enabler for putting the rest
timer *and* a contextual action in the one bottom bar.

---

## Success criteria (from the task)

- Exactly one bottom band (actions); **no** bottom tab bar; navigation lives at the top.
- Every area **and** every subsection reachable **and discoverable** (no reliance on a hidden menu
  as the sole affordance for primary nav).
- Rest timer and a contextual primary action (Add exercise) coexist cleanly in the one bottom bar.
- Consistent, native-feeling chrome; `NeoGymTheme` glass language intact.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS
  Simulator' build` succeeds; `NeoGymKit` `swift build` / `swift test` unaffected.
- iOS 26.0 floor, no older-OS branches; `NeoGymKit` stays free of SwiftUI/UIKit.
- Reduce Motion honored; 44pt targets + accessibility labels on icon-only controls.
- **Both** `CLAUDE.md` (root iOS paragraph) and `ios/NeoGym/CLAUDE.md` (Native iOS design guide)
  rewritten **in the same phase** as each code change; both currently assert a bottom `TabView` with
  three value-based roots and a tab-view-accessory rest timer — all of that must be replaced.

---

## Paradigms considered

All three satisfy the hard constraint (no bottom tabs; nav on top; one bottom action bar). They
differ in the **top-nav mechanism** — specifically how the user reaches the three areas and each
area's subsections — not in cosmetics.

### Paradigm 1 — Two-level top segmented nav (native, lowest churn)

**Top-nav mechanism.** Both levels are stock segmented controls, shown at the stack root only.

- **Area (Workouts / Nutrition / Me):** a segmented `Picker(...).pickerStyle(.segmented)` — the
  loud, always-visible primary switch. Rendered either in a shell-owned glass bar pinned above the
  per-area `NavigationStack`s (persistent → switch area from any depth) **or** in each root's
  `.safeAreaInset(edge: .top)` (root-only).
- **Subsection:** a second segmented `Picker` directly beneath the area control at the stack root,
  reusing `SecondaryTabSection` + the keep-warm `SecondarySectionContentHost` (sections stay
  **inline**, not routes). Both segmented rows collapse when a route is pushed; the pushed screen
  shows the standard back button + title.
- **Root create/log:** single `.bottomBar` (keep `RootPrimaryActionToolbar`, gated on
  `path.isEmpty && selection`).
- **Per-detail actions (Add exercise / Start / Log / Edit / Delete):** stay in the same single
  `.bottomBar` (this *is* the one bottom band now; no tab pill, so leading controls are safe).
- **Rest timer:** leading `.bottomBar` control on session detail, `Spacer()`, Add exercise
  trailing.
- **iOS 26 APIs:** `Picker`/`.segmented` (native), `.safeAreaInset(edge:.top)` (native),
  `ToolbarItemGroup(placement:.bottomBar)` (native), `NavigationStack(path:)` unchanged. The only
  non-native element is the optional shell-owned glass container for the persistent area bar.

**Tradeoffs.** Native-feel: high (all stock controls). Discoverability: high (both levels always
visible at root). One-handed reach: top controls are a stretch on large phones (area+subsection at
the very top) — the classic cost of top nav. iPad: acceptable but not special. Migration cost:
**lowest** — reuses `SecondaryTabSection`, `SecondarySectionContentHost`, and the route enums
almost unchanged; mainly swaps `SectionTitleMenu` → segmented and replaces `AppShellView`'s
`TabView`. **Risk:** two stacked segmented rows at root are the *top-side* analog of the very
"two-band, overkill" look the user rejected on the bottom; and Nutrition's **five** subsections
crowd a segmented control (needs a scrollable segmented or a menu fallback — honest caveat).

### Paradigm 2 — Area switcher + per-area HUB drill-down (native, cleanest single top bar) — **RECOMMENDED**

**Top-nav mechanism.** One top bar, subsections become content.

- **Area (Workouts / Nutrition / Me):** a segmented `Picker` in the nav bar's **principal** slot at
  each area's **hub root** (3 items fit cleanly; loud, native, always visible at the hub). Keep the
  three per-area `NavigationStack`s mounted keep-warm (ZStack at the shell) so each area remembers
  its drill state; switching area toggles which stack is visible.
- **Subsection:** each area root is a **hub screen** whose *content* lists the area's subsections as
  large tappable rows/cards (Workouts hub → Sessions / Workouts / Exercises; Nutrition hub →
  Overview / Days / Plans / Foods / Meals; Me hub → Profile / Body / Journal). Tapping **pushes**
  the subsection as a route. Subsections become first-class routes; the keep-warm
  `SecondarySectionContentHost` and `SectionTitleMenu` are retired.
- **Root create/log:** each subsection screen owns its create/log in the single `.bottomBar`
  (e.g. Foods list → New food; Body list → Log measurement).
- **Per-detail actions:** single `.bottomBar` (Edit / Start / Add exercise / Log / Delete),
  destructive via role + confirmation, consistent with the shipped form pattern.
- **Rest timer:** leading `.bottomBar` on session detail, `Spacer()`, Add exercise trailing.
- **iOS 26 APIs:** `Picker`/`.segmented` in `.toolbar { ToolbarItem(placement:.principal) }`
  (native), `NavigationStack(path:)` + `.navigationDestination(for:)` (native, subsections just
  become more route cases), `ToolbarItemGroup(placement:.bottomBar)` (native). **No custom chrome
  and no `.safeAreaInset` nav bars.** Fewest iOS-26-version gaps of the three (nothing here is
  26.1-only; the removed `.tabViewBottomAccessory` isEnabled/26.1 concern is now moot).

**Tradeoffs.** Native-feel: **highest** (standard drill-down + a single stock top bar; mirrors the
user's "one clean band" instinct symmetrically — one top bar, one bottom bar). Discoverability:
**highest** for subsections (they are visible content on the hub, not a menu). One-handed reach:
best (subsection entry points are tappable content mid-screen; only the area segmented sits at the
top). iPad: **best** path — a hub maps naturally onto a future `NavigationSplitView`
sidebar/detail. Migration cost: **highest** — subsections convert from inline keep-warm to routes
(new route cases + hub screens per area), and `SecondarySectionContentHost`/`SectionTitleMenu` are
removed. **Costs to accept:** (a) one extra tap to reach a subsection; (b) area switch only at the
hub root (back out of a drill-down first) — this is the honest price of moving primary nav off a
persistent bottom bar; (c) loses the current *instant* cross-subsection switch.

### Paradigm 3 — Distinctive custom-glass unified command bar (branded)

**Top-nav mechanism.** A single custom `GlassPanel` "command bar" under the title that combines
both levels: a leading area control (menu or 3 pills) plus a horizontally scrolling row of the
current area's subsection **capsules**, styled in the NeoGym glass language.

- **Root create/log** and **per-detail actions:** single `.bottomBar` as above. **Rest timer:**
  leading `.bottomBar` on session detail.
- **iOS 26 APIs:** custom SwiftUI (`ScrollView(.horizontal)`, `GlassPanel`/`.glassSurface`,
  `Button`), plus native `.bottomBar`. The command bar itself is **custom chrome**.

**Tradeoffs.** Native-feel: **lowest** (bespoke top control competing with the system nav bar).
Discoverability: medium — offscreen subsection capsules require horizontal scroll (a real
discoverability hit for Nutrition's five). One-handed reach: fine (horizontal swipe). iPad: weakest
(a custom horizontal bar doesn't adapt to a sidebar). Migration cost: medium-high (new component +
accessibility parity: it must behave like a real segmented control — 44pt, labels, VoiceOver
adjustable, Reduce-Motion-safe). **Risk:** highest non-native feel and the most ongoing
maintenance; explicitly the "custom chrome" the repo warns against, justified only by branding.

---

## Recommendation — **Paradigm 2 (area segmented + per-area hub drill-down)**

**Why.** The user's strongest signal is aesthetic minimalism: "one bottom band, not overkill and
ugly." Applied consistently, that argues for a single *top* navigation affordance too — which
Paradigm 2 delivers (one stock top bar + one bottom action bar; a clean symmetric result).
It is the most native (standard drill-down), the most discoverable for subsections (they are
visible content, not a hidden menu — directly fixing the prior "undiscoverable `SectionTitleMenu`"
complaint), scales cleanly to Nutrition's five subsections where segmented controls crowd, and sets
up the best iPad story. Paradigm 1's two stacked segmented rows re-create the very "two-band"
heaviness the user rejected (just on top); Paradigm 3 introduces custom chrome and horizontal-scroll
discoverability problems for a branding gain the user did not ask for.

**Honest downsides accepted:** one extra tap to reach a subsection, area-switch only from a hub
root, and loss of instant cross-subsection switching. These are the genuine cost of moving primary
nav off a persistent bottom bar; they are documented, not hidden.

**Runner-up:** Paradigm 1 — choose it if the user prioritizes instant subsection switching /
area-switch-from-depth / the lowest migration cost over the single-top-bar aesthetic.

### Rest-timer coexistence in the one bottom bar (the fatal flaw of the last design, resolved)

- On the session detail (`SessionDetailView` in `SessionsView.swift`), the single `.bottomBar`
  renders: **leading** `RestTimerToolbarControl(timer:)`, `Spacer()`, **trailing** Add exercise.
  With no `TabView`, there is **no minimized tab pill**, so the leading rest-timer control cannot be
  covered — the exact collision the previous design dodged via the accessory is gone by
  construction.
- `RestTimerController` stays a **shell-owned `@StateObject`** in `AppShellView` (survives area
  switches and drill navigation) and is injected down into the Workouts area → `SessionDetailView`,
  which renders the control in its own `.bottomBar`. This removes the `workoutsHasSessionDetail` /
  `.onChange(of: path)` / accessory-gating machinery entirely.
- If the user navigates off the session detail while the timer runs, the on-screen pill disappears
  but the timer keeps running via the existing Live Activity + local notification (unchanged
  behavior). Surfacing a running timer elsewhere is **out of scope**; noted so it is a conscious
  choice, not an oversight.

---

## Phased migration plan (recommended: Paradigm 2)

Every phase is independently buildable, keeps **every** destination reachable, updates **both**
CLAUDE.md files in-phase to the *actual* post-phase state, and passes the gates. Any phase that
adds/removes `App/*.swift` runs `xcodegen generate` **before** `xcodebuild`.

**Per-phase gates.** `swift build` + `swift test` (NeoGymKit must stay unaffected) **and**
`xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator'
build`. Use the documented clean-env `env -u SDKROOT -u CC -u CXX -u LD -u AR -u LDFLAGS …` wrapper
around `xcodebuild` (see `ios/NeoGym/CLAUDE.md`) to avoid Nix linker-flag breakage.

**Automated-coverage gap (stated explicitly).** There is **no XCUITest harness for `App/`**;
`swift test` only covers `NeoGymKit`. Build-green is the automated ceiling. Therefore **each phase
carries a manual acceptance checklist** the implementer must run in the simulator: every touched
destination reachable and labeled; the phase's target action reachable; rest timer + Add exercise
coexist on session detail; 44pt targets; VoiceOver labels on icon-only controls; Reduce Motion
suppresses custom polish only (native structure intact); no forbidden custom chrome / hidden-link
navigation introduced.

### Phase 0 — Validation spike (throwaway branch, human visual gate, no shipped change)

Prove on **iOS 26.0** before anything depends on it:

1. A shell **without** `TabView` that hosts the three area `NavigationStack`s keep-warm (ZStack) and
   switches area via a nav-bar **principal segmented `Picker`**, preserving each area's drill state
   across switches.
2. Rest timer + Add exercise coexisting in **one** `.bottomBar` on a session detail (leading timer,
   trailing action) — read for overlap, 44pt, and label clarity, with no tab pill present.
3. The **hub** feel for one area (Workouts): hub cards → pushed subsection route → detail.
4. Confirm no reliance on any removed/26.1-only API (`.tabViewBottomAccessory`,
   `.tabBarMinimizeBehavior` are gone; nothing 26.1-only is introduced).

Binary GO/NO-GO recorded in this file under "Phase 0 result" before Phase 2 starts.
**NO-GO fallback:** if the hub drill-down reads poorly, fall back to **Paradigm 1** (segmented
subsections inline) using the same shell surgery from Phase 1; the phases below note the divergence.

### Phase 1 — Remove the `TabView`; introduce the shell area switcher; relocate the rest timer

*The core surgery. Kept small by leaving the area shells' internals (subsection title-menu + inline
keep-warm host + root `.bottomBar` actions) unchanged for now — only the shell and the rest timer
move.*

- Rewrite `App/AppShellView.swift`: replace the `TabView` with a keep-warm **ZStack of the three
  area views** driven by `@State selection: AppDestination`; drop `.tabViewBottomAccessory`,
  `.tabBarMinimizeBehavior`, `pendingSessionId`-as-accessory-gate coupling, and
  `workoutsHasSessionDetail`. Keep `restTimer` as the shell `@StateObject`.
- Add the **area switcher**: a segmented `Picker` bound to `$selection`, rendered in each area
  root's nav-bar **principal** slot (pass `$selection` into the three area views). (Interim: the
  three areas still show their subsection title-menu is a conflict for the principal slot — so in
  this phase host the area switcher in a shell-owned top position *or* temporarily keep the
  subsection title-menu and place the area switcher in `.safeAreaInset(edge:.top)` at each root.
  Whichever is chosen, it is explicitly **temporary** and removed/[folded] in Phase 2.)
- Relocate the rest timer: pass `restTimer` into `WorkoutsSectionNavigationView` →
  `SessionDetailView`; render `RestTimerToolbarControl` as the **leading** item of the session
  detail `.bottomBar` (`SessionsView.swift:581`), Add exercise trailing. Remove the
  `workoutsHasSessionDetail` binding + `.onChange(of: path)` from `WorkoutsSectionNavigationView`.
- Verify the `pendingSessionId` deep-link open-session path still works without the accessory gate.
- **Docs (in-phase):** root `CLAUDE.md` iOS paragraph and `ios/NeoGym/CLAUDE.md` "App shell and
  navigation" — replace "bottom `TabView` with three value-based `Tab` roots" and the
  "`tabViewBottomAccessory` rest timer" invariants with: no `TabView`; three areas hosted keep-warm
  under a top area switcher; rest timer lives as a leading item in the session-detail single
  `.bottomBar`. Remove the "do not move the rest timer into `.bottomBar`" rule (now false) and the
  minimized-tab-pill collision rationale (no longer applicable).
- New files → `xcodegen generate` before `xcodebuild`. **Manual check:** all three areas reachable
  via the top switcher; each area's stack state survives switching; rest timer + Add exercise
  coexist; no tab bar anywhere.

### Phase 2 — Convert subsections to hub drill-down, area by area (2a Workouts, 2b Nutrition, 2c Me)

*Each sub-phase is independently buildable and leaves the other two areas on their Phase-1 interim
state.*

For each area:

- Add subsection **route cases** to the area's enum in `App/AppNavigationRoutes.swift` (e.g.
  `WorkoutsRoute.sessions/.workouts/.exercises`; `NutritionRoute.overview/.days/.plans/.foods/.meals`
  — note `.day(String)` already exists; `MeRoute.profile/.body/.journal`).
- Add a **hub root screen** for the area whose content lists the subsections as tappable
  rows/cards (reuse existing `SectionShell`/`GlassPanel`/row chrome; 44pt + labels), each pushing
  its subsection route. Move the area segmented `Picker` into the hub's principal slot (finalizing
  Phase 1's interim placement for this area).
- Route each subsection's existing list view (`SessionsListView`, `WorkoutsListView`,
  `ExercisesListView`, `NutritionOverviewView`, `NutritionDaysView`, `PlansListView`,
  `FoodsListView`, `MealsListView`, `ProfileView`, `BodyMeasurementsListView`, `JournalListView`)
  through `.navigationDestination(for:)` instead of `SecondarySectionContentHost`.
- Move that area's root create/log from the shell-level `RootPrimaryActionToolbar` gating onto the
  relevant subsection list screen's own `.bottomBar` (each subsection owns its create/log).
- Preserve the existing invalidation/`reloadToken` + callback behavior after create/save/delete.
- **Docs (in-phase):** update the "secondary sections … `SecondarySectionContentHost` keep-warm …
  centered collapsed section menus" sentences for that area to describe hub-drill-down subsections
  as routes; update the root-action sentence to "each subsection list owns its create/log in the
  single bottom bar."
- New files → `xcodegen generate`. **Manual check:** hub lists all subsections; each pushes and is
  reachable; create/log reachable on each subsection; back returns to hub; area switch works from
  the hub.

### Phase 3 — Consolidate the single bottom action bar; reconcile detail actions

- With all areas on the hub model, remove the shell/interim area-switcher scaffolding left from
  Phase 1 (the `.safeAreaInset`/temporary container), confirming the area segmented lives only in
  each hub's principal.
- Reconcile per-detail `.bottomBar` sites so the single bottom band is consistent (they already use
  `.bottomBar`; verify Edit/Start/Add exercise/Log placement, destructive Delete via role +
  confirmation, and the rest-timer-leading layout on session detail). No behavior change beyond
  consistency; this is where the "exactly one bottom band" invariant is asserted.
- **Docs (in-phase):** finalize the per-detail action sentences and the "single bottom action bar
  (create/log + rest timer + detail actions)" description in both files.
- **Manual check:** every detail action reachable; single bottom band everywhere; rest-timer
  coexistence intact.

### Phase 4 — Cleanup, dead-code sweep, final doc reconciliation + DoD grep

- Delete now-unused `SecondarySectionContentHost`, `SectionTitleMenu`, `SectionTitleMenuContent`
  (`App/Components/SecondarySectionBar.swift`), the `SecondaryTabSection` protocol if fully unused,
  and `RootPrimaryActionToolbar` (`App/Components/NavigationChrome.swift`) once no call sites remain.
  Keep the shipped `nativeFormActionToolbar` untouched.
- **DoD grep:** `grep -rn "TabView\|tabViewBottomAccessory\|tabBarMinimizeBehavior\|SectionTitleMenu\|SecondarySectionContentHost" ios/NeoGym/App` returns nothing (sheet-local `NavigationView` wrappers are still allowed and intentional).
- **Requirement-traceability pass** with the manual checklist: exactly one bottom band; no bottom
  tab bar; every area+subsection reachable and discoverable; rest timer + contextual action coexist;
  Reduce Motion honored; 44pt + labels.
- **Final doc reconciliation:** both CLAUDE.md files describe only the shipped end state with **zero
  stale claims** — every sentence about `TabView`, value-based `Tab` roots, the tab-view-accessory
  rest timer, `.tabBarMinimizeBehavior`, the minimized-pill collision rationale, centered collapsed
  section menus, and `RootPrimaryActionToolbar` `.bottomBar` gating must be gone or rewritten.
- Final gates + `xcodegen generate` if any App files changed.

---

## Risks & mitigations

- **Big-bang shell surgery in Phase 1** (removing `TabView` is atomic) → de-risked by the Phase 0
  spike and by leaving area-shell internals unchanged in Phase 1 (only the shell + rest timer move).
- **No App-level UI test harness** → per-phase manual acceptance checklists; build-green is the
  honest automated ceiling. Do not claim UI correctness from a green build alone.
- **Loss of area-switch-from-depth / instant subsection switch vs bottom tabs** → accepted,
  documented tradeoff of nav-on-top; hub content makes subsections *more* discoverable in exchange.
- **Rest timer not visible off session detail** → keeps running via Live Activity + notification
  (unchanged); out-of-scope to surface elsewhere; noted so it is a conscious choice.
- **Reduce Motion** → after `TabView` removal the `.tabBarMinimizeBehavior` gate is gone; keep the
  Reduce-Motion gate on any hub/section transition polish and rely on system-honored push
  animations otherwise.
- **iPad** → out of scope; Paradigm 2's hub is the cleanest future `NavigationSplitView` seed. Do
  not add `.sidebarAdaptable` (it reintroduces a bottom tab bar in compact width).
- **Custom chrome creep** → recommended path uses only native controls (segmented `Picker`,
  `.bottomBar`, `NavigationStack`); if any interim shell container is used in Phase 1 it must be
  removed in Phase 3. Any custom chrome that survives must be called out and justified.
- **Doc drift** → each phase rewrites only the sentences it invalidates; Phase 4 reconciles both
  files to the shipped state.

## Open questions (for the user, not invented here)

1. **Paradigm choice.** Confirm **Paradigm 2** (recommended, single top bar + hub) vs **Paradigm 1**
   (two-level top segmented, lower churn, instant switching) vs **Paradigm 3** (custom-glass command
   bar). The phased plan above is written for Paradigm 2.
2. **Area control style.** Segmented `Picker` for the 3 areas (recommended: loud, native) vs a
   nav-title menu (quieter, one tap to reveal). Segmented is assumed.
3. **Phase 1 interim area-switcher placement.** Shell-owned top container vs a temporary
   `.safeAreaInset(edge:.top)` at each root while the subsection title-menu still occupies the
   principal slot — a purely transitional choice removed in Phase 2/3. Any preference?
4. **Hub content design.** Cards vs simple rows for the hub subsection entries, and whether the hub
   should also surface recent/quick items (e.g. recent sessions on the Workouts hub) or stay a pure
   navigation index. Assumed: pure navigation index of subsections for v2.
5. **Area-switch-from-depth.** Confirm it is acceptable that area switching happens only at a hub
   root (back out of a drill-down first), given no bottom tab bar persists across depth.
6. **iPad timing.** Confirm iPad/`NavigationSplitView` is a later follow-up, out of this migration.

---

*Planning sign-off — self-identified model: `claude-opus-4-8`. No code was modified; this document
is the sole deliverable. File paths and line numbers were verified against the repository on
2026-07-04.*

---

## Phase 1 — Implementation log (2026-07-04, COMPLETE)

Implemented via implementer/reviewer subagents; reviewer verdict ACCEPT (no blockers).

**Files changed:**

- `App/AppShellView.swift` — removed `TabView`/`Tab`/`.tabBarMinimizeBehavior`/`.tabViewBottomAccessory`/`workoutsHasSessionDetail`; added keep-warm ZStack via `areaView(_:content:)` (active shown; inactive `opacity(0)` + `accessibilityHidden` + `allowsHitTesting(false)`); added `AppAreaSwitcher` (segmented `Picker`, transitional).
- `App/WorkoutsShellView.swift` — dropped `hasSessionDetail`/`.onChange(of: path)`; added `areaSelection` binding + `restTimer`; hosts switcher via root `.safeAreaInset(edge:.top)` gated on `path.isEmpty`; passes `restTimer` into `SessionDetailView`.
- `App/SessionsView.swift` — `SessionDetailView` gains `restTimer`; `SessionDetailBottomToolbar` renders `RestTimerToolbarControl` leading, `Spacer()`, Add exercise trailing.
- `App/Nutrition/NutritionShellView.swift`, `App/MeShellView.swift` — `areaSelection` binding + root `.safeAreaInset` switcher.
- Root `CLAUDE.md` + `ios/NeoGym/CLAUDE.md` — rewritten to the no-`TabView` end state.

**Gates (all green):** `swift build` ✓ · `swift test` 189+3 ✓ · `xcodebuild -scheme NeoGym` BUILD SUCCEEDED ✓.
Gates required running under real Xcode (`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`,
unset `SDKROOT`/`LD`/`AR`/Nix `*FLAGS`) because this session's Nix devshell repoints `xcode-select`
at an incompatible SDK.

**Owed (human, simulator-only):** visual acceptance of the keep-warm switching, switcher hiding on
push, rest-timer + Add-exercise coexistence layout, and the interim double-top-chrome (segmented
switcher under the principal `SectionTitleMenu`).

**Noted behavior change (from reviewer):** the keep-warm ZStack mounts all three areas at launch,
so each area's root list may fetch eagerly at startup (previously lazy per-`Tab`). Acceptable
keep-warm tradeoff; revisit with visited-set lazy mounting in a later phase if startup load is a
problem.
