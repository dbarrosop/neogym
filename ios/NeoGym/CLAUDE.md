# CLAUDE.md

Guidance for future Claude Code sessions working inside `ios/NeoGym`.

## What this is

Native SwiftUI shell for NeoGym plus the host-testable `NeoGymKit` package.
The app uses the same email OTP auth shape as the web app for sign-in/sign-up.
`NeoGymKit` owns validators, auth/session models (including the host-tested
`PhoneAssistedSignInModel` and `WatchAssistedSignInModel`), repositories, domain view
models, daily energy models/import helpers, and testable form validation;
iPhone SwiftUI under `App/` owns its layout, navigation, and presentation;
watch app SwiftUI and connectivity live under `Watch/`; the token-free
rectangular and circular complications live under `WatchWidgets/` in the separate
`NeoGymWatchWidgets` extension, without Keychain or HealthKit access.

## Offline iPhone demo

**Try demo** on Sign in/Auth error is available in Release; agents can launch
`--demo --demo-reset --demo-screen train/session/current`. See
[`docs/developers/ios-demo.md`](../../docs/developers/ios-demo.md) for all section
names, simulator commands, storage/lifecycle rules and draft App Review notes.
`AppModeView` must choose demo before constructing `LiveAppRuntime`; never pass
the display-only `DemoIdentity` to AuthStore, SDK, Keychain or Watch connectivity.
`AppRepositories` / `AppShellEnvironment` are the composition boundary: feature
views must not construct live repositories themselves. The stateful actor store
persists only under app-private `NeoGymDemo/state-v1.json`; demo `@AppStorage`
and rest timers use the `io.nhost.neogym.demo` suite, not standard defaults.
Demo has no Health importers, Watch activation/PAT/hints, MCP, notification or
Live Activity effects; all phone Energy widget saves/reloads must use the
`energyWidgetUpdates` environment boundary, disabled in demo. Bundled demo
illustrations never reach AsyncImage. Entering demo calls `AuthStore.retire()`
to stop live observation/late callbacks without clearing credentials; Exit creates
a new live runtime. Reset/exit invalidate demo stores and timers so late callbacks
are inert. Keep the visible fictional-data banner, Reset and Exit.
The documentation driver opts into `NEOGYM_DEMO_CAPTURE=1` with the versioned
`Sources/NeoGymKit/Resources/gallery-capture.json` profile (15 Jan 2025, 09:41 UTC).
`AppClock` freezes capture-visible domain dates only during that demo; Exit clears
it. Resolve the capture profile independently of launch arguments: an invalid
`--demo-screen` must leave the clock cleared at the recovery/sign-in screen but
retain the process opt-in for a later **Try demo**. Ordinary demo/live clocks and
SDK/Auth/HealthKit deadlines stay real. New
visible date defaults should use `AppClock.now()` / `AppClock.calendar` or an
explicit injected clock. Unchanged captures preserve PNG/provenance/order; after
baseline adoption, use only affected groups and keep baseline migrations separate
from feature work. Until the one-time profile baseline lands, every group refresh
produces frozen-profile frames: publish only a reviewed full `--group all` baseline
or defer publication; `validate` rejects mixed legacy/profile or profile versions.
The `NeoGym` XcodeGen scheme includes `NeoGymUITests`; host `Demo*Tests` cover
repository behavior and source wiring. Do not claim these replace real backend,
hardware, signing or App Review acceptance. Apple must approve omitting normal
review-account access separately.

## Commands

Run these from `ios/NeoGym/`:

The `NeoGym` app and `NeoGymWidgets` extension target iPhone/iOS 27 only; Mac
and Apple Vision compatibility are disabled. Keep the host-testable `NeoGymKit`
package at its lower deployment floor unless its own code needs newer APIs.

- `swift build` — build the host-compatible `NeoGymKit` package. Keep
  SwiftUI/UIKit out of `Sources/NeoGymKit` so this works on macOS.
- `swift test` — run deterministic package tests against fakes; do not require
  a live Nhost backend, real Keychain, or writable HealthKit data for unit
  tests. Include `TodayNavigationWiringTests` for shell/date changes: its source
  guards check the SwiftUI shortcut order, selected-date identity and lifecycle
  refresh hooks that host model tests do not compile.
  DailyEnergy GraphQL fixtures must include both `activeKcal` and
  `restingKcal` (use `.null` for an absent metric): their numeric decoders expect
  the selected nullable keys, just as the real GraphQL response provides them.
  For fixed-date watch PAT handoff tests, inject the same clock into
  `WatchAssistedSignInModel` and `WatchAccountModel`; both validate credential
  expiry, including account recovery and saved-credential presentation.
  In XCTest, await actor snapshots into a local before passing them to
  `XCTAssertEqual`: assertion autoclosures do not support `await`. Put additional
  `WatchAccountTests` methods in its existing extension: the main class is near
  the Swift lint 350-line type-body limit, and `WatchAccountTests.swift` is at
  the 1000-line file limit; use a separate test file for further additions.
  For ordered refresh-observer test
  assertions, yield events directly into an `AsyncStream` in the callback;
  spawning separate tasks to append events can reorder them. `BodyMeasurementsTests.swift` is near
  the 1000-line file limit; keep standalone Body date-planning tests in
  `BodyHealthRecheckDatesTests.swift` and new sync tests in its existing extension.
- `nix develop ../.. --command xcodegen generate` — regenerate
  `NeoGym.xcodeproj` from `project.yml` after adding/removing Swift app files.
  Keep `project.yml` as the source of truth and do not commit generated
  `.xcodeproj` output.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — build the SwiftUI app for a simulator
  destination.
- `Scripts/verify-release-archive.sh --simulator PATH/NeoGym.app` — inspect
  simulator structure/IDs/icon/platform and watch binary dependencies after
  building both simulator schemes; this checks the watch executable and its
  `.debug.dylib` when present (the Debug executable can be only a stub).
  No signing assertion for simulator builds.
- `python3 -m unittest Scripts/test_verify_release_archive.py` — offline
  fail-closed fixture checks; macOS `/usr/bin/python3` is 3.9, so avoid newer
  Python-only syntax/APIs in release scripts.
- `make archive-release` — non-upload signed device archive, archive signature/
  entitlement/profile verification, local `destination=export`, then IPA
  distribution signature/entitlement verification. `NEOGYM_ALLOW_PROVISIONING_UPDATES=YES`
  is a separate per-run permission to register/update Apple profiles; without it
  Xcode gets no `-allowProvisioningUpdates`. Obtain operator acknowledgment for
  new watch ID provisioning before enabling it. Stock macOS `/bin/bash` 3.2
  treats expansion of an empty array under `set -u` as unbound; keep optional
  provisioning arguments scalar/guarded and test both branches with stubbed
  `xcodebuild`. If no signing account/profiles exist, this gate remains blocked;
  simulator verification is not a substitute. Xcode can embed a development
  watch profile with a team-scoped wildcard App ID (`TEAM.*`) even when the
  signed watch entitlement uses its concrete App ID; the verifier accepts
  component-bounded matching wildcards only when team, signing type, and
  entitlement coverage still agree. Re-run the read-only verifier against a
  retained archive when diagnosing this case; never bypass verification or
  turn provisioning back on without per-run approval.
- `make deploy-testflight` — explicitly starts a real upload and reuses the
  entire non-upload verified path before `destination=upload`. Never run for
  validation; obtain explicit operator approval each time before running it.
  Xcode-managed build numbers can differ across archive and export, but phone/watch/widget versions
  must match within each artifact. Archives remain under ignored
  `.build/testflight/` for diagnosis; never retry through direct export or
  Organizer upload. TestFlight processing/hardware installation are separate.
  See `README.md` for paired-watch acceptance and delayed-hint limits.

