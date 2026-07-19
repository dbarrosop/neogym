# NeoGym iOS

Native SwiftUI app for NeoGym. The current milestone implements email OTP
sign-in/sign-up, a protected grouped app shell with three primary hubs and
native pushed subsection routes, sign out, session
bootstrap through local Nhost Swift SDK storage, bundle-configured app-side
PKCE email-change callbacks, and read-only Apple Health imports for body
weight/body-fat measurements.

## Layout

```text
ios/NeoGym/
├── project.yml                 # XcodeGen target/configuration graph
├── Configuration/              # authoritative Common + variant xcconfigs
├── fastlane/.env.*.example     # tracked templates for ignored opaque inputs
├── fastlane/*receipt*          # cloud-callback attestation schema/example
├── Scripts/                    # materialization, generation, safe inspection
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

- macOS with an Xcode/iOS SDK supporting deployment target 26.6.
- Nix devshell from the repository root. On Darwin, it includes XcodeGen,
  Python with Pillow/python-dotenv, Ruby, and Bundler.
- Local Nhost Swift SDK checkout at
  `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
  directory (normally
  `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Adjust
  `Package.swift` if your workspace layout differs.

If XcodeGen is not available from Nix on a Darwin host, install it with Homebrew
(`brew install xcodegen`) and still use `Scripts/generate-project.sh`; do not
bypass materialization or commit the generated project. Tracked
`Configuration/*.xcconfig`, tokenized plists/entitlements, and `project.yml` are
the source of truth. The spec's single `postGenCommand` patches both shared
schemes for XPC Services, Queue Debugging/backtrace recording, and View Debugging
and is idempotent. Keep `LaunchScreen.storyboard` wired through
`UILaunchStoryboardName`; without it, iOS can use legacy letterboxed sizing.

## Commands

From this directory:

```sh
# Build and test the host-compatible package
swift build
swift test

# One-time local inputs (use non-secret sentinels for configuration checks)
cp fastlane/.env.development.example fastlane/.env.development
cp fastlane/.env.production.example fastlane/.env.production
# Fill each Team/Nhost value locally; these files stay ignored.

# Materialize both mode-0600 xcconfigs and generate both shared schemes
nix develop ../.. --command Scripts/generate-project.sh all

# Build either generic simulator variant (signing may be disabled for checks)
xcodebuild -project NeoGym.xcodeproj -scheme 'NeoGym Dev' \
  -configuration Debug-Development -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
  -configuration Debug-Production -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

`Scripts/generate-project.sh development|production` refreshes only one
materialized input and preserves the other variant. Both schemes always remain
in the project, and their app/widget pre-build guards reject missing, empty, or
unexpanded selected settings using key-only diagnostics. Never use raw
`xcodebuild -showBuildSettings`: it exposes custom settings. Use
`Scripts/read-build-settings.py` with explicit allowlisted fields and a private
output path. The materializer allowlists only `DEVELOPMENT_TEAM`,
`NHOST_SUBDOMAIN`, and `NHOST_REGION`, parses with dotenv interpolation disabled,
and never logs values. Future Fastlane lanes must invoke this same materializer
and consume the generated build settings rather than reparsing product values.

Both app/widget pairs require iOS 26.6. The app is iPhone-only and portrait-only;
Catalyst and Designed for iPad on Mac are disabled. Marketing/build versions
default to `1.0`/`1` for both targets. The variant matrix is:

| Scheme | App / widget IDs | App Group | Shared-keychain suffix | Callback | Name / icon |
|---|---|---|---|---|---|
| `NeoGym Dev` | `io.nhost.dbarroso.neogym.dev` / `.dev.widgets` | `group.io.nhost.dbarroso.neogym.dev` | `io.nhost.dbarroso.neogym.dev.shared` | `neogym-dev://verify` | `NeoGym Dev` / `AppIconDev` |
| `NeoGym` | `io.nhost.dbarroso.neogym` / `.widgets` | `group.io.nhost.dbarroso.neogym` | `io.nhost.dbarroso.neogym.shared` | `neogym://verify` | `NeoGym` / `AppIcon` |

The DEV icon is committed but deterministically derived from the production icon;
run `nix develop ../.. --command python3 Scripts/generate-dev-icon.py --check`
to detect pixel drift. Apple portal App IDs, groups, HealthKit capabilities, and
profiles must be provisioned manually; repository automation does not create them.

To confirm XcodeGen is supplied by Nix on Darwin:

```sh
cd ../..
nix develop . --command xcodegen --version
```

## Persistent GraphQL browsing cache

The bundle-configured app client enables the Nhost Swift SDK file-backed GraphQL cache.
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
Group lock. Service `io.nhost.swift.session`, account `default.nhostSession`,
and the acquisition budgets remain fixed protocol details. The Nhost endpoint,
callback scheme, App Group, and expanded shared-Keychain access group are loaded
once from each built bundle's `NeoGym*` runtime keys. The app and widget bundles
must resolve matching values; the runtime rejects missing, empty, unexpanded, or
crossed access-group metadata without logging configured values. The SDK derives
the lock identity automatically from the canonical Keychain item identity;
callers do not supply a lock namespace. The
app waits up to 5 seconds for session ownership; the widget waits up to 500 ms.
App configuration failure is a fatal developer/provisioning error in this
controlled POC. A widget configuration
failure, lock timeout, cancellation, Auth failure, or network failure selects
the token-free cached/empty Energy Balance snapshot and does not write a failed
live result. The widget never runs HealthKit import; WidgetKit still owns its
best-effort refresh scheduling.

There is no app-private session, credential mirroring, reconciliation, or token
copy in the App Group. Variant xcconfigs own exact static identities;
mode-0600 ignored generated xcconfigs own only Team/Nhost inputs; tracked
plists/entitlements resolve those settings for both targets. Production uses
`io.nhost.dbarroso.neogym`, `group.io.nhost.dbarroso.neogym`, and `neogym`;
development uses the isolated `.dev` identities and `neogym-dev`. Both retain
only the matched shared Keychain group and App Group.

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

1. Run `nix develop ../.. --command Scripts/generate-project.sh all`, build the
   selected signed variant, launch it, and authenticate again.
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

The app-only HealthKit capability and `NSHealthShareUsageDescription` are
declared in tracked entitlement/plist templates. Do not add
`NSHealthUpdateUsageDescription` while both importers request `toShare: []`. The concrete
HealthKit importer is compiled only for non-macOS platforms so `NeoGymKit` keeps
building and testing on the macOS host.

## Current auth scope

Shipped app and widget clients read the Nhost subdomain and region opaquely from
their built runtime metadata; Swift does not select a production environment.
`NhostConfig.local` remains only as an explicit test/preview convenience.
`AuthStore` shows a loading state while `getUserSession()` reads the SDK's
persisted session, subscribes to
`sessionStore.subscribe`, then routes to either signed-out OTP forms or the
protected full-screen app shell.

Sign-in and sign-up use Nhost email OTP: request a 6-digit code, copy it from
local MailHog, and verify it in the app. Sign-up sends
`AuthSignUpOptions(displayName:)`; both flows verify with
`verifySignInOTPEmail`. Sign out calls Nhost Auth when a refresh token exists and
then always clears the SDK's local session store so the app returns to signed-out
UI even if the remote sign-out request fails.

Profile email change uses PKCE on the app side. `ChangeEmailModel` generates a
PKCE verifier/challenge, stores the verifier in Keychain under a service derived
from the built bundle identifier, requests `changeUserEmail` with the configured
`<callback-scheme>://verify` redirect, and handles callbacks from `NeoGymApp`'s
`.onOpenURL` path. A successful configured callback exchanges
the code with the saved verifier, clears the verifier, and applies the returned
session; error or malformed callbacks surface feedback and also clear stale
verifier state. Production resolves `neogym://verify`; development resolves
`neogym-dev://verify`. Both callbacks are present in local
`backend/nhost/nhost.toml` and the production overlay. Restart local Nhost after
any redirect-config edit.

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
2. Build/run the production `NeoGym` scheme in a simulator and sign in as an existing user.
3. Open **Change email** on the profile screen, enter a different email address,
   and submit the request.
4. Open MailHog, open the verification link on the simulator, and confirm iOS
   routes the callback into the app as `neogym://verify?code=...`.
5. Confirm token exchange succeeds, the saved verifier is cleared, and the
   profile shows the updated email.
6. Repeat with the `NeoGym Dev` scheme and confirm the callback routes as
   `neogym-dev://verify?code=...`.

Hand-crafted callback smoke check, when a simulator is available:

```sh
xcrun simctl openurl booted 'neogym://verify?code=fake'
xcrun simctl openurl booted 'neogym-dev://verify?code=fake'
```

With no matching saved verifier this should drive the app's callback path to the
"saved verification state is missing" error and clear any stale verifier.

### Production cloud-callback receipt

The production overlay is tracked deployment input; it does not prove the cloud
Auth configuration was applied. After an operator deploys the exact current
overlay and verifies effective callback behavior for both `neogym://verify` and
`neogym-dev://verify` on project `spmqtxqkdoxvtrkrfnnl`:

1. Copy `fastlane/cloud-callback-receipt.production.example.json` to the ignored
   `fastlane/cloud-callback-receipt.production.json`.
2. Confirm `overlaySha256` is the lowercase SHA-256 of the exact production
   overlay bytes (`shasum -a 256 ../../backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json`).
3. Record `verifiedAt` as a UTC timestamp in `YYYY-MM-DDTHH:MM:SSZ` form and put
   the accountable operator identity in `verifiedBy`.
4. Run `python3 Scripts/verify-cloud-callback-receipt.py`.

The receipt is an operator attestation, not independent or authenticated proof
of cloud state. Do not create a real receipt without applying the overlay and
checking effective Auth behavior. Missing, malformed, wrong-project,
wrong-callback, or stale-overlay receipts fail the gate using field-only
diagnostics. The future production archive and beta lanes must run this gate
before archive and again before upload; no receipt is committed to the
repository.
