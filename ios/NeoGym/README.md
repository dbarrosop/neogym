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
├── Watch/                      # companion SwiftUI, private connectivity, icon/plist
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
`NeoGym.app/Watch/NeoGymWatch.app` and `NeoGym.app/PlugIns/NeoGymWidgets.appex`.
A paired iPhone is required for companion installation; the watch subsequently
uses its own internet connection and privately rotating Nhost SDK session.

The watch signs into an **existing** account with email OTP and displays only a
fresh, managed Auth `GET /user` display name (blank names become “Athlete”). It
reads the latest delivered account-only WatchConnectivity context after local
activation and on foreground. A known signed-out or different iPhone account
blocks the name and triggers remote sign-out plus mandatory local clearing. An
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
sign-out/account switch. No production `GET /user` contract or signed hardware
acceptance is established merely by a simulator build.

### Release verification and guarded TestFlight upload

Provisioning the new watch App ID (`io.nhost.dbarroso.neogym.watchkitapp`)
under team `C7HCKFA2LG` can change Apple account state: obtain operator
acknowledgment first. Confirm Xcode Accounts has that team, distribution
certificate, and phone/widget/watch profiles. Each run that permits Xcode to
register/update profiles needs **separate** `NEOGYM_ALLOW_PROVISIONING_UPDATES=YES`;
without it the scripts do not pass `-allowProvisioningUpdates` and may fail
if suitable profiles are unavailable. This is not upload approval.

```sh
# After regenerating the project and building both simulator schemes:
Scripts/verify-release-archive.sh --simulator /path/to/NeoGym.app
python3 -m unittest Scripts/test_verify_release_archive.py
# Non-upload: signed device archive, verify archive, export locally, verify IPA.
NEOGYM_ALLOW_PROVISIONING_UPDATES=YES make archive-release
# Only after separate explicit approval for THIS real upload:
NEOGYM_ALLOW_TESTFLIGHT_UPLOAD=YES NEOGYM_ALLOW_PROVISIONING_UPDATES=YES make deploy-testflight
```

Omit the provisioning opt-in if current profiles already work; never run the
upload target merely to validate a release. `archive-release` uses
`LocalExportOptions.plist` with `destination=export`; it retains its output
under ignored `.build/testflight/`. The verifier checks exactly one phone app
with embedded watch app and widget, identities, platform/family, watch icon,
matched versions *within* each artifact, linked watch frameworks (including
`NeoGymWatch.debug.dylib` when Xcode places Debug simulator app code behind a
stub executable), and each bundle's non-ad-hoc signature, team, current provisioning profile and
entitlements. An archive may be development-signed; the exported IPA must
have `get-task-allow=false` for every bundle. Xcode-managed build numbering
can differ **between** archive and IPA. Invalid or unsigned artifacts fail
closed; the upload script reuses the complete non-upload path before calling
`destination=upload`. Do not bypass it through Organizer or direct export.
The phone/widget shared Keychain and App Group remain unchanged and are **not**
used by watch. `swift test` and the offline verifier fixtures do not prove
signing or provisioning; record signed archive/IPA checks as blocked until
Apple signing is actually available.

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
`MARKETING_VERSION` in `project.yml`; `CURRENT_PROJECT_VERSION` seeds all three
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
The widget's `CFBundleDisplayName` and the app's
`NSHealthUpdateUsageDescription` are upload-validation requirements; regenerate
and create a **new archive** after changing them. The app's
`ITSAppUsesNonExemptEncryption = false` avoids repeated export-compliance
questions only if the actual app and dependencies qualify; revisit it after
cryptography changes. For builds uploaded without the key, answer **Manage**
in TestFlight build details. Organizer and direct export are **not allowed
fallback upload paths**. Retained archives are for diagnosis only: a retry
must start a fresh `make deploy-testflight` run, with new per-run upload
approval, and repeat archive creation and verification plus local IPA export
and verification before upload. The scripts refuse to reuse an existing archive.

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

Opening the Body measurements view requests read-only Apple Health access for
body mass and body-fat percentage, then imports the latest sample per metric per
local calendar day. The app requests no write authorization and does not export
NeoGym measurements back to HealthKit. Missing dates are created, while rows
from the last 7 local days that still carry the exact
`Imported from Apple Health` note can be refreshed from newer HealthKit values.
Manual or edited rows are not overwritten.

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
Xcode project after changing them. The concrete HealthKit importers compile
only for iOS, so `NeoGymKit` builds and tests on the macOS host and builds for
watchOS without linking HealthKit.

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