If an inherited Nix shell exports `DEVELOPER_DIR`/`SDKROOT` to an older
`apple-sdk` and `swift build`/`swift test` fail with an SDK/compiler mismatch,
rerun the Swift/Xcode checks from a clean Xcode environment (for example via
`xcrun swift ...` with Xcode's `DEVELOPER_DIR`) rather than treating it as an app
compile failure. For `xcodebuild`, also unset Nix toolchain overrides such as
`SDKROOT`, `CC`, `CXX`, `LD`, `AR`, and `LDFLAGS`; leaving `LD=ld` can make the
simulator link step fail with `ld: -objc_abi_version '-Xlinker' not supported`.
When invoking `xcodebuild` through `nix develop --command`, put the cleanup `env
-u ...` both before `nix develop` and immediately after `--command` if the shell
reintroduces linker variables. In the Nix devshell, the xcbuild `xcrun` shim
can shadow `/usr/bin/xcrun`; with both `SDKROOT` and `DEVELOPER_DIR` unset,
that shim fails with `unable to find sdk: 'macosx'`. For `swift build`/`swift
test`, keep Xcode's `DEVELOPER_DIR` set (or use `/usr/bin/xcrun` or plain
`swift`) while unsetting Nix overrides such as `SDKROOT`, `CC`, `CXX`, `LD`,
`AR`, and `LDFLAGS`.

Swift 6 SwiftUI `.onReceive` closures inherit `MainActor` isolation and can trap
if a publisher emits off the main thread. `NSCalendarDayChanged` is an
`AsyncMessage`, not main-actor-guaranteed; prefer UIKit's
`significantTimeChangeNotification` (which includes midnight), or explicitly
hop with `.receive(on: DispatchQueue.main)` before handling an off-main publisher.

The package now supports watchOS 8 without raising its iOS/macOS floors. Its
two HealthKit implementations (Body measurements and raw workouts) compile
only on iOS; the watch energy importer lives in the watch app target
(`Watch/WatchHealthEnergy.swift`), and pure HealthKit grouping models remain
host-testable. For package-only watch architecture checks, run
`xcodebuild -scheme NeoGymKit -destination 'generic/platform=watchOS Simulator' build`
and the `generic/platform=watchOS` variant with `CODE_SIGNING_ALLOWED=NO`
from a directory without a generated `.xcodeproj`; `xcodebuild` otherwise
selects the project instead of the package. After XcodeGen has run, copy
`Package.swift`, `Sources/` and `Tests/` into the repo-root ignored directory
`../../.nhost-code/tmp/watch-package-check/` (relative to `ios/NeoGym/`),
change only that copy's `.package(path:)` to the SDK's absolute path (the
relative path breaks outside `ios/NeoGym`), and use a separate
`-derivedDataPath`. Confirm `xcodebuild -list` selects the package there.
Use the Xcode environment cleanup above for both commands. The watchOS 27
`NeoGymWatch` scheme is now embedded in the iPhone app alongside
`NeoGymWidgets`; XcodeGen does not support target-level `resources:` here:
watch assets must remain included in `sources` (do not exclude
`Assets.xcassets`). After generation, verify the built watch app has
`Assets.car` and `CFBundleIcons/CFBundlePrimaryIcon/CFBundleIconName = AppIcon`.
Use `xcodebuild -project NeoGym.xcodeproj -scheme NeoGymWatch -destination
'generic/platform=watchOS Simulator' build` after generation.
`Watch/` plus the shared `WidgetUI/` are compiled into the watch target (not `App/` or `Shared/`).
`WatchHomeView` forwards live PAT handoff messages to `WatchAssistedSignInModel`;
only the view holds a watchOS expiring activity for the sign-in. The model
checks the request nonce, age, expiry and definitive phone user ID. Rejected
credential handoffs and failed connect pre-checks reply with a nonce-bound
failure so the phone can offer retry; a duplicate for the same in-flight request
does not send a premature failure before its final result. The account
stores the PAT in a private device-only Keychain item and signs in via Auth
`/signin/pat`; it rejects a different-user result and clears the session.
`WatchWidgets/WatchEnergyComplication.swift` has rectangular and circular
families driven by NeoGymKit `WatchComplicationContent` (not connected / waiting
for today / balance, fresh or stale after an hour). Full colour tints only the
title (accent) and ring (Chart 1); tinted faces tint those via
`widgetAccentable()` and keep numbers white. No green, red or teal glyphs; the
two-pan `BalanceScaleIcon` in `WidgetUI/` marks balance (it is shared with the
iPhone Lock Screen rectangular widget). Keep full VoiceOver labels.
`Watch/` and `WidgetUI/` are compiled into the watch app; `WatchWidgets/` and
`WidgetUI/` into its widget extension; `Widgets/`, `Shared/` and `WidgetUI/`
into the iPhone widget extension. `WidgetUI/WatchPalette.swift` is
`#if os(watchOS)` (the watch is always dark); the iPhone widget reads copied
theme colour sets from `Widgets/Assets.xcassets` through `WidgetTheme`, so keep
those colour sets in step with `App/Assets.xcassets/Theme`.

