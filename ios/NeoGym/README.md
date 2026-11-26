# NeoGym iOS

Native SwiftUI iPhone app with a watchOS companion and widget. The phone
uses email OTP, a protected five-tab shell (Today, Train, Nutrition, Progress,
Me), app-side PKCE email change, and read-only Apple Health imports.

## Layout

```text
ios/NeoGym/
├── project.yml                 # XcodeGen source of truth
├── Package.swift               # NeoGymKit SwiftPM library + tests
├── App/                        # SwiftUI app target only
│   ├── NeoGymApp.swift
│   ├── RootView.swift
│   ├── SignInView.swift / SignUpView.swift / ProfileView.swift
│   ├── Components/ and Theme/
│   ├── Info.plist              # URL scheme, HealthKit usage, launch screen
│   ├── LaunchScreen.storyboard # required so iOS uses modern full-screen sizing
│   └── Assets.xcassets/
├── Widgets/                    # iPhone Balance widget + rest timer Live Activity
├── Shared/                     # app + widget: Live Activity attributes and App Intents
├── WidgetUI/                   # SwiftUI shared by the iPhone widget and both watch targets
├── Watch/                      # companion SwiftUI, HealthKit energy sync, private connectivity
├── WatchWidgets/               # watch-face Balance complication, token-free snapshot only
├── Sources/NeoGymKit/          # host-testable auth/session and hint policy
└── Tests/NeoGymKitTests/
```

`NeoGymKit` must stay free of SwiftUI/UIKit so `swift build` and `swift test`
run on the macOS host. iPhone SwiftUI views belong in `App/`; watch SwiftUI
views belong in `Watch/`.

## Prerequisites

- macOS with Xcode 27/watchOS 27 SDK for simulator and device builds. The app
  and widget target iPhone/iOS 27; iPad, Mac and Apple Vision are disabled.
- Nix devshell from the repository root. On Darwin it includes XcodeGen when
  the pinned Nixpkgs exposes `pkgs.xcodegen`.
- Local Nhost Swift SDK checkout at
  `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
  directory (normally
  `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Adjust
  `Package.swift` if your workspace layout differs.

If XcodeGen is not available from Nix on a Darwin host, install it with Homebrew
(`brew install xcodegen`) and run the same `xcodegen generate` command below. Do
not commit the generated `.xcodeproj`; `project.yml` is the source of truth.
If Xcode offers to update recommended build settings on opening the generated
project, choose **Cancel** and make intended changes in `project.yml` instead.
App Info.plist entries that XcodeGen owns, including the `neogym` URL scheme and
full-screen launch screen keys, are declared under the target `info.properties`
in `project.yml`; rerun XcodeGen after changing them. The same spec also keeps
both the `NeoGym` and `NeoGymWatch` schemes' default debug diagnostics disabled:
XcodeGen writes the supported GPU/main-thread/thread-performance settings, then
`Scripts/disable-xcode-debug-options.py` patches both generated `.xcscheme`
files for XPC Services, Queue Debugging/backtrace recording, and View Debugging,
which XcodeGen does not expose directly. Keep `LaunchScreen.storyboard` wired through
`UILaunchStoryboardName`; without a launch screen, iOS can run the app in legacy
letterboxed compatibility sizing on modern devices.

## Commands

From this directory:

```sh
# Build and test the host-compatible package
swift build
swift test

# Generate the Xcode project from project.yml
nix develop ../.. --command xcodegen generate

# Build the simulator app shell
xcodebuild \
  -project NeoGym.xcodeproj \
  -scheme NeoGym \
  -destination 'generic/platform=iOS Simulator' \
  build
```

To confirm XcodeGen is supplied by Nix on Darwin:

```sh
cd ../..
nix develop . --command xcodegen --version
```

## Offline iPhone demo

On Sign in, tap **Try demo** to explore all five areas with fictional local data.
The normal screens support edits, session/set logging, nutrition logging and
charts without an account or backend. Demo stays selected across relaunches;
**Demo controls** in the persistent banner and **Me › Account** provide Reset
and Exit. Reset affects only demo data/preferences. Exit returns to normal
sign-in/session restoration without replacing an existing real session.

For simulator agents, use `--demo --demo-reset --demo-screen train/session/current`
(or any area/section). The same entry ships in Release; it is not a hidden build.
Demo never connects HealthKit, Watch/PAT, email/MCP, widgets, notifications or
Live Activities. Its in-app rest countdown is functional and isolated.

