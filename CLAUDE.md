# CLAUDE.md

Guidance for future Claude Code sessions in this repo.

## What this is

NeoGym — a TanStack Start (React 19 + Vite 8 + Nitro) frontend talking to an Nhost Cloud backend. The Nhost CLI runs a local Docker mirror of the same stack (Hasura + Auth + Postgres + Storage + Functions) for development. Sign-in/sign-up use email OTP (6-digit code, no password). Email-change is verified via a PKCE email-link flow that lands on `/verify` and exchanges the auth code for a session. UI is Tailwind v4 + shadcn/ui.

## Repo layout

```
.
├── flake.nix          # Nix devshell — provides bun + biome + XcodeGen on Darwin
├── ios/NeoGym/        # SwiftUI app shell, XcodeGen spec, and host-testable NeoGymKit package
├── frontend/          # TanStack Start app (Vite default port 5173, bound to 0.0.0.0 for LAN/mobile)
│   ├── src/
│   │   ├── routes/    # File-based routes (TanStack Router)
│   │   │   ├── __root.tsx, index.tsx, signin.tsx, signup.tsx, verify.tsx
│   │   │   ├── _authed.tsx              # pathless protected layout
│   │   │   ├── _authed/energy/          # daily active/resting energy CRUD
│   │   │   └── _authed/profile.tsx
│   │   ├── components/ui/    # shadcn primitives (hand-written, NOT from CLI)
│   │   ├── components/       # navbar, auth-card
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
- [`docs/developers/exercises.md`](docs/developers/exercises.md) — `exercises` is the **base** catalog table with only the truly shared columns; kind-specific catalog metadata lives in two 1:1 sidecars: `exercises_strength` (`double_weight`, `force`, `mechanic`) and `exercises_cardio` (`metrics_schema`). The strength/cardio split is enforced **structurally** via composite FKs, not triggers: `exercises.kind` is a `GENERATED` column (`'cardio'` iff `category='cardio'`, else `'strength'`); `workout_exercises.kind` and `workout_session_exercises.kind` are auto-populated by a `BEFORE INSERT/UPDATE` trigger from the parent exercise; `workout_session_strength_sets.parent_kind` is pinned to `'strength'` and `workout_session_cardio_entries.parent_kind` to `'cardio'`, both composite-FK'd to `workout_session_exercises(id, kind)`. The sidecars themselves repeat the same trick: `exercises_strength.kind` is pinned to `'strength'` and `exercises_cardio.kind` to `'cardio'`, both composite-FK'd to `exercises(id, kind)` with `ON UPDATE CASCADE` — so a category flip on an exercise that already has a sidecar (which every exercise does) cascades into the sidecar's `kind`, the pinned `CHECK` rejects it, and the whole transaction rolls back. Lifecycle is also atomic: `DEFERRABLE INITIALLY DEFERRED` constraint triggers on `exercises` AFTER INSERT and on each sidecar AFTER DELETE fire at commit, refusing to commit a transaction that would leave an exercise without its sidecar or a sidecar without its parent. Clients (admin, user, seeds, migrations) insert exercise + matching sidecar together via a Hasura nested mutation (`insertExercise(object: { ..., strength: { data: {...} } })`) or a SQL CTE — Hasura nested inserts and CASCADE-on-DELETE handle the common cases, the deferred check catches anything that slips through. A strength set cannot attach to a cardio session-exercise (or vice versa) — it's an FK violation, not a runtime check. A separate `BEFORE INSERT/UPDATE` trigger on `workout_session_cardio_entries` still runs `pg_jsonschema` to validate the metrics jsonb shape against the parent exercise's `exercises_cardio.metrics_schema`. The frontend branches on `exercise.kind === 'cardio'` (not `category` — `category` keeps the richer taxonomy: cardio, strength, stretching, powerlifting, plyometrics, olympic_weightlifting, strongman).
- [`docs/developers/nutrition.md`](docs/developers/nutrition.md) — nutrition adds owner-or-public `foods`, private `meals` and `nutrition_plans`, one `nutrition_days` row per local calendar date, optional logged meal groups, and concrete `nutrition_log_entries`. Plans contain meal slots (`nutrition_plan_meals`) and direct food slots (`nutrition_plan_foods`); mixed entries sort by `(slot_time, position, kind, id)` after clients assign a global per-slot `position` across both tables. Logged entries carry `source = 'food' | 'ad_hoc'`: food-backed rows copy trusted food name/kcal/fat/carbs/protein/fiber/sugar per 100g into non-null `snapshot_*` columns on insert and keep those snapshots immutable even after source food edits/deletes; ad-hoc rows are standalone log-only snapshots with no `food_id`, group, or plan-food provenance, and users may edit their snapshot fields. Grouped entries must carry the same `nutrition_day_id` as their `nutrition_log_meal`; the composite FK rejects wrong-day children and cascades group deletes. Direct plan-food logs are standalone food-backed entries with nullable `nutrition_plan_food_id` provenance; a trigger rejects grouped or mismatched-food provenance. `meal_ingredients.food_id`, `nutrition_plan_foods.food_id`, and `nutrition_plan_meals.meal_id` are `ON DELETE RESTRICT`, so public food/admin cleanup and meal deletes can be blocked by template references.
- [`docs/developers/energy.md`](docs/developers/energy.md) — daily energy is a private `daily_energy` stream with one row per `(user_id, energy_on)`, nullable active/resting kcal (at least one required), user-role GraphQL roots named `dailyEnergyEntry/Entries`, body-style web/iOS CRUD, one-way read-only Apple Health import that sums cumulative samples per local day, creates missing dates, refreshes the last 7 days for rows still marked "Imported from Apple Health", and the read-only nutrition in/out/net balance contract.
- [`docs/developers/health-workouts.md`](docs/developers/health-workouts.md) — private raw `health_workouts` JSON snapshots keyed by user + HealthKit workout UUID, read-only workout-level import on Workouts-area open/refresh, anchored add/update/deletion sync, no export or session conversion. Documents the workout importer's read-permission scope and the local-anchor deletion caveat.

**Keep these docs and CLAUDE.md in sync with the code in the same change.** When you make a change, ask: does anything I wrote here or in `docs/developers/` still read true after this? If the change touches the domain model (schema, migrations, Hasura permissions, the `exercises_strength`/`exercises_cardio` sidecar shape, the `kind` discriminator, session lifecycle, auth flow, the codegen pipeline, PWA build config, navigation conventions, toolchain) — update the matching doc and/or CLAUDE.md section as part of the same commit, not as a follow-up. Don't write "TODO: update docs" or leave doc drift for later. If you're unsure whether a doc statement is still accurate after your change, re-read it; stale claims here are worse than no claims, because future sessions act on them.

## Toolchain

`bun`, `biome`, and Darwin-available XcodeGen are NOT assumed to be on the host — they come from `flake.nix`. Run frontend commands via the devshell:

```sh
cd frontend
nix develop ../ --command bun run <script>
nix develop ../ --command bunx <pkg>
```

**Don't `curl | bash` install bun.** The user wants the toolchain to come from Nix. If XcodeGen is unavailable in the pinned Nixpkgs on a Darwin host, use the documented Homebrew fallback (`brew install xcodegen`) but keep `ios/NeoGym/project.yml` as the source of truth and do not commit generated `.xcodeproj` output.

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
- `make test` — run backend integration tests under `backend/tests/` against the live local Hasura. Requires `dev-env-up` first. The Makefile target runs `bun install && bun test` so dependencies are resolved on a fresh clone. The tests deliberately target `https://local.hasura.local.nhost.run/v1/graphql`, not the Constellation/Nhost GraphQL proxy at `https://local.graphql.local.nhost.run/v1`; many assertions depend on Hasura error codes and metadata behavior.
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
WCSession activation does not hold up the foreground UI. The watch signs
existing accounts in with email OTP; WatchConnectivity carries only latest-state
account hints, never credentials. Signed-in watch users swipe between
Energy (today's logged consumed kcal, active+resting burned total and its
active/resting breakdown, and Net = consumed minus burned), Profile
(uncached Auth name/email and watch-only sign-out), and Events (the last 300
timestamped, watch-app-only diagnostic outcomes). Events distinguish background
requests accepted by watchOS from actual wakes and delivered task expiry,
Health observer delivery from sync, typed starts/ends for active/resting
HealthKit queries and backend reconciliation/read/write stages, fresh energy
reads, local snapshot-save success/failure, and WidgetKit reload requests;
a reload request does not confirm a new display.
Random per-attempt IDs correlate observer arrival, sync, snapshot and HealthKit
acknowledgement within one in-process attempt; a resumed pending import uses a
new attempt ID and records the pending wall-clock age instead. Entries include
active/resting metric, app state, elapsed time,
backend operation or skip reason when relevant. Stage elapsed times and
pending age use wall clock (including watch sleep); a missing stage end or
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
response bodies or raw descriptions are exported. The old GraphQL transport
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
and skips manual conflicts. The SDK refreshes and owner-checks the short-lived
bearer before enqueuing; expiry, OS deferral and upload failures retain pending
work for retries. A completed upload still needs a fresh backend read/snapshot
before the pending marker clears; it is not proof of a rendered complication.
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
`.matchPhone` invite OTP. A later phone signed-in hint after explicit watch
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
uses the sessions cache for its read-only strength history. The SDK purges
prior managed-user scopes on sign-out/session replacement. The
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
`UserProfile`, `ChangeEmailModel`, `AuthDeepLink`, `PKCEVerifierStore`, and the
`AuthServicing` boundary; iPhone SwiftUI views under `ios/NeoGym/App/` call
those models and route signed-in sessions into the full-screen `AppShellView`.
Watch SwiftUI views live under `ios/NeoGym/Watch/`; the rectangular watch
complication lives under `ios/NeoGym/WatchWidgets/`. The **iPhone**
native shell has NO `TabView`: the three primary areas (Workouts, Nutrition, Me)
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
or template rows. Progress shows calendar-week strength volume across all
exercises and a per-exercise chart with both session volume and estimated 1RM
for every strength exercise with a logged set in the last 10 local days (separate
axes for the two metrics); the charts default to the last eight calendar weeks
and support other periods. Progress initially fetches strength history from the
local week containing the first of the last 180 local days; both charts extend
that week-rounded bound for older custom ranges while keeping existing progress
visible during revalidation. When its week-rounded cache key changes, an eligible
previous-key SDK cache snapshot can render first without a network request; it
is labeled as potentially missing newer sessions until the current-key stream
emits (expired/missing entries do not provide an offline fallback). Each exercise
chart's tappable header pushes `WorkoutsRoute.exerciseDetail(id)` through the
existing stack; Back returns to Progress without consuming chart gestures. On a
session detail with strength entries, the totals are followed by the three most
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
anchored additions to recheck only affected local dates, independently of chart
ranges. Cursors advance after successful backend reconciliation; an empty
initial read is not checkpointed because HealthKit read denial is opaque. It
creates missing dates and refreshes recent rows that still carry the exact
"Imported from Apple Health" note. Each metric whose first read is empty stays
unanchored and retries its history even when the other metric has samples; an
anchored type with no events retains its cursor if access was revoked. On any
sync with one type unanchored and affected dates, both types are re-read across
one bounded range per type. Cursors live under `body-health.anchor.v2.<userId>`;
the previous `body-health.anchor.v1.*` paired key is ignored if present.
HealthKit deletions are intentionally not reconciled yet. Watch energy sync
remains limited to the last seven local dates; iPhone energy views do not sync
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
for modal editors/pickers. Do not reintroduce a `TabView`,
`.tabViewBottomAccessory`, `.tabBarMinimizeBehavior`, `SectionTitleMenu`,
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