`WatchEnergyRuntime.init` is the watch composition point: it creates one
`NhostClientFactory.makeProductionWatchClient()` client with a watch-only
`WatchAuthRefreshTransport` for `NhostAuthService` (in `AuthStore`), the
uncached Auth `GET /user` via `NhostCurrentUserService`,
and `NhostGraphQLService` (used by `WatchEnergyService` and
`DailyEnergyRepository` for private energy/nutrition reads and energy writes).
That client selects production and the SDK's origin-scoped private, device-only
Keychain session with legacy unscoped migration ignored; it has no shared
Keychain/App Group session lock or GraphQL cache. The transport emits only
random attempt IDs, safe status/error categories and wall time for Auth refresh
HTTP exchanges; cancelled exchanges are recorded as skipped/cancelled, not
network failures. A cancelled request may already have rotated its token on
the server, so a later 401 or session removal can follow. A separate SDK
session-store subscription records successful session writes, including PAT sign-in.
Auth refresh events carry the HTTP boundary timestamp; session-write events
carry the session-store notification callback timestamp (after any SDK queueing).
Both omit app state because MainActor logging can be delayed across suspension.
Neither an HTTP 2xx nor absence of a write event proves whether a rotated
token persisted after watchOS suspension. Never add
token values, headers, response bodies, URLs or account IDs to Events. The watch target does have an
App Group entitlement for the token-free complication snapshot, not its session.
The watch app caches only the most recently fetched name/email in its own
UserDefaults, keyed by session user ID; the SDK's persisted session name is the
fallback. Neither cache is available to the watch widget. Background energy
writes use a separate file-backed `URLSessionConfiguration.background` transfer
(not widget credentials): the same SDK client refreshes its session, checks the
owner, then pins its short-lived access token only on the system upload request.
`WatchEnergyBackgroundUpload` builds one Hasura mutation with insert on
conflict updating only imported-note rows. Manual/edited conflicts remain
untouched; no new server endpoint or user-visible GraphQL roots are needed.
The watch forces SDK refresh before pinning an upload bearer with at least ten
minutes remaining; a transient refresh fallback with less time uses in-process
reconciliation instead. The task description retains only owner ID and bearer
expiry. A same-owner task deduplicates while more than two minutes remain;
older expiry-less or near-expiry tasks are replaced once a valid upload is
ready. A deduplicated task still allows direct reconciliation on the wake;
replaced-task cancellations do not advance retry backoff.
Every watch process launch starts account bootstrap from the application
delegate, independently of the SwiftUI view's task; repeated bootstrap calls
coalesce. Once local Keychain restoration publishes an eligible same-owner
account, the watch registers authorized HealthKit energy observers/background
delivery without waiting for WCSession activation or the network name read.
Foreground startup also renders a cached profile and today's same-owner energy
snapshot, then revalidates the profile in the background. A delayed blocking
hint clears both caches and the local session; on a phone sign-out there can be
a short stale display before delivery.
Foreground backend reconciliation waits for activation and the managed account
read before private energy access. An observer may first read local HealthKit
and save a provisional same-owner, same-day snapshot without that network gate;
a background URLSession write validates the SDK session and owner before queueing. Each observer callback
synchronously attempts a read-back-verified private pending marker for the
authorized watch owner and acknowledges HealthKit promptly, without waiting
for HealthKit queries or backend work. A failed handoff is logged, but cannot
promise a deferred retry. `WatchObserverCompletionGate` still ensures one acknowledgement. The
watch requests a 15-minute preferred fallback wake for pending events without
counting them as sync failures, and tries to reconcile immediately when eligible.
The marker survives relaunch; only a successful Health import, fresh backend
read and saved snapshot for that owner can clear the generation observed at the
start of the refresh. A later delivery remains pending. A new eligible trigger
replaces an in-flight refresh open for 30 wall-clock seconds rather than joining
a suspended/stuck task; a cancelled old task cannot save or reset the new one.
On sign-out/blocking state or different owner the marker is discarded, never
imported under another account. If account validation fails transiently while the same owner's cached
profile remains, a later eligible wake/open retries `/user` and the pending
import. Ineligible deliveries record a skipped energy refresh; observer-query and
background-delivery registration failures record only typed stage, source, and
numeric error code (when available). The End of day page's Refresh control also
retries validation and shows the profile warning; a still-failing or auth-rejected
read cannot sync.
Signed-in watch pages are vertical: Today, End of day, Account (with an Allow
Health access page first until access was requested). Account's watch-only
Debug mode switch (`watchDebugMode.v1`, default off) reveals a Diagnostics page
behind it; recording never depends on the switch. `WatchEventStore` keeps
at most 300 typed, timestamped, non-sensitive outcomes in watch-app-only
UserDefaults (not the widget App Group). It records watchOS background schedule
requested/accepted/failed with numeric codes, actual wakes
started/finished/expired-by-watchOS, Health observer
arrival/acknowledgement (plus legacy timeout) and delivery failures, typed
starts/ends for both HealthKit statistics queries, Health import, backend
reconciliation read/write, and final today read, fresh energy results, local
snapshot saves, and WidgetKit reload requests. Random per-attempt IDs correlate same-run
outcomes, while a resumed pending import has a new ID; metric, app state when
handled, active duration, wall-clock age of the earliest pending delivery when
a refresh starts, stage wall elapsed time, backend operation and account-gate
skip reason are typed optional fields. Stage events capture start/end timestamps
at the operation boundary, then MainActor stores them in occurrence order.
Observer `Started` marks main-actor handling, not raw callback receipt;
acknowledgement uses its actual HealthKit callback timestamp and omits app
state (which might change before the log is written). The observer Started and
acknowledgement events can appear in either order. Auth refresh and SDK
session-write notifications follow the same no-deferred-app-state rule.
Background task expiry cancels work and completes the watchOS task exactly once if the system
calls its handler; a missing expiry or terminal event may mean
suspension/termination and cannot by itself prove a network hang;
legacy 25s watchdog callbacks could run much later after suspension. Failures
include a fixed stage (HealthKit energy/observer query or delivery registration,
local handoff, backend read/write, authorization, scheduling) and allowlisted
source (HealthKit, network, backend, GraphQL transport, other). New GraphQL
transport events carry only an allowlisted URLSession numeric error, HTTP
status, fixed service/response category or unknown; the pinned SDK's
`FetchError.transport` includes a trusted `URLError <code>:` prefix, never
persist its description. SDK session-refresh/Fetch failures outside GraphQL
are labeled Network with safe transport provenance, while GraphQL backend
rejections and unknown failures have no numeric code. Swift NSError enum case
indexes (including legacy GraphQL transport `code 3`) are not HealthKit codes,
URL errors, or HTTP statuses. Both `WatchEnergyRuntime.recordFailure` and
`WatchHealthEnergy` observer-registration failures use the package's safe
classification; host package tests do not compile the latter watch caller, so
also build `NeoGymWatch` after changing this boundary. Auth `/user` failures
likewise emit only safe fixed cause/status events. The
watch scene logs active/inactive/background transitions with an in-flight
attempt ID, but a transition does not prove continuous background execution.
Older records still have only numeric codes. HealthKit code 3 is only
labeled "invalid argument" when the original domain matches `HKErrorDomain`.
HealthKit's `HKErrorDomain` value is `com.apple.healthkit`, not the literal
`HKErrorDomain`. NeoGymKit cannot import HealthKit; compare against that value
and use it in host-test fixtures so tests match device errors.
An accepted schedule does not guarantee a wake; a reload request does not prove
the complication updated. `WatchWidgetProviderReceiptStore` is a separate,
widget-written, 64-item bounded atomic file in the watch App Group; it records
only `getTimeline`/`getSnapshot` time, local date and the snapshot update time
(or absence). The Diagnostics page reads it on demand. A provider receipt shows a
request and App Group read, **not** an actual watch-face render; a missing
receipt can also mean a diagnostic-file write failure. The Diagnostics-page
`ShareLink` exports a temporary `.txt` attachment with events and these
receipts through the watchOS system share sheet only on user action (no
automatic send). `ShareLink` cannot prefill Mail's recipient; retain the .txt
file attachment rather than switching to a `mailto:` body on watchOS. Never
log or export tokens, user identifiers, email/name, URLs, Health values, or raw
localized/server error text.
A snapshot-save failure remains visible on the watch End of day page and does not
request a reload. `WatchRefreshSchedule` coalesces duplicate hourly requests, prefers a
best-effort 15-minute fallback for pending Health events without advancing
failure backoff, and asks for 15/30/60-minute retries after backend
reads/writes or failed profile validation. After account bootstrap, a delivered
background task re-arms before energy reconciliation; a pending earlier
request beats an hourly request. Repeated failures before that retry wakes
do not accelerate backoff. Neither accepted
scheduling nor WidgetKit reload guarantees a wake or fresh display. After a
successful fresh backend read the watch saves the new snapshot timestamp.
Only a previously server-confirmed imported or absent row can receive a local
Health estimate; manual and legacy unknown-provenance rows remain server-only.
The estimate retains server intake; the watch app's End of day page labels it
"Health estimate <time>" until a fresh backend reconciliation. Neither
complication family marks provisional estimates. The app requests `reloadTimelines`
only when displayed values, owner or pending status change, or after clearing
on sign-out. `WatchWidgetReloadGate` allows at most one background app request
per 15 minutes, persisting the time and deferred flag in watch-only defaults;
a later eligible wake or foreground return retries a suppressed latest-value
reload. Foreground value changes and clear/sign-out bypass the gate. This
coalesces app requests, not WidgetKit scheduling itself. A background upload
may be deferred until its bearer expires; subsequent eligible wakes can
reconcile in-process or replace stale transfers.
The pending marker and preferred retry remain best-effort fallbacks. On a
URLSession wake, result handling awaits account bootstrap before checking the
upload owner; a mismatched/blocked owner is logged as skipped. The watchOS task
stays open through the successful upload's Health reconciliation and fresh
backend read (or the failure retry scheduling and deferred widget reload),
unless watchOS expires it first. Expiration cancels follow-up work and releases
the task exactly once; neither a completed upload nor a reload request proves
a WidgetKit render.
The complication shows "Balance at <time>" once its snapshot is an hour old, from
a pre-scheduled timeline entry; an unchanged-value read keeps the old time until
WidgetKit asks for another timeline. Foreground return explicitly awaits the
uncached `/user` revalidation and calls energy refresh even when the account
name is unchanged, coalescing with the existing account-state-driven refresh.
The phone's `LiveAppView` owns the lazy `LiveAppRuntime` in the `WindowGroup`
live branch. `LiveAppRuntime.init` creates `AuthStore`, binds it to
`PhoneAccountConnectivity` and starts WCSession activation; this bootstrap is
view-owned, not independent of scenes. A background-only phone launch that creates
no live view does not activate WCSession or receive watch pairing requests.
Once the live runtime exists, an incoming watch pairing request during
asynchronous Auth restoration is held in memory until the signed-in account is
known, retaining its original receipt time for the ten-minute expiry. Force-quit
delivery is not guaranteed by iOS, so request pairing again from the watch if
needed. No watch OTP path exists.
The phone publishes definitive `AuthStore`
states through `PhoneHintPublisher` and WCSession, re-sending with an opaque
delivery ID on activation/foreground. Transient bootstrap states do not overwrite hints.
The watch reads on cold start. On background-to-active, including the first
active scene after a background-only launch that never created a view, it
cancels any in-flight background name read before refreshing, so an eligible
session starts a fresh `/user` request on open. The first active scene of a
normal foreground launch does not repeat bootstrap's read/refresh. Direct
`WatchAccountModel.refresh()` calls still coalesce with an in-flight read;
inactive wrist raises do not refresh.
A bounded `performExpiringActivity` assertion protects PAT sign-in, live reads,
and session clearing best-effort, not as a watchOS suspension guarantee. Its
20-second local deadline releases only the assertion, never the operation;
system-reported expiry cancels PAT sign-in/read operations, but never interrupts
mandatory local clearing. `acceptVerifiedSession` forces a fresh `/user` read
even when the SDK already persisted the same user's PAT-created session.
Use signed-to-run-locally builds for Keychain checks; an unsigned simulator app
can fail private Keychain reads with missing entitlement (`-34018`). The pure
`PhoneAccountHint` application-context payload carries only account state/userId
and optional opaque deliveryId, never credential or name material. Live
`WatchAssistedSignInMessage` carries the 90-day app-user PAT for one nonce-bound
request; it is not queued or exported. The phone mints it with Auth `/pat` and
holds it in memory until success or request expiry. `PhoneAssistedSignInModel`
tracks the pending request, account switch, delivery and acknowledgment;
`PhoneAccountConnectivity` bridges live WCSession transport. The watch stores
the PAT in `WatchPATKeychainStore`, separate from the SDK session and widget,
and automatically reuses it via `/signin/pat` after session loss, an uncached
Auth `/user` 401, or HTTP 400 confirmed specifically at Auth `POST /token` by
`WatchAuthRefreshTransport`. Its body-free `WatchAuthRefreshRejection` preserves
that endpoint distinction through GraphQL and Health-sync error wrapping; an
unrelated HTTP 400 is not a recovery signal. The transport leaves the SDK's
recognized `invalid-refresh-token` response unchanged for conditional session
removal. Other refresh 400s permit a fallback attempt, not a claim that the PAT
is invalid. Profile reads and energy/forced-upload refresh failures use the same
owner-, phone-hint- and sign-out-gated recovery. Concurrent failures join rather
than cancel the new profile read. An energy refresh can reconcile once more after
successful validation, never recursively retrying recovery without a bound.
The watch attempts PAT sign-in only once until a successful `/user` read;
a valid, non-blocked PAT keeps manual Restore saved sign-in available after
failure and later foreground opens, with Sign out available to erase it even
without a session. Transient profile/network or energy failures, malformed
response bodies alone, and HTTP 400s outside the refresh endpoint do not trigger
PAT sign-in. An expired/invalid PAT requires new phone pairing; there is no OTP
fallback. Reauthentication and Auth-error screens offer Connect using iPhone
with a definitive same-user phone hint even when the SDK retains the rejected
session. Healthy sessions and pending local clearing still refuse replacement.
Restore saved sign-in is shown only for a locally valid, owner-eligible saved
PAT; local validity does not guarantee Auth will accept it.
Sign-out and known signed-out or
different-account hints erase the local PAT before allowing another session.
The PAT has full user sign-in authority, not a restricted role; phone sign-out
cannot remotely revoke an offline watch PAT immediately. A failed local
credential clear remains an error. `.phoneSignedOut` blocks watch sign-in;
`.clearing` stays non-actionable until local session removal completes.
Re-reading identical/matching context
must keep an in-flight same-session `/user` request alive; cancelling it
without replacement strands profile revalidation. A non-auth `/user` read
failure retains the same-user profile and offers Retry; only transport failures
suggest reconnecting, while other failures use a neutral refresh warning. An
Auth failure removes it. Reconcile every AuthStore state publication even when
its user ID is unchanged: a retry through
`authStore.bootstrap()` can move `.error` to `.signedOut` with nil IDs in both
states. A delayed hint cannot revoke an undelivered watch token instantly.
In stub-transport tests of managed Auth refresh, `/token` returns a bare
`AuthSession` JSON object (not `{ "session": ... }`). Fixture JWTs need a
future `exp` claim; `StoredSession(decodedToken:)` overrides the SDK's JWT
decoding, so omit it or include `exp` in its claims to avoid an unnecessary
refresh before `/user`. Never let host tests fall through to the real default
HTTP transport. On a successful remote sign-out, the SDK tries local removal
twice if the first attempt fails; `AuthStore` still attempts its own clear even
if the SDK throws. For a deterministic single-clear failure test, fail the
stubbed remote `/signout` after releasing its held response.