See [Offline iPhone demo](../../docs/developers/ios-demo.md) for build/install/
launch commands, supported screen names, storage and isolation rules, and draft
App Review notes. The `NeoGym` scheme now includes `NeoGymUITests` for five-area,
logging/persistence/reset and public-entry smoke tests. This does **not** establish
Apple's approval to replace review credentials with a demo.

The [illustrated iPhone guide](../../docs/ios/README.md) links every captured
section, canonical walkthrough and full-resolution screenshot, including observed
navigation issues and live-only coverage boundaries. See its
[capture instructions](../../docs/ios/capture.md) for the opt-in, skipped-by-default
`DemoGuideCaptureUITests` driver and Python reproduction/validation tools.

## Private progress photos (signed-in iPhone only)

Open **Progress › Body › Progress photos** to add one library photo, enter an
angle and a date (today or earlier), filter the gallery, or view, correct and
confirm deletion of a stored photo. Separate uploads may share a date and
angle. Photos do not change measurement or Health data. Demo keeps Body
measurement logging and has no photo shortcut or picker.

The app uses the system's single-photo picker, prepares a size-bounded JPEG
without source metadata, and keeps the draft and display bytes in memory only.
The gallery/viewer read again after backgrounding; a create/edit draft is lost.
If an upload was interrupted, check the gallery before starting a new one.
Deletion removes access; Storage's physical cleanup is separate. See the
[API and hosted acceptance](../../docs/developers/progress-photos.md). Confirm
HEIC transfer and App Switcher redaction on a physical iPhone with disposable
fixtures before publication; don't run signed-in smoke against production.

## Embedded Apple Watch companion (Phase 2)

`NeoGymWatch` is a watchOS 27 companion embedded in the existing iPhone app
alongside `NeoGymWidgets`. It targets bundle ID
`io.nhost.dbarroso.neogym.watchkitapp` under team `C7HCKFA2LG`; Xcode automatic
signing may need to register this App ID and provision it. Operator permission
is required before doing that. `Watch/Info.plist` declares the companion ID,
non-independent installation, and versions from the shared project settings;
`Watch/Assets.xcassets/AppIcon.appiconset` contains the opaque watch icon.
Keep that catalog in the watch target's `sources` in `project.yml` (XcodeGen
ignores target-level `resources:`); the built watch bundle must contain
`Assets.car` and `CFBundleIcons/CFBundlePrimaryIcon/CFBundleIconName = AppIcon`. Regenerate with `nix develop ../.. --command xcodegen generate`, build the
`NeoGym` iOS Simulator and `NeoGymWatch` watchOS Simulator schemes, and inspect
`NeoGym.app/Watch/NeoGymWatch.app` (including `PlugIns/NeoGymWatchWidgets.appex`)
and `NeoGym.app/PlugIns/NeoGymWidgets.appex`.
A paired iPhone is required for companion installation; the watch subsequently
uses its own internet connection and privately rotating Nhost SDK session.

