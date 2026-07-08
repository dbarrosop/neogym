# iOS 26 navigation, tabs & actions redesign

Status: active (user sign-off received 2026-07-04; open questions resolved)
Date: 2026-07-04
Area: `ios/NeoGym/App/` (SwiftUI shell; iOS 26.0-only app target)

## Provenance

Produced with the `nhost-architect` workflow: two model-diverse planning branches, then a
two-model feedback round on a synthesized draft. Both feedback reviews returned
**NEEDS_REVISION** with converging findings; this plan folds them in.

- Planning artifacts: `.nhost-code/tmp/architect/20260704-ios26-nav-tabs-actions-redesign_ARCHITECT_{claude_opus_4_8,gpt_5_5}.md`
- Feedback round: `.nhost-code/tmp/architect/20260704-ios26-nav-tabs-actions-redesign_FEEDBACK.md`
- Model-attribution note: the gpt-5.5 planning branch self-reported its model as `unknown-openai`
  and its review branch as `unknown-gpt` (self-ID drift, not a real result difference). The Opus
  branch self-reported `claude-opus-4-8` in both rounds. True cross-family diversity was achieved
  in this round (the gpt/Codex usage limit that blocked the first attempt cleared).

## Problem

The signed-in shell mixes a **minimizable root tab bar** with **per-screen `.bottomBar` toolbar
actions** and a **tab-view bottom accessory**. Three concrete defects result:

1. **Minimize collision.** On scroll-down the tab bar collapses into a *system-anchored leading
   pill*. Any leading `.bottomBar` control lands under it. The concrete offender is
   `nativeFormActionToolbar` in `App/Components/NavigationChrome.swift:9`, whose group is
   `Button("Cancel", role: .cancel)` → `Spacer()` → trailing — the leading Cancel is exactly
   what the pill covers. (`RootPrimaryActionToolbar` at `NavigationChrome.swift:3` is
   `Spacer()`-then-trailing, so it has no leading control and does not collide.)
2. **Size mismatch.** System-sized tab items vs `.bottomBar` button metrics never match; both are
   system-owned and cannot be forced to the same size.
3. **Hidden sections.** Sessions/Workouts/Exercises, Nutrition subsections, and
   Profile/Body/Journal are reachable only through a centered navigation-title menu
   (`SectionTitleMenu`, `App/Components/SecondarySectionBar.swift:12`) — undiscoverable.

User reference: NetNewsWire and the app's own Food detail — icon-forward tabs with a detached
trailing action pill in the tab-bar region.

## Success criteria

- No minimize/overlap collision in any state (expanded or minimized tab bar).
- Consistent, discoverable, one-handed-reachable actions; sizing reads native.
- Every current destination still reachable; every current create/log/edit/start/add/delete action
  still reachable.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
  succeeds; `swift build` / `swift test` for `NeoGymKit` unaffected.
- Reduce Motion honored (custom section-switch / accessory polish suppressed, native nav intact).
- 44pt targets and accessibility labels for any icon-only control.
- Both `CLAUDE.md` (root iOS paragraph) and `ios/NeoGym/CLAUDE.md` (Native iOS design guide) updated
  in the *same* phase that changes each invariant, describing the actual post-phase state.

## Constraints (carried from CLAUDE.md)

- Keep `NeoGymTheme` glass visual language; navigation structure/chrome is fair game.
- iOS 26.0 floor, no older-OS branches. Use the **content-only** `.tabViewBottomAccessory { ... }`
  (26.0); do **not** use the `isEnabled:` overload (26.1+).
- `NeoGymKit` stays free of SwiftUI/UIKit (must still `swift build` / `swift test` on macOS).
- Forbidden unless a phase explicitly revisits and justifies: UIKit parent-chain tab-bar hiding, the
  removed `.hidesBottomTabBarWhenPushed()` alias, custom dock chrome, new hidden-link navigation.
- Sheet-local `NavigationView` wrappers for modal editors/pickers remain intentional.
- After adding/removing `App/*.swift` files, run `nix develop ../.. --command xcodegen generate`
  **before** `xcodebuild` (a stale project omits new sources → misleading "cannot find type" errors).

## Out of scope

