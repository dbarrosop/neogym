# Add medium iOS Energy Balance widget

**Status:** ready
**Created:** 2026-07-11

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

NeoGym’s native Nutrition Overview already has an Energy balance card, but the same at-a-glance data is not available from iOS widgets. The user wants a medium WidgetKit widget for that balance and wants the Overview card/widget captions changed to show more useful freshness and split-state information.

### 1.2 Functional requirements

- Add a medium-size iOS WidgetKit home-screen widget in the existing `NeoGymWidgets` extension.
- Show the same core balance data as the native Nutrition Overview Energy balance card:
  - consumed calories for today;
  - burned calories for today from active + resting energy;
  - net today = consumed - burned;
  - 7-day average net.
- Update both the existing Overview card and the new widget captions:
  - Consumed: `As of <timestamp>`, where `<timestamp>` is the latest user-entered food log `slotTime` for today.
  - Burned: actual `<active> + <resting>` kcal values.
  - Net today: `Deficit`, `Surplus`, or `Balanced` when a net value exists; keep clear no-energy wording otherwise.
  - 7-day average: `Deficit`, `Surplus`, or `Balanced` when an average exists; keep clear no-data wording otherwise.
- Use `slotTime` as a local time-of-day. For today’s logged meals, use parent `nutritionLogMeals.slotTime`; for standalone entries, use `nutritionLogEntries.slotTime`; grouped child entries inherit the parent meal group time.
- Add a refresh button if feasible. Treat it as best effort and use WidgetKit/iOS APIs honestly.
- Refresh in the background roughly every 15–30 minutes if possible, explicitly as WidgetKit best-effort scheduling rather than a guaranteed cadence.
- Preserve the existing Nutrition Overview behavior: it remains a pushed dashboard and continues HealthKit Body/Energy auto-sync on load and pull-to-refresh.

### 1.3 Non-functional requirements / constraints

- Native iOS only; no web/frontend changes.
- Avoid backend/schema/metadata changes unless implementation discovers the current query shape is insufficient. Current analysis says it is sufficient.
- Preserve current iOS navigation conventions from `CLAUDE.md`; do not introduce TabView/custom dock/navigation redesigns.
- Keep `ios/NeoGym/project.yml` as the Xcode project source of truth; do not commit generated `.xcodeproj` output.
- Keep the app target at iOS 26 and the widget extension at its existing lower deployment floor unless a widget-only API requires guarded availability.
- Do not store auth tokens in an App Group `UserDefaults` snapshot.
- Avoid leaking stale/cross-user widget data: clear snapshots on sign-out, definitive signed-out bootstrap, auth error where appropriate, and user switch before new user data is available.
- Widget timeline refresh is iOS-throttled. Copy and comments must not imply exact 15-minute refresh or guaranteed network freshness.
- Phase 4 live widget fetch is optional/skippable if extension-safety, memory, provisioning, or one-time re-login risk is unacceptable; the cached snapshot widget remains a shippable fallback.

### 1.4 Surfaces in scope

- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — pure balance summary, latest `slotTime`, state/caption helpers.
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyModels.swift` — reusable kcal/split formatting if needed.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift` — expected no query change; verify current fields remain sufficient.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — existing Energy balance card captions and snapshot write hook.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` — preview data updates if helpful.
- `ios/NeoGym/Shared/` — dependency-free widget snapshot DTO/store shared by app and extension.
- `ios/NeoGym/Widgets/` — new medium widget, optional refresh intent, existing widget bundle update.
- `ios/NeoGym/project.yml`, `ios/NeoGym/App/NeoGym.entitlements`, new `ios/NeoGym/Widgets/NeoGymWidgets.entitlements` — widget/App Group/keychain capability configuration.
- `ios/NeoGym/App/NeoGymApp.swift`, `ios/NeoGym/App/RootView.swift`, `ios/NeoGym/Sources/NeoGymKit/AuthStore.swift` — snapshot clear/reload hooks and optional shared-session setup.
- `ios/NeoGym/Tests/NeoGymKitTests/` — pure summary, latest time, formatter, and auth/store behavior tests.
- `ios/NeoGym/CLAUDE.md`, root `CLAUDE.md`, and maybe `docs/developers/energy.md` — durable documentation if widget architecture/conventions change.

### 1.5 Out of scope

- Backend migrations, Hasura metadata/permission changes, and frontend codegen unless implementation discovers a blocker.
- Web/frontend widget work.
- Workouts, sessions, or exercises data-model changes.
- Broad Nutrition Overview redesign beyond requested Energy balance captions.
- Guaranteed exact 15–30 minute refresh.
- HealthKit import from the widget extension.
- Deep-linking directly into Nutrition Overview from the widget unless existing routing makes it trivial; plain app launch is enough.

### 1.6 Success criteria

- Overview Energy balance card shows the requested captions in loaded, no-intake, no-energy, and no-7-day-average states.
- Medium Energy Balance widget appears in the widget gallery and renders cached signed-in balance data or a safe empty/signed-out state.
- Widget refresh is implemented honestly: app-triggered reloads, best-effort timeline reloads, and a refresh button only when it can perform or trigger meaningful refresh behavior.
- Snapshots are aggregate-only and cleared on sign-out/user switch/bootstrap signed-out paths.
- From `ios/NeoGym/`: `swift build`, `swift test`, `nix develop ../.. --command xcodegen generate`, and `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` pass.
- Generated `.xcodeproj` output is not committed.
- Any changed docs remain accurate.

### 1.7 Open questions / blockers

- Confirm final App Group identifier, proposed `group.io.nhost.neogym` — owner: implementer/user if provisioning rejects default; blocking: no for simulator implementation, yes for device/TestFlight signing.
- Confirm shared keychain access-group identifier if Phase 4 is pursued, proposed `$(AppIdentifierPrefix)io.nhost.neogym.shared` — owner: implementer/user; blocking: only for Phase 4 live fetch.
- Accept one-time re-login if Phase 4 migrates app session storage to a shared keychain access group — owner: user/product; blocking: yes for Phase 4 if migration is required, no for Phases 1–3.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use a fallback-first architecture. Put all testable balance math, latest-log-time selection, and display strings in `NeoGymKit`; have the app map that summary to a dependency-free `Shared/` Codable snapshot DTO with preformatted strings and aggregate numbers; render the Phase 3 widget from that App Group snapshot without linking `NeoGymKit` or Nhost. Then optionally add live widget fetch through a shared-session `NeoGymKit`/Nhost client only after an early extension-safety spike and product acceptance of keychain/provisioning risks.

### 2.2 Key constraints and invariants

- Latest `As of` time is the max valid local `slotTime` from today’s parent logged meals and standalone entries; it is not `updatedAt` and not a full timestamp.
- Missing or malformed `slotTime` values are ignored; all missing yields fallback copy such as `No entries yet`.
- Burned split displays missing active/resting components as `0` only when a `DailyEnergy` row exists; no row keeps no-energy behavior.
- Net values stay `nil` when no daily energy row exists; do not turn missing energy into zero-burned surplus.
- The 7-day average caption intentionally drops the old `N/7 days with intake + energy` footer and uses the average state label when present.
- `Shared/` snapshot DTO must remain dependency-free for Phase 3: no `NeoGymKit`, no Nhost, no tokens.
- HealthKit sync remains app-owned. Widget live fetch, if implemented, fetches server nutrition/daily-energy data only.
- Refresh button copy must not imply server freshness unless Phase 4 live fetch is active.

### 2.3 Touched surfaces

- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — add `EnergyBalanceOverviewSummary` and latest-log-time helper.
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyModels.swift` — optional shared kcal formatting.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — consume summary helpers, update captions, write widget snapshots after successful load.
- `ios/NeoGym/Shared/EnergyBalanceWidgetSnapshot.swift` — dependency-free DTO/store and widget kind/App Group constants.
- `ios/NeoGym/Widgets/EnergyBalanceWidget.swift` — medium widget provider/view and optional AppIntent button.
- `ios/NeoGym/Widgets/RestTimerLiveActivityWidget.swift` — add the new widget to `NeoGymWidgetsBundle` without breaking the Live Activity.
- `ios/NeoGym/project.yml` and entitlements — App Group, optional keychain group, optional `NeoGymKit` widget dependency in Phase 4.
- `ios/NeoGym/Sources/NeoGymKit/NhostClientFactory.swift` and `AppEnvironment.swift` — optional shared production config/shared-session factory in Phase 4.
- `ios/NeoGym/Tests/NeoGymKitTests/` — unit tests for summary, formatting, and auth/store decision logic.
- `CLAUDE.md` files/docs — document final widget architecture and refresh limits if changed.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No backend GraphQL schema or permission change is expected. Existing overview query already selects the necessary `slotTime`, `activeKcal`, and `restingKcal` fields. Phase 3 remains compatible with no widget auth/session access. Phase 4 may require a shared keychain session migration that can force one-time re-login; it is explicitly optional.
- **Deployment:** App Group entitlements build on simulator but require a real team/profile for device/TestFlight. Run XcodeGen after `project.yml` changes and do not commit generated project files. Availability-guard AppIntent/interactive widget code for iOS 17+ while keeping the widget extension’s iOS 16.2 floor.
- **Rollback:** Standard revert is sufficient for Phases 1–3. If Phase 4 shared keychain is implemented and rolled back, users may need to sign in again because session storage location changes; document that in the phase implementation log.