The watch signs in **only** through the signed-in iPhone. Tap **Connect** under
**Connect your iPhone** on the watch, then **Me › Account › Apple Watch → Connect watch**
on the phone with both apps open and reachable. If the watch shows **Try again**
instead, tap it after opening the signed-in phone app to re-read its account hint,
then tap **Connect** once it appears. The phone creates a 90-day
app-user Auth PAT and sends it in one nonce-bound live WatchConnectivity message.
The watch keeps the PAT in a separate device-only Keychain item, calls
`/signin/pat` to create its own SDK session, and automatically repeats that
sign-in when its session is lost, Auth `/user` returns 401, or Auth `POST /token`
rejects a refresh with HTTP 400. The last case is identified at the actual refresh
endpoint, including refreshes started by energy sync or a background upload;
HTTP 400 elsewhere does not trigger sign-in. It tries once per failed validation,
then keeps Restore saved sign-in available on later opens
while a valid, non-blocked PAT remains stored; Sign out on this screen erases it
even without a session. A successful `/user` read permits a later automatic
attempt. A refresh 400 does not prove the PAT is invalid; it permits this bounded
fallback. Transient network, profile and energy errors and malformed responses
alone do not trigger PAT sign-in. A recovered energy refresh can reconcile once
more after fresh account validation, without an unbounded retry loop. No OTP
is entered on the watch and no phone session is copied. After 90 days,
reconnect from the phone. With a matching signed-in phone hint, both **Sign in
again** and **Couldn't sign in** screens show **Connect**, even if the rejected
SDK session is still stored; no preliminary Sign out is needed.
Healthy sessions and pending local clearing cannot be replaced. **Restore saved
sign-in** is shown only while a locally valid, owner-eligible PAT remains saved;
Auth may still reject it. If iOS suppresses
a force-quit app's message delivery, open both apps and request pairing again.
Phone account hints in application context contain only state/user ID, never
the credential. Known phone sign-out/account switches clear the local watch PAT;
a phone sign-out while the watch is offline cannot revoke it instantly. The PAT
can sign in as the full user until expiry or server revocation; it is distinct
from a privileged Nhost Cloud dashboard PAT. Watch-only sign-out erases it.
Signed-in users page vertically between Today (balance so far = consumed minus
burned, the resting/active bar, In and Out), End of day (the ≈ Net/Burned
estimate, the 7-day average net, Refresh and the sync time) and Account (a
locally cached name, revalidated by uncached Auth `GET /user` in the background,
"Signed in from iPhone", Health status and watch-only sign-out; blank names
become “Athlete”). An Allow Health access page comes first until read access has
been requested; account states without a session use a message layout (icon,
title, one line, buttons). Turn on **Debug mode** under Account to reveal
Diagnostics behind it (recent timestamped
background scheduling, wake, Health sync, observer-query and background-delivery
registration failures, backend read, snapshot save, Auth refresh exchanges
and SDK session-write notifications, and complication reload-request outcomes). The last 300 events stay on the watch, not in its
widget or on a server. A random attempt ID ties together observer arrival,
energy reconciliation, snapshot save, and HealthKit acknowledgement within
one in-process attempt; a resumed pending import has a new ID. Entries
include the observed active/resting metric, optional app state captured at
handling time, elapsed seconds, backend operation or account-gate skip reason. A refresh now emits
start and terminal events for the active/resting HealthKit statistics queries,
Health import, reconciliation read/write, and today's final backend read.
These stage durations use wall time (including suspension), not the older
active-runtime seconds. A missing terminal stage does not prove a query failed;
watchOS may have suspended or killed the app. An actual scheduled background
wake has a separate `Expired by watchOS` event if its expiration handler ran;
absence of that event is not evidence of success. Each observer callback
first attempts a read-back-verified private, user-scoped pending Health sync,
then promptly acknowledges HealthKit without waiting for backend or HealthKit
queries. A failed local handoff is logged but cannot guarantee a deferred retry. An
eligible app run reconciles the marker and clears it only after Health sync,
fresh backend read and local snapshot save; a newer delivery cannot be cleared
by an older in-flight sync. Events report wall-clock age since the earliest
pending delivery separately from active runtime. Observer acknowledgements
carry the callback's timestamp even if storing the event on the main actor is
delayed; exports sort late-stored events by actual occurrence. A new eligible trigger
replaces an in-flight refresh older than 30 wall-clock seconds rather than
joining a suspended task indefinitely. Legacy 25-second timeout events may
have been acknowledged much later if the app was suspended. Error
categories distinguish HealthKit queries, background registration and
backend reads/writes. New GraphQL transport failures report only a fixed
URLSession, HTTP, service/response or unknown cause (and real URLSession error
number or HTTP status when available); older `GraphQL transport · code 3`
records are Swift enum indices, not HTTP/HealthKit codes. Uncached Auth `/user`
failures record their own safe cause; scene transitions record
active/inactive/background but cannot prove uninterrupted background work.
Auth refresh events use a random attempt ID and record request start, safe
HTTP/transport outcome, and wall time at the HTTP boundary. Session-write
events use the session-store notification callback time (after any SDK queueing),
not the later MainActor log time. Both omit app state because it could change
before deferred logging runs. A cancelled exchange is logged as
Skipped · cancelled, not a Network failure; its server outcome is unknown, so
a later 401 or session removal may mean the token already rotated. A 2xx
response means only that the transport received it; a separate SDK session-write event indicates a stored
session (including PAT sign-in), not necessarily that a preceding refresh
belongs to it. Missing terminal/write events cannot prove persistence failed
if watchOS suspended the app. Older events retain numeric-only detail. Separately, the watch widget writes
up to 64 timestamp-only provider receipts to an atomic App Group file when
`getTimeline` or `getSnapshot` reads the shared snapshot. In Diagnostics, tap
**Read widget receipts** to inspect the latest six; the `.txt` export includes
all retained receipts and watch-app events. A receipt gives the widget request
time and the snapshot's last-updated time (or absence), not confirmation that
the watch face rendered it. In Diagnostics, **Share logs** exports the plain-text
`NeoGym-Watch-Events.txt` attachment through the watchOS share sheet. Mail is
a destination only if available; the recipient cannot be prefilled by
`ShareLink` and nothing is sent automatically. Neither events nor receipts
contain account details, tokens, URLs, Health values or raw error messages.
“Accepted” means watchOS accepted a background request, not that it woke the
app; “Requested” means WidgetKit was asked to reload, not that the watch face
rendered new data. Snapshot-save failure is shown on the End of day page and logged
rather than silently claiming a fresh complication.
Pages use the same words and numbers as the phone's Today card. Missing backend
energy leaves the balance and Out unavailable (`—`) until a local provisional
Health estimate is available; absent active/resting components on an existing
row count as zero.
The watch app syncs active and resting HealthKit statistics for
the last seven local dates to private backend daily energy only after the user
taps **Allow** on the Allow Health access page; manual energy rows are not overwritten. WatchKit's
preferred hourly background task and HealthKit observer delivery are
best-effort, not a guaranteed hourly schedule. Pending observer deliveries
request a coalesced, 15-minute preferred fallback wake; accepted requests do
not guarantee delivery, and a foreground open retries any pending work. NeoGym
observes active/basal
energy samples, not Workout records; a Fitness workout is not itself a NeoGym
background wake. Observer sync work waits for local activation and account
validation, but HealthKit completion follows the local handoff immediately;
ineligible runs log a skipped Energy refresh while the same-owner pending
marker remains for a later eligible run. After a failed backend sync or
transient account-validation failure, the app requests another background wake
with 15/30/60-minute backoff. It coalesces duplicate hourly requests and
re-arms after account bootstrap but before energy reconciliation so an
interrupted sync is less likely to omit the next request. watchOS may still defer or skip that wake. Returning from
the background explicitly awaits the fresh `/user` read then refreshes energy,
including when the account name did not change; tapping the widget opens the
app, not an on-visible widget sync. The watch complication's rectangular family
shows "Balance so far", the balance and "In · Out"; its circular family shows food
in against today's plan kcal as a ring with a compact number ("1.5k IN"). Both
read the watch app's token-free App Group snapshot after a fresh backend fetch
or a local Apple Health estimate. On observer delivery, the watch reads local HealthKit
before its network reconciliation and saves an estimate only when its same-owner,
same-day backend snapshot says today's row is imported or absent. Manually
edited rows and older snapshots with unknown provenance are not overlaid;
intake remains the last known server value. This is provisional until a fresh
backend read: the watch app's End of day page labels it "Health estimate <time>",
but neither complication family marks provisional values. Phone-side manual
edits made since the last server read may briefly supersede it. A file-backed
watchOS background URLSession upload sends one idempotent GraphQL upsert for the
last seven dates instead of holding a chain of GraphQL calls through suspension. Hasura inserts missing dates and
updates only conflicts still marked "Imported from Apple Health"; owner
permissions come from a freshly checked SDK bearer token, never the widget.
The system may defer transfers or deliver them after the short-lived bearer
expires; failures keep the private pending marker for a later retry. A delivered
transfer requests a fresh backend read; only successful reconciliation, read
and snapshot save clear the pending marker. URLSession transfer completion
cannot prove a WidgetKit render. Full colour tints only the title (accent) and
ring (Chart 1); tinted faces take the face colour for those, and numbers stay
white. VoiceOver identifies each metric. The provider reads the latest snapshot
of any date. The rectangular title changes to its time ("Balance at 13:40") once
the snapshot is an hour old; a previous day's snapshot shows "—" with "Open NeoGym
to sync", and no snapshot (never connected, or cleared on sign-out) shows "Not
connected". The app saves the
latest successful fetch timestamp even if values are unchanged, but requests
a WidgetKit reload only for changed displayed values/provisional status or
cleared snapshots. To avoid exhausting background reload opportunities during
HealthKit callback bursts, background requests are limited to one per 15 minutes;
a suppressed request is recorded as coalesced and retained for the next eligible
wake or foreground return. Foreground updates and session clearing bypass the
limit. Provider receipts prove a timeline was generated, not that WidgetKit
rendered it. The stale label comes from pre-scheduled timeline entries. Scrolling into view
does not force an app sync. Neither Keychain nor HealthKit is available to the
watch widget. Signing watch app/widget requires App Group provisioning, plus HealthKit
background delivery on the watch app ID; test refreshes and permission on paired
hardware rather than inferring behavior from simulator builds. The watch first restores the local session and shows the same-user cached
profile and today's energy snapshot without waiting for a phone connection,
local WCSession activation, or `GET /user`. It reads any already delivered
account-only WatchConnectivity context immediately, then completes local
activation in the background and checks the latest hint again. A known
signed-out or different iPhone account blocks the display, clears cached data,
and triggers remote sign-out plus mandatory local clearing. A hint delivered
after launch may briefly leave stale data visible before it is processed. An
unknown/unreachable phone does not block independent watch internet access.
Hints contain no credential, email, or name; an undelivered hint cannot revoke
the watch's server session instantly, and failed remote revocation can leave a
server token valid until expiry despite successful local removal. The bounded
watch expiring activity around auth work is best-effort, not a suspension
promise: its 20-second local deadline releases the assertion without cancelling
the request; system-reported expiry can cancel PAT sign-in or a name read, while local
session clearing must complete. A PAT sign-in forces a fresh `/user` read even
when the SDK already persisted a same-account session. On a paired test device,
terminate the iPhone app, tap **Connect** on the watch, then open
**Me › Account** on the phone; when iOS delivers the request, confirm the
**Apple Watch** row shows **Request waiting** without a second tap (tap it to
open Connect Apple Watch). Repeat after a
force-quit and retry from the watch if iOS suppressed background delivery. Then
sign in with the phone-issued PAT, edit the server-side name,
background/reopen the watch, and check that it shows the new name; repeat with
phone unreachable, watch offline/retry, watch sign-out, and a later phone
sign-out/account switch. With Debug mode on, check Diagnostics for accepted scheduling versus actual
background wakes, Auth refresh request/response versus session-write events,
and snapshot-save failures. Tap **Share logs** on the
paired watch, pick an available destination, and inspect the resulting `.txt`
attachment for matching same-run observer/refresh attempt IDs, callback-time
acknowledgement, active/background state when the handler ran, typed stage
starts/ends and wall durations, background-task expiry (if delivered), backend
stage/source/code, coalesced WidgetKit reloads, and widget provider receipts.
Compare local workout time to export UTC (e.g. 06:19 UTC+2 = 04:19Z). No
`Background wake` event is required for a HealthKit delivery. A missing
acknowledgement log can mean watchOS suspended or terminated the app before it
could record the callback; older timed-out events do not prove a sync completed. Verify that scrolling into
the widget does not claim a new sync, and that an hour-old snapshot switches to
"Balance at <time>". Tap the widget to open NeoGym, and check that account
revalidation is followed by a fresh energy read. With unchanged energy/intake values and the same provisional status, expect a
successful snapshot save but **no** WidgetKit reload request; after a value or
provisional-status change, expect a reload request or a coalesced background
request and verify the widget's actual display separately. Leave NeoGym closed
while the watch face stays stale, then open Diagnostics and export the receipts: a
missing pre-open timeline points to deferred WidgetKit scheduling, a pre-open
read of an old/missing snapshot points to shared-store visibility/date issues,
and a pre-open read of the latest snapshot without a new face display points
to rendering/timeline delivery. Even a receipt for the latest snapshot does not
prove a new face render. On paired hardware verify a background observer's
local Health estimate is saved before its URLSession upload completes, that
manual rows are not replaced, and that a deferred/expired-token upload remains
pending for the next eligible retry. A successful upload alone is not a
confirmed watch-face update.
After a transient backend failure, look for a preferred retry request
(15/30/60-minute backoff); acceptance still does not prove an OS wake. Simulator
builds only prove the share API compiles, not which services appear on real hardware. Only a
paired-device test can confirm that WidgetKit ultimately updated the watch face. No production `GET /user` contract or signed hardware
acceptance is established merely by a simulator build.