Backend, GraphQL/data model, Hasura, auth flows, widget/Live-Activity internals. The rest timer's
*placement* is in scope; its timer logic is not.

---

## Paradigms considered

### A — Three roots + visible section switcher + rest-timer accessory + top-trailing detail actions (RECOMMENDED)

- **Roots:** keep value-based `TabView` roots Workouts / Nutrition / Me (native tab presentation;
  icon-only is *not* forced — see Decisions).
- **Sections:** replace the hidden `SectionTitleMenu` with a **visible root section switcher**
  (segmented control or chip row — open question) reusing `SecondaryTabSection` + the keep-warm
  `SecondarySectionContentHost`. No extra navigation level.
- **Root create/log actions** (New workout/food/meal/plan, Log measurement, New entry): the single
  shell-owned `tabViewBottomAccessory` as a detached action pill (the reference look). These render
  only at `path.isEmpty` for the matching section — i.e. **never** while a session detail (and thus
  the rest timer) is on screen, so they never contend for the one accessory slot.
- **Rest timer:** stays the sole accessory occupant while a session detail is on the Workouts stack.
- **Detail primary actions** (Add exercise, Start session, Log, Edit): native **top-trailing**
  toolbar items owned by each detail view. Destructive (Delete, Clear day): top-trailing overflow +
  confirmation.
- **Forms:** Cancel → top-leading `.cancellationAction`; Save → top-trailing `.confirmationAction`;
  Delete → top-trailing destructive/overflow. Retire `nativeFormActionToolbar`'s bottom bar.
- **Why recommended:** kills the collision *by construction* (no leading `.bottomBar` control
  remains under the pill; root accessory is trailing and mutually exclusive with the timer), kills
  the size mismatch for the surfaced pill, fixes discoverability, and — critically — keeps
  `AppShellView` from having to know every route's local action/enabled state. This is the synthesis
  the feedback round converged on: **detail actions stay local/top-trailing; the accessory is for
  the rest timer and root create/log only.**

### B — Flatten sections into many first-class tabs / `.sidebarAdaptable` (rejected)

Promote Sessions/Workouts/Exercises/Days/Foods/Meals/Plans/Body/Journal/Profile to peer tabs. Most
discoverable, best iPad story via `.tabViewStyle(.sidebarAdaptable)`, but too many peer tabs on
iPhone, demotes the clean 3-area model, and is the biggest rewrite. Deferred as a possible iPad
follow-up only.

### C — Per-root `NavigationSplitView` hub (rejected)

Each root becomes a sidebar/list of sections + detail column. Excellent on iPad, but on iPhone it
turns section choice into an extra navigation level and weakens one-handed reach; it "fixes"
collisions by abandoning bottom actions rather than delivering the requested detached pill.

---

## Key decisions (resolved from feedback)

- **Accessory scope = rest timer + root create/log only.** Detail actions do **not** go in the
  accessory. This resolves the functional conflict both reviewers flagged: the single accessory slot
  cannot host the rest timer *and* "Add exercise" simultaneously during a live session.
- **Detail actions = top-trailing, view-local.** Keeps `AppShellView` decoupled from per-route
  state; no action-registration/stale-closure machinery needed. Answers the plan's own "multiplex?"
  question: **no.**
- **Fix the reported bug first.** The `nativeFormActionToolbar` leading-Cancel migration is
  independent of the switcher/accessory work and is the headline defect — it moves to **Phase 1**.
- **Icon-only is not a hard requirement.** Success criteria ask for size parity + labels, not
  icon-only. Keep native tab label density; do not fabricate custom tab chrome to force icon-only.
- **Edit → top-trailing** (not accessory), consistent with all other detail actions.

## Current `.bottomBar` / menu inventory → target disposition

