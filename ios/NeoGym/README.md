# NeoGym iOS

Native SwiftUI app for NeoGym. The current milestone implements email OTP
sign-in/sign-up, a protected grouped app shell with three primary tabs and
secondary sections for the seven signed-in destinations, sign out, session
bootstrap through local Nhost Swift SDK storage, app-side PKCE email-change
handling through the `neogym://verify` URL scheme, and read-only Apple Health
imports for body weight/body-fat measurements.

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
├── Sources/NeoGymKit/          # host-testable auth/session logic
└── Tests/NeoGymKitTests/
```

`NeoGymKit` must stay free of SwiftUI/UIKit so `swift build` and `swift test`
run on the macOS host. SwiftUI views belong in `App/`.

## Prerequisites

- macOS with Xcode installed for simulator builds.
- Nix devshell from the repository root. On Darwin, the shell includes XcodeGen
  when the pinned Nixpkgs exposes `pkgs.xcodegen`.
- Local Nhost Swift SDK checkout at
  `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
  directory (normally
  `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Adjust
  `Package.swift` if your workspace layout differs.

If XcodeGen is not available from Nix on a Darwin host, install it with Homebrew
(`brew install xcodegen`) and run the same `xcodegen generate` command below. Do
not commit the generated `.xcodeproj`; `project.yml` is the source of truth. App
Info.plist entries that XcodeGen owns, including the `neogym` URL scheme and
full-screen launch screen keys, are declared under the target `info.properties`
in `project.yml`; rerun XcodeGen after changing them. The same spec also keeps
the shared scheme's default debug diagnostics disabled: XcodeGen writes the
supported GPU/main-thread/thread-performance settings, then
`Scripts/disable-xcode-debug-options.py` patches the generated `.xcscheme` for
XPC Services, Queue Debugging/backtrace recording, and View Debugging, which
XcodeGen does not expose directly. Keep `LaunchScreen.storyboard` wired through
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

## Persistent GraphQL list cache

The production app client enables the Nhost Swift SDK file-backed GraphQL cache.
Workouts, sessions, exercises, journal, foods, meals, nutrition plans/overview,
Body, and Energy list screens consume stale-while-revalidate streams: a cached
response renders immediately when available, followed by fresh backend data.
Cache entries are isolated by the SDK's managed-session authorization scope and
the previous scope is purged on sign-out/session replacement. Mutations remain
network-only.

The app uses a 5-minute freshness window and allows cached offline fallback for
up to 7 days. The cache is opportunistic and may be evicted by iOS; it is not a
complete offline database or mutation queue.

## Shared app/widget session adoption

The app and widget use one SDK-managed Keychain item and one SDK-managed App
Group lock. Both use service `io.nhost.swift.session`, account
`default.nhostSession`, Keychain access group
`$(AppIdentifierPrefix)io.nhost.neogym.shared`, App Group
`group.io.nhost.neogym`, and lock namespace
`io.nhost.neogym.shared-session`. The app waits up to 5 seconds for session
ownership; the widget waits up to 500 ms. App configuration failure is a fatal
developer/provisioning error in this controlled POC. A widget configuration
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
3. Hold the stable App Group session lock from an app/debug harness for longer
   than 500 ms and reload the widget. Confirm it renders the cached/empty
   snapshot and performs no live snapshot write.
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

The HealthKit capability and `NSHealthShareUsageDescription` are declared in
`project.yml`; regenerate the Xcode project after changing them. The concrete
HealthKit importer is compiled only for non-macOS platforms so `NeoGymKit` keeps
building and testing on the macOS host.

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