Keep `App/LaunchScreen.storyboard` wired through `UILaunchStoryboardName` in
both `App/Info.plist` and `project.yml`. Removing it can make the app run
letterboxed on current devices. Keep both `NSHealthShareUsageDescription` and
`NSHealthUpdateUsageDescription` in `App/Info.plist` and `project.yml` in sync;
Apple requires both during upload even though the Health import requests only
read access. The update string must not claim NeoGym writes to Health. Keep
`CFBundleDisplayName` on the widget extension Info.plist; App Store Connect
requires it for archive validation. The app's
`ITSAppUsesNonExemptEncryption: false` in `project.yml` is an export-compliance
declaration; verify it remains accurate before shipping changes to cryptography
or dependencies.

The package depends on the local Nhost Swift SDK at
`../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
directory. Update `Package.swift` and docs together if that workspace assumption
changes.

## Auth and app-shell invariants

- Sign-in/sign-up use email OTP, no password. Native email change uses app-side
  PKCE with `redirectTo = "neogym://verify"`, a Keychain-backed verifier,
  `.onOpenURL` deep-link handling, token exchange, and verifier clearing on all
  callback outcomes.
- The native callback must be allowed by `auth.redirections.allowedUrls` in both
  `backend/nhost/nhost.toml` and the production overlay. Restart local Nhost
  after redirect config edits because the CLI does not hot-reload `nhost.toml`.
- Sign-out must always call `clearSession()` after attempting remote sign-out so
  local persisted sessions are removed even when the network request fails.
- The production app client enables the Nhost Swift SDK persistent GraphQL cache
  with a 5-minute freshness window and 7-day stale-if-error window. Browsing list
  and display-detail repositories expose cached-first/fresh-second streams
  through `GraphQLServicing.cachedQuery`; view models must retain cached values
  while revalidation runs or fails. Cached domains include workouts, sessions
  (including workout progress), exercises, journal, foods, meals, nutrition
  plans/overview, Body, and Energy.
  Edit/form, HealthKit reconciliation, daily-intake, and widget live-fetch reads
  stay network-only. Mutations also use the network-only `execute` path; browsing
  caches remain available after mutations and their stale-while-revalidate loads
  still fetch fresh backend data. The SDK scopes private cache entries by the
  managed session and purges prior user scopes on sign-out/session replacement.
  The file cache is app-process-only; the widget client has no GraphQL cache because each
  process must own a distinct SDK cache directory. On a cold launch, Today's
  Body card and the Progress › Energy calorie chart read today's exact range and up to seven prior
  daily ranges through the SDK's age-bounded `.cacheOnly` policy before their
  current-range refresh. Previous-range results are visibly labeled and kept
  on network failure, never copied into app storage; the SDK enforces scope
  and age on every read. Do not add weaker app-owned user cache keys.
- `NeoGymWidgets` contains the rest timer Live Activity and the Balance widget
  (small, medium, Lock Screen inline/rectangular/circular). Balance math, the
  `EnergyBalanceDisplay` formatter, the numeric token-free v2 aggregate DTO/store
  (`energyBalanceWidgetSnapshot.v2`; the old string v1 key is removed on save or
  clear), and live-fetch/fallback orchestration live in host-testable
  `NeoGymKit` and use the `group.io.nhost.dbarroso.neogym` App Group. Every family
  opens Today with `neogym://today` (`AppDeepLink`); `LiveAppView` sends those
  links to `AppDeepLinkRouter`, consumed by `AppShellView`, and only other URLs
  to the auth callback router. The app
  writes snapshots only after a fresh backend nutrition overview emission on Today (not
  an offline cached fallback) and clears/reloads them on sign-out, definitive
  signed-out bootstrap, auth errors, and user switches before new user data is
  available. Nutrition mutations and
  Energy-list loads also ask WidgetKit to reload timelines so the widget can take
  the live server-fetch path after backend changes. The
  app and widget both use the SDK's one coordinated Keychain item: service
  `io.nhost.swift.session`, account `default.nhostSession`, access group
  `$(AppIdentifierPrefix)io.nhost.neogym.shared`, and App Group
  `group.io.nhost.dbarroso.neogym`. The SDK derives the lock-file identity automatically
  from the canonical Keychain item identity instead of accepting a caller-owned
  namespace. The app acquisition budget is 5 seconds; the widget budget is 500
  ms. Keep only `NeoGymSharedKeychainAccessGroup` in both
  Info plists and only the shared Keychain group plus App Group in both targets'
  entitlements. There is no app-private session, mirroring, reconciliation,
  credential copy, or App Group token storage. App shared-factory failure is a
  fatal developer/provisioning error for this controlled POC. Widget factory,
  lock-timeout, cancellation, Auth, and network failures must render the cached
  or empty token-free fallback and write no live snapshot. The widget does not
  run HealthKit import; the watch app syncs energy, while the iPhone app only
  syncs Body measurements and raw workouts from HealthKit. WidgetKit timeline
  policies and the in-widget Refresh button are best-effort triggers that
  reload timelines and therefore run the live-fetch provider path when the
  system grants runtime. At the widget extension's iOS 27 deployment floor,
  AppIntent/`Button(intent:)`/`containerBackground` need no older-OS availability
  gates; existing guards are vestigial, not a pattern for new code. Use immutable
  `static let` metadata on AppIntent types so Swift 6 concurrency checks accept
  them as shared state, and do not describe widget refresh as guaranteed server
  freshness or an exact cadence.
