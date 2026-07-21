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
├── Configuration/              # tracked public settings + ignored generated settings
├── .env.*.example              # four-key templates for ignored private inputs
├── fastlane/Fastfile           # temporary orchestration-only release lanes
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
  Python, Ruby, and overlay-packaged Fastlane 2.237.0. The configuration path
  uses only Python's standard library; it does not use `python-dotenv`.
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
| `make build` | Generate and compile one unsigned generic-simulator variant. It does not run the test/lint gate or custom artifact validation. |
| `make check` | Run `nix flake check`, the temporary Fastlane Xcode-release tests, Swift build/tests, strict materializer and focused archive-validator tests, icon checks, and both unsigned generic-simulator builds. It performs no custom artifact validation. |
| `make deploy-simulator` | Boot the simulator, run `make check`, rebuild and locally sign the selected variant with simulated entitlements, install it, launch it, and confirm it remains running through startup. |
| `make deploy-device DEVICE_ID=…` | Run `make check`, build/sign the selected variant for the connected device, install it, and launch it. |
| `make deploy-testflight` | Run `make check`, archive production, validate that archive exactly once, then ask Xcode to sign, assign the next build number, and upload the same archive through its configured account. |

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
| `VARIANT` | `development` by default; accepts `development` or `production` for `build`, `deploy-simulator`, and `deploy-device`. TestFlight is always production. | Choose the separately installable ignored development base for normal local work. Use production only when intentionally testing the production identity/callback. |
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

Create both root files before `make check` or any deploy target. `make build`
needs the selected file plus validates the other file when it exists.

```sh
cp .env.development.example .env.development
cp .env.production.example .env.production
chmod 600 .env.development .env.production
```

Each file contains exactly four non-empty keys, in strict `KEY=value` syntax:

- `DEVELOPMENT_TEAM` — the 10-character team identifier from the signing
  certificate's `OU` value.
- `BUNDLE_IDENTIFIER_BASE` — the already registered reverse-DNS app identifier
  base for that environment. Development and production bases must differ.
- `NHOST_SUBDOMAIN` and `NHOST_REGION` — use `local`/`local` for a local backend,
  or obtain the deployment values with `cd ../../backend && nhost login && nhost list`.

Blank lines are allowed. Comments, `export`, whitespace wrappers, quotes,
continuations, duplicate/unknown keys, and shell or xcconfig expressions are
rejected. The materializer never prints supplied values. It derives the app ID
as `<base>`, widget ID as `<base>.widgets`, App Group as `group.<base>`, and
Keychain suffix as `<base>.shared`, then atomically writes ignored mode-`0600`
xcconfigs. It also validates any existing counterpart, rejects equal bases, and
audits tracked iOS/tooling/docs files for the supplied private values before
replacing generated output.

When migrating from the former ignored `fastlane/.env.*` files, manually copy
Team/Nhost values into these root files, add the existing registered bases, set
mode `0600`, and verify `Scripts/generate-project.sh all` succeeds before deleting
the legacy files. Keep any temporary backup outside the repository. Do not copy
`ALLOW_PROVISIONING_UPDATES` into the dotenv contract.

Simulator deployment uses Xcode's local ad-hoc signature and simulated
entitlements, so it needs no Apple certificate or provisioning profile. It does
require a valid `DEVELOPMENT_TEAM` setting to expand the simulated application
and shared-Keychain prefixes. Do not add `CODE_SIGNING_ALLOWED=NO` to the
simulator deployment build: the app intentionally fails closed at startup when
its App Group entitlement/container is unavailable. Credential-free `build` and
`check` products remain unsigned because they are never launched.

TestFlight delivery uses the Apple account configured in the selected Xcode.
The account must belong to the production team, have access to the existing App
Store Connect record, and be allowed to upload builds. The temporary wrapper
still accepts `ALLOW_PROVISIONING_UPDATES=1` as a command environment setting
when Xcode may create or refresh profiles; it is not a dotenv key. No App Store
Connect API key is used.

## Low-level commands

From this directory:

