# Offline iPhone demo

NeoGym has one interactive, local-data demo for simulator development and App
Review exploration. It ships in normal Release builds; it is not a hidden
review-only build or a production authentication bypass. The watch app and
widgets do **not** have demo modes.

## Entry, reset, and exit

- On the signed-out **Sign in** screen, tap **Try demo**. No email or code is
  needed. An authentication-error screen also offers this action.
- The demo shell displays a **Demo · fictional data** banner. Its **Demo controls**
  menu offers **Reset demo data** (with confirmation) and **Exit demo**.
- **Me › Account** also has Reset and Exit. Connection rows explicitly say they
  are not connected; the sample profile is not a real account.
- Demo mode is remembered across relaunches until Exit. Exiting preserves the
  local dataset for a later visit and returns to normal authentication/session
  restoration. It does not sign out, revoke, or replace a real SDK session.
- Reset replaces the demo dataset and resets demo Appearance, Default rest,
  running rest, navigation and drafts. It never resets real data/preferences.
- Corrupt or incompatible saved data shows an error with explicit **Reset demo
  data** / **Exit demo** actions; it is not silently discarded.

## Simulator workflow

From `ios/NeoGym/`, generate the project, then build and install on an available
iPhone simulator. Choose its UDID with `/usr/bin/xcrun simctl list devices available`.
No running backend, Docker stack, Nhost account, OTP, or Health permissions are
required. The local Swift SDK checkout and normal build tools are still required.

```sh
nix develop ../.. --command xcodegen generate

# Substitute an available iPhone simulator UDID.
UDID='YOUR-IPHONE-SIMULATOR-UDID'
DERIVED_DATA=/tmp/neogym-demo-derived

env -u SDKROOT -u DEVELOPER_DIR -u CC -u CXX -u LD -u AR -u LDFLAGS \
  /usr/bin/xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-

# Skip boot if it is already booted; bootstatus waits for device readiness.
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl boot "$UDID"
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl bootstatus "$UDID" -b
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl install "$UDID" \
  "$DERIVED_DATA/Build/Products/Debug-iphonesimulator/NeoGym.app"
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl launch --terminate-running-process \
  "$UDID" io.nhost.dbarroso.neogym \
  --demo --demo-reset --demo-scenario populated --demo-screen train/session/current

# After the demo banner and selected screen appear, capture the current screen.
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl io "$UDID" screenshot /tmp/neogym-demo.png
```

`--demo-reset` is destructive **only to demo state** and applies only to the
first demo load of that process launch. Exit → Try demo in the same process
preserves subsequent edits; **Reset demo data** remains an explicit reset.
Omit the flag to inspect edits across relaunches. Xcode's scheme Run › Arguments
accepts these same arguments; there is no separate build configuration or
compile-time demo switch.

Supported arguments:

| Argument | Meaning |
|---|---|
| `--demo` | Select demo before constructing a live client or auth store |
| `--demo-reset` | Start from newly generated sample data and default demo preferences |
| `--demo-scenario populated` | The single v1 scenario (also the default) |
| `--demo-screen SCREEN` | Select the initial area/section, or today's partially logged session |

Screens use the same area/section names as the app:

```text
today
train/sessions         train/workouts       train/exercises
train/session/current
nutrition/log          nutrition/plans      nutrition/foods      nutrition/meals
progress/overview      progress/muscles     progress/strength    progress/body
progress/energy
me/journal             me/account
```

Additional demo options require `--demo`; malformed/unknown demo arguments show
an explicit configuration error rather than silently falling through to live
mode. Initial-screen selection is applied once per demo runtime, not on every
tab return. Important accessibility identifiers: `demo.enter`, `demo.banner`,
`demo.controls`, `demo.exit`. Existing set-log controls retain their spoken
`Log set N` labels.

## Architecture and isolation

`App/NeoGymApp.swift` chooses `AppModeView` first. `LiveAppRuntime` is lazy and
exists only in the live branch. `DemoModeView` owns a `DemoStore`, display-only
`DemoIdentity`, no-op rest effects and a permanently disabled phone-connectivity
object. The identity has deliberately invalid, non-secret token placeholders
solely because the shared profile shell consumes `StoredSession`; it is never
passed to an SDK client, AuthStore, Keychain, bearer header or Watch handoff.