### Release verification and guarded TestFlight upload

Provisioning the watch and watch widget App IDs (`io.nhost.dbarroso.neogym.watchkitapp`
and `io.nhost.dbarroso.neogym.watchkitapp.widgets`)
under team `C7HCKFA2LG` can change Apple account state: obtain operator
acknowledgment first. Confirm Xcode Accounts has that team, a distribution
certificate, and phone/phone-widget/watch/watch-widget profiles. Each run that
permits Xcode to register/update profiles needs **separate** `NEOGYM_ALLOW_PROVISIONING_UPDATES=YES`;
without it the scripts do not pass `-allowProvisioningUpdates` and may fail
if suitable profiles are unavailable. This is not upload approval.

```sh
# After regenerating the project and building both simulator schemes:
Scripts/verify-release-archive.sh --simulator /path/to/NeoGym.app
python3 -m unittest Scripts/test_verify_release_archive.py
# Non-upload: signed device archive, verify archive, export locally, verify IPA.
make archive-release
# Only after explicit approval for THIS real upload:
make deploy-testflight
```

If current profiles do not work, obtain separate approval before prefixing
**either** command with `NEOGYM_ALLOW_PROVISIONING_UPDATES=YES`. Never run the
upload target merely to validate a release. `archive-release` uses
`LocalExportOptions.plist` with `destination=export`; it retains its output
under ignored `.build/testflight/`. The verifier checks exactly one phone app
with embedded watch app, phone widget, and watch complication extension, identities,
platform/family, watch icon,
matched versions *within* each artifact, linked watch frameworks (including
`NeoGymWatch.debug.dylib` when Xcode places Debug simulator app code behind a
stub executable), and each bundle's non-ad-hoc signature, team, current provisioning profile and
entitlements. An archive may be development-signed; the exported IPA must
have `get-task-allow=false` for every bundle. Xcode-managed build numbering
can differ **between** archive and IPA. Invalid or unsigned artifacts fail
closed; the upload script reuses the complete non-upload path before calling
`destination=upload`. Do not bypass it through Organizer or direct export.
The phone/widget shared Keychain remains unused by watch. Watch app and watch
widget use the same App Group **identifier** for a separate, watch-local
snapshot; App Group files do not sync across devices (unlike a user-initiated
Diagnostics-page share). `swift test` and offline verifier fixtures do not prove signing or provisioning; on a machine without
Apple signing, report signed archive/IPA checks as blocked.