---

## 3. Phased plan of action

### Phase 1 — Shared summary helpers and Overview captions

**Goal:** Ship the requested Overview card caption/data changes with testable shared logic and no widget/entitlement changes.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — add pure summary/latest-time helpers.
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyModels.swift` — add/reuse rounded kcal formatting if needed.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — render captions from the summary.
- `ios/NeoGym/Tests/NeoGymKitTests/NutritionDayTests.swift` or nearby existing test file — add unit tests.
- `ios/NeoGym/App/Nutrition/PreviewNutritionFoodMealRepository.swift` — update preview fixtures if useful.

**Implementation steps:**

1. Add `EnergyBalanceOverviewSummary` (or equivalent) derived from `NutritionOverviewPayload`, injected today date, and calendar.
2. Include raw/display fields: calories in, active/resting kcal from the raw `DailyEnergy` row, total out, net/state, 7-day average/state, latest logged slot time, and captions.
3. Add `NutritionDay.latestLoggedSlotTime` or equivalent. Parse `slotTime` as local time-of-day; use today only; compare parent meal-group times and standalone entry times; ignore grouped child times and malformed/nil times; tolerate future times.
4. Update `NutritionOverviewView.balanceOverview`:
   - Consumed caption: `As of <localized time>` or fallback `No entries yet`.
   - Burned caption: `<active> + <resting> kcal` when a daily energy row exists; otherwise keep no-energy wording.
   - Net today caption: state label when net exists; existing needs-energy wording otherwise.
   - 7-day caption: state label when average exists; existing no-data guidance otherwise.
5. Keep helpers in `NeoGymKit` Foundation-only; do not import SwiftUI/UIKit into package sources.

**Tests and checks:**

- Unit tests for latest time: standalone vs meal groups, malformed/nil ignored, all missing fallback, grouped child inherits parent semantics, future time tolerated.
- Unit tests for missing energy row vs row with nil active/resting, net state labels, rolling average state labels, and burned split captions.
- Run `cd ios/NeoGym && swift build && swift test`.
- Run or defer with clear note: `nix develop ../.. --command xcodegen generate` and `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` because this phase edits SwiftUI app code.

**Definition of done:**

- Overview card shows requested captions in loaded/no-intake/no-energy/no-average states.
- NeoGymKit remains host-buildable and SwiftUI/UIKit-free.
- App remains fully functional because no target/entitlement/widget changes are introduced.
- Phase is testable by Swift package tests and simulator app build.

**Phase commit message:** `feat(ios): refresh energy balance overview captions`

**Implementation log**

Implemented in commit `13850ad5`.

- **Implementation notes:** Added `EnergyBalanceOverviewSummary` and `NutritionDay.latestLoggedSlotTime` in `NeoGymKit`, exposed shared kcal rounding, added a `NutritionDaysListViewModel.energyBalanceOverviewSummary(locale:)` seam, and updated `NutritionOverviewView` to render consumed, burned, net, and 7-day captions from the summary. Added tests for latest slot-time selection, malformed/missing times, grouped-child inheritance via parent meal time, missing-energy behavior, zero-component split display, and state captions.
- **Reviewer verdict:** `ACCEPT` after an initial `ACCEPT_WITH_CONCERNS`; the only concrete concern was an out-of-scope machine-specific `ios/NeoGym/CLAUDE.md` symlink note, which was reverted before acceptance.
- **Autonomous decisions:**
  - Selected `No entries yet` as the no-intake consumed caption. **Correctness:** this is an explicit, non-misleading fallback for missing `slotTime` and matches the plan examples.
  - Accepted `DailyIntakeViewModel.swift` as in-scope even though not listed by name. **Long-term maintenance:** the added method is a thin view-model seam that keeps SwiftUI code from duplicating summary construction.
  - Used a clean Xcode environment for the simulator build after the process-inherited environment failed the widget link with `ld: -objc_abi_version '-Xlinker' not supported`. **Correctness:** reviewer and clean retry confirmed the failure was environmental, not a Phase 1 regression.
- **Quality gate:** `xcrun swift build` passed; `xcrun swift test` passed (220 XCTest + 4 Swift Testing tests); `nix develop ../.. --command xcodegen generate` passed; initial `xcodebuild` failed in inherited environment with widget linker error, then clean-environment `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed.