`AppRepositories` groups the existing protocol boundaries. `AppShellEnvironment`
selects these repositories and platform effects. Both modes render the same
`AppShellView`, feature views, editors, view models, charts, validation and
cross-tab invalidation. The demo banner is a layout sibling above the TabView,
not a top safe-area overlay: overlays can cover the native Back/create toolbar
row on current iOS. UI smoke coverage exercises those real controls as well as
tab switching. Do not construct live repositories/clients inside feature views:
add new dependencies to this composition boundary.

All demo repositories share one actor-backed, normalized local state. Writes
validate references and commit a copy through an atomic file replacement before
publishing it. Multi-row meal/plan logging rolls back together. They preserve
important domain behavior: strength/cardio validation, public read-only items,
workout deletion detaching sessions, trusted food snapshots, same-day meal
children, template delete restrictions, nullable provenance, and unique
Body/Energy dates. This is not a full Postgres/Hasura emulator; backend security
and integration tests remain necessary. Today training preserves the live query's
ordering: today's sessions are oldest first, while the latest-session fallback
remains newest first. The Workouts index matches `WorkoutsIndex`: private workouts
first, then public workouts, each ordered by name; its labels are ordered by name.

The populated scenario has three workouts, five exercises with bundled vector
illustrations, strength/cardio history, foods/meals/a mixed-slot plan, partially
logged intake and training today, Body/Energy history, and journal entries.
Initial history covers 91 local dates. Dates use local-calendar arithmetic,
normalizing every step to that day's start: a DST-skipped midnight may start at
01:00, but that hour must not carry into later days and leave today unseeded. A
reopened store adds missing newer dates without overwriting edits or resurrecting
deleted templates. For each date, seeding independently skips any existing Log day,
Body measurement or Energy entry, including user rows created for future dates or
after midnight before reopening. An existing Log day receives no seeded meals or
food entries. Seeded IDs are stable; newly created IDs are unique. Clock
freezing, fault/empty scenarios and backward device-clock changes are not v1
features (reset after deliberately changing the device clock). Leave and reopen
demo after crossing a local midnight to prepare the new day's sample records.
If an older build already marked a missing day as prepared, use **Reset demo
data** to regenerate it; reopening does not backfill dates already marked prepared.

### Storage

- Data: app-private Application Support `NeoGymDemo/state-v1.json`, with an
  explicit payload schema version and backup-excluded directory.
- Preferences and in-app rest: separate `io.nhost.neogym.demo` UserDefaults
  suite. `defaultAppStorage` keeps the existing editors/preferences on that
  suite, not standard defaults.
- Reset/exit invalidate the old store and timer before replacing the runtime,
  so late callbacks cannot mutate or restart the retired demo.
- No app-owned production cache keys, real credentials, backend writes, or
  App Group demo files are introduced.

### Platform effects

| Integration | Demo behavior |
|---|---|
| Auth / email / PKCE | Display-only sample profile; no auth model, OTP, email change or deep-link exchange |
| GraphQL / SDK cache | Local repository calls only; no production client or cache |
| Exercise images | Bundled illustrations; file-backed demo URLs never enter `AsyncImage` |
| HealthKit | No importers or access requests; records say fictional demo data, not imported |
| WatchConnectivity / PAT | Disabled object; no activation, application-context hints, PAT creation or messages |
| Widgets | `EnergyWidgetUpdates.disabled` suppresses both snapshot saves and timeline reloads |
| Rest timer | Functional countdown, +30 s and Skip; isolated persistence; no notifications or Live Activities |
| Agent/MCP | Connection unavailable; no production MCP link offered from demo |

