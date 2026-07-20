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
├── fastlane/Fastfile           # orchestration-only local release lanes
├── fastlane/.env.*.example     # tracked templates for ignored opaque inputs
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
  Python with Pillow/python-dotenv, Ruby, and overlay-packaged Fastlane 2.237.0.
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

## Make workflow

Run the public workflow from this directory. Every command enters the repository
Nix devshell itself; do not install XcodeGen or Fastlane globally.

| Target | Behavior |
|---|---|
| `make simulator-up` | Boot the selected iPhone simulator and open Simulator. With no selection, reuse a booted iPhone or choose one from the newest installed iOS runtime. |
| `make simulator-down` | Shut down the selected simulator, or every booted iPhone simulator when no selection is supplied. It does not stop booted watch simulators. |
| `make build` | Generate and compile one unsigned generic-simulator variant, then validate the built app and embedded widget. It does not run the test/lint gate. |
| `make check` | Run `nix flake check`, Fastlane's Xcode-release tests, Swift build/tests, Python tool tests, icon/configuration checks, both generic-simulator builds, and both artifact validations. |
| `make deploy-simulator` | Boot the simulator, run `make check`, rebuild and locally sign the selected variant with simulated entitlements, validate it, install it, launch it, and confirm it remains running through startup. |
| `make deploy-device DEVICE_ID=…` | Run `make check`, build/sign the selected variant for the connected device, validate the signed app, install it, and launch it. |
| `make deploy-testflight` | Run `make check`, archive and validate production, then ask Xcode to sign, assign the next build number, and upload through its configured account. |

Examples:

```sh
make simulator-up
make deploy-simulator                         # development by default
make deploy-simulator VARIANT=production SIMULATOR_ID=<simulator-udid>
make deploy-device DEVICE_ID=<physical-device-identifier>
make deploy-device DEVICE_ID=<id> ALLOW_PROVISIONING_UPDATES=1
make deploy-testflight
make deploy-testflight VERSION=1.1
```

The Make parameters are:

| Parameter | Required/default | How to obtain it |
|---|---|---|
| `VARIANT` | `development` by default; accepts `development` or `production` for `build`, `deploy-simulator`, and `deploy-device`. TestFlight is always production. | Choose the isolated `.dev` identity for normal local work. Use production only when intentionally testing the production identity/callback. |
| `SIMULATOR_ID` | Optional. | Run `xcrun simctl list devices available`; copy the UUID beside an iPhone. `xcrun simctl list devices booted` shows the currently booted choice. |
| `DEVICE_ID` | Required by `deploy-device`. | Pair/connect and unlock the iPhone, enable Developer Mode, then run `xcrun xctrace list devices`; copy the hardware UDID in parentheses beside the physical iPhone (typically beginning `0000`). Do not use the unrelated CoreDevice UUID shown in `devicectl`'s **Identifier** column. The hardware UDID works with both `xcodebuild` and `devicectl`. |
| `ALLOW_PROVISIONING_UPDATES` | `0` by default; accepts `0` or `1`. | Set to `1` only if Xcode is signed in to the correct Apple team and may create/update profiles. The device target translates it to `xcodebuild -allowProvisioningUpdates`. |
| `VERSION` | Optional for TestFlight; otherwise the tracked marketing version. | Use a new App Store version such as `1.1`. Inspect the tracked value with `grep MARKETING_VERSION Configuration/Common.xcconfig`. Xcode manages the uploaded build number. |

`make deploy-device` uses Xcode's signing identities and private keys from the
login Keychain; no signing-key path is passed to Make. List usable
certificate/private-key pairs with:

```sh
security find-identity -v -p codesigning
```

The parenthesized value in an `Apple Development` identity's display name is not
reliably the Team ID. Read the certificate subject and use its `OU` value:

```sh
security find-certificate -a -p \
  | openssl crl2pkcs7 -nocrl -certfile /dev/stdin 2>/dev/null \
  | openssl pkcs7 -print_certs -noout 2>/dev/null \
  | grep 'Apple Development'
# subject=..., OU=ABCDE12345, O=Example Team, ...
```

Choose the `OU` belonging to the organization/team that owns the app IDs. An
`Apple Development` identity is sufficient for device deployment; TestFlight
requires Apple Distribution signing/provisioning (or an authenticated Xcode
account allowed to manage it). If no valid identity is listed, add the account
under Xcode **Settings > Accounts** or import the certificate/private key into
the login Keychain. List locally installed profiles with:

```sh
find "$HOME/Library/MobileDevice/Provisioning Profiles" -type f -name '*.mobileprovision' -print
```