### Phase 2 — App Group snapshot foundation and auth clearing

**Goal:** Add secure aggregate snapshot storage shared by app and widget, and write/clear it from the app, without introducing widget UI yet.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Shared/EnergyBalanceWidgetSnapshot.swift` — dependency-free Codable DTO/store, preformatted display strings, constants.
- `ios/NeoGym/project.yml` — app/widget App Group entitlements.
- `ios/NeoGym/App/NeoGym.entitlements` — App Group.
- `ios/NeoGym/Widgets/NeoGymWidgets.entitlements` — new widget entitlement file.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — write snapshot after successful overview load and reload timelines.
- `ios/NeoGym/App/RootView.swift`, `ios/NeoGym/App/NeoGymApp.swift`, and/or `ios/NeoGym/Sources/NeoGymKit/AuthStore.swift` — clear snapshots on auth transitions.
- `ios/NeoGym/Tests/NeoGymKitTests/` — test summary-to-display behavior and auth clear decision logic where it lives in `NeoGymKit`.

**Implementation steps:**

1. Add App Group entitlements via `project.yml`; use proposed `group.io.nhost.neogym` unless provisioning requires a different value.
2. Define `Shared/EnergyBalanceWidgetSnapshot` as a dependency-free DTO of primitives and preformatted strings: local date, optional user marker, generatedAt/lastSynced text, consumed value/caption, burned value/caption, net value/caption/state, 7-day value/caption/state, and empty-state metadata. Do not import `NeoGymKit` in this file.
3. Add a simple App Group `UserDefaults(suiteName:)` snapshot store in `Shared/` plus constants such as widget kind. Keep it token-free.
4. In the app, map `EnergyBalanceOverviewSummary` to the `Shared/` DTO after a successful `loadOverview()` (after existing Energy HealthKit sync and nutrition load complete), write it, and call `WidgetCenter.shared.reloadTimelines(ofKind:)`.
5. Do not overwrite a good snapshot on failed overview load; preserve the last snapshot with its generatedAt/last-synced display.
6. Clear the snapshot and reload timelines on sign-out, definitive signed-out bootstrap, auth error where appropriate, and user switch before writing the new user’s data. If the snapshot stores a user marker, compare before writing and clear mismatches.
7. Keep Phase 2 tests focused on `NeoGymKit` summary/display logic and auth/store decision seams; `Shared/` DTO/store compile is validated by the app build because it is outside SwiftPM.

**Tests and checks:**

- Unit tests for summary/display values that feed the snapshot.
- Unit or integration-style tests for sign-out/user-switch clear behavior if dependency injection allows; otherwise add a reviewer-visible manual test note and keep clear logic small.
- Run `cd ios/NeoGym && swift build && swift test`.
- Run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.

**Definition of done:**

- App writes aggregate-only snapshots on successful overview load/refresh.
- Snapshots clear on auth transitions/user switch and never contain tokens.
- Simulator build proves App Group entitlements and `Shared/` code compile; device/TestFlight provisioning requirements are documented in the implementation log.
- App remains fully functional because widget UI is unchanged and existing Live Activity still compiles.

**Phase commit message:** `feat(ios): add energy balance widget snapshot store`

**Implementation log**

Implemented in commit `cedeec2a`.

- **Implementation notes:** Added `Shared/EnergyBalanceWidgetSnapshot.swift` as a dependency-free aggregate snapshot DTO/store with preformatted display strings, generated/last-synced values, widget kind/App Group constants, and user-marker mismatch clearing. Added App Group entitlements for the app and widget through `project.yml`, `App/NeoGym.entitlements`, and `Widgets/NeoGymWidgets.entitlements`. Wired Nutrition Overview successful loads to write snapshots and reload timelines, and wired auth transitions to clear snapshots/reload timelines.
- **Reviewer verdict:** `ACCEPT`; reviewer verified the snapshot is token-free, app writes only after loaded overview state, failures preserve the last good snapshot, all required auth transitions clear snapshots, no widget UI was added, and generated `.xcodeproj` remains ignored.
- **Autonomous decisions:**
  - Used App Group identifier `group.io.nhost.neogym`. **Correctness:** this was the plan-proposed default and sufficient for simulator validation; device/TestFlight provisioning remains documented as a release requirement.
  - Added a user marker to the snapshot and clear-on-mismatch behavior. **Security:** this provides a second guard against stale cross-user data.
  - Introduced a testable `AuthStore` snapshot-clear seam and app-level reload handler. **Long-term maintenance:** this keeps auth state transitions testable while keeping WidgetKit imports in app code.
  - Used a clean Xcode environment for native build/test gates. **Correctness:** inherited shell environment can produce SDK/toolchain/linker mismatches; clean Xcode commands are the strongest available native validation.
- **Quality gate:** `xcrun swift build` passed; `xcrun swift test` passed (225 XCTest + 4 Swift Testing tests); `nix develop ../.. --command xcodegen generate` passed; clean-environment `xcodebuild -quiet -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed; `plutil -lint App/NeoGym.entitlements Widgets/NeoGymWidgets.entitlements` passed.