- SwiftUI previews can set Dynamic Type with
  `.environment(\.dynamicTypeSize, ...)`, but Xcode 17 treats
  `accessibilityReduceTransparency` and `accessibilityReduceMotion` as read-only
  environment values; verify those modes in simulator Accessibility settings.
- Daily energy uses `DailyEnergy*` types in `NeoGymKit` (`DailyEnergy`, form
  values/validation, repository, list/detail/editor view models, trend builders,
  `DailyEnergyHealthImporting` and `HealthDailyEnergy`). Keep those host-testable;
  only the watch app requests active/basal HealthKit energy read permission.
  Progress › Energy and Today read energy from the backend.
- Do not pin `AuthStore`'s `session.accessToken` to a request: an explicit Authorization header is not replaced by SDK managed refresh, and the bootstrap session may already be expired. For account-bound writes, use `client.refreshSession(marginSeconds:)`, verify the cursor owner's user ID, then pin the returned token for that request.
- `HealthKitWorkoutImporter` is read-only (`toShare: []`) and requests only the workout type. It projects workout-level fields, metadata, events, activities and aggregate statistics into private `health_workouts.raw` JSON, upserts by `(user_id, healthkit_uuid)`, and processes anchored HealthKit deletions when the Train tab opens and on Sessions pull-to-refresh. The user-scoped on-device cursor advances only after backend writes succeed. A Sessions pull-to-refresh overlapping an import waits for it and runs another anchored pass; cancelled refreshes do not run a follow-up. Separate route and heart-rate streams are not imported; erasing the local cursor can leave previously deleted backend rows unreconciled (see `docs/developers/health-workouts.md`). Do not turn imported workouts into NeoGym sessions or exports.
- The watch's read-only HealthKit energy importer sums active and basal/resting
  energy in bounded, DST-safe local-day buckets (`HKStatisticsCollectionQuery`,
  `.cumulativeSum`, local-midnight anchor, `DateComponents(day: 1)`). The pure
  `HealthDailyEnergyGrouper` drops non-finite/`<= 0` values per metric
  independently and skips only days where both metrics are absent. Watch energy
  sync creates missing dates and refreshes the last 7 local calendar days only
  for rows still carrying the exact "Imported from Apple Health" note; manual
  or edited rows are not overwritten. The iPhone no longer imports HealthKit
  energy, even when opening or refreshing Progress › Energy or Today. Body
  measurement HealthKit sync runs from both Progress › Body and Today on initial
  load and pull-to-refresh (Today also on tab return and foreground).
  It scans history once per app user/timezone, then uses per-type anchored
  changes to re-query added-sample dates or the recent deletion window; cursors
  commit only after successful backend reconciliation. A type whose first read
  is empty stays unanchored even if the other type has samples, so later permission grants
  retry that type's history. On any sync with one type unanchored and affected
  dates, one bounded query per metric re-reads the affected values. An anchored
  type with no events retains its prior cursor in case access was revoked.
  Cursors live under `body-health.anchor.v2.<userId>`; the previous
  `body-health.anchor.v1.*` paired key is ignored if present so a previously
  unreadable type starts from history. It creates missing dates and refreshes
  the last 7 local days only for rows still carrying that note. Reported
  deletions re-read those dates to correct imported rows when a sample remains;
  older dates and fully emptied days are not cleared. Today revalidates its
  backend queries after sync when Body rows changed or when refresh/Retry was
  requested while sync was pending;
  queued requests keep the dashboard's loading indicator visible.

## Native iOS design guide

The root `CLAUDE.md` section "UI design system (web + iOS)" is the source of
truth (areas, shell mapping, tokens, type, patterns, accessibility); this
section records how the iPhone app implements it.