### Required ignored environment files

Create both files before `make check` or any deploy target. `make build` needs
only the file for its selected variant.

```sh
cp fastlane/.env.development.example fastlane/.env.development
cp fastlane/.env.production.example fastlane/.env.production
chmod 600 fastlane/.env.development fastlane/.env.production
```

Fill `DEVELOPMENT_TEAM`, `NHOST_SUBDOMAIN`, and `NHOST_REGION` in each file:

- Get `DEVELOPMENT_TEAM` from the certificate subject's `OU` value using the
  `security ... | openssl ...` command above. Do not copy the parenthesized
  certificate-name suffix; it may identify the member/certificate rather than
  the Apple Developer team.
- Local development normally uses `NHOST_SUBDOMAIN=local` and
  `NHOST_REGION=local`.
- For production, authenticate and list accessible Nhost apps with
  `cd ../../backend && nhost login && nhost list`; copy the app's subdomain and
  region. Return to `ios/NeoGym/` before running Make.

Simulator deployment uses Xcode's local ad-hoc signature and simulated
entitlements, so it needs no Apple certificate or provisioning profile. It does
require a nonempty `DEVELOPMENT_TEAM` setting to expand the simulated application
and shared-Keychain prefixes; the tracked sentinel is sufficient for a local
simulator. Do not add `CODE_SIGNING_ALLOWED=NO` to the simulator deployment
build: the app intentionally fails closed at startup when its App Group
entitlement/container is unavailable. Credential-free `build` and `check`
products remain unsigned because they are never launched.

TestFlight delivery uses the Apple account configured in the selected Xcode.
The account must belong to the production team, have access to the existing App
Store Connect record, and be allowed to upload builds. Set
`ALLOW_PROVISIONING_UPDATES=1` in `.env.production` when Xcode may create or
refresh signing profiles. No App Store Connect API key is used.

## Low-level commands

From this directory:

```sh
# Build and test the host-compatible package
swift build
swift test

# One-time local inputs (use non-secret sentinels for configuration checks)
cp fastlane/.env.development.example fastlane/.env.development
cp fastlane/.env.production.example fastlane/.env.production
# Fill each Team/Nhost value locally; these files stay ignored.

# Canonical credential-free, headless gate (generation + source/tool tests + both builds)
nix develop ../.. --command Scripts/check.sh

# Materialize both mode-0600 xcconfigs and generate both shared schemes only
nix develop ../.. --command Scripts/generate-project.sh all

# Build either generic simulator variant (signing may be disabled for checks)
xcodebuild -project NeoGym.xcodeproj -scheme 'NeoGym Dev' \
  -configuration Debug-Development -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
  -configuration Debug-Production -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

`Scripts/check.sh` is the canonical local gate for humans and future release
orchestration. It uses the existing safe build-setting inspector, keeps raw
Xcode output in private temporary files, runs `swift build`, `swift test`, the
Python tooling/validator fixtures, default `all` generation, the DEV-icon drift
check, both generic simulator builds, and unsigned built-product validation. It
requires both ignored dotenv inputs but accepts their tracked non-secret
sentinels. It needs no booted simulator, App Store Connect credential,
distribution certificate, or provisioning profile, and it does not install or
launch either app.

Validate a separately built product explicitly against one selected variant:

```sh
# Unsigned generic-simulator check product
python3 Scripts/verify-artifact.py --variant development \
  DerivedData/Checks/development/Build/Products/Debug-Development-iphonesimulator/NeoGym.app

# Locally signed simulator product with simulated entitlements
python3 Scripts/verify-artifact.py --variant development --signed-simulator \
  DerivedData/Deploy/development-simulator/Build/Products/Debug-Development-iphonesimulator/NeoGym.app

# Provisioning-dependent signed outputs (examples; paths are local/ignored)
python3 Scripts/verify-artifact.py --variant production path/to/NeoGym.xcarchive
python3 Scripts/verify-artifact.py --variant production path/to/NeoGym.ipa
```

The validator always inspects the embedded
`PlugIns/NeoGymWidgets.appex`. It compares static identity/icon/callback/device/
platform/HealthKit metadata with the authoritative selected xcconfig and opaque
Nhost plist values exactly with the selected mode-0600 materialized xcconfig,
while diagnostics name keys only. Unsigned `.app` validation combines the
built plists with the tracked entitlement contract. `--signed-simulator` also
requires valid local app/widget signatures and verifies the Team-prefixed
runtime values against the tracked simulated-entitlement contract. `.xcarchive`
and `.ipa` validation additionally requires real signed entitlements and embedded
provisioning for app and widget, deriving application/keychain prefixes from the
signed values. Producing a signed archive or IPA remains credential/profile
dependent; the Fastlane workflow below orchestrates the same generator and
validator without becoming another product-configuration source.

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
to detect pixel drift.

## Local TestFlight delivery

Fastlane 2.237.0 is packaged by the repository Nix overlay from the hashed gem
closure under `nix/fastlane/`; do not run Bundler or install/invoke a global Fastlane. From a clean checkout:

```sh
cd ios/NeoGym