### Phase 3 — Medium widget from cached snapshot

**Goal:** Add a shippable medium widget that renders the app-written cached snapshot and safe empty states, without widget auth or live network fetch.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Widgets/EnergyBalanceWidget.swift` — new WidgetKit widget provider/view.
- `ios/NeoGym/Widgets/RestTimerLiveActivityWidget.swift` — add widget to `NeoGymWidgetsBundle`.
- `ios/NeoGym/project.yml` — only if source/entitlement references need adjustment; do not add `NeoGymKit` dependency in this phase.

**Implementation steps:**

1. Add a `StaticConfiguration` widget that supports `.systemMedium` only.
2. Timeline provider reads `Shared/` App Group snapshot and emits placeholder, snapshot, and timeline entries.
3. Use `.after(Date().addingTimeInterval(15 * 60))` to `.after(30 * 60)` as a best-effort timeline policy with comments that iOS controls actual scheduling.
4. Render four metrics matching the Overview card display strings from the snapshot.
5. Show signed-out/no-snapshot state such as `Open NeoGym to sync`/`Sign in to NeoGym` and include last-synced/generatedAt when rendering potentially stale data.
6. Do not add a refresh button in this phase unless the copy explicitly says it only reopens/reloads cached data. Prefer tap-to-open app as the honest cached-only fallback.
7. Ensure `RestTimerLiveActivityWidget()` remains in `NeoGymWidgetsBundle`.

**Tests and checks:**

- Keep widget math thin; rely on Phase 1/2 unit-tested summary/display strings.
- Run Xcode previews or simulator manual check for medium rendering and empty state; label this as manual verification.
- Run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` if `project.yml` changed.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` with `APPLICATION_EXTENSION_API_ONLY=true`.

**Definition of done:**

- Medium widget is available in the widget gallery in manual simulator verification and renders cached data/empty state.
- Automated simulator build passes.
- Existing Live Activity still compiles.
- System remains fully functional because no live widget auth/session dependency has been introduced.

**Phase commit message:** `feat(ios): add cached energy balance widget`

**Implementation log**

Implemented in commit `e8d8ed28`.

- **Implementation notes:** Added `Widgets/EnergyBalanceWidget.swift`, a medium-only `StaticConfiguration` widget that reads the Phase 2 App Group snapshot, renders the four preformatted balance metrics plus last-synced/generated freshness text, shows a safe signed-out/no-snapshot state, sets a tap-to-open `widgetURL`, and schedules best-effort 15–30 minute cache rereads. Registered `EnergyBalanceWidget()` in `NeoGymWidgetsBundle` while preserving `RestTimerLiveActivityWidget()`.
- **Reviewer verdict:** `ACCEPT`; reviewer verified scope matches Phase 3, no `NeoGymKit` widget dependency or live auth/network was added, no refresh button was added, the widget uses `.systemMedium` only, the Live Activity remains, and the implementation compiles under extension API-only.
- **Autonomous decisions:**
  - Did not add automated widget tests. **Long-term maintenance:** Phase 3 intentionally keeps widget math thin and renders Phase 1/2-tested preformatted snapshot strings; build and manual preview/gateway checks are the appropriate validation surface.
  - Used tap-to-open app as the cached-only refresh affordance. **Correctness/security:** cached-only timeline reloads cannot fetch fresh server data, so a refresh button would be misleading before Phase 4.
  - Used `PreviewProvider` rather than `#Preview(as:)`. **Compatibility:** the widget extension deploys to iOS 16.2, and `#Preview(as:)` requires newer availability.