- **App shell and navigation**: `App/Shell/AppShellView.swift` hosts a native
  `TabView` with five `Tab`s (Today, Train, Nutrition, Progress, Me; enum
  `AppTab` in `App/AppNavigationRoutes.swift`), each with its own
  `NavigationStack`, so every tab keeps its path across tab switches.
  `RootView` gives the shell `.id(userId)`, so a different account gets fresh
  tabs, paths and sync models. Area roots (`TrainNavigationView`,
  `NutritionNavigationView`, `ProgressNavigationView`, `MeNavigationView`,
  `TodayView`) use `.areaRoot(title:)` (large title + background token). The
  section enums (`TrainSection`, `NutritionSection`, `ProgressSection`,
  `MeSection`) feed `AreaSectionPicker`, a segmented `Picker` injected through
  the `areaSectionHeader` environment value and rendered by
  `AreaSectionHeader()` as the first element of each section's scroll content,
  so it sits under the large title. Section state and the Train, Nutrition and
  Progress paths live in the shell. Today's explicit section shortcuts clear
  the destination path before selecting its tab, including when that section
  is already selected behind a detail; ordinary tab switches preserve history.
  The shell also owns Nutrition Log's date (`NutritionLogDateSelection`): Today's
  Log shortcuts always select today. Scene activation and UIKit's main-actor
  `significantTimeChangeNotification` (midnight and clock/time-zone changes)
  advance a selection that matched the previous today, but retain deliberately
  browsed dates. `DailyIntakeView` is
  keyed by the selected date, giving each date its own day model and sheets;
  changing dates closes old drafts and reloads the day/week so an old response
  cannot provide the new date's write target. Cache policies and query ranges
  are unchanged.
  Other tabs can also open a session. Each section's
  create/log action is a top-trailing `+` (`AreaPrimaryAction`); Today's `+` is
  a quick-log menu. Pushed routes use typed enums (`TrainRoute`,
  `NutritionRoute`, `ProgressRoute`, `MeRoute`) through
  `.navigationDestination(for:)` with `.screenBackground()`; do not add hidden
  `NavigationLink` state. Detail screens put "Edit" in the top-trailing toolbar
  and start/log actions in the content; there are no `.bottomBar` actions.
  `openSession` in the shell selects Train and pushes the session (or pops back
  to it); it serves deep links, Today, the accessory and start-session callbacks
  from any tab. Post-create, the create view pops itself with `dismiss()` and
  the area root's `openRouteAfterCurrentTransition(_:)` appends the detail
  route on the next runloop tick, so Back returns to the section root; do not
  add a `removeLast()` there. Cross-tab invalidation uses shell revisions
  (`trainingRevision`, `nutritionRevision`) passed down as reload tokens.
- **Rest timer and live session**: `NeoGymKit.RestTimerAccountScope` owns one
  per-owner `RestTimerController` and supplies it to the shell. Only a matching
  signed-in owner can restore a running rest; ownerless legacy and other-owner
  schedules are removed. A session without a usable owner ID gets an inert timer
  while the shell remains usable. The app binds the scope to `AuthStore` and calls
  `endSession()` from its snapshot-clear handler, clearing persisted state,
  pending/delivered notifications and Live Activities on sign-out (before the
  remote request), definitive session loss, auth errors and account switches,
  even without a mounted shell. Invalidated controllers ignore late old-view
  callbacks. Same-owner refreshes, relaunches and tab switches retain the rest.
  The host-testable core uses `Task.sleep(nanoseconds:)` to preserve the package's
  macOS 12/iOS 15/watchOS 8 floors; the Duration overload requires newer OSes.
  `RestTimerSystemEffects` (`App/Shell/RestTimerController.swift`) mirrors the
  schedule into a local notification and a Live Activity (updated, not restarted,
  on +30 s), guards delayed notification authorization and orders activity cleanup
  after earlier operations. The activity's content state carries the end date,
  total duration, exercise, next set number, target and session ID; it turns
  stale at the end date ("Rest over", Open session via `neogym://session/<id>`).
  When the app sees the rest finish it ends the activity with that content and a
  10-minute dismissal; Skip, sign-out and the next rest end it immediately. The
  Live Activity's +30 s and Skip are `LiveActivityIntent`s in `Shared/` (compiled
  into app and extension, run in the app process). `LiveRestTimerIntents`
  (`App/Shell/RestTimerIntentHandler.swift`) routes them to the attached live
  scope's controller, or, with no controller (background launch, or restoring),
  to `RestTimerController.extendPersisted`/`cancelPersisted` for the stored owner,
  then awaits notification scheduling and the ActivityKit work before the intent
  returns. Demo detaches it. `RestTimerAccessory` is the `.tabViewBottomAccessory`
  content, enabled while a session is in the Train stack or a rest runs: it
  shows the countdown with +30 s and Skip (only Skip in the inline placement)
  and opens the session on tap. Logging a set starts the default rest
  (`RestTimerPreference`, set under Me › Account) with a `RestTimerSetContext`
  (`afterLogging`): "<exercise> · set N next" plus the next set's target from the
  set just logged ("95 kg × 10", "/side" for per-side weights).
  `SessionDetailView` reports its display name with `noteSession`.
- **Tokens and surfaces**: colours are asset-catalog colour sets with Any/Dark
  variants (`App/Assets.xcassets/Theme/*`, plus `AccentColor` = `#3463E0`)
  exposed only through `NeoGymTheme` (`background`, `surface`, `inset`, `fill`,
  `segmentedThumb`, `separator`, `text`, `textSecondary`, `textTertiary`,
  `accent` for fills, `accentText` for text/icons, `accentSoft`, `chart1`/
  `chart2` for chart series, `carbs` for the carbs macro, `positive`,
  `destructive` (text: light `#B91C1C`, dark `#F87171`), `destructiveFill`
  (`#DC2626`), `health` (the `#E5484D` Apple Health heart, glyph only), and `onFill` for
  labels/glyphs on accent or destructive fills). Never hard-code hex
  or system colours in views. `RootView` applies `.preferredColorScheme` from
  the `AppAppearance` `@AppStorage` key (Dark default) and the global
  `.tint(NeoGymTheme.accentText)`; prominent buttons tint with `accent`.
  Content uses flat surfaces: `SurfaceCard`, `.cardSurface()` (cards, radius
  22), `.insetCard()` (tiles), `.fieldSurface()` and `SectionShell` (titled
  card). Glass is only system chrome (tab bar, toolbars, accessory, sheets); do
  not reintroduce materials, gradients, `GridBackground` or shadows on content.
  Spacing steps are 4/8/12/16/20/24/32 with a 16 pt screen gutter.
- **Type and metrics**: Dynamic Type styles only (Large Title from the
  navigation bar on area roots, Title 2 for detail titles, Headline/Body/
  Subheadline/Footnote for content). Every metric uses `.monospacedDigit()`.
  Shared pieces live in `App/Components/MetricViews.swift` (`CardHeader`,
  `StatTile`, `MeterBar`, `MeterTrack`, `RingMeter`,
  `LegendItem`, `MetricValueText`, `MetricFormat`, `AdaptiveRow`) and
  `App/Components/ListPrimitives.swift` (`SearchField`, `ListRow`,
  `RowSeparator`). `AdaptiveRow` stacks vertically at accessibility text sizes;
  use it for tiles and paired metrics instead of letting text truncate.