Entering from the signed-out UI retires the live phone-connectivity observer
without publishing a synthetic or signed-out Watch hint. `AuthStore.retire()`
permanently retires that store's observation and ignores late startup, account,
error and old-view callbacks without clearing credentials. An already-issued SDK
read/refresh may settle normally, rather than cancelling a potentially rotated
token's response; returning to normal
mode creates a new live runtime. Live auth snapshot-clear callbacks are also
gated once that runtime has been retired. The existing real
session/cache remains SDK-owned and unchanged by demo. The independently running
widget/watch extension can still use its own real account; opening phone demo is
not a promise that all device processes have stopped networking.

## Validation

- `swift test`: `DemoDataTests`, `DemoIntegrityTests` and
  `DemoIsolationWiringTests` cover DTO compatibility, cross-feature mutation
  consistency, persistence/reset/retirement, failed-save rollback, snapshot and
  cascade invariants, local-midnight/DST fixtures and composition/effect guards.
  Workouts ordering fixtures include a newly created late-alphabet private workout
  and label IDs opposite to name order, so record-ID sorting cannot pass by chance.
  DST fixtures include fresh seeds after skipped midnights in America/Santiago
  and Atlantic/Azores, plus persisted reopen across each transition day's end;
  they check today's session, nutrition, energy, Body and journal records.
  `AuthStoreTests` also verifies retirement preserves real credentials, ignores
  late startup success/failure, and does not cancel an already-issued SDK refresh.
  Host source guards supplement, not replace, compiling the SwiftUI target.
- The XcodeGen `NeoGym` scheme includes `NeoGymUITests`. Use a **fresh, dedicated**
  iPhone simulator, not one containing a developer's real Keychain/session.
  Exit intentionally restores an existing live account; the public-entry test
  expects a clean sign-in screen and must never sign out a developer to obtain it.
  Create a test simulator with `simctl create` and its available device/runtime
  identifiers, then run against its UDID (not a generic build destination):

  ```sh
  env -u SDKROOT -u DEVELOPER_DIR -u CC -u CXX -u LD -u AR -u LDFLAGS \
    /usr/bin/xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
    -destination "platform=iOS Simulator,id=$UDID" \
    -parallel-testing-enabled NO -only-testing:NeoGymUITests/DemoModeUITests \
    test CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-
  ```

  Smoke tests visit all five areas, inspect connection disclosure, exercise the
  native Quick log/Back/create/cancel controls, log a set, relaunch without reset,
  reset, exit and re-enter through the public action (including preserving a logged
  set in a process launched with `--demo-reset`), log a planned nutrition slot
  and check persisted totals, and open explicit launch targets. Screenshots are
  retained as test attachments.
  Keep simulator ad-hoc signing enabled for exit/public-entry checks: an unsigned
  demo itself runs, but the live runtime deliberately rejects an unavailable
  shared App Group when Exit constructs it. Do not weaken that provisioning gate
  to accommodate `CODE_SIGNING_ALLOWED=NO`.
- For release acceptance, also inspect the signed Release build's visible entry
  and verify existing real-account Watch/widget state is not replaced. Simulator
  and host tests do not establish signing, hardware integration, App Review
  approval, or absence of requests from independently running extensions.

## App Review notes (operator-reviewed draft)

> NeoGym includes an interactive offline demo. On the Sign in screen, tap
> **Try demo**; no email code is required. All displayed data is fictional.
> Try Train → Sessions → today's session and log a set, Nutrition → Log and log
> a planned slot, and Progress for charts. You may create/edit/delete local demo
> records. **Demo controls** at the top and **Me → Account** provide Reset demo
> data and Exit demo. Exit returns to normal sign-in/session restoration.
>
> The demo does not connect email authentication, Apple Health, Apple Watch,
> widgets, MCP, notifications or Live Activities. Those integrations require
> normal sign-in and, where applicable, permission/paired hardware; demo does not
> claim to validate them.

Do **not** treat this draft as permission to omit review credentials. Apple's
[Guideline 2.1(a)](https://developer.apple.com/app-store/review/guidelines/#app-completeness)
requires prior approval for the stated built-in-demo-in-lieu-of-an-account
exception. Keep normal sign-in available and provide a populated review account
with authentication Apple can actually complete unless Apple agrees otherwise.
An OTP inbox the reviewer cannot access is not usable review access. Never add
a hard-coded OTP, shared privileged token, or production authentication bypass.