- **Quality gate:** `xcrun swift build` passed; `xcrun swift test` passed (225 XCTest + 4 Swift Testing tests); `nix develop ../.. --command xcodegen generate` passed; clean-environment `xcodebuild -quiet -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' APPLICATION_EXTENSION_API_ONLY=true build` passed. Manual widget gallery rendering was not performed in the non-interactive environment and remains a manual follow-up.

### Phase 4 — Optional live widget refresh through shared session

**Goal:** Make widget timeline/button refresh capable of fetching fresh server data without foregrounding the app, while preserving cached fallback and allowing this phase to be skipped.

**Depends on:** Phase 3 and user/product acceptance of shared-session risks

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/project.yml` — add `NeoGymKit` widget dependency and keychain group entitlements if pursuing live fetch.
- `ios/NeoGym/App/NeoGym.entitlements` and `ios/NeoGym/Widgets/NeoGymWidgets.entitlements` — optional shared keychain group.
- `ios/NeoGym/Sources/NeoGymKit/NhostClientFactory.swift`, `AppEnvironment.swift`, and config constants — shared production config/session factory.
- `ios/NeoGym/Widgets/EnergyBalanceWidget.swift` — provider live fetch and fallback.
- `ios/NeoGym/Tests/NeoGymKitTests/` — testable live-refresh decision logic.

**Implementation steps:**

1. Start with an early extension-safety/memory spike in this phase: temporarily link/import the needed `NeoGymKit`/Nhost pieces in the widget target and build with `APPLICATION_EXTENSION_API_ONLY=true`. Remove spike-only code before committing.
2. If the spike fails or widget memory/provisioning looks unacceptable, stop this phase, document the cached snapshot fallback as the shipping state, and do not add misleading refresh UI.
3. If the spike passes and the user accepts possible one-time re-login, add a widget-safe `NeoGymKit` client factory using the same production `NhostConfig` as the app.
4. Configure shared keychain access group if required for the widget to read the existing Nhost session. Document the migration and one-time re-login risk prominently.
5. In the widget timeline provider, attempt `NutritionFoodMealRepository.nutritionOverview()` using the shared session; on success, map to summary/snapshot, write App Group snapshot, and render fresh data.
6. On no session/network/auth failure, render latest cached snapshot if present; otherwise render signed-out/empty state. Do not run HealthKit import from the widget.
7. Keep meaningful refresh tied to this live-fetch path; timeline reload now can fetch fresh server data when iOS schedules it.

**Tests and checks:**

- Unit-test any extracted decision layer: live fetch success writes snapshot; failure falls back to cache; no cache produces signed-out/empty state.
- Run `cd ios/NeoGym && swift build && swift test`.
- Run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Manual simulator check: widget can refresh after reload/re-add without app foreground, and failure paths display cache/empty state.

**Definition of done:**

- Either live fetch works with shared session and safe fallback, or the phase is explicitly skipped with the cached widget documented as the supported behavior.
- No HealthKit work runs in the widget.
- Keychain migration/provisioning risks are documented in the implementation log.
- System remains fully functional because Phase 3 cached widget remains the fallback.

**Phase commit message:** `feat(ios): enable live energy widget refresh`

**Implementation log**

Implemented in commit `6a6eb38d`.

- **Implementation notes:** Linked the widget target to `NeoGymKit` after the extension-safety spike passed under `APPLICATION_EXTENSION_API_ONLY=true`. Added shared production Nhost config, Info.plist-driven shared-keychain session configuration, an app-side migrating session backend that can copy the old app-only keychain session into `$(AppIdentifierPrefix)io.nhost.neogym.shared`, and a testable widget live-refresh client. The widget timeline provider now attempts `nutritionOverview()` with the shared session, writes a fresh aggregate App Group snapshot on success, and falls back to cached snapshot or empty state on no-session/auth/network/provisioning failure. No HealthKit code runs in the widget and no refresh button was added.
- **Reviewer verdict:** `ACCEPT_WITH_CONCERNS`; reviewer verified extension API-only builds, safe keychain migration/fallback semantics, token-free App Group behavior, Info.plist/project/entitlement validity, and live-fetch fallback behavior. The accepted concern is that the new `ios/NeoGym/CLAUDE.md` note lands before the planned Phase 5 docs pass; Phase 5 must consolidate rather than duplicate it.
- **Autonomous decisions:**
  - Treated the user’s “implement all phases” instruction as acceptance to attempt optional Phase 4 and its one-time re-login risk. **Correctness:** the user explicitly requested all phases and the plan documents the risk.
  - Used shared keychain group `$(AppIdentifierPrefix)io.nhost.neogym.shared`. **Security:** this avoids copying tokens into App Group storage and matches the plan-proposed shared Keychain approach.
  - Reused the production Nhost project in `NhostConfig.production`. **Correctness:** widget and app must talk to the same production backend.
  - Used Info.plist-expanded access-group values instead of Security entitlement introspection. **Compatibility:** `SecTaskCopyValueForEntitlement` did not compile for the iOS target, while Info.plist expansion is build-validated and guarded against unexpanded `$(...)` values.
  - Kept cached snapshots as the fallback for all live-fetch failures. **Security/correctness:** widget data remains safe and useful without crashing or exposing tokens.
- **Quality gate:** `xcrun swift build` passed; `xcrun swift test` passed (228 XCTest + 4 Swift Testing tests); `nix develop ../.. --command xcodegen generate` passed; clean-environment `xcodebuild -quiet -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed; clean-environment `xcodebuild -quiet -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' APPLICATION_EXTENSION_API_ONLY=YES build` passed; `plutil -lint App/Info.plist Widgets/Info.plist App/NeoGym.entitlements Widgets/NeoGymWidgets.entitlements` passed. Manual simulator widget refresh/re-add was not performed in the non-interactive environment.