On paired development-signed iPhone/watch hardware, install the phone app and
its companion, connect an existing account to the watch from the phone, edit that test
account's name server-side (without saving an admin secret in this repo),
background/reopen watch and confirm the new name from `GET /user`. Test retry
after network loss, PAT expiry/re-pairing, watch-only internet while the phone is
unreachable, and delayed phone sign-out/account-switch hints after reconnect.
A paired iPhone is needed for installation, not independent watch network
reads. Undelivered hints are not instant server revocation; failed remote
sign-out may leave a server token active until expiry even though the watch
clears locally. Confirm production `GET /user` contract before release. After
an approved upload, wait for App Store Connect processing and install the
processed TestFlight build on paired hardware before claiming acceptance.

### TestFlight release notes

The existing App Store Connect app remains `io.nhost.dbarroso.neogym`; the
widget remains `io.nhost.dbarroso.neogym.widgets`, with App Group
`group.io.nhost.dbarroso.neogym`. The phone and widget still connect to the
production Nhost backend through TestFlight. Keep the intended
`MARKETING_VERSION` in `project.yml`; `CURRENT_PROJECT_VERSION` seeds all four
bundles in the archive. Export can use Xcode-managed build numbers, so the
uploaded number may differ from the archive's; do not change only generated
project settings or plists. App Store Connect processing, compliance answers,
and tester-group assignment happen after any future authorized upload, not at
archive creation. External testers may require Beta App Review; uploading is
not a production App Store release.

