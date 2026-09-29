# NeoGym iOS

Native SwiftUI iPhone app with a watchOS companion and widget. The phone
uses email OTP, a protected Workouts/Nutrition/Me navigation shell, app-side
PKCE email change, and read-only Apple Health imports.

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
├── Watch/                      # companion SwiftUI, HealthKit energy sync, private connectivity
├── WatchWidgets/               # watch-face Energy complication, token-free snapshot only
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

The watch signs into an **existing** account with email OTP. Signed-in users
swipe between Energy (today's consumed, total burned, active/resting, and
Net = consumed minus burned kcal) and Profile (a locally cached name/email,
revalidated by uncached Auth `GET /user` in the background, plus watch-only
sign-out; blank names become “Athlete”), and Events (recent timestamped
background scheduling, wake, Health sync, observer-query and background-delivery
registration failures, backend read, snapshot save, and complication
reload-request outcomes). The last 300 events stay on the watch, not in its
widget or on a server. A random attempt ID ties together observer arrival,
energy reconciliation, snapshot save, and HealthKit acknowledgement. Entries
include the observed active/resting metric, app state when handled, elapsed
seconds, backend operation or account-gate skip reason. Observer processing is
acknowledged when it finishes or at a 25-second deadline that cancels only that
attempt's active refresh; watchOS suspension can prevent a terminal event from
being logged. Error categories distinguish HealthKit queries, background
registration, backend reads/writes and GraphQL transport (which still combines
network, HTTP and service failures). Older events retain numeric-only detail. In Events, tap **Share logs** to choose an
app/destination in the watchOS share sheet for a plain-text `.txt` attachment.
Available destinations depend on the watchOS
share sheet and installed apps; nothing is sent automatically. Exports contain
no account details, tokens, URLs, Health values or raw error messages; they
contain only these diagnostic events.
“Accepted” means watchOS accepted a background request, not that it woke the
app; “Requested” means WidgetKit was asked to reload, not that the watch face
rendered new data. Snapshot-save failure is shown on the Energy page and logged
rather than silently claiming a fresh complication.
Consumed and Burned use icons rather than visible labels on the watch page; Net uses a
balance-scale icon and equally prominent value. The Energy title carries a
small `(kcal)` unit, while an icon-only refresh button sits beside the sync
time. Missing backend energy leaves total burn and Net unavailable; absent
active/resting components on an existing row are shown as `—` but count as zero
in the total.
The watch app syncs active and resting HealthKit statistics for
the last seven local dates to private backend daily energy only after the user
taps Sync Apple Health; manual energy rows are not overwritten. WatchKit's
preferred hourly background task and HealthKit observer delivery are
best-effort, not a guaranteed hourly schedule. NeoGym observes active/basal
energy samples, not Workout records; a Fitness workout is not itself a NeoGym
background wake. Observer deliveries wait for local
activation and account validation before syncing or calling HealthKit's
completion; ineligible deliveries record a skipped Energy refresh · Health event
before completion. After a failed backend sync, transient account-validation
failure, or timed-out Health observer, the app requests another background wake
with 15/30/60-minute backoff. It coalesces duplicate hourly requests and
re-arms after account bootstrap but before energy reconciliation so an
interrupted sync is less likely to omit the next request. watchOS may still defer or skip that wake. Returning from
the background explicitly awaits the fresh `/user` read then refreshes Energy,
including when the account name did not change; tapping the widget opens the
app, not an on-visible widget sync. The rectangular watch complication shows
intake, total burn, active/resting, and Net from the watch app's token-free,
today-only App Group snapshot after a fresh backend fetch. Only its cutlery,
flame, and custom two-pan balance icons are colored green, red, and teal;
consumed and burned use equal bold type with no visible “in/out” words.
VoiceOver still identifies each metric. A small clock/relative age indicates
when the currently rendered widget snapshot was fetched. The app saves the
latest successful fetch timestamp even if values are unchanged, but requests
a WidgetKit reload only for changed displayed values or cleared snapshots;
the age may lag until WidgetKit's next timeline request. Scrolling into view
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
the request; system-reported expiry can cancel OTP or a name read, while local
session clearing must complete. A verified OTP forces a fresh `/user` read even
when the SDK already persisted a same-account session. On a paired test device,
sign in via OTP, edit the server-side name,
background/reopen the watch, and check that it shows the new name; repeat with
phone unreachable, watch offline/retry, watch sign-out, and a later phone
sign-out/account switch. Check Events for accepted scheduling versus actual
background wakes and for snapshot-save failures. Tap **Share logs** on the
paired watch, pick an available destination, and inspect the resulting `.txt`
attachment for matching observer/refresh attempt IDs, metric, active/background
state, acknowledgement or timeout, duration, and backend stage/source/code.
Compare local workout time to export UTC (e.g. 06:19 UTC+2 = 04:19Z). No
`Background wake` event is required for a HealthKit delivery. A missing
acknowledgement can mean watchOS suspended or terminated the app; a timed-out
acknowledgement means no completed sync is assured. Verify that scrolling into
the widget shows an advancing snapshot age but does not claim a new sync. Tap
the widget to open NeoGym, and check that account revalidation is followed by a
fresh Energy read. With unchanged energy/intake values, expect a successful
snapshot save but **no** WidgetKit reload request; after a real value change,
expect a reload request and verify the widget's actual display separately.
After a timeout or transient backend failure, look for a preferred retry request
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
Events-page share). `swift test` and offline verifier fixtures do not prove signing or provisioning; on a machine without
Apple signing, report signed archive/IPA checks as blocked.