### Phase 5 — Interactive refresh affordance and durable docs

**Goal:** Add an honest iOS 17+ refresh affordance if it can trigger meaningful refresh, and document the final widget architecture.

**Depends on:** Phase 3; Phase 4 if the refresh button claims fresh server data

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Widgets/RefreshEnergyBalanceIntent.swift` — optional iOS 17+ AppIntent.
- `ios/NeoGym/Widgets/EnergyBalanceWidget.swift` — button/fallback UI and availability guards.
- `ios/NeoGym/CLAUDE.md` and root `CLAUDE.md` — widget architecture/conventions.
- `docs/developers/energy.md` — only if the read-only energy balance/widget contract is documented there.

**Implementation steps:**

1. If Phase 4 live fetch is active, add an iOS 17+ `AppIntent`/`Button(intent:)` that triggers timeline reload and therefore the live-fetch provider path.
2. If Phase 4 was skipped, omit the in-widget refresh button or label it honestly as opening/reloading cached data; prefer a `widgetURL`/tap-to-open app fallback.
3. Availability-guard AppIntent/Button code so the widget extension still builds at iOS 16.2.
4. Use honest copy: `Refresh`/`Update` only when it can attempt live fetch; otherwise `Open NeoGym to refresh`.
5. Update durable docs to describe the final architecture: `NeoGymKit` summary, `Shared/` aggregate snapshot, App Group, auth clearing, optional shared-session live fetch, no HealthKit import in widget, best-effort WidgetKit refresh, and iOS 17+ button gating.
6. Ensure docs do not claim the widget extension contains only the rest timer Live Activity anymore.

**Tests and checks:**

- Run `cd ios/NeoGym && swift build && swift test` if docs/code touched package.
- Run `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` if project config changed.
- Run `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Manual iOS 17+ simulator check for button; manual older-runtime/availability review if available.