```sh
# Build and test the host-compatible package
swift build
swift test

# One-time local inputs
cp .env.development.example .env.development
cp .env.production.example .env.production
chmod 600 .env.development .env.production
# Fill each Team/base/Nhost value locally; these files stay ignored.

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

`Scripts/check.sh` is the canonical local gate for humans and transitional
release orchestration. It keeps Xcode build output in private temporary files,
runs `swift build`, `swift test`, strict materializer and focused synthetic
archive-validator tests, default `all` generation, the DEV-icon drift check, and
both unsigned generic simulator builds. It performs no resolved build-setting
comparison and no custom validation of built products. It requires both ignored
root dotenv inputs. It needs no booted simulator, App Store Connect credential,
distribution certificate, or provisioning profile, and it does not install or
launch either app. `read-build-settings.py` remains in this script only to select
a compatible local Xcode until the Phase 3 orchestration replacement.

The sole supported validator input is a signed production archive:

```sh
python3 Scripts/verify-archive.py path/to/NeoGym.xcarchive
```

The release workflow invokes this command exactly once, immediately after Xcode
creates the archive and before export. It requires exactly one app under
`Products/Applications` and exactly one embedded
`PlugIns/NeoGymWidgets.appex`. It recursively rejects unresolved build-setting
tokens and checks only app/widget App Group entitlement/runtime equality,
Keychain entitlement/runtime equality and suffix consistency, and matching
marketing versions/build numbers. `codesign` is an injectable entitlement
reader only: signature verification, provisioning-profile/CMS decoding,
build-setting reconstruction, and broad static metadata comparisons are left to
Xcode or configuration tests. Diagnostics name keys only. Direct `.app`, `.ipa`,
variant-selection, and signed-simulator validation modes are unsupported.

`Scripts/generate-project.sh development|production` refreshes only one
materialized input and preserves the other variant. Both schemes always remain
in the project. There is intentionally no project pre-build validator: supported
scripted paths materialize before XcodeGen/build, so run generation before any
low-level `xcodebuild` command. Never use raw `xcodebuild -showBuildSettings`; it exposes custom settings. The
transitional release wrapper uses `Scripts/read-build-settings.py` with explicit
allowlisted fields and a private output path, while `check.sh` uses its Xcode
selection helper only. `Scripts/materialize-config.py` is the only dotenv parser,
validator, identity deriver, and tracked-value auditor. Archive validation does
not read xcconfigs or reconstruct expected build settings.

Both app/widget pairs require iOS 26.6. The app is iPhone-only and portrait-only;
Catalyst and Designed for iPad on Mac are disabled. Marketing/build versions
default to `1.0`/`1` for both targets. Private identities come only from each
ignored `BUNDLE_IDENTIFIER_BASE`; committed variant differences are:

| Scheme | Derived private identities | Callback | Name / icon |
|---|---|---|---|
| `NeoGym Dev` | `<development-base>`, `.widgets`, `group.<development-base>`, `.shared` | `neogym-dev://verify` | `NeoGym Dev` / `AppIconDev` |
| `NeoGym` | `<production-base>`, `.widgets`, `group.<production-base>`, `.shared` | `neogym://verify` | `NeoGym` / `AppIcon` |

Future Watch targets, if added, must use `<base>.watch` for the Watch app and
`<base>.watch.widgets` for its widget extension. This repository currently has
no Watch target, capability, private input, generated setting, or artifact.

The DEV icon is committed but deterministically derived from the production icon;
run `nix develop ../.. --command python3 Scripts/generate-dev-icon.py --check`
to detect pixel drift.

## Local TestFlight delivery

Fastlane 2.237.0 is packaged by the repository Nix overlay from the hashed gem
closure under `nix/fastlane/`; do not run Bundler or install/invoke a global Fastlane. From a clean checkout:

```sh
cd ios/NeoGym

# Local SDK and the two ignored four-key root files are required first.
cp .env.development.example .env.development
cp .env.production.example .env.production
chmod 600 .env.development .env.production
# Fill Team/base/Nhost values and authenticate the production team in Xcode.

nix develop ../.. --command fastlane generate environment:production
nix develop ../.. --command fastlane check environment:production

# After all portal/signing prerequisites below are satisfied:
nix develop ../.. --command fastlane beta environment:production
```

The lanes are orchestration only:

- `generate environment:development|production` invokes the canonical variant
  generator. `check environment:production` runs the pure Ruby Xcode-release
  tests and `Scripts/check.sh`.
- `archive environment:production` resolves the marketing version through
  `read-build-settings.py`, creates a signed Xcode archive, and validates the
  archive plus embedded widget. It does not compare against a hardcoded product
  identifier and does not load Fastlane dotenv files.
- `beta environment:production` performs that archive flow without repeating
  validation, then runs `xcodebuild -exportArchive` with `destination=upload` on
  the same archive. Xcode uses its
  configured Apple account and automatic signing, manages the uploaded build
  number, and sends the build directly to App Store Connect.

The default marketing version is authoritative `MARKETING_VERSION` (`1.0` at
present). An optional strict decimal marketing-version override applies to the
app and widget at archive scope without mutating tracked inputs:

```sh
nix develop ../.. --command fastlane beta environment:production version:1.1
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

1. An Apple Developer team with explicit App IDs for each ignored environment
   base and its derived `<base>.widgets` extension.
2. Derived App Groups `group.<base>` plus matching App Group and shared-Keychain
   capabilities on each app/widget pair; HealthKit on both app IDs only; and
   valid extension containment/provisioning.
3. An authenticated local Xcode account for the production team, with automatic
   signing access to the distribution certificate/profiles and permission to
   upload builds. Set `ALLOW_PROVISIONING_UPDATES=1` only when that account may
   create or update profiles.
4. An existing App Store Connect app record whose bundle ID equals the ignored
   production `BUNDLE_IDENTIFIER_BASE` and is visible to the configured Xcode
   account.

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
copy in the App Group. Ignored mode-`0600` generated xcconfigs own Team, Nhost,
and all derived Apple identities; tracked variant xcconfigs own only callback,
display-name, and icon differences. Tracked plists/entitlements resolve those
settings for both targets. Production uses its ignored base with `neogym`;
development uses a different ignored base with `neogym-dev`. Both retain only
the matched shared Keychain group and App Group.

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