**Add new tests when you change the backend in a way that's already covered by the suite, or when you introduce a new invariant.** The backend suite includes `backend/tests/kind-enforcement.test.ts` for workout/exercise invariants, `backend/tests/nutrition.test.ts` for nutrition permissions, snapshots, provenance, and cascade behavior, and `backend/tests/daily-energy.test.ts` for `daily_energy` ownership, CHECK, range, UNIQUE, and root-field invariants. The kind-enforcement file is organized into describes by concern:

- **kind discriminator** — that `exercises.kind` is generated correctly from `category`, the sidecar relationships resolve, and the sync trigger on `workout_session_exercises` populates `kind` from the parent exercise.
- **composite-FK enforcement** — that strength sets can't attach to cardio session-exercises (and vice versa), and that the sync trigger can't be bypassed by a client passing a wrong `kind`.
- **cardio metrics-schema validation** — that `pg_jsonschema` rejects malformed cardio metrics and accepts valid ones; that valid strength sets / cardio entries insert cleanly.
- **user-role permissions** — that the FK chain `child → workout_session_exercise → workout_session → user` is enforced as a security boundary: foreign users can't insert or read into another user's session, and `kind` is excluded from the user-role insert allowlist on WSE. Uses the `gqlAsUser(userId, query, vars)` helper to forge `x-hasura-role: user` + `x-hasura-user-id`.
- **category-flip cascade integrity** — that flipping `exercises.category` between cardio and strength fails when child rows exist (the pinned `parent_kind` CHECK rejects the cascade). This is the hardest invariant to spot from the code alone, so when you touch the kind discriminator, composite FKs, or `parent_kind` CHECKs, **add or extend a test in this describe block**.