# Local SDK and the two ignored product-input files are required first.
cp fastlane/.env.development.example fastlane/.env.development
cp fastlane/.env.production.example fastlane/.env.production
# Fill Team/Nhost values in both files and authenticate the production team in Xcode.

nix develop ../.. --command fastlane generate --env production
nix develop ../.. --command fastlane check --env production

# After all portal/signing prerequisites below are satisfied:
nix develop ../.. --command fastlane beta --env production
```

The lanes are orchestration only:

- `generate --env development|production` invokes the canonical variant
  generator. `check` runs the pure Ruby Xcode-release tests and
  `Scripts/check.sh`.
- `archive --env production` resolves the authoritative production app ID and
  marketing version through `read-build-settings.py`, creates a signed Xcode
  archive, and validates the archive plus embedded widget. It does not upload.
- `beta --env production` performs that archive flow, validates it again, then
  runs `xcodebuild -exportArchive` with `destination=upload`. Xcode uses its
  configured Apple account and automatic signing, manages the uploaded build
  number, and sends the build directly to App Store Connect.

The default marketing version is authoritative `MARKETING_VERSION` (`1.0` at
present). An optional strict decimal marketing-version override applies to the
app and widget at archive scope without mutating tracked inputs:

```sh
nix develop ../.. --command fastlane beta --env production version:1.1
```

Xcode's upload export uses `manageAppVersionAndBuildNumber=true`, so Xcode assigns
an acceptable build number for App Store Connect. There is no manual build-number
parameter.

The app uses only exempt, standard system encryption for HTTPS/TLS and
authentication; it does not bundle non-exempt or proprietary encryption.
`App/Info.plist` therefore sets `ITSAppUsesNonExemptEncryption=false`, allowing
App Store Connect to resolve export compliance automatically. Reassess that
declaration before adding custom cryptography, VPN functionality, or encrypted
communications beyond the current system services.

### Apple and release-Mac prerequisites

Repository automation intentionally does not create or repair Apple resources.
Before `archive` or `beta`, an operator must provide:

1. An Apple Developer team with explicit App IDs
   `io.nhost.dbarroso.neogym`, `io.nhost.dbarroso.neogym.widgets`,
   `io.nhost.dbarroso.neogym.dev`, and
   `io.nhost.dbarroso.neogym.dev.widgets`.
2. App Groups `group.io.nhost.dbarroso.neogym` and
   `group.io.nhost.dbarroso.neogym.dev`; matching App Group and shared-Keychain
   capabilities on each app/widget pair; HealthKit on both app IDs only; and
   valid extension containment/provisioning.
3. An authenticated local Xcode account for the production team, with automatic
   signing access to the distribution certificate/profiles and permission to
   upload builds. Set `ALLOW_PROVISIONING_UPDATES=1` only when that account may
   create or update profiles.
4. An existing App Store Connect app record whose bundle ID is exactly
   `io.nhost.dbarroso.neogym` and is visible to the configured Xcode account.

The clean-checkout rehearsal is complete only when the Nix-provided `fastlane`,
`generate`, `check`, and the credential gates run from tracked inputs plus the
ignored files, and `git status --ignored` shows the project, generated xcconfigs,
Fastlane reports/output, DerivedData, archives, and upload output as ignored.
Before a real release, also install both signed variants on a
simulator/device, verify they coexist with isolated containers, and exercise
`neogym://verify?code=fake` and `neogym-dev://verify?code=fake` against the
matching app. Those interactive checks are not implied by the headless gate.

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

The app-only HealthKit capability and both HealthKit purpose strings are
declared in tracked entitlement/plist templates. Both importers remain strictly
read-only with `toShare: []` and no save/delete calls. Although Apple documents
`NSHealthUpdateUsageDescription` for apps that update Health data, App Store
static validation requires it for NeoGym's combined
`requestAuthorization(toShare:read:)` API reference. Its honest text states that
NeoGym only imports and never writes or updates Apple Health data; the key does
not request or grant write access. The concrete HealthKit importer is compiled
only for non-macOS platforms so `NeoGymKit` keeps building and testing on the
macOS host.

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