Keep the phone/widget shared
Keychain access group `$(AppIdentifierPrefix)io.nhost.neogym.shared` unchanged;
if a signed installation uses a different group, reconcile both targets and
SDK configuration before archiving or users may lose their shared session.
The phone widget's `CFBundleDisplayName`, the phone app's
`NSHealthUpdateUsageDescription`, and **both** the watch app's
`NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` are
upload-validation requirements. App Store Connect requires the watch update
purpose key because of its HealthKit entitlement even though NeoGym requests
read-only watch access and the string explicitly says it does not write Health
data. The release verifier checks the purpose keys in the built watch bundle;
regenerate and create a **new archive** after changing them. The app's
`ITSAppUsesNonExemptEncryption = false` avoids repeated export-compliance
questions only if the actual app and dependencies qualify; revisit it after
cryptography changes. For builds uploaded without the key, answer **Manage**
in TestFlight build details. Organizer and direct export are **not allowed
fallback upload paths**. Retained archives are for diagnosis only: a retry
must start a fresh `make deploy-testflight` run after obtaining upload
approval for that run, repeating archive creation and verification plus local
IPA export and verification before upload. The scripts refuse to reuse an
existing archive.

## Persistent GraphQL browsing cache

The production app client enables the Nhost Swift SDK file-backed GraphQL cache.
Workouts, sessions, exercises, journal, foods, meals, nutrition plans/overview,
Body, and Energy list and display-detail screens consume stale-while-revalidate
streams: a cached response renders immediately when available, followed by fresh
backend data. Edit/form, HealthKit reconciliation, daily-intake, and widget
live-fetch queries stay network-only. Cache entries are isolated by the SDK's
managed-session authorization scope and the previous scope is purged on
sign-out/session replacement. Mutations remain network-only. Browsing caches
remain available after mutations, and every stale-while-revalidate load still
requests fresh backend data after any cached emission.