- **Exercise images**: `ExerciseThumbnail` (`App/Components/StorageImageView.swift`)
  reads the Storage base URL from the `storageBaseURL` environment value that
  `AppShellView` sets, so rows need no URL plumbing; list, editor and session
  queries select `image1FileId` (sessions also `image2FileId` for the open
  card's alternating `AlternatingStorageImageView`). Storage files load with
  plain `AsyncImage` GETs, as on exercise detail. Catalog muscle groups and the
  shared grouped/search row stack are lazy, so thumbnail work follows visible
  and nearby rows rather than the whole catalog. Keep laziness at the row
  boundary; making only muscle cards lazy still eagerly loads a large group.
- **Nutrition slots**: the Log timeline and plan detail share
  `NutritionSlotHeader` (time, title, kcal, trailing control, then a P · C · F
  grams line with accent/carbs/secondary dots aligned under the title) and
  `NutritionSlotItemRow` (name, MEAL tag for meals, "amount · P · C · F" from
  NeoGymKit `NutritionMacroText`, kcal). Expanded logged meals list their child
  food snapshots beneath the meal row (`NutritionTimeline.loggedMealEntries`
  matches the logged group ID, not the reusable meal ID). Each food row opens
  `EditLogEntrySheet` for grams/position edits and single-entry deletion, hiding
  the time control because grouped foods inherit their meal's time; the meal row
  still opens `EditMealGroupSheet`. Successful entry changes keep the existing
  day reload and parent mutation callback, which reloads week-strip kcal and
  invalidates the other nutrition views. Planned (dashed) slots pass `muted`.
  Every selected-plan slot stays in the timeline; one sharing its time with a
  logged slot comes after it (`hasLoggedFood`), keeps the accent-soft Log and
  asks first through a `confirmationDialog` with the web dialog's wording.
  Only `NutritionTimeline.nextPlannedId` (the first planned slot with nothing
  logged at its time) opens by default with the accent Log.
- **Patterns**: session logging, the Nutrition Log timeline, Today, Progress
  and Account follow the root design section. Their rules live in host-tested
  NeoGymKit types (`SessionLogging`, `NextSetDraft`, `SessionWeekGrouping`,
  `NutritionTimeline`, `NutritionWeekStrip`, `TodayTrainingSummary`,
  `TodayNutritionSummary`, `TodayBalanceSummary`, `BodyTrendSummary`,
  `MuscleSetBar`, `MuscleSetOverview`, `StrengthWeeklyOverview`,
  `CalorieTrend`, `EntryHistoryWindow`, `DailyEnergyOutAverage`,
  `HealthImportMarker`, `AgentAccess`); keep new view logic there with tests
  rather than in views. Lists show one title, one metadata line and one
  trailing value, with a chevron only when the row pushes. Body and Energy
  entry lists show the latest five under an `EntryListHeader` ("5 of 32") and
  end with `LoadMoreRow` (`App/Components/ListPrimitives.swift`). Health data always shows its source with a
  sync-status row (`HealthSyncStatusRow`), and each Body/Energy row whose
  notes are exactly the import marker shows `HealthImportHeart` (a red heart
  labelled "Imported from Apple Health") after its date instead of the note.
- **Loading, empty, and error states**: reuse `AppLoadingStateView`,
  `AppErrorStateView` and `AppEmptyStateView`. The empty state follows the
  design's States board: its icon on an accent-soft tile, a Title 2 heading, the
  message and an optional primary capsule action (`actionTitle`/`action`, e.g.
  Sessions' "Browse workouts", "Clear filters", a session's "Add exercise"). A
  section-level empty state sits directly on the page background with no card;
  only one nested inside an existing card (an exercise's Progress card) takes
  that card's surface. Preserve stale data while refreshing when the view model
  exposes a previous value, and wire retry buttons to
  `Task { await viewModel.load() }`.
- **Buttons and destructive actions**: primary full-width actions use
  `NeoGymPrimaryButtonStyle`; secondary actions use `NeoGymSecondaryButtonStyle`;
  icon-only buttons keep a 44×44 target and an accessibility label.
  Destructive deletes and Sign out are full-width buttons on the surface token
  with destructive text (`FormDeleteButton`) at the end of the content, opening
  a `.confirmationDialog` (action sheet, `titleVisibility: .visible`, destructive
  button then Cancel) that states what will cascade; keep `.alert` for text
  input such as a plan slot label. Pushed form routes put Cancel in
  `.cancellationAction` and Save in `.confirmationAction`. Nutrition log edit
  sheets and the set editor keep their Delete as a destructive `Button` in a
  trailing `Section`; the cardio entry sheet uses `FormDeleteButton`.
- **Forms and validation**: non-trivial forms keep field state and validation in
  `NeoGymKit` `ObservableObject` form models (`valuesForSubmit()`, `canSubmit`,
  `errorMessage`) and keep SwiftUI views focused on layout. Representative
  forms use the app-layer `PrimaryActionButton` for primary submit actions,
  `InlineProgressLabel` for inline busy copy, and `FeedbackBanner` for
  form-level errors near the actions. Disable submit while saving or invalid,
  call parent callbacks before dismissing, and keep unit tests around
  model-level validation rather than live services; a full app-wide form
  migration is intentionally out of scope unless a view is already being
  refactored.
- **Grouped editors**: New/Edit food, Edit meal, Edit plan, New/Edit workout,
  New/Edit journal entry, New/Edit measurement, New/Edit energy and the cardio
  entry sheet follow the design's inset grouped rows from
  `App/Components/FormRows.swift` (`FormSection` with caps header/footer,
  `FormRow`, `FormLabeledTextRow`, `FormDateRow` for a `YYYY-MM-DD` binding,
  `FormTextAreaRow` for notes and monospaced markdown bodies, `FormNumberRow`/
  `FormNumberField` wells on the background token via `formWell(isInvalid:)`,
  `FormActionRow` with its accent-circle glyph, `FormRemoveButton`,
  `MacroTotalsStrip`, `EntryKindTag`, `FormScrollContainer`). The navigation
  bar carries the title; do not repeat it in a `SectionShell` card. Inputs
  inside a surface card must use a contrasting fill (`fill`, `inset` or the
  background well), never the surface token. Editable lists (meal ingredients,
  plan entries, workout exercises) remove rows with the red minus and reorder
  through a long-press menu mirrored in `accessibilityActions`; the workout
  design's drag handle is not implemented.
- **Inputs**: grouped editors use inline row titles; any remaining stacked
  fields are labelled with `.subheadline.weight(.semibold)`. Use `.words`
  autocapitalization for names/titles, `.never` plus disabled autocorrection for
  emails, IDs, labels, and numeric text; use `.decimalPad` for weights/grams and
  macro fields, `.numberPad` for integer/cardio duration parts, compact
  `DatePicker` for dates, and wheel time pickers in modal logging sheets. Actual
  `.decimalPad`/`.numberPad` `TextField`s outside OTP should opt in to local
  `@FocusState` plus `KeyboardDoneToolbar`/`numericFieldFocus` so the keyboard
  has a Done dismissal affordance without moving validation into `NeoGymKit`.
  Multi-line notes/descriptions use `FormTextAreaRow` (a vertical `TextField`
  that grows from a minimum line count, placeholder "Optional" for notes). OTP entry uses the custom `OTPCodeField` so paste,
  one-time-code autofill, six-digit filtering, focus, and accessibility stay
  consistent.
- **Pickers and composite editors**: workouts and sessions add exercises
  through the multi-select `ExercisePickerView` checklist; meal and plan
  editors pick foods/meals with the searchable `NutritionSelectionSheet` list
  (its toolbar pushes a create form in the same sheet). Log intake uses it too:
  Food and Meal show the chosen item as a two-line `NutritionChoiceRow` (name,
  wrapping, over its per-100 g or meal caption) whose Change opens the list
  with a checkmark only on the current choice, blank glyph space on other rows,
  and no create action (`newItemTitle: nil`). Editor add lists keep their plus
  glyphs. Meal search retains name, description and ingredient matching via
  `Meal.matchesSearch`, shared with the Meals library. Both the choice row and
  paired macro values stack at accessibility text sizes. Its Macro preview and `EditLogEntrySheet`'s Nutrition card share
  `NutritionMacroPreview`: kcal with P · C · F in whole grams (protein first, as
  on the log's slots), fiber and sugar below. Host-tested NeoGymKit
  `NutritionEntryPreview` owns edit totals, the "per 100 g, as logged" caption
  and the optional saved totals ("Was 110 kcal · P 14 · C 6 · F 3 at 150 g").
  It accepts the timeline's `IntakeEntry` projection (`NutritionLogEntry.intakeEntry`),
  which is also the edit sheet's input; helper tests should use that boundary.
  Food-backed entries use the immutable snapshot, even after catalog edits or
  deletion; ad-hoc entries use the typed per-100 g nutrients. Both multiply by
  the typed grams. Saved totals appear only when the displayed whole
  kcal/protein/carbs/fat differ, not for fiber/sugar alone or sub-rounding
  changes. `NutritionMacroText.whole` preserves the previews' existing visible
  rounding and is shared by the comparison, rendering and spoken P/C/F values
  (also in slot headers). Keep speech on the same formatter: rounding exact
  half grams away from zero would disagree with the visible half-to-even values.
  Amount and custom-nutrient fields provide a focus-scoped keyboard Done action.
  The old `FoodPickerView` / `MealPickerView` wheels were removed; do not
  reintroduce them. Workout labels and journal labels share `LabelChipsEditor`
  (`App/LabelInputView.swift`):
  accent-soft chips with a remove button, an inline "Add label" field with
  normalized typed creation, and matching existing labels shown only while the
  field is focused. Strength set editing intentionally uses a sheet with native
  `Form` + wheel pickers for kg/grams/reps; cardio entry editing is
  schema-driven: the exercise name and "Entry N" form the title, REQUIRED then
  OPTIONAL groups list each metric with its unit and the schema range as the
  placeholder, and the invalid metric row is highlighted. Filter-chip rows use
  `FilterChip`, whose unselected fill is the surface token on the page and the
  fill token on sheets (Add exercises).
- **Graphs and summaries**: Muscles, Strength, Body, daily-energy and calorie trends use
  `TimeSeriesTrendChartView` / `TimeSeriesChartView` with a period menu, custom
  date pickers, sampled points, axes/legend, and tap/drag callouts. One period
  menu can drive several stacked `TimeSeriesChartPanel`s (Consumed above Net);
  `chartHeight` covers each chart and its legend. Overview's Strength and Energy
  sparklines and Today's Body chart are a `TimeSeriesChartView` with
  `showsAxes: false` (no grid, axes or legend); Overview's Body chart keeps
  both axes but no legend. Body and Energy charts (Calories included) open on
  `.last30Days`, as do Overview's Body and Energy cards. Non-empty
  custom chart plots collapse decorative drawing, axes, markers, and callouts
  into one VoiceOver element with a domain label plus the NeoGymKit
  `ChartAccessibilitySummary` of the visible series: the complete-period date
  range, then lowest, highest, average and latest per series (no average for
  `isRollingAverage` 7-day lines), leaving out a partial point, and a closing
  "Today so far: …" (or "This week so far: …" for `periodUnit: .week` series
  such as weekly volume) that names series only when several are partial; legends
  stay separate tappable controls for hiding/showing series. Caller-provided
  chart accessibility values must account for hidden series themselves.
  Empty-state text remains naturally accessible. Value axes use NeoGymKit
  `ChartAxisScale`: three labels (bottom, middle, top) on rounded values, bare
  compact numbers without units (`12`, `2,000`, `50k`, `+400`/`−1,200` when the
  axis crosses zero) in `textSecondary` whatever the series colour, with one
  grid line per label. A series with `axisFormat: .durationSeconds` (cardio
  exercise detail when the primary metric is a duration) steps in whole
  minutes and labels m:ss, or h:mm:ss on every label once the axis reaches an
  hour, matching its `valueFormatter`; seconds are never shown raw. Series with `includesZero` (Muscles sets, daily energy,
  net calories) keep 0 on the axis; others hug their data. When visible series
  sit on both axes (Strength and exercise-detail volume + Est. 1RM, the Today
  and Overview body charts), `ChartAxisScale.startAligned` scales each to its
  own data with both first values at the same height, so those labels are
  less round. Lines join across missing days and every point gets a dot,
  3.6 pt once a series passes `maxPointMarkers` (31); charts render up to
  `maxRenderedPoints` (64) before sampling. X-axis dates use the "d MMM"
  template (`showsMiddleDate: false` keeps only the first and last). Charts have no border and
  grid lines use the separator token. Series colour follows the metric:
  `chart1` (blue) for weight, resting energy, consumed, volume and sets,
  `chart2` (orange) for body fat, active energy, net and Est. 1RM, for lines,
  bars and split bars alike; no grey series and no `accentText` lines. A
  `.readings` series (daily values: 1.5 pt line at half opacity with dots)
  sits under its `.line` 7-day average in the same colour, and one chart holds
  one unit on detail tabs (Body has a card per metric); summary cards may pair
  weight and body fat on two axes. A point with `isPartial` (today's intake or
  energy, this week's volume) joins the line with a dashed segment to an open
  dot, and the NeoGymKit averages leave it out. Callouts name the series in
  `textSecondary` beside a colour dot. Day summaries use `MeterBar`/`MeterTrack` (protein
  accent, carbs `carbs`, fat secondary text); plan/meal editors use the
  compact `MacroTotalsStrip`, and meal/plan library summaries still use
  `MacroSummaryView` grids;
  the daily intake balance is read-only, with calories in from logged snapshots
  and calories out from the same date's `daily_energy` row. Today, Progress ›
  Energy list/detail, the Log, the watch app's End of day page and the small/medium
  iPhone Balance widgets also show
  `DailyEnergyProjection`: prior seven local dates' mean positive resting kcal,
  floored at resting already recorded today, plus today's recorded active kcal;
  estimated net subtracts this from food already logged. Require today's row and
  at least one usable historical resting value, and never replace actual values,
  historical charts or `daily_energy` records. Keep estimate presentation compact:
  labeled values and units, without calculation prose or history-day counts.
  Format estimates as whole kcal, choosing the net sign after rounding so zero
  never displays a plus/minus sign.
  Future food/activity are not predicted. The overview read behind Today reads extra past/current
  `balanceDays` without hiding future logs from browsing, and its cache key
  includes today. Daily intake/watch reads fetch today plus seven prior energy
  dates and explicitly select today by date. The watch snapshot's optional
  resting baseline survives eligible local provisional updates, but is ignored
  by complication display/reload identity; the watch complication and Lock Screen
  widgets stay actuals-only. The watch snapshot's optional plan kcal (circular
  ring) does trigger a reload; its optional 7-day average (watch app only) does
  not. Home Screen widgets follow the design board: balance so far with the
  resting/active bar (Chart 1/Chart 2, 45 % active in accented mode), In/Out,
  "End of day ≈ …"; medium adds the legend, the 7-day average and Refresh.
  `EnergyBalanceWidgetLiveRefreshOrchestrator.timeline` adds a calendar-day
  next-local-midnight entry for a same-day snapshot: estimates drop and "today so
  far" becomes "<weekday> so far" without another provider run.
  Timeline tests inject both calendar and locale; `en_US_POSIX` numeric fixtures
  use ungrouped values such as `2100`, unlike `en_US`'s `2,100`.
  See `docs/developers/energy.md` from the repo root. Do not introduce a new
  chart or macro tile style unless these primitives cannot express the need.
- **Accessibility and previews**: add accessibility labels for icon-only actions,
  preserve 44-point hit targets for tappable chips/buttons where practical, and
  keep dynamic type in mind. Previews can set `dynamicTypeSize`, color scheme,
  and fake repositories/services; do not depend on live Nhost, real Keychain, or
  writable HealthKit data in previews/tests.

## Inconsistencies worth fixing when touching nearby code

- Some forms outside the representative migration still use local error,
  mutation-progress, or submit-button presentation. Prefer
  `PrimaryActionButton`, `InlineProgressLabel`, and `FeedbackBanner` when
  refactoring those forms.
