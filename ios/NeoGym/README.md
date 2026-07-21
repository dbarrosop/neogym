# NeoGym iOS

Native SwiftUI app for NeoGym. XcodeGen owns the project structure, and the
host-testable `NeoGymKit` Swift package owns auth/session and domain logic.

## Layout and prerequisites

```text
ios/NeoGym/
├── project.yml
├── Configuration/              # public xcconfigs + TestFlight export options
├── .env.*.example              # templates for ignored private inputs
├── Scripts/ios.sh              # check, device deployment, TestFlight upload
├── Scripts/materialize-config.py
├── Scripts/verify-archive.py
├── Package.swift
├── App/ and Widgets/
├── Sources/NeoGymKit/
└── Tests/NeoGymKitTests/
```

Required local tooling is macOS, an installed Xcode whose iOS SDK supports 26.6,
the repository Nix devshell (plain Python and XcodeGen), and the local Nhost
Swift SDK checkout at `../../../../../nhost/nhost/swift/packages/nhost-swift`.
`DEVELOPER_DIR` may explicitly select Xcode; otherwise `Scripts/ios.sh` chooses a
compatible installed Xcode. The script clears Nix-provided `SDKROOT`, `CC`,
`CXX`, `LD`, `AR`, and `LDFLAGS` before invoking Apple tools. If XcodeGen is
unavailable from pinned Nixpkgs on Darwin, install it with Homebrew, but keep
`project.yml` authoritative and do not commit `NeoGym.xcodeproj`.

`project.yml`'s post-generation command keeps
`Scripts/disable-xcode-debug-options.py` as the sole idempotent shared-scheme
patcher. Keep `App/LaunchScreen.storyboard` wired through the project and
`UILaunchStoryboardName`; it opts the app into modern full-screen sizing.
`AppIconDev` is a committed static asset and is not generated during checks.

## Private configuration

Create both ignored files before running any supported command:

```sh
cp .env.development.example .env.development
cp .env.production.example .env.production
chmod 600 .env.development .env.production
# Fill all four values in each file locally.
```

Each file contains exactly four non-empty `KEY=value` entries:

- `DEVELOPMENT_TEAM`
- `BUNDLE_IDENTIFIER_BASE`
- `NHOST_SUBDOMAIN`
- `NHOST_REGION`

Blank lines are allowed. Comments, `export`, whitespace wrappers, quotes,
continuations, duplicates, unknown keys, and shell/xcconfig expressions are not.
The standard-library-only materializer validates both inputs, requires different
development and production bases, never prints values, and derives app
`<base>`, widget `<base>.widgets`, App Group `group.<base>`, and Keychain suffix
`<base>.shared`. It atomically writes ignored mode-`0600` generated xcconfigs.
Use the already registered production base; configuration migration is manual
and must never be printed or committed.

The public callback schemes remain independent: development uses
`neogym-dev://verify`, production uses `neogym://verify`. Both are present in the
authoritative local backend config and production overlay. Those backend files
are the explicit exception to the tracked-value audit; this workflow does not
apply backend configuration or change the authoritative Nhost deployment.

## Supported commands

Run from `ios/NeoGym/`:

| Command | Behavior |
|---|---|
| `make check` | Run `nix flake check`, Swift build/tests, focused Python/shell tests, materialize each environment exactly once, generate once, and build both unsigned generic-simulator configurations. |
| `make deploy-device DEVICE_ID=…` | Reject a missing ID, run the full gate, automatically sign `NeoGym Dev` / `Debug-Development`, install the deterministic app with `devicectl`, read its built plist bundle ID, and launch it. |
| `make upload-testflight VERSION=x.y` | Reject a missing/malformed one-to-three-component version before the gate, run the full gate, archive `NeoGym` / `Release-Production`, validate that archive once, then export/upload the exact archive through Xcode. |