The app uses a 5-minute freshness window and allows cached offline fallback for
up to 7 days. Its cache directory is private to the app process; the widget
client deliberately has no GraphQL cache because each process must own a distinct
SDK file-cache directory. The cache is opportunistic and may be evicted by iOS;
it is not a complete offline database or mutation queue.

## Shared app/widget session adoption

The app and widget use one SDK-managed Keychain item and one SDK-managed App
Group lock. Both use service `io.nhost.swift.session`, account
`default.nhostSession`, Keychain access group
`$(AppIdentifierPrefix)io.nhost.neogym.shared`, and App Group
`group.io.nhost.dbarroso.neogym`. The Keychain access group is a separate
shared-session identity, not the app's bundle ID or its App Group; preserve it
unless the signed app and widget actually use another Keychain access group.
The SDK derives the lock identity automatically from the
canonical Keychain item identity; callers no longer supply a lock namespace. The
app waits up to 5 seconds for session ownership; the widget waits up to 500 ms.
App configuration failure is a fatal developer/provisioning error in this
controlled POC. A widget configuration
failure, lock timeout, cancellation, Auth failure, or network failure selects
the token-free cached/empty Energy Balance snapshot and does not write a failed
live result. The widget never runs HealthKit import; WidgetKit still owns its
best-effort refresh scheduling.

There is no app-private session, credential mirroring, reconciliation, or token
copy in the App Group. `project.yml` is the capability source of truth: both
targets retain only the shared Keychain access group and App Group, and both Info
plists expose only `NeoGymSharedKeychainAccessGroup` after build-setting
expansion.

### Controlled reset and validation

The old private/shared POC credentials are intentionally not migrated. Before
validating this adoption on a simulator, erase it because uninstalling the app
does not reliably erase Keychain items:

```sh
xcrun simctl shutdown <SIMULATOR_UDID>
xcrun simctl erase <SIMULATOR_UDID>
```

On a physical POC device, use a debug/test harness or debugger invocation of the
old private and shared `KeychainSessionStorageBackend.remove()` configurations
before installing this build. Do not add that cleanup or any reconciliation to
the shipped app. Downgrade to the mirroring build is unsupported; reset and
authenticate again when reverting.

After reset:

1. Run `nix develop ../.. --command xcodegen generate`, build the signed app,
   launch it, and authenticate again.
2. Confirm the app restores and refreshes its session, then add/run the Energy
   Balance widget and confirm a live server result. This signed simulator/device
   check proves both targets can access the same Keychain item and App Group;
   unsigned SwiftPM host tests cannot prove entitlement interoperability.
3. Hold the SDK-derived App Group session lock for the shared Keychain item from
   an app/debug harness for longer than 500 ms and reload the widget. Confirm it
   renders the cached/empty snapshot and performs no live snapshot write.
4. Repeat with widget cancellation, offline mode, and an Auth failure. The
   fallback must remain token-free and the widget must not run HealthKit import.
5. Sign out in the app. Confirm the shared session is removed and the widget
   falls back; the obsolete private item must never be consulted.

## Apple Health body imports

Opening Today or Progress › Body requests read-only Apple Health access for
body mass and body-fat percentage. The first import scans historical samples;
subsequent visits use per-type HealthKit anchors to check additions and reported
deletions, then re-read affected local dates to keep the latest sample per
metric. Whenever one type is unanchored and dates are affected, both metrics
are re-read in one date-bounded query per type. Cursors are scoped to the app user/timezone and
saved after backend reconciliation, not before; a type with an empty first
read keeps a nil anchor so it can retry if permission is granted later, even
when the other type already imported samples. An anchored type with no events
keeps its previous cursor in case its read access was revoked. Cursors live
under `body-health.anchor.v2.<userId>`; the previous
`body-health.anchor.v1.*` paired key is ignored if present so a previously
unreadable type starts from history. The app requests no write authorization
and does not export NeoGym measurements back to HealthKit. Missing dates are
created, while rows from the last 7 local days that still carry the exact
`Imported from Apple Health` note can be refreshed.
Manual or edited rows are not overwritten. Reported HealthKit deletions re-read
the last 7 local dates, correcting recent imported rows when another sample
remains. Older dates are not rechecked for deletions, and deleting every sample
for a day does not remove its imported Body row.

