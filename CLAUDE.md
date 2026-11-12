# CLAUDE.md

Guidance for future Claude Code sessions in this repo.

## What this is

NeoGym — a TanStack Start (React 19 + Vite 8 + Nitro) frontend talking to an Nhost Cloud backend. The Nhost CLI runs a local Docker mirror of the same stack (Hasura + Auth + Postgres + Storage + Functions) for development. Sign-in/sign-up use email OTP (6-digit code, no password). Email-change is verified via a PKCE email-link flow that lands on `/verify` and exchanges the auth code for a session. UI is Tailwind v4 + shadcn/ui.

## Repo layout

```
.
├── flake.nix          # Nix devshell — provides bun + biome + constellation + XcodeGen on Darwin
├── ios/NeoGym/        # SwiftUI app shell, XcodeGen spec, and host-testable NeoGymKit package
├── frontend/          # TanStack Start app (Vite default port 5173, bound to 0.0.0.0 for LAN/mobile)
│   ├── src/
│   │   ├── routes/    # File-based routes (TanStack Router)
│   │   │   ├── __root.tsx, index.tsx, signin.tsx, signup.tsx, verify.tsx
│   │   │   ├── _authed.tsx              # pathless protected layout
│   │   │   ├── _authed/today.tsx        # signed-in landing (Today)
│   │   │   ├── _authed/train/           # Sessions, Workouts (split-view `_split` layouts), Exercises
│   │   │   ├── _authed/nutrition/       # Log (log/$date), Plans, Foods, Meals
│   │   │   ├── _authed/progress/        # Muscles, Strength, Body, Energy
│   │   │   └── _authed/me/              # Journal (split view), Account
│   │   ├── components/ui/    # shadcn primitives (hand-written, NOT from CLI)
│   │   ├── components/shell/ # sidebar, mobile tab bar, area tabs, rest timer
│   │   ├── components/patterns/ # page shell, metrics, segmented, query states
│   │   ├── components/       # domain components (forms, pickers, charts), auth-card
│   │   ├── lib/nhost/        # client + AuthProvider
│   │   └── lib/utils.ts      # cn() helper
│   ├── biome.json, codegen.ts, components.json, vite.config.ts
├── backend/           # Nhost CLI project — Hasura + Auth + Storage + Functions
│   ├── nhost/nhost.toml       # auth/Hasura config
│   ├── nhost/metadata/        # Hasura metadata
│   └── nhost/migrations/      # SQL migrations
└── docs/developers/   # Domain-model docs — read before touching sessions/exercises
```

## Domain docs

Before changing anything in the sessions or exercises data model, read the matching doc — they cover invariants that are not obvious from the schema alone:

- [`docs/developers/database.md`](docs/developers/database.md) — Mermaid ER diagrams of the schema, with the composite-FK / discriminator pattern and cascade rules called out. Start here if you need to see the shape; the other two docs cover invariants in prose.
- [`docs/developers/sessions.md`](docs/developers/sessions.md) — sessions are containers with an ordered exercise list. `workout_id` is **nullable** (ad-hoc sessions) and is a *template link*, not a contract: nothing enforces that the session's exercises match the workout's, and the `workout_id` can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (FK is `ON DELETE SET NULL` — was `CASCADE` in the init migration, changed in `1790000460000` to match the template/contract framing).
- [`docs/developers/exercises.md`](docs/developers/exercises.md) — `exercises` is the **base** catalog table with only the truly shared columns; kind-specific catalog metadata lives in two 1:1 sidecars: `exercises_strength` (`double_weight`, `force`, `mechanic`) and `exercises_cardio` (`metrics_schema`). The strength/cardio split is enforced **structurally** via composite FKs, not triggers: `exercises.kind` is a `GENERATED` column (`'cardio'` iff `category='cardio'`, else `'strength'`); `workout_exercises.kind` and `workout_session_exercises.kind` are auto-populated by a `BEFORE INSERT/UPDATE` trigger from the parent exercise; `workout_session_strength_sets.parent_kind` is pinned to `'strength'` and `workout_session_cardio_entries.parent_kind` to `'cardio'`, both composite-FK'd to `workout_session_exercises(id, kind)`. The sidecars themselves repeat the same trick: `exercises_strength.kind` is pinned to `'strength'` and `exercises_cardio.kind` to `'cardio'`, both composite-FK'd to `exercises(id, kind)` with `ON UPDATE CASCADE` — so a category flip on an exercise that already has a sidecar (which every exercise does) cascades into the sidecar's `kind`, the pinned `CHECK` rejects it, and the whole transaction rolls back. Lifecycle is also atomic: `DEFERRABLE INITIALLY DEFERRED` constraint triggers on `exercises` AFTER INSERT and on each sidecar AFTER DELETE fire at commit, refusing to commit a transaction that would leave an exercise without its sidecar or a sidecar without its parent. Clients (admin, user, seeds, migrations) insert exercise + matching sidecar together via a Hasura nested mutation (`insertExercise(object: { ..., strength: { data: {...} } })`) or a SQL CTE — Hasura nested inserts and CASCADE-on-DELETE handle the common cases, the deferred check catches anything that slips through. A strength set cannot attach to a cardio session-exercise (or vice versa) — it's an FK violation, not a runtime check. A separate `BEFORE INSERT/UPDATE` trigger on `workout_session_cardio_entries` still runs `pg_jsonschema` to validate the metrics jsonb shape against the parent exercise's `exercises_cardio.metrics_schema`. The frontend branches on `exercise.kind === 'cardio'` (not `category` — `category` keeps the richer taxonomy: cardio, strength, stretching, powerlifting, plyometrics, olympic_weightlifting, strongman). Secondary-muscle mappings inherit owner-or-public reads through `exercise`; users may insert/delete mappings only on their own private exercises (including nested creation), with no update/reparent permission. Change a mapping with delete + insert in one GraphQL mutation, as with other junctions; public targets stay admin-managed. See `docs/developers/permissions.md` and the `secondary-muscle ownership` tests in `backend/tests/kind-enforcement.test.ts`.
- [`docs/developers/nutrition.md`](docs/developers/nutrition.md) — nutrition adds owner-or-public `foods`, private `meals` and `nutrition_plans`, one `nutrition_days` row per local calendar date, optional logged meal groups, and concrete `nutrition_log_entries`. Plans contain meal slots (`nutrition_plan_meals`) and direct food slots (`nutrition_plan_foods`); mixed entries sort by `(slot_time, position, kind, id)` after clients assign a global per-slot `position` across both tables. Logged entries carry `source = 'food' | 'ad_hoc'`: food-backed rows copy trusted food name/kcal/fat/carbs/protein/fiber/sugar per 100g into non-null `snapshot_*` columns on insert and keep those snapshots immutable even after source food edits/deletes; ad-hoc rows are standalone log-only snapshots with no `food_id`, group, or plan-food provenance, and users may edit their snapshot fields. Grouped entries must carry the same `nutrition_day_id` as their `nutrition_log_meal`; the composite FK rejects wrong-day children and cascades group deletes. Direct plan-food logs are standalone food-backed entries with nullable `nutrition_plan_food_id` provenance; a trigger rejects grouped or mismatched-food provenance. `meal_ingredients.food_id`, `nutrition_plan_foods.food_id`, and `nutrition_plan_meals.meal_id` are `ON DELETE RESTRICT`, so public food/admin cleanup and meal deletes can be blocked by template references.
- [`docs/developers/energy.md`](docs/developers/energy.md) — daily energy is a private `daily_energy` stream with one row per `(user_id, energy_on)`, nullable active/resting kcal (at least one required), user-role GraphQL roots named `dailyEnergyEntry/Entries`, body-style web/iOS CRUD, one-way read-only Apple Health import that sums cumulative samples per local day, creates missing dates, refreshes the last 7 days for rows still marked "Imported from Apple Health", and the read-only nutrition in/out/net balance contract. Today-only summaries also show derived burned/net estimates: mean positive resting energy over the previous seven local dates (one usable day is enough), floored at today's already recorded resting energy, plus today's recorded activity; estimated net uses food already logged. Actual values/history remain unchanged, no projection is stored in `daily_energy`, and no future meals/activity are predicted. Native Overview/Energy/intake, web Today (Balance card, beside yesterday's actual balance), web Energy/intake, the watch app, and the medium iPhone widget show estimates; the watch complication does not.
- [`docs/developers/health-workouts.md`](docs/developers/health-workouts.md) — private raw `health_workouts` JSON snapshots keyed by user + HealthKit workout UUID, read-only workout-level import on Workouts-area open/refresh, anchored add/update/deletion sync, no export or session conversion. Documents the workout importer's read-permission scope and the local-anchor deletion caveat.

**Keep these docs and CLAUDE.md in sync with the code in the same change.** When you make a change, ask: does anything I wrote here or in `docs/developers/` still read true after this? If the change touches the domain model (schema, migrations, Hasura permissions, the `exercises_strength`/`exercises_cardio` sidecar shape, the `kind` discriminator, session lifecycle, auth flow, the codegen pipeline, PWA build config, navigation conventions, toolchain) — update the matching doc and/or CLAUDE.md section as part of the same commit, not as a follow-up. Don't write "TODO: update docs" or leave doc drift for later. If you're unsure whether a doc statement is still accurate after your change, re-read it; stale claims here are worse than no claims, because future sessions act on them.

## Toolchain

`bun`, `biome`, `constellation` (from `nixops.packages`), and Darwin-available XcodeGen are NOT assumed to be on the host — they come from `flake.nix`. Run frontend commands via the devshell:

```sh
cd frontend
nix develop ../ --command bun run <script>
nix develop ../ --command bunx <pkg>
```

**Don't `curl | bash` install bun.** The user wants the toolchain to come from Nix. If XcodeGen is unavailable in the pinned Nixpkgs on a Darwin host, use the documented Homebrew fallback (`brew install xcodegen`) but keep `ios/NeoGym/project.yml` as the source of truth and do not commit generated `.xcodeproj` output.

For native Swift/WebKit validation from the Nix shell, bare `xcrun` can resolve to Nix's older SDK rather than the host Xcode SDK, causing `SwiftShims` or compiler/SDK-version errors. Use `/usr/bin/swift` with an explicit `-sdk` path from `env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun --sdk macosx --show-sdk-path`; unset those overrides for the Swift invocation too.

## Common commands

From `frontend/` (each prefixed with `nix develop ../ --command` if outside the shell):

| What | Command |
|---|---|
| Install deps | `bun install` |
| Dev server (<http://localhost:5173>, also exposed on LAN) | `bun run dev` |
| Production build | `bun run build` |
| Typecheck | `bun run typecheck` |
| Lint + format check | `bun run lint` |
| Typecheck + lint + tests (run after every code change) | `bun run check` |
| Auto-fix formatting | `bun run format` |
| Regen GraphQL schema dump + TS types | `bun run codegen` (needs backend up; runs `codegen:graphql-schema` then `codegen:graphql`) |

**Always run `bun run check` after writing or modifying code.** It runs `typecheck` + `lint` + `bun test` together; fix any errors it surfaces before reporting work as done.

From `backend/`:

- `make dev-env-up` — boot Hasura + Auth + Postgres + MailHog locally and apply seeds (wraps `nhost up --apply-seeds`)
- `make dev-env-down` — stop and remove volumes (wraps `nhost down --volumes`) — destroys the local DB, so the next `dev-env-up` is a clean apply of migrations + seeds. Use after editing migrations to make sure a fresh run picks them up.
- `make schema` — dump Hasura and Nhost/Constellation SDL for `admin`, `user`, and `public` plus per-role structural diffs to `backend/schemas/` using `nhost schema dump` / `nhost schema diff`. Requires both endpoints running; see the codegen pipeline below.
- `make test` — run backend integration tests under `backend/tests/` against live local Hasura and Constellation. Requires both services from `dev-env-up` first. The Makefile target runs `bun install && bun test` so dependencies are resolved on a fresh clone. Most tests deliberately target `https://local.hasura.local.nhost.run/v1/graphql` because many assertions depend on Hasura error codes and metadata behavior. `backend/tests/strength-reporting.test.ts` deliberately also queries the Constellation/Nhost GraphQL proxy at `https://local.graphql.local.nhost.run/v1` to prove the report roots are reachable by app clients.
- `nhost config validate` — sanity-check `nhost.toml` after edits

From `ios/NeoGym/`:

The `NeoGym` app and `NeoGymWidgets` extension target iPhone/iOS 27 only; Mac
and Apple Vision compatibility are disabled. Keep the host-testable `NeoGymKit`
package at its lower deployment floor unless its own code needs newer APIs.

- `swift build` — build the host-compatible `NeoGymKit` package. It must keep SwiftUI/UIKit out of `Sources/NeoGymKit` so this works on macOS.
- `swift test` — run deterministic package tests against fakes; do not require a live Nhost backend or real Keychain for unit tests.
- `nix develop ../.. --command xcodegen generate` — generate `NeoGym.xcodeproj` from `project.yml`.
  After adding/removing Swift app files, wait for XcodeGen to finish before running `xcodebuild`; a stale generated project can omit new `App/*.swift` sources and surface misleading `cannot find type/member` compile errors.
  The spec's post-generation script patches both `NeoGym` and `NeoGymWatch`
  schemes to keep XPC Services, Queue Debugging/backtrace recording, View
  Debugging, and related default diagnostics disabled after regeneration.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — build the SwiftUI app for a simulator destination.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGymWatch -destination 'generic/platform=watchOS Simulator' build` — build the watch companion and its embedded complication after regenerating XcodeGen.
- `make archive-release` — signed non-upload device archive and local export, verifying the archive and IPA independently; Apple signing/profiles are required. Automatic provisioning updates require a separate per-run `NEOGYM_ALLOW_PROVISIONING_UPDATES=YES` and operator acknowledgment for the watch App ID. Without signing access this gate remains blocked; simulator checks do not replace it.
- `make deploy-testflight` — explicitly uploads after reusing the verified non-upload path. Never use it for validation; obtain operator approval for each real upload. See `ios/NeoGym/README.md` for paired hardware and production `GET /user` acceptance.

Keep `ios/NeoGym/App/LaunchScreen.storyboard` wired through `UILaunchStoryboardName` in both `App/Info.plist` and `project.yml`. The storyboard can stay visually minimal, but it is required for iOS to opt the app into modern full-screen sizing on current devices; removing it can make the simulator/device run the app letterboxed with large empty top/bottom bands.

`NeoGymKit` also supports watchOS 8 without changing its iOS/macOS floors.
The Body and raw-workout HealthKit importers are iOS-only; watch energy
HealthKit reads live in the watch app. The embedded
`NeoGymWatch` watchOS 27 companion uses the watch core's private,
origin-scoped, device-only SDK Keychain session with legacy migration ignored,
no GraphQL cache, and a managed, uncached Auth `GET /user` name/email read.
The watch restores its local Keychain session first, displays a same-user
watch-app-only cached profile (or the SDK session's name) and today's token-free
energy snapshot immediately, and revalidates the profile in the background;
WCSession activation does not hold up the foreground UI. The watch signs in
only through a phone-issued, app-user Auth PAT. In Me → Profile → Connect Apple
Watch, the signed-in iPhone creates a 90-day PAT for a
live, nonce-bound watch request and hands it over by reachable WCSession message;
there is no watch email/OTP fallback. The watch saves the PAT in its own
ThisDeviceOnly Keychain item, uses `/signin/pat` to obtain a separate SDK session,
and automatically reuses the unchanged PAT if its ordinary refresh session is
lost, an uncached Auth `/user` read returns 401, or the watch transport confirms
HTTP 400 specifically from Auth `POST /token`. That refresh rejection is a
recovery signal, not proof of an invalid PAT; other HTTP 400s do not trigger it.
The same bounded recovery handles a rejected refresh during profile validation,
energy reconciliation/read, or forced pre-upload refresh. After fresh account
validation, an energy refresh can reconcile once more; it never retries in a loop.
Automatic PAT sign-in is limited to one attempt until a successful `/user` read, avoiding a sign-in loop
when Auth remains unavailable; a still-valid, non-blocked saved PAT keeps manual
Restore saved sign-in available across foreground opens after a transient failure,
and that screen also allows watch-only sign-out to erase it. Transient
profile/network or energy failures and malformed response bodies alone do not
trigger PAT sign-in. The SDK still handles its typed `invalid-refresh-token`
response and conditional session removal normally.
PAT renewal requires reconnecting from the phone after expiry. With a definitive
same-user phone hint, reauthentication and Auth-error screens offer Connect using
iPhone even if the SDK still retains the rejected session; a healthy session or
pending local clearing cannot be replaced. Restore saved sign-in is shown only
while a locally valid, owner-eligible PAT remains saved (Auth may still reject it).
The phone retains the token
only in memory until acknowledgment/attempt expiry. Application context contains
only latest-state phone account hints. Known signed-out/different-account hints
clear the watch credential and block recovery; explicit watch sign-out also clears
it. PAT metadata is not a permission scope: the credential can sign in as the
full user until expiry or server revocation. Ordinary phone sign-out does not
revoke a PAT while the watch is offline; a stale/undelivered hint is not instant
server revocation. A Nhost Cloud dashboard PAT is not an app-user Auth PAT.
Signed-in watch users swipe between
Energy (today's logged consumed kcal, active+resting burned total and its
active/resting breakdown, and Net = consumed minus burned), Profile
(uncached Auth name/email and watch-only sign-out), and Events (the last 300
timestamped, watch-app-only diagnostic outcomes). Events distinguish background
requests accepted by watchOS from actual wakes and delivered task expiry,
Health observer delivery from sync, typed starts/ends for active/resting
HealthKit queries and backend reconciliation/read/write stages, fresh energy
reads, local snapshot-save success/failure, Auth refresh HTTP start/response/
cancellation/failure and SDK session-write notifications, and WidgetKit reload requests;
a reload request does not confirm a new display.
Random per-attempt IDs correlate observer arrival, sync, snapshot and HealthKit
acknowledgement within one in-process attempt; a resumed pending import uses a
new attempt ID and records the pending wall-clock age instead. Entries include
active/resting metric, app state when captured during handling, elapsed time,
backend operation or skip reason when relevant. Auth refresh events use HTTP
boundary timestamps, and SDK session-write events use the notification callback
time; both omit app state because their MainActor log writes can be delayed.
Stage elapsed times and pending age use wall clock (including watch sleep); a missing stage end or
expiry event cannot prove a hung query or a successful wake. Observer
acknowledgement is timestamped in the HealthKit callback rather than at a
delayed MainActor log write, and exports remain occurrence-sorted.
HealthKit observer callbacks
attempt a read-back-verified private, user-scoped pending-sync marker before
promptly acknowledging HealthKit; failed local handoffs are logged but cannot
guarantee a deferred retry. Backend work never holds the callback through
watchOS suspension.
The marker survives relaunch, is cleared only after a successful Health import,
fresh backend read and snapshot save for the same owner, and protects newer
deliveries from an in-flight refresh. A 15-minute preferred fallback wake is
requested for pending deliveries; acceptance is not proof of a wake. Events
show the pending delivery's wall-clock age when a refresh starts. A new eligible
trigger cancels and replaces a refresh open for over 30 wall-clock seconds, so a
suspended/stuck task cannot block foreground recovery; legacy 25s timeout
events could have been logged much later after suspension. Errors retain
fixed stages, numeric codes and safe sources, including a distinct GraphQL
transport category. New events retain only a typed URLSession error number,
HTTP status, service/response category or unknown cause; no URLs, headers,
response bodies or raw descriptions are exported. A cancelled Auth refresh
is logged as skipped/cancelled, not a network failure; its server outcome is
unknown and a later 401 or session removal can follow if the token rotated.
A refresh HTTP success is not evidence that the rotated token reached Keychain; a missing SDK write event
is also not proof of failure if watchOS suspended delivery. Auth refresh attempt
IDs are random and never derived from tokens or account IDs. The old GraphQL transport
`code 3` was a Swift enum index, not an HTTP/HealthKit status. A watch scene
transition event distinguishes active/inactive/background (but does not prove
continuous execution), and an uncached Auth `/user` read failure records the
same safe cause separately. HealthKit code 3 means invalid argument only for
`HKErrorDomain`; legacy entries
remain numeric-only. The widget extension writes a bounded, timestamp-only
App Group file when `getTimeline` or `getSnapshot` reads the snapshot; the
watch Events page can read these provider receipts, and the export appends
them. A provider receipt proves a timeline/snapshot request, not a new face
rendering; absent receipts can also reflect a failed diagnostic write.
**Share logs** opens the watchOS system share sheet with a temporary `.txt`
attachment on request; it cannot pre-address Mail and never sends automatically.
Events and exports exclude credentials, account IDs, names, URLs, Health values
and raw error/server descriptions. Consumed/Burned use icons
without visible labels on the watch page; Net uses a balance-scale icon and the
same prominent number style. VoiceOver labels still name all metrics. The
Energy heading has a small `(kcal)` unit but no Today subtitle, and an icon-only
circular-arrow Refresh control sits before the last-synced time. A
missing backend energy row leaves burned and Net unavailable until an eligible
local Apple Health estimate is available; a missing component on an existing
row shows `—` but contributes zero to total. The compact rectangular
complication displays all values from a token-free snapshot; Net is computed,
not persisted. Its cutlery, fire, and custom two-pan balance icons alone are
green, red, and turquoise/teal; consumed and burned values use identical bold
type without visible “in/out” words. VoiceOver still names each value. The watch app, not its
rectangular WidgetKit complication, reads active/basal HealthKit energy and
syncs the last seven local dates to private `daily_energy` after explicit read
permission. It refreshes imported-note rows without replacing manual entries;
observer delivery and hourly-preferred watchOS background refresh are
best-effort, not guaranteed periodic uploads. `WatchRefreshSchedule` coalesces
duplicate preferred wake requests, asks for a 15-minute pending-delivery
fallback without counting it as a failure, and asks for 15/30/60-minute
backed-off retries after backend failure or transient profile validation
failure; a scheduled wake is not guaranteed. A delivered background
task requests its next preferred wake after account bootstrap but before energy reconciliation. On
background-to-active, the watch explicitly waits for the uncached account read
and refreshes Energy even if the account name is unchanged. The watch saves a
fresh token-free, today-only App Group snapshot after each successful backend
read. On an eligible HealthKit delivery it first reads local daily totals and,
only for a same-owner snapshot known to represent an imported or absent backend
row, saves a labeled provisional Health estimate and requests WidgetKit reload
when visible values change. Manual/edited or legacy unknown-provenance rows are
never locally overlaid. In the background it enqueues one seven-day, idempotent
GraphQL upsert via a file-backed watchOS background URLSession upload; Hasura's
conflict predicate updates only rows still labeled "Imported from Apple Health"
and skips manual conflicts. The SDK forces a refresh and owner-checks the
bearer before enqueuing; transient refresh fallback tokens with under ten
minutes left use the direct
path instead. Same-owner transfers deduplicate only while their recorded bearer
has over two minutes left; an expiry-less or near-expiry transfer is replaced
once a valid upload is ready. A deduplicated transfer still allows direct
reconciliation during that wake. Expiry, OS deferral and upload failures retain
pending work for best-effort retries. On a URLSession wake, upload result
handling restores the watch account before checking ownership and holds the watchOS task through follow-up
Health reconciliation, fresh backend read/snapshot (or retry scheduling), and
deferred reload; expiration releases the wake early. A different or blocked
owner's result is skipped, never applied. A completed upload still needs a fresh
backend read/snapshot before the pending marker clears; it is not proof of a
rendered complication.
WidgetKit reloads are requested only when display values or provisional status
change (or the snapshot is cleared). Background requests are coalesced to at
most one per 15 minutes in the watch app, while a suppressed latest-value
request is retained for another eligible wake/foreground return; foreground
changes and snapshot clearing bypass the gate. Neither requests nor provider
receipts prove the watch face updated. The rectangular widget shows relative
snapshot age and distinguishes a provisional estimate; an unchanged-value
backend read may not update that age until WidgetKit requests another timeline.
The widget has no Keychain or HealthKit access;
blocking auth changes/sign-out clear its snapshot. Watch App Group and HealthKit background-delivery signing
capabilities must be provisioned for physical-device validation. The watch
Info.plist must include **both** `NSHealthShareUsageDescription` and
`NSHealthUpdateUsageDescription` even though watch HealthKit access is read-only:
App Store Connect rejects a HealthKit-entitled watch bundle without the update
purpose string. The update string truthfully says NeoGym does not write Health
samples; the release verifier checks both keys in archive and IPA. A cold launch does not wait for local WCSession activation or `GET /user` to
show a restored session's cached profile; if a later phone hint blocks it, the
watch clears the profile/energy display and local session. Background work still
waits for local activation and account validation. Background-to-active cancels
any in-flight name read before refreshing the eligible session, including when
the view was first created in the background. An inactive wrist raise does not force a refresh. A
paired iPhone is required to install the companion, not to perform the watch's
independent network read.
The release scripts verify a signed archive and locally exported IPA before
any explicitly approved upload; archive/export requires Apple signing access
and any provisioning update requires its own per-run opt-in. No signed archive,
TestFlight processing, or paired-device acceptance can be inferred from
simulator/host checks. Phone account
hints contain only version/state/user ID and an opaque delivery ID on re-send,
never credentials or display name; known signed-out
or different-account state blocks the watch while unknown state allows independent
watch internet use. The watch model exposes non-actionable `.clearing` while a
blocking hint's session removal is pending; only after clearing finishes may
`.matchPhone` invite phone pairing. A later phone signed-in hint after explicit watch
sign-out also changes the prompt to `.matchPhone`.

The iOS package depends on the local Nhost Swift SDK at `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to `ios/NeoGym/` (normally `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Update `Package.swift` and docs together if that workspace assumption changes.

The production iOS app enables the SDK's persistent, managed-session-scoped
GraphQL response cache. Browsing list and display-detail queries use
stale-while-revalidate streams to show cached data before fresh backend data for
workouts, sessions, exercises, journal, foods, meals, nutrition plans/overview,
Body, and Energy; edit/form, HealthKit reconciliation, daily-intake, and widget
live-fetch queries stay network-only. The cache uses a 5-minute freshness window
and 7-day stale-if-error window. Mutations remain network-only; cached browsing
queries always revalidate against the backend, while their existing cached values
remain available for responsive rendering and offline fallback. Workout Progress
uses the sessions cache for server-calculated muscle-set and strength summaries. Each pane's SDK
stream revalidates the exact query key (180 local days by default, up to 366 for
extended history). Before a cold default-history stream, each pane probes today's
key then at most seven previous local-day 180-date keys through SDK cache-only
reads. The first eligible hit renders immediately with its actual displayed range
and a cached-through label for prior-day data, remains on refresh failure, and is
replaced/unlabeled on a current-key emission. Extended/custom requests stay
exact-key only, never substituting a shorter default snapshot. An already open
view retains and labels yesterday's rows through their date while refreshing on
foreground return, and labels previously displayed shorter history partial until
a wider request succeeds.
The SDK enforces managed-user scope and cache age; no app-owned snapshot is
saved. The SDK purges prior managed-user scopes on sign-out/session replacement. The
file cache is app-process-only; the widget client deliberately has no GraphQL
cache because the SDK requires each process to own a distinct cache directory.
Keep cache identity and authorization isolation in the SDK rather than adding
weaker app-owned local-storage keys.

The `NeoGymWidgets` extension contains both the rest timer Live Activity and the
medium Energy Balance widget. Energy Balance display math, captions, snapshot
DTO/store, and live-fetch/fallback orchestration live in host-testable
`NeoGymKit`. The app writes a token-free aggregate snapshot to the
`group.io.nhost.dbarroso.neogym` App Group only after a fresh backend Nutrition Overview
emission (never from an offline cached fallback) and clears/reloads it on
sign-out, definitive signed-out bootstrap, auth errors, and user switches. Nutrition mutations and Energy-list loads also ask WidgetKit to
reload timelines so the widget can take the live server-fetch path after
backend changes. The app and widget use the SDK's single
coordinated Keychain item (service `io.nhost.swift.session`, account
`default.nhostSession`, access group
`$(AppIdentifierPrefix)io.nhost.neogym.shared`) and App Group
`group.io.nhost.dbarroso.neogym`; the SDK derives the shared lock identity automatically
from the canonical Keychain item identity, and the app waits up to 5 seconds
while the widget waits up to 500 ms. There
is no private credential, mirroring, reconciliation, or token copy. App shared
configuration failure is a fatal provisioning error for this POC; widget
configuration, lock-timeout, cancellation, Auth, and network failures render the
token-free cached/empty fallback and never write a failed live result. The
widget never runs HealthKit import. WidgetKit timeline reloads and the
in-widget Refresh button are best-effort triggers for the live-fetch provider
path, not guaranteed freshness or cadence. At the widget extension's iOS 27
floor, AppIntent/`Button(intent:)`/`containerBackground` need no older-OS
availability gates; existing guards are vestigial, not a pattern for new code.

The native app uses the same email OTP auth shape as the web app for
sign-in/sign-up. `NeoGymKit` owns validators, `SignInModel`, `SignUpModel`,
`PhoneAssistedSignInModel`, `WatchAssistedSignInModel`, `WatchPATCredential`, `UserProfile`,
`ChangeEmailModel`, `AuthDeepLink`, `PKCEVerifierStore`, and the
`AuthServicing` boundary; iPhone SwiftUI views under `ios/NeoGym/App/` call
those models and route signed-in sessions into the full-screen `AppShellView`.
Watch SwiftUI views live under `ios/NeoGym/Watch/`; the rectangular watch
complication lives under `ios/NeoGym/WatchWidgets/`.
**Legacy iPhone shell (superseded by [UI design system](#ui-design-system-web--ios)).**
The navigation and chrome described in the rest of this paragraph is the
pre-redesign shell. Read it as current-state fact while migrating, not as rules;
the data, sync, caching and lifecycle behaviour it describes stays valid. The
**current iPhone** shell has no `TabView`: the three primary areas (Workouts, Nutrition, Me)
are hosted keep-warm as a ZStack of per-area `NavigationStack(path:)` views
keyed by `@State selection: AppDestination` (the active area is shown; the others
stay mounted but `opacity(0)`, `accessibilityHidden`, and non-interactive so each
area's stack path survives area switches). Areas are switched via a segmented
`Picker` shown at each area's stack root only. **Workouts (Phase 2a) is now a
hub:** its root is a native `List` of tappable glass rows
(Sessions/Workouts/Exercises/Progress) that push subsection routes
(`WorkoutsRoute.sessionsList`/`.workoutsList`/`.exercisesList`/`.progress`) via
`.navigationDestination(for:)`, each with its own `navigationTitle`; the area
segmented `Picker` lives in the Workouts hub's nav-bar **principal** slot, and
"New workout" lives on the `.workoutsList` route's own `.bottomBar`. Opening the
Workouts area and pulling to refresh its hub root also syncs the separate raw
HealthKit workout stream (`health_workouts`); that import does not create session
or template rows. Progress has a native Muscle sets / Strength segmented picker
(default Muscle sets), not a `TabView`. Both panes retain chart/scroll state after
first opening; Strength loads lazily and only the selected pane reacts to reloads
and foreground-day changes. Strength restores weekly volume plus recent-exercise
volume/e1RM charts using the owner-filtered `strengthProgress` root (migration
`1793029694424`), shared strength facts, and the existing empty
`exercise_strength_history_rows` shape; no raw sets are downloaded. It includes
templated/ad-hoc sessions and ordinary strength categories, including stretching.
The client only groups local weeks and selects exercises logged in the last ten
local dates; the first week can be partial at the history boundary. Muscle sets
reads the user-scoped `muscleSetProgress` Hasura function, not raw sets: Postgres counts one direct set per primary muscle and a
half set per distinct secondary muscle for strength-style sets with `reps > 0`,
excluding only `category = 'stretching'`; all other strength-style categories
remain eligible. Daily and rolling seven-local-day totals use the same rule.
Its descriptive list selects a muscle's weighted-set history chart;
ambiguous shoulders remain "Shoulders (unspecified)" alongside front, side, and
rear delts. It uses the SDK's sessions cache and requests 180 local days by
default, extending up to one year for older custom chart periods. The iOS
screen does not infer targets, RIR, or warm-up status. The database's tracked
`muscle_set_progress_rows` return-shape table is empty (not a cached summary),
and the function enforces the injected Hasura session's user ID before joining
private sessions. The local-only `1790000570001_progress_recent.sql` seed supplies 91 moving-window sessions (1,911 sets including 91 zero-rep entries) for the dev user; it advances only on fresh local reset/reseed, and the backend suite verifies its Progress totals. Public catalog shoulder corrections are made in migration
`1790000570000` for existing databases and the exercise seed for new ones;
uncertain exercises keep the `shoulders` value. Follow-up migration `1792997064993_reviewed_secondary_targets` corrects secondary associations for nine reviewed public exercises (presses, Hammer Curls, pulldown, row, Barbell Ab Rollout, and three lower-body movements), mirrored in the seed; it preserves primary targets and private exercises. Barbell Ab Rollout adds lats without replacing its other secondaries. See `docs/developers/exercises.md` for the changes and deliberately unaddressed custom-exercise cases. The read-time `strength_set_report_facts` view centralizes reps, volume (per-side `double_weight` multiplier) and per-set Epley; the tracked `workoutStrengthReport` and `exerciseStrengthReport` root functions expose owner-filtered session points through Hasura **and Constellation** via empty return-shape tables (migrations `1790000580000`/`1790000590000`, details in `docs/developers/sessions.md`). Nested `workouts.strengthHistory` and `exercises.strengthHistory` computed fields share the SQL and appear in both checked-in Hasura and Constellation user SDLs; app reports continue to use the roots' local-day contract. The configured Constellation version lives in `backend/nhost/nhost.toml`; checked-in SDLs or an already-running service do not prove a newly configured binary's compatibility (see the schema-verification guidance in `docs/developers/sessions.md`). The workout grouping follows the session's current nullable `workout_id`; exercise points expose best per-session e1RM, using recorded weight for single reps and Epley for 2+ reps, never doubling e1RM. Existing web charts and native exercise-detail charts mirror that formula locally until switched to server report fields. On a session detail with strength
entries, the totals are followed by the three most
recent earlier sessions still linked to the same workout template (ad-hoc
sessions have no same-workout comparison). No area uses
`SecondarySectionContentHost` or `SectionTitleMenu` anymore (both, along with
`AppAreaSwitcher` and the interim `.safeAreaInset` switcher, are deleted). The
`pendingSessionId` deep link is consumed at the `WorkoutsSectionNavigationView`
root so a pending session opens regardless of which subsection is showing.
**Nutrition (Phase 2b) is now a hub too:** its root is a native `List` of
tappable glass rows (Overview/Days/Plans/Foods/Meals/Body/Energy) that push subsection-list
routes (`NutritionRoute.overview`/`.daysList`/`.plansList`/`.foodsList`/`.mealsList`/`.bodyList`/`.energyList`)
via `.navigationDestination(for:)`, each with its own `navigationTitle`; the
area segmented `Picker` lives in the Nutrition hub's nav-bar **principal** slot,
and New plan/food/meal, Log measurement, and Log energy live on their subsection
list's own `.bottomBar`. Energy hosts the daily active/resting kcal CRUD list and trend under the
Nutrition hub; opening or refreshing it reads the backend only. The Overview
screen (a pushed route) is a dashboard: on load and pull-to-refresh it reads
Energy from the backend and auto-syncs Body measurements from HealthKit;
it revalidates the backend overview and charts after sync when Body rows
changed or when a refresh/Retry was requested while the sync was pending.
The iPhone does not request active/resting HealthKit energy access or upload
energy; the watch app owns that import. Cached chart data can render
during Body sync. On a cold launch across a local-day change,
the default charts first read today's and up to seven earlier exact ranges from
the SDK's user-scoped, age-bounded cache without network calls; any previous-range
fallback is labeled as missing newer dates until the current-range refresh
succeeds. No app-owned cache keys or chart snapshots are stored. The dashboard shows Energy balance,
Calories consumed, and Body composition trends. Both charts default to the
last 14 local days and query only their selected period plus six warm-up days
for rolling averages. The Calories consumed chart uses a separate date-bounded
snapshot-kcal/grams + daily-energy query (not the detailed overview/day-list
query), and Body composition uses a date-bounded measurements query; changing
a chart period or custom dates loads that range on demand. Body HealthKit
reconciliation scans history once per app user/timezone, then uses per-type
anchored changes to recheck added-sample dates or the recent deletion window,
independently of chart ranges. Cursors advance after successful backend
reconciliation; an empty initial read is not checkpointed because HealthKit read
denial is opaque. It
creates missing dates and refreshes recent rows that still carry the exact
"Imported from Apple Health" note. Each metric whose first read is empty stays
unanchored and retries its history even when the other metric has samples; an
anchored type with no events retains its cursor if access was revoked. On any
sync with one type unanchored and affected dates, both types are re-read across
one bounded range per type. Cursors live under `body-health.anchor.v2.<userId>`;
the previous `body-health.anchor.v1.*` paired key is ignored if present.
Reported HealthKit deletions re-read the last seven local Body dates to
correct recent imported rows when another sample remains; older dates and
fully emptied days are not cleared. Watch energy sync remains limited to the
last seven local dates; iPhone energy views do not sync
it. It does not show the old intro copy or recent daily-log list.
`NutritionDaysView` no longer takes a `selectedDate` binding. After a create
the shell replaces only the top create route with the new detail route so Back
returns to the subsection list, not the hub.
**Me is now a hub too:** its root is a native `List` of tappable glass rows
(Profile/Journal) that push subsection-list routes (`MeRoute.profile`/`.journalList`) via
`.navigationDestination(for:)`, each with its own `navigationTitle`; the area
segmented `Picker` lives in the Me hub's nav-bar **principal** slot, and New
entry lives on the `.journalList` subsection list's own `.bottomBar` via
`RootPrimaryActionToolbar`. After a create the shell appends only the new detail
route (the create view's `dismiss()` already popped the create route) so Back
returns to the subsection list, not the hub. All three areas (Workouts/Nutrition/Me) are hubs;
there is **exactly one bottom band** holding create/log, the rest timer, and
detail actions, and no tab bar. Pushed form routes put Cancel in the top-leading
`.cancellationAction`, Save in the top-trailing `.confirmationAction`, and
destructive Delete as a full-width `FormDeleteButton` in the form's scroll
content (no top-trailing overflow menu). Detail routes that can delete (e.g.
session detail) use the same in-content `FormDeleteButton` at the bottom of
their scroll content, not a bottom-bar or overflow action. In the nutrition day
view the logged intake rows (food entries and logged meal groups) have no inline
Edit/trash buttons — the whole glass row is tappable to open its modal edit
sheet, and each edit sheet (`EditLogEntrySheet`/`EditMealGroupSheet`) holds its
own Delete as a native destructive `Button(role: .destructive)` in a trailing
`Section` (like the strength/cardio editors) wired to a confirm dialog. Pushed
detail routes otherwise use native bottom toolbar actions (`.bottomBar`,
confirmation/destructive roles where appropriate); a session detail's single
`.bottomBar` holds the rest timer as its **leading** item, a `Spacer()`, then
"Add exercise" trailing (no Delete in the bar, no overflow menu). The rest timer
is a shell-owned `@StateObject RestTimerController` (survives area switches and
drill navigation) injected down into `WorkoutsSectionNavigationView` →
`SessionDetailView`, which renders `RestTimerToolbarControl(timer:)` in that
leading bottom-bar slot. With no tab bar there is no minimized tab pill, so a
leading bottom-bar control cannot be covered. Root list pages rely on standard
navigation-title spacing and native safe-area insets; do not add custom dock
clearance constants or extra bottom padding for custom bottom chrome. Reduce
Motion should suppress custom section scaling polish while preserving native
navigation structure. Sheet-local `NavigationView` wrappers remain intentional
for modal editors/pickers. The target shell uses a native `TabView` with
`.tabViewBottomAccessory` for the live session and rest timer (see UI design
system). Still do not reintroduce `SectionTitleMenu`,
`SecondarySectionContentHost`, `AppAreaSwitcher`, the interim `.safeAreaInset`
area switcher, older OS fallbacks, UIKit parent-chain tab-bar hiding, the removed
`.hidesBottomTabBarWhenPushed()` alias, custom dock chrome, or new hidden-link
navigation. Sign-out must always call `clearSession()` after attempting remote
sign-out so local persisted sessions are removed even when the network request
fails. SwiftUI previews can set Dynamic Type with
`.environment(\.dynamicTypeSize, ...)`, but Xcode 17 treats
`accessibilityReduceTransparency` and `accessibilityReduceMotion` as read-only
environment values; verify those modes in simulator Accessibility settings rather
than trying to force them in preview code. Native email change uses app-side PKCE with
`redirectTo = "neogym://verify"`, a Keychain-backed verifier, `.onOpenURL`
deep-link handling, token exchange, and verifier clearing on all callback
outcomes. The native callback is allowed by `auth.redirections.allowedUrls` in
both `backend/nhost/nhost.toml` and the production overlay; restart the local
Nhost stack after redirect config edits because the CLI does not hot-reload
`nhost.toml`.

### Backend tests — the rule

**Always run `make test` after a backend change**, the same way `bun run check` is the gate for frontend changes. "Backend change" means anything under `backend/nhost/migrations/`, `backend/nhost/metadata/`, `backend/nhost/seeds/`, or `backend/nhost.toml`. Don't report the task done until the tests pass.

**Add new tests when you change the backend in a way that's already covered by the suite, or when you introduce a new invariant.** The backend suite includes `backend/tests/kind-enforcement.test.ts` for workout/exercise invariants, `backend/tests/nutrition.test.ts` for nutrition permissions, snapshots, provenance, and cascade behavior, and `backend/tests/daily-energy.test.ts` for `daily_energy` ownership, CHECK, range, UNIQUE, and root-field invariants. `backend/tests/muscle-set-progress.test.ts` checks shoulder mapping, fractional counts, local-day windows, seeded recent-session totals, and cross-user isolation. `backend/tests/strength-reporting.test.ts` checks empty return-shape tables, seeded workout/exercise history agreement, per-side volume, single-rep versus Epley e1RM, local-day ranges, and owner isolation across Hasura-direct and Constellation queries. The kind-enforcement file is organized into describes by concern:

- **kind discriminator** — that `exercises.kind` is generated correctly from `category`, the sidecar relationships resolve, and the sync trigger on `workout_session_exercises` populates `kind` from the parent exercise.
- **composite-FK enforcement** — that strength sets can't attach to cardio session-exercises (and vice versa), and that the sync trigger can't be bypassed by a client passing a wrong `kind`.
- **cardio metrics-schema validation** — that `pg_jsonschema` rejects malformed cardio metrics and accepts valid ones; that valid strength sets / cardio entries insert cleanly.
- **user-role permissions** — that the FK chain `child → workout_session_exercise → workout_session → user` is enforced as a security boundary: foreign users can't insert or read into another user's session, and `kind` is excluded from the user-role insert allowlist on WSE. Uses the `gqlAsUser(userId, query, vars)` helper to forge `x-hasura-role: user` + `x-hasura-user-id`.
- **category-flip cascade integrity** — that flipping `exercises.category` between cardio and strength fails when child rows exist (the pinned `parent_kind` CHECK rejects the cascade). This is the hardest invariant to spot from the code alone, so when you touch the kind discriminator, composite FKs, or `parent_kind` CHECKs, **add or extend a test in this describe block**.

When adding tests, follow the existing patterns: the `gql(...)`/`gqlAdmin(...)` helpers for admin-level checks, `gqlAsUser(...)` for user-role assertions, and self-contained fixtures (each test inserts what it needs with unique names or numbers — don't depend on test ordering). The local `backend/tests/bun-test.d.ts` declarations expose a small Bun API subset; use loops registering `test(...)` cases and standard matchers for table-driven tests unless intentionally expanding that shim. For negative missing-mutation assertions, first verify the exact root exists in admin introspection so a misspelling cannot pass as a permission denial (a table's `custom_name` alone can leave the default `insert_` prefix). `hasuraReachable` is set in `beforeAll`; data-dependent tests start with `if (!hasuraReachable) return;`, while the reachability smoke test intentionally fails when the NeoGym Hasura stack is unavailable so missing/wrong local environments are not reported as passing. **If you add a new permission, FK, trigger, or CHECK that encodes a security or integrity invariant, write the corresponding negative test** — the metadata YAMLs and migrations are the rules; the tests are the proof.

A note on **applying metadata edits to the running DB**: Nhost CLI doesn't hot-reload YAML changes. After editing under `backend/nhost/metadata/`, either restart with `make dev-env-down && make dev-env-up` (destroys local data), or push the change through Hasura's metadata API (`pg_drop_*_permission` + `pg_create_*_permission`, or `replace_metadata`). For schema-only changes via run_sql, use the v2 query endpoint. Then re-run `make test` and frontend `bun run codegen` if user-role visibility changed.

## UI design system (web + iOS)

The source of truth for screens is the **"NeoGym — Unified UI"** Design canvas: <https://claude.ai/artifact/MPsT7eQ33DM1Sob54h9qeu> (private to David until shared). Its *Foundations* page holds the navigation model, tokens and components; the *iOS* page has 22 screens and the *Web* page 13 pages, all drawn with real data. This section supersedes every earlier design note in this file (the old iOS glass/aurora theme, the 3-area segmented iPhone shell with hub lists, the 8-item web navbar). Where an older paragraph describes the legacy UI, treat it as current-state fact for migration, not as a rule. When you migrate a screen, follow this section and update **Migration status** at the end.

### Principles

- **One information architecture, native chrome per platform.** The same areas and sections, in the same order and with the same names, on web and iOS. iOS uses SwiftUI system components; the web uses the shadcn primitives in `src/components/ui/`.
- **Feature parity by default.** A feature shipped on one platform gets a design on the other. The exceptions are capability-bound: Apple Health / Apple Watch import stays iOS-only, and the web shows imported data read-only with an "Apple Health" tag.
- **Data first, calm surfaces.** Content sits on plain surfaces. No grid or aurora backgrounds, gradient washes, emoji, or left-border accent cards. On iOS, glass/material is only for system chrome (tab bar, toolbars, bottom accessory, sheets), never for content cards.
- **Few taps in the gym.** Logging a set, a planned nutrition slot or a measurement takes at most two taps from the area root.

### Information architecture

| Area | Sections, in order | Web routes |
|---|---|---|
| Today | — | `/today` (signed-in `/` lands here) |
| Train | Sessions · Workouts · Exercises | `/train/sessions`, `/train/workouts`, `/train/exercises` (+ `/$id` detail; exercise pages always live under `/train/exercises/$id`) |
| Nutrition | Log · Plans · Foods · Meals | `/nutrition/log/$date` (`/nutrition` opens today), `/nutrition/plans`, `/nutrition/foods`, `/nutrition/meals` |
| Progress | Muscles · Strength · Body · Energy | `/progress/muscles`, `/progress/strength`, `/progress/body`, `/progress/energy` |
| Me | Journal · Account | `/me/journal`, `/me/account` |

Every signed-in URL starts with its area (`/train`, `/me`, …); area roots redirect to their first section. The pre-redesign URLs (`/sessions`, `/journal`, `/profile`, `/body`, `/nutrition/days/…`) were removed without redirects.

Today replaces Nutrition › Overview: today's training, nutrition so far against the selected plan, yesterday's energy balance and the body trend. The nutrition Days list is replaced by the Log section's date strip/date picker.

### Shell mapping

| Element | iOS (SwiftUI) | Web ≥ 768 px | Web < 768 px |
|---|---|---|---|
| Top-level areas | `TabView`, 5 tabs, each with its own `NavigationStack(path:)` | Left sidebar, 232 px, 5 items | Bottom tab bar, 5 items, no horizontal scroll |
| Sections in an area | Segmented `Picker` under the large title on the area root | Segmented tabs in the page header | Same tabs, full width |
| Primary create/log | Glass `+` toolbar button, top trailing | Primary button, header right | Icon button, header right |
| Live session + rest timer | `.tabViewBottomAccessory`, visible on every tab while a session is open or a rest timer runs | Rest timer card above the account row while running | Rest timer pill pinned above the tab bar while running |
| Detail | Push in the tab's stack | List + detail split from 1100 px; full page below | Full page with back link |
| Create / edit | Sheet, large detent; Cancel leading, Save trailing | Full page; Cancel + Save in a sticky header | Full page; sticky Save |
| Quick entry (set, food, cardio entry) | Inline row, or sheet at medium detent | Inline row, or dialog | Inline row, or bottom sheet |
| Delete | Destructive button at the end of content + confirmation dialog | Same + alert dialog | Same |

- The rest timer stays shell-owned (one `RestTimerController` on iOS, one provider on the web) so it survives tab/area switches. Logging a set starts it; the accessory/card/pill offers +30 s and Skip. Tapping the web timer's clock/context opens the session that started it; those actions remain separate buttons. The iOS target accessory also shows the live session and opens it on tap. Web sessions have `startedAt` but no open/finished state, so the web shell shows only a running rest timer, not a separate live-session indicator.
- Each iOS tab keeps its own navigation path when you switch tabs. Deep links (e.g. a pending session id) select the Train tab and push the session.
- The web `replace: true` rule for spent forms/pickers (see Conventions) still applies.

### Tokens — dark is the default

| Token | Dark (default) | Light |
|---|---|---|
| Background | `#09090B` | `#F4F4F6` |
| Surface (cards, rows, sheets) | `#18181B` | `#FFFFFF` |
| Inset (tiles inside cards) | `#202024` | `#F7F7F8` |
| Fill (segmented track, secondary buttons, chips) | `#27272A` | `#EDEDF0` |
| Segmented thumb | `#3F3F46` | `#FFFFFF` |
| Separator / border | `#2E2E33` | `#E4E4E7` |
| Text | `#FAFAFA` | `#18181B` |
| Text secondary | `#A1A1AA` | `#52525B` |
| Text tertiary (captions on surface only) | `#8B8B94` | `#6A6A73` |
| Accent fill (buttons, selection, bars) | `#3463E0` | `#3463E0` |
| Accent text, links, chart lines | `#6E93FF` | `#3463E0` |
| Accent soft (selected tab pill, tags) | `#1E2A4D` | `#E9EFFD` |
| Series 2 (carbs, active energy; fills only) | `#F5A35A` | `#EE8A2A` |
| Positive | `#4ADE80` | `#15803D` |
| Destructive | `#F87171` (text) / `#DC2626` (fill) | `#DC2626` |

- **Appearance** is Dark (default) / Light / System on both platforms, under Me › Account. iOS applies it with `.preferredColorScheme`; the web theme provider defaults to `dark`.
- **Accent** is `#3463E0`, replacing the `#4373F4` AccentColor asset, because white labels on it pass 4.5:1 (5.2:1). On dark surfaces, text-coloured accent uses `#6E93FF` (6.1:1).
- **Where tokens live.** Web: shadcn CSS variables in `src/styles.css` (`--background`, `--card`, `--primary`, `--muted`, `--muted-foreground`, `--border`, `--chart-1`, `--chart-2`, …) for both `.dark` and light. iOS: asset-catalog colours with Any/Dark variants exposed through `NeoGymTheme`. Never hard-code hex values in views.
- **Retired.** Remove `grid-bg`, `GridBackground`, the aurora gradients and glass-panel content styling as screens migrate.

### Type, shape, spacing

- **iOS:** SF Pro with Dynamic Type styles — Large Title (34, bold) on area roots, Title 2 for detail titles, Headline / Body / Subheadline / Footnote for content.
- **Web:** Inter — page title 28 bold, section 18 semibold, row title 15 semibold, body 15, secondary 14, caption 12.
- **Numbers:** every metric uses tabular figures (`font-variant-numeric: tabular-nums`, `.monospacedDigit()`).
- **Radius:** iOS cards 22, controls 12–14, pills fully rounded. Web cards 14, controls 9–10.
- **Spacing and targets:** spacing steps 4 / 8 / 12 / 16 / 20 / 24 / 32. Touch targets are at least 44 pt.

### Patterns

- **Session logging.** Exercises are cards in session order. Completed exercises collapse to one summary line (weight × reps per set). The active exercise lists its logged sets and an inline next-set row, prefilled from the previous set, with weight and reps steppers and a Log button. Every exercise shows "last time" from its most recent logged occurrence strictly before the current session: prefer the same workout, falling back to earlier exercise history when that workout has none (always exercise history for ad-hoc sessions). Skip occurrences with no sets/entries before limiting history; the selected reference also drives status and automatic collapse. Tapping a logged set opens it to edit or delete. Cardio entries use a sheet or dialog generated from the exercise's metrics schema, with required fields first. Session totals (sets, reps, volume) sit under the title; earlier sessions of the same workout and Delete sit at the end.
- **Nutrition day.** A time-slot timeline: logged slots are solid; planned slots from the day's selected plan are dashed and have one Log action per slot. Tapping a logged row opens its edit sheet. The day summary shows kcal against planned, P/C/F bars (protein accent, carbs series 2, fat secondary text colour) and energy out so far.
- **Lists.** One title, one metadata line, one trailing value. Show a chevron only when the row pushes.
- **Charts.** No chart border; grid lines in the separator colour. Series 1 is accent and series 2 is orange (they differ in lightness, not only hue). Daily values are grey with the 7-day average in accent; reference lines are dashed tertiary. Every chart has an accessible label that states the trend.
- **Health data.** Always show the source: an "Apple Health" tag on web rows, a sync-status row on iOS. Never imply the web can trigger an import.
- **States.** Empty, loading and error states are not designed yet. Use `src/components/patterns/query-states.tsx` on the web and `AppStateViews` on iOS until they are.

### Accessibility

- Text contrast is at least 4.5:1 in both themes (the tokens above are checked); non-text UI is at least 3:1.
- Use real buttons, links and labelled inputs. Icon-only buttons need an accessibility label.
- Colours that must be told apart also differ in lightness.
- Respect Dynamic Type, Reduce Motion and Reduce Transparency on iOS.

### Migration status

- **Web: all five areas migrated; shell/form migration incomplete.** Where things live and remaining gaps:
  - Navigation model: `src/lib/navigation.ts` (`AREAS`, sections, `isSectionLanding`). The shell is `src/components/shell/` — `AppFrame` (sidebar ≥ 768 px, `MobileTabBar` below, breadcrumbs only on pages deeper than an area tab), `AreaTabs` for the header section tabs.
  - Tokens: `src/styles.css` (dark default via `.dark`, light in `:root`); `DEFAULT_THEME = "dark"` in `src/lib/theme/theme-provider.tsx`. Appearance and the default rest length are set under Me › Account.
  - Split views (Sessions, Workouts, Journal): a pathless `_split` layout (e.g. `routes/_authed/train/workouts/_split.tsx`) renders the list and an `<Outlet />`, declares `staticData: { splitView: true }`, and its index route opens the first item from 1100 px (`useIsSplit`). Detail routes live in `_split/`; create/edit pages sit beside `_split` (`train/workouts/new.tsx`, `train/workouts/$workoutId/edit.tsx`) so they render full page. Index panes must not auto-select stale list data while revalidation is fetching, paused, or failed, since it can still contain deleted records. Fresh cached lists and idle lists whose last fetch succeeded remain usable, even after `staleTime` passes; aging alone must not hide the empty state or prevent auto-selection after widening.
  - Rest timer: `src/lib/rest-timer.tsx` (`RestTimerProvider`, mounted by `AppFrame`), shown by `RestTimerCard` (sidebar) and `RestTimerPill` (mobile). Logging a set or starting a rest from the session header records its `sessionId`; tapping the clock/context links back to that session, while +30 s and Skip do not navigate. The link uses a screen-reader-only "Open session:" prefix, not an overriding `aria-label`, so the card's Rest/next-set context is part of its accessible name. Browsers such as Chromium omit the `role="timer"` countdown from that name, though it remains in the link's content. The localStorage state retains `userId`, `endsAt`, `duration`, `label`, and nullable `sessionId`. Only a matching signed-in owner can restore it; ownerless legacy timers and different-owner timers are discarded. The shell keys the provider by user ID so switching accounts also cancels the old in-memory timer and expiry toast. Same-owner timers without a session id still restore with no link, and the default rest length remains a device-wide preference. There is no separate web live-session indicator because sessions have no open/finished state.
  - **Outstanding form migration:** no create/edit page has the target sticky Cancel/Save header (≥ 768 px) or sticky Save (< 768 px); Cancel/Save sit at the bottom of the form. Journal, Body and Energy pages use `FormCardShell` with the shared `FormActions`; Workouts, Foods, Meals and Plans pages use a plain `Card` and render their own Cancel/Save buttons in `workout-form.tsx`, `food-form.tsx`, `meal-form.tsx` and `nutrition-plan-form.tsx`, so making `FormActions` sticky alone will not migrate them. The Journal, Body and Energy create pages also retain the legacy “Tracking” eyebrow (e.g. `routes/_authed/me/journal/new.tsx`).
  - Shared presentation: `src/components/patterns/metrics.tsx` (`SectionCard`, `StatTile`, `MeterBar`, `RingMeter`, `Sparkline`), `patterns/segmented.tsx`, and `patterns/query-states.tsx`.
  - Today revalidates its aggregate overview on every mount, even within the app-wide 30-second query freshness window; cached cards remain visible while the request runs. This keeps return visits fresh without relying solely on writer-side invalidations. An overview failure offers Retry without loading skeletons; if cached data exists, its cards remain visible alongside the error.
  - Progress › Muscles and Strength read the `muscleSetProgress` / `strengthProgress` roots with the browser time zone. All four Progress sections use `src/lib/chart-trend.ts` to name their charts with each plotted series' endpoints, units, and overall change (not a fitted trend). Missing values are omitted per series, not treated as zero; single observations explicitly have no trend yet. Recharts summaries label the interactive SVG directly so its keyboard/tooltip accessibility stays available; Strength sparklines use their image labels.
  - Nutrition day navigation is `src/components/nutrition-day-navigator.tsx` (prev/next, native date picker, week strip with logged kcal); the old Days list is gone.
  - The next-set row uses `patterns/number-stepper.tsx` (weight ±2.5 kg, reps ±1).
  - Imported Body and Energy rows are recognised by the exact note "Imported from Apple Health" that the iPhone and watch importers write; `src/components/health-source-tag.tsx` shows the tag and hides that note.
- **iOS: not started.** The app still runs the legacy 3-area segmented shell with hub lists described in the iOS paragraph above.
- Update this list as areas migrate.

## Conventions

- **Path alias**: `@/*` → `frontend/src/*`. Wired in `tsconfig.json` (paths) and `vite.config.ts` (`resolve.alias`).
- **File-based routing**: any new file under `src/routes/` is a route. The router plugin regenerates `src/routeTree.gen.ts` when the dev server boots — never edit that file by hand. If `bun run check` reports the generated file is missing in a fresh workspace, generate it first (for example by starting the dev server once); the file is ignored and should not be committed. Pathless layouts use the `_name.tsx` + `_name/` directory pattern (see `_authed`).
- **Forms**: react-hook-form + zod via `@hookform/resolvers/zod`, rendered through `@/components/ui/form` shadcn primitives.
- **Toasts**: `sonner` mounted at root in `__root.tsx`; call `toast.error(...)` etc. from anywhere.
- **Component tiers**: `src/components/ui/` stays generic shadcn-style UI with no NeoGym product semantics. `src/components/patterns/` holds narrow app/product presentation patterns (page shells, headers, query states, form sections/actions, confirm dialogs, picker/dialog footers, ordered-row chrome) with slots/children and no domain imports. Domain components/routes keep GraphQL documents, mutations, validation, navigation, and domain-specific behavior; do not hide them behind a generic CRUD framework.
- **shadcn components are hand-written** under `src/components/ui/`. The `bunx shadcn add` CLI was deliberately *not* used. To add a new primitive, copy from <https://ui.shadcn.com> and adjust the `cn`/import paths to `@/lib/utils`.
- **Biome** is the only formatter/linter. ESLint and Prettier are not used. CSS parser has `tailwindDirectives: true` so `@theme inline`, `@utility`, `@custom-variant` parse cleanly.
- **DOM integration tests** run Happy DOM fixtures in isolated Bun subprocesses so module mocks and browser globals cannot leak into other tests. For browser timer spies, narrow the target to the DOM `Window` interface; `typeof globalThis.window` also includes Bun/Node timer overloads with incompatible handle types. Wait for query-backed child widgets' own data before asserting it: the nutrition week strip query starts only after the parent day query renders its children. See `frontend/scripts/nutrition-timeline.fixture.tsx` for a controlled clock that exercises the rendered Today and day-log components without a backend. Infinite-query fixtures seed the cache with `{ pages, pageParams }`, but a mocked `gqlRequest` must return a single GraphQL page, not that cache wrapper (see `frontend/scripts/split-index-selection.fixture.tsx`). For fixtures that can exceed Bun's default 5-second test budget, set an explicit `test` timeout longer than the subprocess timeout; `Bun.spawnSync`'s timeout does not extend the enclosing test's budget. GraphQL argument assertions using Node's strict deep equality should normalize `valueFromASTUntyped`'s null-prototype objects with `structuredClone`. Assert query-cache errors explicitly for optional history queries, whose failures intentionally leave the UI usable and could otherwise hide a broken fixture.
- **Auth state** lives client-side in `lib/nhost/auth-provider.tsx`. The Nhost client uses localStorage by default; SSR renders see `user = null` and `isAuthenticated = false`. Protected routes (`_authed.tsx`) redirect via `useEffect`, not `beforeLoad`, because the SDK's session storage is browser-only.
- **Auth methods**: sign-in and sign-up use `nhost.auth.signInOTPEmail` / `signUpOTPEmail` + `verifySignInOTPEmail` (6-digit codes; no email link, no password). `auth.method.emailPasswordless` is disabled and `auth.method.otp.email` is enabled in `nhost.toml`. Change-email (in `_authed/me/account.tsx`) is the one PKCE flow: it generates a verifier with `generatePKCEPair()` from `@nhost/nhost-js/auth`, stashes it in localStorage under `PKCE_VERIFIER_STORAGE_KEY` (`@/lib/nhost/pkce`), calls `nhost.auth.changeUserEmail({ codeChallenge, options: { redirectTo: ${origin}/verify } })`, and the user clicks the email link. The link routes through Hasura Auth to `/verify?code=...`, where `routes/verify.tsx` exchanges the code via `nhost.auth.tokenExchange({ code, codeVerifier })`. The session middleware (`updateSessionFromResponseMiddleware`) auto-persists the new session because `/token/exchange` matches its URL filter — don't manually `sessionStorage.set`. The verifier is removed from localStorage in the route's `finally`. Any subpath of `auth.redirections.clientUrl` is accepted as a `redirectTo` target by default, so per-route entries (e.g. `/verify`) don't need to be listed. Redirects to a different host/port or scheme must be added to `auth.redirections.allowedUrls` in both `backend/nhost/nhost.toml` (local-dev baseline) and `backend/nhost/overlays/<project-id>.json` (production overrides applied as JSON Patch at deploy time); the native iOS callback currently uses `neogym://verify`.
- **GraphQL data flow**: queries/mutations are authored inline via the typed `graphql(...)` template tag. Operations are sent through the `gqlRequest` helper in `src/lib/graphql.ts`, which is what `@tanstack/react-query`'s `useQuery` / `useMutation` calls.
- **`bun run codegen` is a two-step pipeline** — both outputs are checked in and neither should be edited by hand:
  1. `codegen:graphql-schema` (needs backend up) runs `backend/gen.sh` with the Nhost CLI from the Nix devshell. For the supported GraphQL roles (`admin`, `user`, `public`; Auth's `me` role has no metadata permissions), `nhost schema dump` introspects both `https://local.hasura.local.nhost.run/v1/graphql` and `https://local.graphql.local.nhost.run/v1/graphql` with the explicit role and admin secret. It writes `backend/schemas/schema.hasura.<role>.graphqls`, `schema.nhost.<role>.graphqls`, and a structural `schema.<role>.diff` via `nhost schema diff`. Outputs resolve relative to the script, not the caller's cwd, and replace the previous snapshots only after every dump/diff succeeds. The same script is available as `make schema` from `backend/`. Defaults are local; `NHOST_SUBDOMAIN`, `NHOST_REGION`, `NHOST_ADMIN_SECRET`, and `DST_PATH` can override the connection/output settings (set the secret explicitly for non-local targets). The canonical app SDL is `backend/schemas/schema.nhost.user.graphqls`; the old `frontend/schema.user.graphqls` copy is removed. Consult the canonical SDL before writing a new `graphql(...)` document. Generate SDL only through this pipeline to avoid ad-hoc ordering/directive churn.
  2. `codegen:graphql` (offline) feeds `backend/schemas/schema.nhost.user.graphqls` plus your `graphql(...)` documents into `graphql-codegen` and writes TypeScript types + the typed `graphql()` tag to `frontend/src/gql/`. Because step 2 reads the user-role SDL, the generated types only expose what permissions actually allow — operations that admin can run but `user` can't will fail to typecheck.
- **Re-run `bun run codegen` after any change that affects what the `user` role can see**: editing a `graphql(...)` document, applying a Hasura migration (database schema), editing Hasura metadata (permissions, relationships, exposed columns), or pulling someone else's metadata/migration changes. This includes body-style metric tables such as `daily_energy` and query additions such as the daily-intake `dailyEnergyEntries` balance selection. Stale outputs cause confusing type errors and "field not found" runtime failures.
- **Nutrition GraphQL/logging shape**: meal logging should use one nested `insertNutritionLogMeal` with child `nutritionLogEntries`, and each child must explicitly include the same `nutritionDayId` as the parent group. Hasura nested inserts populate `nutritionLogMealId` but not the direct day FK used by permissions/composite same-day enforcement. Individual planned-entry log time is user-selected, user-correctable, defaults to now, and must not blindly copy the template slot: planned-meal logging may keep `nutritionPlanMealId` as provenance, and direct plan-food logging should use a standalone food-backed `insertNutritionLogEntry` with matching `foodId` + `nutritionPlanFoodId` (never grouped under `nutritionLogMealId`; deleting the plan/direct-food slot nulls provenance while snapshots remain). Day logging only shows selected-plan tabs/segments, suggestions, and actions when `nutrition_days.nutritionPlanId` resolves to a plan; no selected plan means no plan logging UI. Selected-plan suggestions are grouped by normalized slot time. Clients no longer expose a whole-plan `Log selected plan` action; each selected-plan time slot has its own `Log` action that logs every planned meal/food in that slot in one combined mutation. Normal slots log at their plan slot time, legacy no-time slots default to now, every entry in the slot receives that slot's logged time, empty planned meals fail the slot all-or-nothing before sending, and re-logging appends duplicates just like individual logging. On the web day timeline, every selected-plan slot stays visible with its **Log slot** action even beside same-time logged intake; the plan picker lives in the day summary rail. Today's **Next in plan** is clock-based (updated once a minute and on focus/visibility changes), not a logged/done-state filter. Plan detail and plan editor screens group mixed meal/direct-food plan entries by normalized slot time; move controls are enforced slot-local, and cross-slot moves happen by editing the row time before the existing sorted/renumbered submit shape is saved. Ad-hoc one-off logs use standalone `source: "ad_hoc"` entries with no `foodId`, `nutritionPlanFoodId`, or `nutritionLogMealId`, and must send name plus kcal/fat/carbs/protein/fiber/sugar snapshot fields per 100g. Standalone entries store their own editable `slotTime`; grouped entries display the parent logged meal's editable `slotTime`. Daily nutrition totals and calories-in/out balance should be computed from logged `snapshot*Per100g` columns, not live `foods`; balance output comes from same-date `daily_energy` and remains read-only.
- **Form/picker navigation must use `replace: true`**: When a form submit, cancel, picker selection, or delete handler redirects away from a "spent" page (e.g., `/train/workouts/$id/edit` → `/train/workouts/$id` after save *or* cancel, `/train/workouts/$id/edit` → `/train/workouts` after delete, `/train/workouts/new` → `/train/workouts` after cancel), pass `replace: true` to `navigate(...)`. Without it, the now-spent form/picker (or the just-deleted record's detail page) stays on the history stack and the back button lands on it instead of the previous screen. A cancelled form is "spent" in the same way a submitted one is — the user explicitly abandoned it. Same rule for redirects out of invalid states (e.g., the non-owner bounce in `train/workouts/$workoutId/edit.tsx`) — the user was never meant to see that page, so don't leave it in history. Auth-flow redirects (`signin`/`signup` → `/`, which opens `/today`) are a separate case and have their own logic.
- **Primary navigation (web)**: five areas — Today, Train, Nutrition, Progress, Me — in a left sidebar from 768 px and a five-item bottom tab bar below it, with no horizontal scrolling. Sections inside an area (Train: Sessions/Workouts/Exercises; Nutrition: Log/Plans/Foods/Meals; Progress: Muscles/Strength/Body/Energy; Me: Journal/Account) are header tabs, never extra top-level items. See [UI design system](#ui-design-system-web--ios).
- **PWA build outDir**: `vite-plugin-pwa` (≤1.3.0) reads `viteConfig.build.outDir` from the *root* config, but Vite 8's Environments API means Nitro only sets `outDir = ".output/public"` on its `client` environment — the root `build.outDir` stays at the default `"dist"`. Without the override, `sw.js` and `workbox-*.js` get written to `dist/` while everything else lands in `.output/public/`, *and* the precache glob scans `dist/` so the SW only precaches itself + 7 static icons (the actual hashed JS/CSS bundles never make it into the precache manifest). Both bugs are silent — the build succeeds, but the deployed SW is unreachable and offline mode caches nothing useful. Fix: `vite.config.ts` sets `build: { outDir: ".output/public", emptyOutDir: false }` at the root. After upgrading vite-plugin-pwa / TanStack Start / Nitro, sanity-check that `.output/public/sw.js` exists *and* contains a precache entry for `assets/*.js` (e.g. `grep -c '"url":"assets/' .output/public/sw.js` should be in the dozens). To regenerate icons from `public/logo.svg`, run `bunx pwa-assets-generator` (config in `pwa-assets.config.ts`).

## Nhost MCP

An Nhost MCP server (`mcp__nhost__*`) is configured for this repo and exposes tools for inspecting and managing the local Nhost project — listing apps/projects, reading the GraphQL schema, running queries, and managing Hasura metadata/migrations. **When it's available, prefer it** for tasks like:

- Inspecting Hasura metadata, permissions, or the live GraphQL schema instead of guessing or reading dumps.
- Running ad-hoc GraphQL queries against the local backend to verify behavior.
- Applying or reviewing metadata/migration changes.

Always list resources/roots/templates first to see what's exposed, and confirm which environment (`local` vs cloud) you're operating against before making changes.

**If the MCP server is not available** (the `mcp__nhost__*` tools aren't present in the session), warn the user up front before falling back to manual approaches like `bun run codegen`, hand-written SQL, or editing metadata files directly. They likely want to start it rather than have you work around its absence.