**Definition of done:**

- Refresh affordance exists only when it is not misleading.
- iOS 16.2-compatible build path remains valid.
- Docs accurately reflect the implemented widget architecture and refresh limitations.
- Final validation commands pass.

**Phase commit message:** `feat(ios): add energy widget refresh affordance`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

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
| Overview captions updated | 1 | `swift test`, simulator build, manual/preview check |
| Latest `As of` uses today’s user-entered `slotTime` | 1 | Unit tests for standalone, meal-group, malformed/nil, future-time cases |
| Burned caption shows actual active + resting values | 1 | Unit tests for row/no-row/nil-component cases |
| 7-day average caption uses state label | 1 | Unit tests for rolling average states and Overview check |
| Secure aggregate snapshot written by app | 2 | App build, unit tests for summary/display, manual app write inspection if needed |
| Snapshot clears on sign-out/user switch/bootstrap signed-out | 2 | Unit/integration tests where practical, manual auth smoke, widget empty-state check |
| Medium widget renders cached data | 3 | Simulator `xcodebuild`, manual widget gallery/render check |
| Existing Rest Timer Live Activity remains | 3 | Simulator `xcodebuild` |
| Background refresh best-effort | 3, 4 | Timeline policy code review; Phase 4 manual refresh/re-add check if live fetch active |
| Refresh button if feasible | 5 | iOS 17+ manual simulator check; code review for honest fallback if Phase 4 skipped |
| No backend/frontend scope creep | all | Diff review confirms no backend/frontend changes unless explicitly justified |
| Final repo validation | all | `swift build`, `swift test`, XcodeGen, simulator `xcodebuild` |

---

## 6. Risks and mitigations

- **Risk:** App Group provisioning fails on device/TestFlight because `DEVELOPMENT_TEAM` is empty or App Group is not registered — **Mitigation:** validate simulator build in Phase 2, document device provisioning requirements, and confirm final IDs before release signing.
- **Risk:** Cached widget data becomes stale — **Mitigation:** show generatedAt/last-synced or honest `Open NeoGym to sync` copy, refresh timelines best-effort, and clear aggressively on auth transitions.
- **Risk:** Cached-only timeline/button appears to refresh but re-renders stale data — **Mitigation:** do not add a misleading button before Phase 4; use tap-to-open fallback or copy that clearly says it opens/syncs via app.
- **Risk:** Linking `NeoGymKit`/Nhost in the widget exceeds extension-safety or memory limits — **Mitigation:** keep Phase 3 dependency-free and run a Phase 4 spike before committing live-fetch architecture.
- **Risk:** Shared keychain migration causes one-time re-login — **Mitigation:** make Phase 4 optional and get user/product acceptance before changing session storage.
- **Risk:** Widget refresh cadence is throttled by iOS — **Mitigation:** document best-effort behavior in code/docs and combine app-triggered reloads with timeline policies.
- **Risk:** Cross-user stale data leak — **Mitigation:** store a user marker, compare before write, clear on sign-out/bootstrap signed-out/auth error/user switch, and never store tokens in App Group.

---

## 7. Follow-ups (out of scope for this plan)

- True guaranteed background refresh beyond WidgetKit limits — tracked in: TBD, requires a separate iOS background-task/product feasibility design.
- Direct deep link from widget into the Nutrition Overview route — tracked in: TBD if user requests it.
- Backend aggregate/view optimized specifically for widget balance — tracked in: TBD only if current client-side summary becomes too expensive or insufficient.