| Site | Current | Target |
|---|---|---|
| `Components/NavigationChrome.swift:3` `RootPrimaryActionToolbar` | root `.bottomBar`, trailing | → shell accessory pill (Phase 2), then delete |
| `Components/NavigationChrome.swift:53` `nativeFormActionToolbar` (leading Cancel) | form `.bottomBar` | → top-leading Cancel / top-trailing Save (Phase 1) |
| `WorkoutsShellView.swift:72` `SectionTitleMenu` | hidden principal menu | → visible switcher (Phase 1a) |
| `NutritionShellView.swift:71` `SectionTitleMenu` | hidden principal menu | → visible switcher (Phase 1a) |
| `MeShellView.swift:68` `SectionTitleMenu` | hidden principal menu | → visible switcher (Phase 1a) |
| `SessionsView.swift:581` Add exercise | detail `.bottomBar` | → top-trailing (Phase 3) |
| `WorkoutDetailView.swift:54` Edit / Start session | detail `.bottomBar` | → top-trailing (Phase 3) |
| `ExerciseDetailView.swift:35` Start session | detail `.bottomBar` | → top-trailing (Phase 3) |
| `Nutrition/DailyIntakeViews.swift:255` Log / Clear day | detail `.bottomBar` | → Log top-trailing; Clear day overflow+confirm (Phase 4) |
| `Nutrition/FoodDetailAndFormViews.swift:38` | detail `.bottomBar` | → top-trailing (Phase 4) |
| `Nutrition/MealDetailView.swift:35` | detail `.bottomBar` | → top-trailing (Phase 4) |
| `Nutrition/PlanDetailView.swift:35` | detail `.bottomBar` | → top-trailing (Phase 4) |
| `BodyViews.swift:218` | detail `.bottomBar` | → top-trailing (Phase 4) |
| `JournalViews.swift:293` | detail `.bottomBar` | → top-trailing (Phase 4) |
| `WorkoutFormViews.swift:229` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 (via helper rewrite) |
| `BodyViews.swift:550` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 |
| `JournalViews.swift:606` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 |
| `Nutrition/FoodDetailAndFormViews.swift:342` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 |
| `Nutrition/MealEditorViews.swift:237` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 |
| `Nutrition/PlanEditorViews.swift:240` `nativeFormActionToolbar` | form `.bottomBar` | Phase 1 |
| `AppShellView.swift:81` rest timer accessory | `tabViewBottomAccessory` | unchanged (sole occupant) |

**Definition-of-done grep (final):** no tab-visible pushed/root `ToolbarItemGroup(placement: .bottomBar)`
remains in `App/`; sheet-local `NavigationView` toolbars are allowed.

---

## Phases

Each phase is independently buildable, shippable, keeps every destination reachable, updates docs
in-phase to the *actual* post-phase state, and runs the gates. Any phase that adds/removes
`App/*.swift` runs `xcodegen generate` **before** `xcodebuild`.