Every target first runs `nix flake check` and then one `Scripts/ios.sh` command.
The removed `make build`, simulator-control/deployment targets,
`deploy-testflight`, `VARIANT`, `SIMULATOR_ID`, and
`ALLOW_PROVISIONING_UPDATES` interfaces are unsupported. Use Xcode's generated
schemes directly for normal simulator use. The unsigned check products are not
launchable because runtime shared-container configuration intentionally fails
closed without signed entitlements.

Find a connected physical-device hardware UDID with
`xcrun xctrace list devices`. Device and archive operations always pass
`-allowProvisioningUpdates` and use automatic signing; configure the correct
Apple team under Xcode **Settings > Accounts**. The app/widget IDs, App Group,
Keychain capability, HealthKit capability, and development device must already
exist in the Apple Developer account. No signing keys or App Store Connect API
credentials live in the repository.

## Check and validation boundaries

`Scripts/ios.sh check` is the canonical credential-free headless iOS gate. It
uses explicit DerivedData paths, runs `xcrun swift build`, `xcrun swift test`,
`bash -n`, focused standard-library Python tests, one development and one
production materialization, one XcodeGen generation, then these builds:

```sh
xcodebuild -project NeoGym.xcodeproj -scheme 'NeoGym Dev' \
  -configuration Debug-Development -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath DerivedData/Checks/development CODE_SIGNING_ALLOWED=NO build
xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
  -configuration Debug-Production -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath DerivedData/Checks/production CODE_SIGNING_ALLOWED=NO build
```

Routine checks and device builds perform no custom artifact/build-setting
validation. `Scripts/verify-archive.py` accepts only one signed production
`.xcarchive`; immediately after archive creation it checks exactly one app and
embedded `NeoGymWidgets.appex`, unresolved metadata/entitlement tokens, matching
app/widget App Group and Keychain runtime/entitlement identities, Keychain suffix
consistency, and matching marketing/build versions. It reads signed entitlements
with `codesign` but does not verify signatures, profiles, or reconstructed build
settings. Its diagnostics are key-only. Release invokes it exactly once; export
does not repeat it.

`Scripts/materialize-config.py` and `Scripts/verify-archive.py` remain directly
testable implementation boundaries. Bare low-level `xcodebuild` does not perform
materialization; use the supported script or explicitly materialize both inputs
and run XcodeGen first. Never use unsuppressed `xcodebuild -showBuildSettings`.

## TestFlight and production promotion

An upload is an explicit authorized action:

```sh
make upload-testflight VERSION=1.2
```

`VERSION` is required and accepts one to three decimal components such as `1`,
`1.2`, or `1.2.3`; it overrides tracked `MARKETING_VERSION` only for that
archive. The archive is written under ignored `Artifacts/TestFlight/`, validated
once, and passed unchanged to `xcodebuild -exportArchive` with the committed,
credential-free `Configuration/TestFlightExportOptions.plist`. That plist uses
`destination=upload`, `method=app-store-connect`, automatic signing,
`manageAppVersionAndBuildNumber=true`, and `uploadSymbols=true`, so Xcode/App
Store Connect manages the uploaded build number.

The selected Xcode must have an authenticated production-team account with
access to the existing App Store Connect app and distribution signing. NeoGym
uses only exempt system TLS/authentication encryption, so
`ITSAppUsesNonExemptEncryption=false` remains in `App/Info.plist`; reassess it if
custom cryptography, VPN behavior, or additional encrypted communications are
added.

The processed TestFlight build is the production candidate. Test it, then
manually promote that exact processed build in App Store Connect; do not rebuild
for production. This repository does not automate App Review submission or
production release. A real device deployment and a real upload are external,
operator-authorized acceptance checks and are never performed by `make check`.

Future Watch identifiers are reserved as `<base>.watch` and
`<base>.watch.widgets`. No Watch target, capability, configuration, or artifact
exists.

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

1. Run `make deploy-device DEVICE_ID=<hardware-udid>`, launch the development
   variant, and authenticate again.
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