The iPhone no longer reads active/resting energy from HealthKit. Opening or
refreshing Today and Progress › Energy fetches `daily_energy` from the
backend; manual Energy logging still works. The watch app is the only HealthKit
energy uploader for now, so without a synced watch, energy must be entered
manually. The iPhone Balance widget also reads the backend, never
HealthKit.

Opening the Train tab (and pulling to refresh Sessions) also reads HealthKit
workouts into private `health_workouts` raw JSON snapshots. It requests workout
read permission only, recording activity type, start/end time, active calories
burned when available, and other workout-level metadata/events/statistics. It
does not request route or heart-rate stream access, create NeoGym sessions, or
export data. An on-device per-user HealthKit anchor handles additions, changes,
and reported deletions; see `docs/developers/health-workouts.md` for the cursor
reset caveat and the backend contract.

The HealthKit capability and both `NSHealthShareUsageDescription` and
`NSHealthUpdateUsageDescription` are declared in `project.yml`; regenerate the
Xcode project after changing them. The concrete Body and workout HealthKit importers compile
only for iOS; the watch energy importer lives in the watch app. `NeoGymKit`
builds and tests on the macOS host and builds for watchOS without linking
HealthKit.

## Current auth scope

`NhostConfig.local` defaults to `subdomain = "local"` and `region = "local"`,
matching the web app's local development config. `AuthStore` shows a loading
state while `getUserSession()` reads the SDK's persisted session, subscribes to
`sessionStore.subscribe`, then routes to either the signed-out email OTP
sign-in/sign-up forms or the protected full-screen app shell.

Sign-in and sign-up use Nhost email OTP: request a 6-digit code, copy it from
local MailHog, and verify it in the app. Sign-up sends
`AuthSignUpOptions(displayName:)`; both flows verify with
`verifySignInOTPEmail`. Sign out calls Nhost Auth when a refresh token exists and
then always clears the SDK's local session store so the app returns to signed-out
UI even if the remote sign-out request fails.

Profile email change uses PKCE on the app side. `ChangeEmailModel` generates a
PKCE verifier/challenge, stores the verifier in Keychain via
`KeychainPKCEVerifierStore`, requests `changeUserEmail` with
`redirectTo = "neogym://verify"`, and handles callbacks from `NeoGymApp`'s
`.onOpenURL` path. A successful `neogym://verify?code=...` callback exchanges
the code with the saved verifier, clears the verifier, and applies the returned
session; error or malformed callbacks surface feedback and also clear stale
verifier state. The backend must allow this native callback by keeping
`neogym://verify` in `auth.redirections.allowedUrls` in both
`backend/nhost/nhost.toml` and the production overlay. Restart the local Nhost
stack after redirect config edits; the CLI does not hot-reload `nhost.toml`.

Manual local OTP check:

1. From the repository root, run `make -C backend dev-env-up`.
2. Build/run the iOS app in a simulator from Xcode, or generate/build with the
   commands above.
3. Sign up with display name + email, open MailHog, copy the 6-digit code, and
   verify.
4. Confirm **Me › Account** shows the initials, display name, email, and
   member-since date.
5. Sign out, sign in again with the same email, verify the OTP, and relaunch the
   app to confirm the persisted session is restored.

Manual local email-change check:

1. From the repository root, run
   `make -C backend dev-env-down && make -C backend dev-env-up` after redirect
   config changes so local Auth loads the allowlist.
2. Build/run the iOS app in a simulator and sign in as an existing user.
3. Open **Change email** in **Me › Account**, enter a different email address,
   and submit the request.
4. Open MailHog, open the verification link on the simulator, and confirm iOS
   routes the callback into the app as `neogym://verify?code=...`.
5. Confirm token exchange succeeds, the saved verifier is cleared, and
   **Me › Account** shows the updated email.

Hand-crafted callback smoke check, when a simulator is available:

```sh
xcrun simctl openurl booted 'neogym://verify?code=fake'
```

With no matching saved verifier this should drive the app's callback path to the
"saved verification state is missing" error and clear any stale verifier.