**Per-phase gates:** `swift build` + `swift test` (NeoGymKit unaffected) and
`xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.

**Per-phase manual acceptance checklist** (this is a UI redesign; `swift test` only covers
NeoGymKit, and there is no XCUITest harness for `App/` — stated explicitly as a coverage gap):
every touched destination reachable and labeled; the phase's target action reachable; no overlap
with the minimized tab pill; 44pt targets; VoiceOver labels present on icon-only controls; Reduce
Motion suppresses custom polish; no forbidden API/custom chrome introduced. Each phase's checklist
names the specific requirement(s) (collision / size mismatch / discoverability) it closes.

### Phase 0 — Validation spike (throwaway branch, no shipped change)

Prove the accessory-as-action-pill assumption on **iOS 26.0** before anything depends on it.

Binary GO/NO-GO criteria (record the written decision in this plan file under "Phase 0 result"
before starting Phase 2 — the throwaway branch must not be the only record):

- Accessory action pill renders and reads as a **detached trailing pill** (reference look), meets
  44pt, and does **not** overlap tab-bar hit targets when the bar is expanded *or* minimized.
- An **empty/absent** accessory (e.g. Workouts *Sessions*/*Exercises* sections have no root action;
  only *Workouts* does) collapses cleanly with no reserved empty bar and no appear/disappear jitter
  on section switch.
- Swapping accessory content on section/route/tab change does not drop or glitch the rest timer.
- **Size-parity check (requirement 2):** the root action pill reads as size-matched to the tab bar.
  If this cannot be demonstrated, requirement 2 is unmet even if the collision is gone — record it.
- Top-leading Cancel / top-trailing Save read natively with the tab bar visible.
- Confirm only the content-only `.tabViewBottomAccessory { ... }` overload is used (no `isEnabled:`).

Also prototype **both** section-switcher forms (glass chip row vs native segmented control) and pick
from screenshots — this choice feeds Phase 1a.

Evidence: screenshots/recordings for expanded bar, minimized pill, root accessory action, session
detail with rest timer, pushed form with top Cancel/Save, and both switcher-form prototypes.

**NO-GO fallback:** if the accessory can't be a clean size-matched action pill, root create/log
actions also move **top-trailing** (drop the accessory action pill; keep the accessory for the rest
timer only). Phases 2–4 then all use top-trailing uniformly.

### Phase 1 — Fix the reported collision (form toolbars) + docs

- Rewrite `nativeFormActionToolbar` (`Components/NavigationChrome.swift:53`) to emit top-leading
  `.cancellationAction` (Cancel) and top-trailing `.confirmationAction` (Save), destructive in
  top-trailing overflow — preserving roles, disabled/loading state, and confirmation behavior.
- All six call sites (`WorkoutFormViews`, `BodyViews`, `JournalViews`, `FoodDetailAndFormViews`,
  `MealEditorViews`, `PlanEditorViews`) inherit the fix through the helper; verify each.
- Docs: update both CLAUDE.md form-toolbar sentences to top-bar Cancel/Save.
- Closes requirement **1** (collision) for forms — the headline bug — first.

### Phase 1a — Visible section switcher + docs

- Add a visible root section switcher component (reuse `SecondaryTabSection`; respect Reduce Motion;
  44pt + labels), replacing the hidden `SectionTitleMenu` in all three shells
  (`WorkoutsShellView:72`, `NutritionShellView:71`, `MeShellView:68`). Keep
  `SecondarySectionContentHost` keep-warm mounting; re-verify non-selected sections stay
  `accessibilityHidden`.
- Routes and all actions unchanged this phase.
- Docs: describe the visible switcher replacing the title menu. Do **not** yet claim actions moved.
- Closes requirement **3** (discoverability). New file → `xcodegen generate`.

### Phase 2 — Shell accessory action coordinator + migrate ROOT actions (GO path only)

- Add a shell accessory action model (title, SF Symbol, a11y label, disabled/loading, role,
  closure); render inside the existing `.tabViewBottomAccessory`. Root actions gate on
  `path.isEmpty && selection == X` — mutually exclusive with the rest timer, so no coexistence
  logic is needed.
- Migrate `RootPrimaryActionToolbar` usages (`WorkoutsShellView:80`; `NutritionShellView:79/86/93`;
  `MeShellView:76/83`) to accessory payloads; delete `RootPrimaryActionToolbar`.
- Docs: root primary actions are the shell accessory pill, not `.bottomBar`.
- (NO-GO path: root actions → top-trailing instead; skip the coordinator.) New file → `xcodegen`.

### Phase 3 — Workouts detail actions → top-trailing + docs

- `SessionsView` Add exercise (`:581`), `WorkoutDetailView` Edit/Start (`:54`),
  `ExerciseDetailView` Start (`:35`) → top-trailing toolbar items; Delete session stays
  top-trailing overflow. Rest timer remains the sole accessory occupant on session detail.
- Verify the `pendingSessionId` deep-link path and `workoutsHasSessionDetail` gating
  (`AppShellView` / `WorkoutsSectionNavigationView`) still drive the rest-timer accessory correctly.
- Docs: replace the "session detail `.bottomBar` holds only Add exercise" invariant; keep the
  "do not move the rest timer back into `.bottomBar`" rule (still true).

### Phase 4 — Nutrition + Me detail/log actions → top-trailing + docs

- Migrate `DailyIntakeViews:255` (Log → top-trailing; Clear day → overflow+confirm),
  `FoodDetailAndFormViews:38`, `MealDetailView:35`, `PlanDetailView:35`, `BodyViews:218`,
  `JournalViews:293` to top-trailing / overflow consistently with Phase 3.
- Docs: update per-detail action sentences.

### Phase 5 — Cleanup + final reconciliation

- Dead-code sweep: orphaned `SectionTitleMenu` / `SectionTitleMenuContent` if unused,
  `RootPrimaryActionToolbar` (already deleted in Phase 2), any now-unused `NavigationChrome` helpers.
- Repo-wide grep DoD: no tab-visible pushed/root `.bottomBar` in `App/` (sheet-local allowed).
- Requirement-traceability pass: demonstrate all three reported problems fixed (collision / size
  mismatch / hidden sections) with the manual checklist.
- Final doc reconciliation: both CLAUDE.md files describe only the shipped end state, zero stale
  claims. Final gates + `xcodegen generate` if any App files changed.

---

## Risks & mitigations

- **Accessory rendering uncertainty on 26.0** → Phase 0 gate with binary criteria + top-trailing
  fallback.
- **Rest timer vs detail action conflict** → resolved by design: detail actions are top-trailing;
  the accessory hosts only the timer (session detail) or a root action (root, mutually exclusive).
- **Coupling / stale closures** → avoided: no per-route action registration into `AppShellView`.
- **Reintroducing a collision** → no leading `.bottomBar` control survives; root accessory is
  trailing.
- **Ban revisit (visible switcher = persistent secondary bar)** → justified by the discoverability
  requirement; documented in-phase. No other ban is touched.
- **Doc drift** → each phase rewrites only the sentences it invalidates; Phase 5 reconciles.
- **Build-only DoD** → per-phase manual acceptance checklist; UI-test gap stated explicitly.

## Decisions from the user

1. **Section switcher visual form:** decide during Phase 0 — prototype both a glass chip row and a
   native segmented control in the validation spike and pick from real screenshots. Phase 1a's
   switcher form is therefore gated on the Phase 0 result.
2. **iPad/sidebar:** later follow-up. `.sidebarAdaptable` / Paradigm B are explicitly out of this
   migration; ship the iPhone redesign first.

## Execution notes

**Ordering decision (orchestrator, correctness pillar):** Phase 0 is a human visual gate — its
GO/NO-GO and the switcher-form pick require judging a running simulator, which cannot be done by an
autonomous agent/subagent. Phase 1 (the reported-collision form-toolbar fix) is the only phase
independent of Phase 0's visual decisions, so it is executed first. Phases 1a/2–5 remain gated on
the user's Phase 0 validation.

### Phase 1 — Implementation log

**Status: complete.** Reworked the single shared `NativeFormActionToolbar` modifier
(`ios/NeoGym/App/Components/NavigationChrome.swift`): Cancel → top-leading
`.cancellationAction`, Save → top-trailing `.confirmationAction` (semibold + loading/`isSubmitEnabled`
disabled logic preserved), optional destructive Delete → top-trailing overflow `Menu`
(`ellipsis.circle`, `.accessibilityLabel("More actions")`, disabled during submit). Removed
`.bottomBar` from the modifier. Signature unchanged, so all six call sites (`WorkoutFormViews`,
`BodyViews`, `JournalViews`, `Nutrition/FoodDetailAndFormViews`, `Nutrition/MealEditorViews`,
`Nutrition/PlanEditorViews`) inherit the fix with no argument changes. Updated the form-toolbar
sentences in both `CLAUDE.md` and `ios/NeoGym/CLAUDE.md` to the new state (detail `.bottomBar`
sentences intentionally left for later phases), plus a Nix/xcodebuild `env -u` friction note.

**Reviewer verdict:** ACCEPT (no blockers; scope confirmed clean — no later-phase bleed).

**Quality gate (orchestrator, clean env `env -u ... -u NIX_LDFLAGS -u NIX_CFLAGS_COMPILE -u NIX_CFLAGS_LINK`):**
`swift build` ✓ · `swift test` 3-suite ✓ (189 XCTest + 3 swift-testing across the package per
subagents) · `xcodebuild -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`
**BUILD SUCCEEDED** ✓.

**Autonomous decisions:** (1) Delete placed in a top-trailing overflow menu rather than a bare
top-trailing destructive item — keeps the destructive action discoverable but out of the primary
Save slot (long-term maintenance + reduces mis-tap risk). (2) Accepted the implementer's extra
`env -u` Nix/xcodebuild doc note as in-scope toolchain guidance (maintenance). (3) No automated App
UI test added — there is no XCUITest harness for `App/`; build + code validation is the honest
ceiling, visual acceptance deferred to the Phase 0 human gate (correctness/honesty over false
coverage).

## Phase 0 result

*(to be filled in after the validation spike: GO or NO-GO, with the size-parity finding.)*