On paired development-signed iPhone/watch hardware, install the phone app and
its companion, sign an existing account into the watch by OTP, edit that test
account's name server-side (without saving an admin secret in this repo),
background/reopen watch and confirm the new name from `GET /user`. Test retry
after network loss, expiry/new OTP, watch-only internet while the phone is
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

Opening Body or Nutrition Overview requests read-only Apple Health access for
body mass and body-fat percentage. The first import scans historical samples;
subsequent visits use per-type HealthKit anchors to check additions only, then
re-read the affected local dates to keep the latest sample per metric. Whenever
one type is unanchored and dates are affected, both metrics are re-read in one
date-bounded query per type. Cursors are scoped to the app user/timezone and
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
Manual or edited rows are not overwritten. HealthKit sample deletions are not
reconciled yet; deleting a sample alone does not remove its imported Body row.

The iPhone no longer reads active/resting energy from HealthKit. Opening or
refreshing Nutrition Overview and Energy fetches `daily_energy` from the
backend; manual Energy logging still works. The watch app is the only HealthKit
energy uploader for now, so without a synced watch, energy must be entered
manually. The iPhone Energy Balance widget also reads the backend, never
HealthKit.

Opening the Workouts area (and pulling to refresh its hub) also reads HealthKit
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
`sessionStore.subscribe`, then routes to either signed-out OTP forms or the
protected full-screen app shell.

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
4. Confirm the profile shows initials, display name, email, locale, role, user
   ID, and member-since date.
5. Sign out, sign in again with the same email, verify the OTP, and relaunch the
   app to confirm the persisted session is restored.

Manual local email-change check:

1. From the repository root, run
   `make -C backend dev-env-down && make -C backend dev-env-up` after redirect
   config changes so local Auth loads the allowlist.
2. Build/run the iOS app in a simulator and sign in as an existing user.
3. Open **Change email** on the profile screen, enter a different email address,
   and submit the request.
4. Open MailHog, open the verification link on the simulator, and confirm iOS
   routes the callback into the app as `neogym://verify?code=...`.
5. Confirm token exchange succeeds, the saved verifier is cleared, and the
   profile shows the updated email.

Hand-crafted callback smoke check, when a simulator is available:

```sh
xcrun simctl openurl booted 'neogym://verify?code=fake'
```

With no matching saved verifier this should drive the app's callback path to the
"saved verification state is missing" error and clear any stale verifier.