When adding tests, follow the existing patterns: the `gql(...)`/`gqlAdmin(...)` helpers for admin-level checks, `gqlAsUser(...)` for user-role assertions, and self-contained fixtures (each test inserts what it needs with unique names or numbers — don't depend on test ordering). `hasuraReachable` is set in `beforeAll`; data-dependent tests start with `if (!hasuraReachable) return;`, while the reachability smoke test intentionally fails when the NeoGym Hasura stack is unavailable so missing/wrong local environments are not reported as passing. **If you add a new permission, FK, trigger, or CHECK that encodes a security or integrity invariant, write the corresponding negative test** — the metadata YAMLs and migrations are the rules; the tests are the proof.

A note on **applying metadata edits to the running DB**: Nhost CLI doesn't hot-reload YAML changes. After editing under `backend/nhost/metadata/`, either restart with `make dev-env-down && make dev-env-up` (destroys local data), or push the change through Hasura's metadata API (`pg_drop_*_permission` + `pg_create_*_permission`, or `replace_metadata`). For schema-only changes via run_sql, use the v2 query endpoint. Then re-run `make test` and frontend `bun run codegen` if user-role visibility changed.

## Conventions

- **Path alias**: `@/*` → `frontend/src/*`. Wired in `tsconfig.json` (paths) and `vite.config.ts` (`resolve.alias`).
- **File-based routing**: any new file under `src/routes/` is a route. The router plugin regenerates `src/routeTree.gen.ts` when the dev server boots — never edit that file by hand. If `bun run check` reports the generated file is missing in a fresh workspace, generate it first (for example by starting the dev server once); the file is ignored and should not be committed. Pathless layouts use the `_name.tsx` + `_name/` directory pattern (see `_authed`).
- **Forms**: react-hook-form + zod via `@hookform/resolvers/zod`, rendered through `@/components/ui/form` shadcn primitives.
- **Toasts**: `sonner` mounted at root in `__root.tsx`; call `toast.error(...)` etc. from anywhere.
- **Component tiers**: `src/components/ui/` stays generic shadcn-style UI with no NeoGym product semantics. `src/components/patterns/` holds narrow app/product presentation patterns (page shells, headers, query states, form sections/actions, confirm dialogs, picker/dialog footers, ordered-row chrome) with slots/children and no domain imports. Domain components/routes keep GraphQL documents, mutations, validation, navigation, and domain-specific behavior; do not hide them behind a generic CRUD framework.
- **shadcn components are hand-written** under `src/components/ui/`. The `bunx shadcn add` CLI was deliberately *not* used. To add a new primitive, copy from <https://ui.shadcn.com> and adjust the `cn`/import paths to `@/lib/utils`.
- **Biome** is the only formatter/linter. ESLint and Prettier are not used. CSS parser has `tailwindDirectives: true` so `@theme inline`, `@utility`, `@custom-variant` parse cleanly.
- **Auth state** lives client-side in `lib/nhost/auth-provider.tsx`. The Nhost client uses localStorage by default; SSR renders see `user = null` and `isAuthenticated = false`. Protected routes (`_authed.tsx`) redirect via `useEffect`, not `beforeLoad`, because the SDK's session storage is browser-only.
- **Auth methods**: sign-in and sign-up use `nhost.auth.signInOTPEmail` / `signUpOTPEmail` + `verifySignInOTPEmail` (6-digit codes; no email link, no password). `auth.method.emailPasswordless` is disabled and `auth.method.otp.email` is enabled in `nhost.toml`. Change-email (in `_authed/profile.tsx`) is the one PKCE flow: it generates a verifier with `generatePKCEPair()` from `@nhost/nhost-js/auth`, stashes it in localStorage under `PKCE_VERIFIER_STORAGE_KEY` (`@/lib/nhost/pkce`), calls `nhost.auth.changeUserEmail({ codeChallenge, options: { redirectTo: ${origin}/verify } })`, and the user clicks the email link. The link routes through Hasura Auth to `/verify?code=...`, where `routes/verify.tsx` exchanges the code via `nhost.auth.tokenExchange({ code, codeVerifier })`. The session middleware (`updateSessionFromResponseMiddleware`) auto-persists the new session because `/token/exchange` matches its URL filter — don't manually `sessionStorage.set`. The verifier is removed from localStorage in the route's `finally`. Any subpath of `auth.redirections.clientUrl` is accepted as a `redirectTo` target by default, so per-route entries (e.g. `/verify`) don't need to be listed. Redirects to a different host/port or scheme must be added to `auth.redirections.allowedUrls` in both `backend/nhost/nhost.toml` (local-dev baseline) and `backend/nhost/overlays/<project-id>.json` (production overrides applied as JSON Patch at deploy time); the native iOS callback currently uses `neogym://verify`.
- **GraphQL data flow**: queries/mutations are authored inline via the typed `graphql(...)` template tag. Operations are sent through the `gqlRequest` helper in `src/lib/graphql.ts`, which is what `@tanstack/react-query`'s `useQuery` / `useMutation` calls.
- **`bun run codegen` is a two-step pipeline** — both outputs are checked in and neither should be edited by hand:
  1. `codegen:graphql-schema` (needs backend up) introspects Hasura via `rover` with `X-Hasura-Role: user` and writes the canonical SDL to `frontend/schema.user.graphqls`. This is the human-readable map of every query, mutation, type, and field the app is allowed to use; consult it (or point an LLM/IDE at it) to discover what's available before writing a new `graphql(...)` document. Do not commit schema dumps produced by ad-hoc introspection tools unless `codegen:graphql-schema` is deliberately changed to use that tool, because otherwise harmless ordering/directive differences create large generated-file diffs.
  2. `codegen:graphql` (offline) feeds that SDL plus your `graphql(...)` documents into `graphql-codegen` and writes TypeScript types + the typed `graphql()` tag to `frontend/src/gql/`. Because step 2 reads the user-role SDL, the generated types only expose what permissions actually allow — operations that admin can run but `user` can't will fail to typecheck.
- **Re-run `bun run codegen` after any change that affects what the `user` role can see**: editing a `graphql(...)` document, applying a Hasura migration (database schema), editing Hasura metadata (permissions, relationships, exposed columns), or pulling someone else's metadata/migration changes. This includes body-style metric tables such as `daily_energy` and query additions such as the daily-intake `dailyEnergyEntries` balance selection. Stale outputs cause confusing type errors and "field not found" runtime failures.
- **Nutrition GraphQL/logging shape**: meal logging should use one nested `insertNutritionLogMeal` with child `nutritionLogEntries`, and each child must explicitly include the same `nutritionDayId` as the parent group. Hasura nested inserts populate `nutritionLogMealId` but not the direct day FK used by permissions/composite same-day enforcement. Individual planned-entry log time is user-selected, user-correctable, defaults to now, and must not blindly copy the template slot: planned-meal logging may keep `nutritionPlanMealId` as provenance, and direct plan-food logging should use a standalone food-backed `insertNutritionLogEntry` with matching `foodId` + `nutritionPlanFoodId` (never grouped under `nutritionLogMealId`; deleting the plan/direct-food slot nulls provenance while snapshots remain). Day logging only shows selected-plan tabs/segments, suggestions, and actions when `nutrition_days.nutritionPlanId` resolves to a plan; no selected plan means no plan logging UI. Selected-plan suggestions are grouped by normalized slot time. Clients no longer expose a whole-plan `Log selected plan` action; each selected-plan time slot has its own `Log` action that logs every planned meal/food in that slot in one combined mutation. Normal slots log at their plan slot time, legacy no-time slots default to now, every entry in the slot receives that slot's logged time, empty planned meals fail the slot all-or-nothing before sending, and re-logging appends duplicates just like individual logging. Plan detail and plan editor screens group mixed meal/direct-food plan entries by normalized slot time; move controls are enforced slot-local, and cross-slot moves happen by editing the row time before the existing sorted/renumbered submit shape is saved. Ad-hoc one-off logs use standalone `source: "ad_hoc"` entries with no `foodId`, `nutritionPlanFoodId`, or `nutritionLogMealId`, and must send name plus kcal/fat/carbs/protein/fiber/sugar snapshot fields per 100g. Standalone entries store their own editable `slotTime`; grouped entries display the parent logged meal's editable `slotTime`. Daily nutrition totals and calories-in/out balance should be computed from logged `snapshot*Per100g` columns, not live `foods`; balance output comes from same-date `daily_energy` and remains read-only.
- **Form/picker navigation must use `replace: true`**: When a form submit, cancel, picker selection, or delete handler redirects away from a "spent" page (e.g., `/sessions/new` → `/sessions/$sessionId`, `/workouts/$id/edit` → `/workouts/$id` after save *or* cancel, `/workouts/$id/edit` → `/workouts` after delete, `/workouts/new` → `/workouts` after cancel), pass `replace: true` to `navigate(...)`. Without it, the now-spent form/picker (or the just-deleted record's detail page) stays on the history stack and the back button lands on it instead of the previous screen. A cancelled form is "spent" in the same way a submitted one is — the user explicitly abandoned it. Same rule for redirects out of invalid states (e.g., the non-owner bounce in `workouts/$workoutId/edit.tsx`) — the user was never meant to see that page, so don't leave it in history. Auth-flow redirects (`signin`/`signup` → `/profile`) are a separate case and have their own logic.
- **Mobile primary nav can scroll horizontally**: With the Energy and Nutrition top-level items the mobile tab bar has eight entries. Keep one top-level Nutrition item (not separate Foods/Meals/Plans/Days items) and preserve usability on narrow screens with the existing horizontally scrollable tab bar/min-width items rather than hiding primary destinations.
- **PWA build outDir**: `vite-plugin-pwa` (≤1.3.0) reads `viteConfig.build.outDir` from the *root* config, but Vite 8's Environments API means Nitro only sets `outDir = ".output/public"` on its `client` environment — the root `build.outDir` stays at the default `"dist"`. Without the override, `sw.js` and `workbox-*.js` get written to `dist/` while everything else lands in `.output/public/`, *and* the precache glob scans `dist/` so the SW only precaches itself + 7 static icons (the actual hashed JS/CSS bundles never make it into the precache manifest). Both bugs are silent — the build succeeds, but the deployed SW is unreachable and offline mode caches nothing useful. Fix: `vite.config.ts` sets `build: { outDir: ".output/public", emptyOutDir: false }` at the root. After upgrading vite-plugin-pwa / TanStack Start / Nitro, sanity-check that `.output/public/sw.js` exists *and* contains a precache entry for `assets/*.js` (e.g. `grep -c '"url":"assets/' .output/public/sw.js` should be in the dozens). To regenerate icons from `public/logo.svg`, run `bunx pwa-assets-generator` (config in `pwa-assets.config.ts`).

## Nhost MCP

An Nhost MCP server (`mcp__nhost__*`) is configured for this repo and exposes tools for inspecting and managing the local Nhost project — listing apps/projects, reading the GraphQL schema, running queries, and managing Hasura metadata/migrations. **When it's available, prefer it** for tasks like:

- Inspecting Hasura metadata, permissions, or the live GraphQL schema instead of guessing or reading dumps.
- Running ad-hoc GraphQL queries against the local backend to verify behavior.
- Applying or reviewing metadata/migration changes.

Always list resources/roots/templates first to see what's exposed, and confirm which environment (`local` vs cloud) you're operating against before making changes.

**If the MCP server is not available** (the `mcp__nhost__*` tools aren't present in the session), warn the user up front before falling back to manual approaches like `bun run codegen`, hand-written SQL, or editing metadata files directly. They likely want to start it rather than have you work around its absence.
