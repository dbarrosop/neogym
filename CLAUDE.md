# CLAUDE.md

Guidance for future Claude Code sessions in this repo.

## What this is

NeoGym — a TanStack Start (React 19 + Vite 8 + Nitro) frontend talking to an Nhost Cloud backend. The Nhost CLI runs a local Docker mirror of the same stack (Hasura + Auth + Postgres + Storage + Functions) for development. Sign-in/sign-up use email OTP (6-digit code, no password). Email-change is verified via a PKCE email-link flow that lands on `/verify` and exchanges the auth code for a session. UI is Tailwind v4 + shadcn/ui.

## Repo layout

```
.
├── flake.nix          # Nix devshell — provides bun + biome + python3 + constellation + XcodeGen on Darwin
├── ios/NeoGym/        # SwiftUI app shell, XcodeGen spec, and host-testable NeoGymKit package
├── frontend/          # TanStack Start app (Vite default port 5173, bound to 0.0.0.0 for LAN/mobile)
│   ├── src/
│   │   ├── routes/    # File-based routes (TanStack Router)
│   │   │   ├── __root.tsx, index.tsx, signin.tsx, signup.tsx, verify.tsx
│   │   │   ├── _authed.tsx              # pathless protected layout
│   │   │   ├── _authed/today.tsx        # signed-in landing (Today)
│   │   │   ├── _authed/train/           # Sessions, Workouts (split-view `_split` layouts), Exercises
│   │   │   ├── _authed/nutrition/       # Log (log/$date), Plans, Foods, Meals
│   │   │   ├── _authed/progress/        # Overview, Muscles, Strength, Body, Energy
│   │   │   └── _authed/me/              # Journal (split view), Account
│   │   ├── components/ui/    # shadcn primitives (hand-written, NOT from CLI)
│   │   ├── components/shell/ # sidebar, mobile tab bar, area tabs, rest timer
│   │   ├── components/patterns/ # page shell, form page, metrics, segmented, query states, tags, chips
│   │   ├── components/charts/   # TrendChart (Recharts) and its pure model/legend
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
- [`docs/developers/energy.md`](docs/developers/energy.md) — daily energy is a private `daily_energy` stream with one row per `(user_id, energy_on)`, nullable active/resting kcal (at least one required), user-role GraphQL roots named `dailyEnergyEntry/Entries`, body-style web/iOS CRUD, one-way read-only Apple Health import that sums cumulative samples per local day, creates missing dates, refreshes the last 7 days for rows still marked "Imported from Apple Health", and the read-only nutrition in/out/net balance contract. Today-only summaries also show derived burned/net estimates: mean positive resting energy over the previous seven local dates (one usable day is enough), floored at today's already recorded resting energy, plus today's recorded activity; estimated net uses food already logged. Actual values/history remain unchanged, no projection is stored in `daily_energy`, and no future meals/activity are predicted. Native and web Today (Balance card: today so far, then the end-of-day estimate), native Energy/Log, web Energy/intake, the watch app's End of day page, and the small/medium iPhone Balance widgets show estimates; the watch complication and the Lock Screen widgets do not.
- [`docs/developers/health-workouts.md`](docs/developers/health-workouts.md) — private raw `health_workouts` JSON snapshots keyed by user + HealthKit workout UUID, read-only workout-level import when the Train tab opens and on Sessions pull-to-refresh, anchored add/update/deletion sync, no export or session conversion. Documents the workout importer's read-permission scope and the local-anchor deletion caveat.

**Keep these docs and CLAUDE.md in sync with the code in the same change.** When you make a change, ask: does anything I wrote here or in `docs/developers/` still read true after this? If the change touches the domain model (schema, migrations, Hasura permissions, the `exercises_strength`/`exercises_cardio` sidecar shape, the `kind` discriminator, session lifecycle, auth flow, the codegen pipeline, PWA build config, navigation conventions, toolchain) — update the matching doc and/or CLAUDE.md section as part of the same commit, not as a follow-up. Don't write "TODO: update docs" or leave doc drift for later. If you're unsure whether a doc statement is still accurate after your change, re-read it; stale claims here are worse than no claims, because future sessions act on them.

## Toolchain

`bun`, `biome`, `wrangler`, `python3`, `constellation` (from `nixops.packages`), and Darwin-available XcodeGen are NOT assumed to be on the host — they come from `flake.nix`. Run frontend commands via the devshell:

```sh
cd frontend
nix develop ../ --command bun run <script>
nix develop ../ --command bunx <pkg>
```

The devshell's `python3` is pinned through `flake.lock` and runs the gallery renderer regressions included in `bun run check`. Run standalone **web gallery** Python tooling/tests through the devshell too (`nix develop . --command python3 ...` from the repository root), not a host interpreter. This does not migrate the native capture/release commands documented under `docs/ios/` and `ios/NeoGym/`.

Keep the shared `tools/gallery.py` renderer and native Python scripts compatible with Python 3.9. On macOS, `/usr/bin/python3` is an `xcrun` shim: inside `nix develop` it can select Nix's Python too, even with `PYTHONPATH` unset. An absolute `/usr/bin/python3` path alone is therefore not a Python 3.9 check. Outside the devshell it currently supplies native tooling's Python 3.9 floor.

After shared-renderer or native-script changes, run these additional offline compatibility checks from the repository root in a **fresh macOS terminal outside all Nix/direnv shells**. The version assertion must pass; if the host interpreter changes, explicitly select and verify a Python 3.9 interpreter instead. These checks supplement the Nix gates; they are not part of `bun run check` and do not require macOS system Python on Linux.

```sh
/usr/bin/python3 -c 'import os, sys; assert not os.environ.get("IN_NIX_SHELL"), "Exit the Nix shell first"; assert sys.version_info[:2] == (3, 9), sys.version; print(sys.version)' &&
/usr/bin/python3 -m unittest discover -s tools -p 'test_web_gallery.py' &&
/usr/bin/python3 -m unittest discover -s ios/NeoGym/Scripts -p 'test_*.py'
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
| Build + deploy to Cloudflare production | `bun run deploy` (or `make deploy-prod`; publishes live) |
| Build + validate deployment without publishing | `bun run deploy:dry-run` (or `make deploy-dry-run`) |
| Cloudflare static-SPA preview | `bun run preview:cloudflare` (builds production assets; normally port 8787) |
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
only through a phone-issued, app-user Auth PAT. In Me › Account › Apple Watch (Connect Apple
Watch), the signed-in iPhone creates a 90-day PAT for a
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
same-user phone hint, the reauthentication ("Sign in again") and Auth-error
("Couldn't sign in") screens offer **Connect** even if the SDK still retains the
rejected session; a healthy session or pending local clearing cannot be replaced.
Restore saved sign-in is shown only
while a locally valid, owner-eligible PAT remains saved (Auth may still reject it).
The phone retains the token
only in memory until acknowledgment/attempt expiry. Application context contains
only latest-state phone account hints. Known signed-out/different-account hints
clear the watch credential and block recovery; explicit watch sign-out also clears
it. PAT metadata is not a permission scope: the credential can sign in as the
full user until expiry or server revocation. Ordinary phone sign-out does not
revoke a PAT while the watch is offline; a stale/undelivered hint is not instant
server revocation. A Nhost Cloud dashboard PAT is not an app-user Auth PAT.
Signed-in watch users page vertically between
Today (balance so far = logged consumed minus active+resting burned, the
resting/active bar and In/Out), End of day (the ≈ Net/Burned estimate card, the
7-day average net, Refresh and the sync time) and Account (initial, uncached Auth
name, "Signed in from iPhone", Health status and watch-only sign-out). An Allow
Health access page comes first until read access has been requested. Account
states without a usable session use a message layout (icon, title, one line,
buttons) instead of red text; "Connect your iPhone · On iPhone: Me › Account ›
Apple Watch" replaces the old session-error text. Diagnostics (the last 300
timestamped, watch-app-only outcomes) open behind Account only while its
watch-only **Debug mode** switch is on; logging continues regardless. Events distinguish background
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
watch Diagnostics page can read these provider receipts, and the export appends
them. A provider receipt proves a timeline/snapshot request, not a new face
rendering; absent receipts can also reflect a failed diagnostic write.
**Share logs** opens the watchOS system share sheet with a temporary `.txt`
attachment on request; it cannot pre-address Mail and never sends automatically.
Events and exports exclude credentials, account IDs, names, URLs, Health values
and raw error/server descriptions. Watch pages, the complication and the iPhone
widgets format through NeoGymKit `EnergyBalanceDisplay` (same words and numbers
as Today's Balance card); resting is Chart 1 blue, active Chart 2 orange, and
there are no green, red or teal glyphs. VoiceOver labels name every metric. A
missing backend energy row leaves the balance and Out unavailable (`—`) until
an eligible local Apple Health estimate is available; a missing component on an
existing row contributes zero. The watch complication has a rectangular family
(balance glyph + "Balance so far", the balance, "In · Out") and a circular
family (food in against today's plan kcal as a Chart 1 capacity ring with a
compact "1.5k IN"); full colour tints the title with the accent, tinted faces
tint only the title and ring, numbers stay white. A snapshot over an hour old
shows its time ("Balance at 13:40"), an earlier date's shows "—", and no
snapshot (never connected or cleared) shows "Not connected"; the provider reads
the latest snapshot of any date and adds entries at the stale point and local
midnight. Balance is computed, not persisted. The watch app, not its
WidgetKit complication, reads active/basal HealthKit energy and
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
and refreshes energy even if the account name is unchanged. The watch saves a
fresh token-free, today-only App Group snapshot after each successful backend
read. On an eligible HealthKit delivery it first reads local daily totals and,
only for a same-owner snapshot known to represent an imported or absent backend
row, saves a provisional Health estimate (labeled on the watch app's End of day
page) and requests WidgetKit reload when visible values change. Manual/edited or
legacy unknown-provenance rows are never locally overlaid. In the background it enqueues one seven-day, idempotent
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
receipts prove the watch face updated. The rectangular complication's title
changes from "Balance so far" to "Balance at <time>" once its snapshot is an hour
old, using a pre-scheduled timeline entry. An unchanged-value backend read may
leave that displayed time unchanged until WidgetKit requests another timeline.
Neither complication family marks provisional Health estimates; only the watch
app's End of day page labels them.
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

The `NeoGymWidgets` extension contains the rest timer Live Activity and the
**Balance** widget (Home Screen small/medium, Lock Screen inline/rectangular/
circular). Balance display formatting (`EnergyBalanceDisplay`), the numeric v2
snapshot DTO/store and live-fetch/fallback orchestration live in host-testable
`NeoGymKit`; colours come from a copy of the theme colour sets in
`Widgets/Assets.xcassets`, and SwiftUI pieces shared with the watch targets
(balance glyph, resting/active bar, watch palette) live in `WidgetUI/`. Every
family opens Today via `neogym://today`; medium keeps the Refresh intent.
Small/medium show the end-of-day estimate (medium also the 7-day average); Lock
Screen families show actual balance only, and the circular one shows food in
against the day's plan kcal. The app writes a token-free aggregate snapshot to the
`group.io.nhost.dbarroso.neogym` App Group only after a fresh backend nutrition overview
emission on Today (never from an offline cached fallback) and clears/reloads it on
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

The iPhone also ships an offline, interactive **Try demo** entry on Sign in
(and the Auth-error screen). `AppModeView` selects the runtime before constructing
production dependencies; `AppRepositories` / `AppShellEnvironment` inject either
live repositories or one shared actor-backed `DemoStore`. Demo uses a versioned,
backup-excluded app-private file and the `io.nhost.neogym.demo` defaults suite,
never the SDK session/cache, Keychain or App Group. A fictional display-only
identity renders the same shell; demo HealthKit, Watch/PAT, email/MCP, widget
snapshot/reload and system rest effects are disabled. Reset/exit retire old
stores/timers; entering demo permanently retires live `AuthStore` observation
without clearing credentials, and Exit constructs a new live runtime for normal
authentication/session restoration. `--demo --demo-reset --demo-screen train/session/current` opens a
repeatable simulator starting point; all sections and the `NeoGymUITests` smoke
workflow are documented in [`docs/developers/ios-demo.md`](docs/developers/ios-demo.md).
The illustrated [iPhone demo guide](docs/ios/README.md) includes full-resolution
screenshots, recorded canonical walkthroughs and explicit coverage boundaries.
Its [capture instructions](docs/ios/capture.md) document the opt-in
`DemoGuideCaptureUITests` driver (skipped in normal test runs), Python tools and
completeness gate; use a fresh credential-free simulator for its destructive
fixture/recovery scenarios. The separate [Widgets & Watch catalog](docs/ios/widgets-watch/README.md)
uses `ios/NeoGym/Gallery/project.yml` (not the production spec) and
`Scripts/capture-surface-gallery.py` to render production views with fictional,
inert inputs in disposable simulators. Its 45 captures and per-image manifest are
visual fixtures, not system-hosted widgets/watch faces/Live Activities or verified
workflows; the 255 legacy iPhone captures keep their original provenance.
`NEOGYM_GALLERY` is defined only by the capture spec: it exposes fixture entry
views, replaces rest timers with frozen display inputs and compiles inert intents.
Never enable it in shipping targets or construct live services in the capture apps. Capture opts into a versioned 15 Jan 2025, 09:41 UTC
profile (`Sources/NeoGymKit/Resources/gallery-capture.json`) through
`NEOGYM_DEMO_CAPTURE=1`; `AppClock` freezes domain dates only while that demo is
active, never SDK/Auth/HealthKit clocks, and Exit clears the override. Ordinary
use stays real-time. Keep unchanged PNGs/provenance/order and, after baseline
adoption, refresh only affected groups; a profile/runtime baseline migration
belongs in a separate reviewed change. Until the one-time profile baseline lands,
any group refresh produces frozen-profile frames: publish only a reviewed full
`--group all` baseline (updating manifest `data`/`statusBar` summaries), or defer
publication; `validate` rejects mixed legacy/profile or profile-version catalogs.
Do not treat the demo as Apple-approved replacement review access: usable review
credentials are still required unless Apple explicitly approves otherwise.

The native app's live mode uses the same email OTP auth shape as the web app for
sign-in/sign-up. `NeoGymKit` owns validators, `SignInModel`, `SignUpModel`,
`PhoneAssistedSignInModel`, `WatchAssistedSignInModel`, `WatchPATCredential`, `UserProfile`,
`ChangeEmailModel`, `AuthDeepLink`, `PKCEVerifierStore`, and the
`AuthServicing` boundary; iPhone SwiftUI views under `ios/NeoGym/App/` call
those models and route signed-in sessions into the full-screen `AppShellView`.
Watch SwiftUI views live under `ios/NeoGym/Watch/`; the rectangular and circular
watch complication lives under `ios/NeoGym/WatchWidgets/`; SwiftUI shared by the
iPhone widget and both watch targets lives under `ios/NeoGym/WidgetUI/`.
**iPhone shell** (see [UI design system](#ui-design-system-web--ios) for the
rules). `AppShellView` hosts a native `TabView` with five tabs (Today, Train,
Nutrition, Progress, Me), each with its own `NavigationStack`; every stack
survives tab switches. Area roots show a large title with the segmented section
picker as the first scroll element and a top-trailing `+` for the section's
create/log action. Details push in the tab's stack; detail "Edit" links sit top
trailing and start/log actions in the content. Train, Nutrition and Progress
paths are shell state. Today's explicit section shortcuts pop the destination
stack to its root; ordinary tab switches preserve each stack's history.
`openSession` (deep links, Today, the bottom accessory and start-session
callbacks from any tab) selects Train and pushes the session, or pops back to
it when it is already in the stack. Opening the Train tab, and pulling to
refresh Sessions, also syncs the separate raw HealthKit workout stream
(`health_workouts`); that import does not create session or template rows. The
rest timer is one account-owned `RestTimerController` supplied to the shell and shown in
`.tabViewBottomAccessory` while a session is in the Train stack or a rest runs;
logging a set starts the default rest set under Me › Account, the accessory
offers +30 s and Skip and opens the session, and the Live Activity follows each
update. The Live Activity shows "Rest", the exercise with "set N next", the next
set's target (prefilled from the set just logged) and a countdown with a
time-left bar; its +30 s and Skip are `LiveActivityIntent`s (`Shared/RestTimerIntents.swift`)
that the system runs in the app process, routed by `LiveRestTimerIntents` to the
account's controller (or, in a background launch with no mounted runtime, to the
persisted rest for its stored owner). At the end date it turns stale and shows
"Rest over" with Open session (`neogym://session/<id>`); the app ends it as Rest
over for 10 minutes when it sees the rest finish, and the next set's rest replaces
it. Widget and Live Activity links go through NeoGymKit's `AppDeepLinkRouter`, never
the auth callback handler. Its stable main-queue-deferred stream lets the shell
atomically take the stored pending link before navigating; warm links cannot
replay on a later tab switch. Today replaces the old Nutrition Overview and keeps its duties: on
open, tab return, foreground and pull-to-refresh it loads training
(`TodayTraining`, sessions cache), the cached nutrition overview (writing the
Balance widget snapshot only after a fresh emission) and the Body chart
range, and auto-syncs Body measurements from HealthKit, revalidating the
overview and Body reads when Body rows changed or a refresh arrived during the
sync. Cached data renders during Body sync. The iPhone does not request
active/resting HealthKit energy access or upload energy; the watch app owns
that import. Progress renders one section at a time; Muscles and Strength keep
their view models in the area root and revalidate only after a training
mutation or a new local day. Strength restores weekly volume plus recent-exercise
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
Its list of stacked direct/½-secondary bars selects a muscle's weighted-set history chart;
ambiguous shoulders remain "Shoulders (unspecified)" alongside front, side, and
rear delts. It uses the SDK's sessions cache and requests 180 local days by
default, extending up to one year for older custom chart periods. The iOS
screen does not infer targets, RIR, or warm-up status. The database's tracked
`muscle_set_progress_rows` return-shape table is empty (not a cached summary),
and the function enforces the injected Hasura session's user ID before joining
private sessions. The local-only `1790000570001_progress_recent.sql` seed supplies 91 moving-window sessions (1,911 sets including 91 zero-rep entries) for the dev user; it advances only on fresh local reset/reseed, and the backend suite verifies its Progress totals. Public catalog shoulder corrections are made in migration
`1790000570000` for existing databases and the exercise seed for new ones;
uncertain exercises keep the `shoulders` value. Follow-up migration `1792997064993_reviewed_secondary_targets` corrects secondary associations for nine reviewed public exercises (presses, Hammer Curls, pulldown, row, Barbell Ab Rollout, and three lower-body movements), mirrored in the seed; it preserves primary targets and private exercises. Barbell Ab Rollout adds lats without replacing its other secondaries. See `docs/developers/exercises.md` for the changes and deliberately unaddressed custom-exercise cases. The read-time `strength_set_report_facts` view centralizes reps, volume (per-side `double_weight` multiplier) and per-set Epley; the tracked `workoutStrengthReport` and `exerciseStrengthReport` root functions expose owner-filtered session points through Hasura **and Constellation** via empty return-shape tables (migrations `1790000580000`/`1790000590000`, details in `docs/developers/sessions.md`). Nested `workouts.strengthHistory` and `exercises.strengthHistory` computed fields share the SQL and appear in both checked-in Hasura and Constellation user SDLs; app reports continue to use the roots' local-day contract. The configured Constellation version lives in `backend/nhost/nhost.toml`; checked-in SDLs or an already-running service do not prove a newly configured binary's compatibility (see the schema-verification guidance in `docs/developers/sessions.md`). The workout grouping follows the session's current nullable `workout_id`; exercise points expose best per-session e1RM, using recorded weight for single reps and Epley for 2+ reps, never doubling e1RM. Web and native exercise-detail charts mirror that formula locally until switched to server report fields. A session detail ends with the three most
recent earlier sessions still linked to the same workout template (ad-hoc
sessions have no same-workout comparison) and its Delete button. The Progress
tab opens on Overview (one card per section with "See all"). Progress ›
Energy hosts today's estimate, the Calories card (Consumed and Net charts, each
daily values with a 7-day average over full days; today's partial intake is an
open dot after a dashed segment) and the daily active/resting kcal list and
trend; it reads the backend only. Body and Energy charts (including Calories
and Overview's Body and Energy cards) open on the last 30 local days; the
Calories chart and Today's Body card (the last 14) each also read six warm-up
days for rolling averages; on a cold launch
across a local-day change they first read today's and up to seven earlier exact
ranges from the SDK's user-scoped, age-bounded cache without network calls; any
previous-range fallback is labeled as missing newer dates until the
current-range refresh succeeds. The Calories chart uses a separate date-bounded
snapshot-kcal/grams + daily-energy query, and changing a chart period or custom
dates loads that range on demand. No app-owned cache keys or chart snapshots are
stored. Progress › Body syncs HealthKit on first load and pull-to-refresh. Body HealthKit
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
last seven local dates; iPhone energy views do not sync it. Nutrition › Log
replaces Overview's day list with a week strip and date picker. After a create,
the create view's `dismiss()` pops the create route and the area root appends
the new detail route on the next runloop tick, so Back returns to the section
root. Pushed form routes put Cancel in the top-leading `.cancellationAction`,
Save in the top-trailing `.confirmationAction`, and destructive Delete as a
full-width `FormDeleteButton` at the end of the scroll content (detail routes
that delete, such as session detail or Clear day log, use the same button). In
the Log timeline, logged rows have no inline Edit/trash buttons — the whole row
opens its modal edit sheet, and each edit sheet
(`EditLogEntrySheet`/`EditMealGroupSheet`) holds its own Delete as a native
destructive `Button(role: .destructive)` in a trailing `Section` wired to a
confirm dialog. Sheet-local `NavigationView` wrappers remain intentional for
modal editors/pickers. Do not reintroduce `SectionTitleMenu`,
`SecondarySectionContentHost`, `AppAreaSwitcher`, hub lists, `.bottomBar`
detail actions, older OS fallbacks, UIKit parent-chain tab-bar hiding, custom
dock chrome, or hidden-link navigation. Sign-out must always call `clearSession()` after attempting remote
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
| Progress | Overview · Muscles · Strength · Body · Energy | `/progress/overview` (`/progress` opens it), `/progress/muscles`, `/progress/strength`, `/progress/body`, `/progress/energy` |
| Me | Journal · Account | `/me/journal`, `/me/account` |

Every signed-in URL starts with its area (`/train`, `/me`, …); area roots redirect to their first section. The pre-redesign URLs (`/sessions`, `/journal`, `/profile`, `/body`, `/nutrition/days/…`) were removed without redirects.

Today replaces Nutrition › Overview: today's training, nutrition so far against the selected plan, the energy balance and the body trend. On both platforms the Balance card shows today so far (food logged against energy recorded so far, stamped with the time today's energy row was last written), then the end-of-day estimate. The nutrition Days list is replaced by the Log section's date strip/date picker.

### Shell mapping

| Element | iOS (SwiftUI) | Web ≥ 768 px | Web < 768 px |
|---|---|---|---|
| Top-level areas | `TabView`, 5 tabs, each with its own `NavigationStack(path:)` | Left sidebar, 232 px, 5 items | Bottom tab bar, 5 items, no horizontal scroll |
| Sections in an area | Segmented `Picker` under the large title on the area root | Segmented tabs in the page header | Same tabs, full width |
| Primary create/log | Glass `+` toolbar button, top trailing | Primary button, header right | Icon button, header right (label in `ActionLabel`, kept for screen readers) |
| Live session + rest timer | `.tabViewBottomAccessory`, visible on every tab while a session is open or a rest timer runs | Rest timer card above the account row while running | Rest timer pill pinned above the tab bar while running |
| Detail | Push in the tab's stack | List + detail split from 1100 px; full page below | Full page with back link |
| Create / edit | Pushed screen in the tab's stack, inline title; Cancel leading, Save trailing | Full page; Cancel + Save in a sticky header | Full page; Cancel + Save in a sticky footer |
| Quick entry (set, food, cardio entry) | Inline row, or sheet at medium detent | Inline row, or dialog | Inline row, or bottom sheet |
| Delete | Destructive button at the end of content + confirmation dialog | Same + alert dialog | Same |

- The rest timer stays above individual screens (one account-owned `RestTimerController` on iOS, one shell provider on the web) so it survives tab/area switches. Logging a set starts it; the accessory/card/pill offers +30 s and Skip. Tapping the web timer's clock/context opens the session that started it; those actions remain separate buttons. The iOS target accessory also shows the live session and opens it on tap. Web sessions have `startedAt` but no open/finished state, so the web shell shows only a running rest timer, not a separate live-session indicator.
- Each iOS tab keeps its own navigation path when you switch tabs. Deep links (e.g. a pending session id) select the Train tab and push the session.
- The web `replace: true` rule for spent forms/pickers (see Conventions) still applies.
- Below 768 px web dialogs stand in for bottom sheets and stay anchored near the top (`ui/dialog.tsx`) so the on-screen keyboard cannot cover their fields; keep that rather than centring or bottom-anchoring them.

### Tokens — dark is the default

| Token | Dark (default) | Light |
|---|---|---|
| Background | `#09090B` | `#F4F4F6` |
| Surface (cards, rows, sheets) | `#18181B` | `#FFFFFF` |
| Inset (tiles inside cards) | `#202024` | `#F7F7F8` |
| Fill (segmented track, secondary buttons, chips) | `#27272A` | `#EDEDF0` |
| Segmented thumb | `#3F3F46` | `#FFFFFF` |
| Separator / border | `#2E2E33` | `#E4E4E7` |
| Strong border (dashed planned slots, empty states) | `#46464D` | `#8A8A92` |
| Text | `#FAFAFA` | `#18181B` |
| Text secondary | `#A1A1AA` | `#52525B` |
| Soft text (nav items, field labels, tags, chips) | `#D4D4D8` | `#3F3F46` |
| Text tertiary (captions on surface only) | `#8B8B94` | `#6A6A73` |
| Accent fill (buttons, selection, bars) | `#3463E0` | `#3463E0` |
| Accent text, links | `#6E93FF` | `#3463E0` |
| Accent soft (selected tab pill, kind tags, icon tiles) | `#1E2A4D` | `#E9EFFD` |
| Chart 1 (weight, resting energy, consumed, volume) | `#5E87F5` | `#2A78D6` |
| Chart 2 (body fat, active energy, net, Est. 1RM) | `#D9732C` | `#EB6834` |
| Carbs (macro meters and dots; fills only) | `#F5A35A` | `#EE8A2A` |
| Muscle secondary (½-secondary set bars) | `#4A66B0` | `#6C8BE8` |
| Positive | `#4ADE80` | `#15803D` |
| Positive soft (web status-pill background) | `#14321F` | `#E8F7EE` |
| Destructive | `#F87171` (text) / `#DC2626` (fill) | `#B91C1C` (text) / `#DC2626` (fill) |
| Error surface (web error banner) | `#2A1416`, text `#FCA5A5` | `#FDECEC`, text `#B91C1C` |

- **Appearance** is Dark (default) / Light / System on both platforms, under Me › Account. iOS applies it with `.preferredColorScheme`; the web theme provider defaults to `dark`.
- **Accent** is `#3463E0`, replacing the `#4373F4` AccentColor asset, because white labels on it pass 4.5:1 (5.2:1). On dark surfaces, text-coloured accent uses `#6E93FF` (6.1:1).
- **Where tokens live.** Web: shadcn CSS variables in `src/styles.css` (`--background`, `--card`, `--primary`, `--muted`, `--muted-foreground`, `--soft-foreground`, `--border`, `--border-strong`, `--chart-1`, `--chart-2`, `--chart-grid`, `--carbs`, `--muscle-secondary`, `--destructive-soft`, …) for both `.dark` and light. iOS: asset-catalog colours with Any/Dark variants exposed through `NeoGymTheme`. Never hard-code hex values in views.
- **Status and destructive contrast (web).** Pair `text-positive` with `bg-positive-soft` for Logged pills and success badges. Destructive text uses `--destructive`, not `--destructive-fill`, which is reserved for filled buttons; iOS carries the same split: `NeoGymTheme.destructive` (light `#B91C1C`, dark `#F87171`) for text and `destructiveFill` (`#DC2626`) for fills. `src/styles.test.ts` checks both palettes: 4.5:1 for the positive, accent-soft and primary text pairs, soft text on page, card, sidebar and fill, error-banner text on the error surface, and destructive text on page/card surfaces and their 10% hover tints (checking text on white alone misses the page and hover cases); 3:1 on the card for Chart 1, Chart 2, Carbs, muscle secondary and strong border; and `--chart-grid` equal to the separator. Spec values that miss a target are pinned as deliberate exceptions, not bugs to fix: light Carbs (2.53:1), dark strong border (1.89:1), and dark muscle secondary, which matches the accent fill's lightness and differs only in saturation.
- **Retired.** Remove `grid-bg`, `GridBackground`, the aurora gradients and glass-panel content styling as screens migrate.

### Type, shape, spacing

- **iOS:** SF Pro with Dynamic Type styles — Large Title (34, bold) on area roots, Title 2 for detail titles, Headline / Body / Subheadline / Footnote for content.
- **Web:** Inter — page title 28 bold, section 18 semibold, row title 15 semibold, body 15, secondary 14, caption 12. Inputs keep 16 px text below 768 px so iOS Safari does not zoom focused fields.
- **Numbers:** every metric uses tabular figures (`font-variant-numeric: tabular-nums`, `.monospacedDigit()`).
- **Radius:** iOS cards 22, controls 12–14, pills fully rounded. Web cards 14, controls 9–10.
- **Spacing and targets:** spacing steps 4 / 8 / 12 / 16 / 20 / 24 / 32. Touch targets are at least 44 pt.

### Patterns

- **Session logging.** Exercises are cards in session order. Completed exercises collapse to one summary line (weight × reps per set). The active exercise lists its logged sets and an inline next-set row, prefilled from the previous set, with weight and reps steppers and a Log button. Every exercise has a "last time" reference from its most recent logged occurrence strictly before the current session (collapsed cards show it as a one-line summary; the open card shows a Recent panel of the three latest earlier sessions instead of per-set "last" captions): prefer the same workout, falling back to earlier exercise history when that workout has none (always exercise history for ad-hoc sessions). Skip occurrences with no sets/entries before limiting history; the selected reference also drives status and automatic collapse. Tapping a logged set opens it to edit or delete. Cardio entries use a sheet or dialog generated from the exercise's metrics schema, with required fields first. Session totals (sets, reps, volume) sit under the title; earlier sessions of the same workout and Delete sit at the end.
- **Nutrition day.** A time-slot timeline: logged slots are solid; planned slots from the day's selected plan are dashed and have one Log action per slot. A planned slot stays when food is already logged at its time (matching times don't mean the plan was followed); its Log then steps down (an outline button on the web, the accent-soft button on iOS) and asks first: "Food is already logged at 07:15. This adds 3 planned items at 07:15; nothing already logged changes." Tapping a logged row opens its edit sheet. The day summary shows kcal against planned, P/C/F bars (protein accent, carbs the Carbs colour, fat secondary text colour) and energy out so far.
- **Lists.** One title, one metadata line, one trailing value. Show a chevron only when the row pushes. Entry histories (Body, Energy) show the latest 5 on iOS or 7 on the web, a count such as "5 of 32", and Load more for the next page.
- **Charts.** No chart border; grid lines in the separator colour. Charts have their own pair, checked for colour-blind separation on both surfaces: Chart 1 blue and Chart 2 orange, for lines, bars and areas alike. Colour follows the metric, never its position: weight, resting energy, consumed and volume are blue; body fat, active energy, net and Est. 1RM are orange. No grey series. Daily readings are a thin half-opacity line with dots under the 7-day rolling average, a solid 2.5 pt line in the same colour. Every reading gets a dot (smaller past 31 points); missing days are joined with a straight line. Detail tabs keep one unit per chart (weight and body fat, or consumed and net, get stacked charts); summary cards on Today and Overview may pair weight and body fat on left and right axes. Where two measures share a chart on left and right axes (exercise volume and Est. 1RM, the Today and Overview body cards), both lines start at the same height, then each fits its own data, so labels are less round (4.8k · 3.7k · 2.6k). A partial current period (today, this week) joins with a dashed segment to an open dot and stays out of averages. Body and Energy charts open on the last 30 days. Reference lines are dashed tertiary. Every chart has an accessible label that states the trend. Axis labels use the same notation as the values, callouts and spoken summary (one formatter per metric): durations read m:ss on whole-minute ticks such as 20:00 · 30:00 · 40:00 (every label h:mm:ss once an axis reaches an hour), never raw seconds. Spoken summaries (VoiceOver value, web aria-label) give lowest, highest, average and latest over complete periods only (no average for a 7-day average line), leaving out today or this week, and end with what is partial: "Today so far: …" or "This week so far: …", naming series only when several are partial. On iOS these are NeoGymKit `ChartAxisScale` (`.durationSeconds`) and `ChartAccessibilitySummary`; the web ports them as `src/lib/chart-axis-scale.ts` and `src/lib/chart-summary.ts` (`summarizeChart`, framed with the chart title and naming interior gaps of three or more days that the line joins across), with one formatter per metric in `src/lib/metric-format.ts`. `scripts/chart-series-contrast.fixture.tsx` renders the web Body, Energy and Calories charts and checks that series use only Chart 1/Chart 2 by metric, at 3:1 on the card, with tertiary axis labels at 4.5:1.
- **Selection.** Selected chips and the selected day use the accent fill (web `bg-primary text-primary-foreground`); accent soft is for the selected tab pill and the MEAL/CARDIO kind tags. Label, muscle, "public" and FOOD tags use the fill with soft text (web `Tag`/`KindTag` in `patterns/tag.tsx`; iOS label chips still use accent soft). The selected row of a split list (Sessions, Workouts, Journal) or of Progress › Muscles uses accent soft at 60 % with a 1 px inset `ring-primary/40`; the Foods and Meals tables use the fill alone.
- **Deltas (web).** Positive marks favourable deltas only, such as exercise volume or Est. 1RM gains; declines and unchanged values use `text-muted-foreground`, never destructive (that is for delete, sign-out and errors). Weight change is always neutral: Today's Body summary (7-day average and prior-week delta) and Progress › Body's delta use `text-muted-foreground`, because NeoGym has no weight goal and neither a gain nor a loss is a success state.
- **Health data.** Always show the source: an "Apple Health" tag on web rows; on iOS a sync-status row plus a small red heart (`#E5484D`, glyph only, labelled "Imported from Apple Health") after the date of each imported Body and Energy row. Both mark rows that still carry the exact import note. Never imply the web can trigger an import.
- **States.** Empty, loading and error states are on the Web · States and iOS · States boards. Build them with `src/components/patterns/query-states.tsx` on the web and `AppStateViews` on iOS. On the web `EmptyState` takes an `icon` tile and `actions`; `ErrorState` is `role="alert"`, shows "Network request failed. Check your connection and try again." for browser fetch failures (specific GraphQL messages are kept) and offers Retry through `onRetry`.

### Accessibility

- Text contrast is at least 4.5:1 in both themes (the tokens above are checked); non-text UI is at least 3:1.
- Use real buttons, links and labelled inputs. Icon-only buttons need an accessibility label.
- Colours that must be told apart also differ in lightness.
- Respect Dynamic Type, Reduce Motion and Reduce Transparency on iOS.

### Migration status

- **Web: all five areas migrated.** Where things live and remaining gaps:
  - Navigation model: `src/lib/navigation.ts` (`AREAS`, sections, `isSectionLanding`). The shell is `src/components/shell/` — `AppFrame` (sidebar ≥ 768 px, `MobileTabBar` below, breadcrumbs only on pages deeper than an area tab), `AreaTabs` for the header section tabs. `/oauth2/login` and `/verify` render with the public brand bar only, even for a signed-in visitor (`isBarePublicPage`); `/signin` and `/signup` draw their own brand panel.
  - Tokens: `src/styles.css` (dark default via `.dark`, light in `:root`); `DEFAULT_THEME = "dark"` in `src/lib/theme/theme-provider.tsx`. Appearance and the default rest length are set under Me › Account.
  - Split views (Sessions, Workouts, Journal): a pathless `_split` layout (e.g. `routes/_authed/train/workouts/_split.tsx`) renders the list and an `<Outlet />`, declares `staticData: { splitView: true }`, and its index route opens the first item from 1100 px (`useIsSplit`). Detail routes live in `_split/`; create/edit pages sit beside `_split` (`train/workouts/new.tsx`, `train/workouts/$workoutId/edit.tsx`) so they render full page. Index panes must not auto-select stale list data while revalidation is fetching, paused, or failed, since it can still contain deleted records. Fresh cached lists and idle lists whose last fetch succeeded remain usable, even after `staleTime` passes; aging alone must not hide the empty state or prevent auto-selection after widening.
  - Rest timer: `src/lib/rest-timer.tsx` (`RestTimerProvider`, mounted by `AppFrame`), shown by `RestTimerCard` (sidebar) and `RestTimerPill` (mobile). Logging a set or starting a rest from the session header records its `sessionId`; tapping the clock/context links back to that session, while +30 s and Skip do not navigate. The link uses a screen-reader-only "Open session:" prefix, not an overriding `aria-label`, so the card's Rest/next-set context is part of its accessible name. Browsers such as Chromium omit the `role="timer"` countdown from that name, though it remains in the link's content. The localStorage state retains `userId`, `endsAt`, `duration`, `label`, and nullable `sessionId`. Only a matching signed-in owner can restore it; ownerless legacy timers and different-owner timers are discarded. The shell keys the provider by user ID so switching accounts also cancels the old in-memory timer and expiry toast. Below 768 px the shell main pads ordinary pages by the tab bar plus the pill (`safe area + 8.5rem`) and form pages (`isFormPage`) by the tab bar only (`+ 4rem`); there the full-width pill is raised to `+ 9rem`, above the sticky Cancel/Save footer that sits on the tab bar. The mobile `FormPage` fills the viewport minus the tab bar with growing content, so a short, non-scrolling form keeps its footer at the bottom (a sticky bottom offset alone does not pin it there), and leaves `pb-16` under its content so the raised pill never covers the last field. The pill stays raised during form loading/error states, when the footer may be absent. Toasts (`AppToaster` in `__root.tsx`) are offset to stay above the tab bar and the pill, raised or not. Same-owner timers without a session id still restore with no link, and the default rest length remains a device-wide preference. There is no separate web live-session indicator because sessions have no open/finished state.
  - Create and edit pages use `src/components/patterns/form-page.tsx`: `FormPage` renders a sticky header with the breadcrumb trail, the page title and, from 768 px, Cancel and Save; below 768 px Cancel and Save sit in a sticky footer above the tab bar. Forms keep rendering the shared `FormActions` (`patterns/form-actions.tsx`) and give their `<form>` the id from `useFormPageFormId()`; inside a `FormPage`, `FormActions` portals its buttons into those bars and the submit buttons target the form via the `form` attribute. `DialogContent` wraps its children in `FormPageBoundary`, so forms inside dialogs (quick food/meal) keep inline actions. Edit pages pass a `DangerZone` card (a `destructive-outline` button) as `danger` for delete; it only opens the existing confirmation, a `ConfirmActionDialog` titled "Delete {name}?" whose body ends "This can't be undone." when true. `FormPage` also takes `width` (`form` 760 px: food, measurement, energy; `wide` 1000 px: workout, journal, plan; `split` 1180 px: meal), `layout` (`card`, the default single wrapper card the Journal editors still use, or `sections`, where the form renders its own `FormSection card` cards) and an aside column (`aside`, or `FormPageAside` from inside the form for live state such as meal totals) that is sticky beside the form from 1024 px and stacks below it otherwise. Edit pages submit with "Save", create pages with "Create {noun}". `AppFrame` skips its breadcrumb row on form pages (`isFormPage`), and the Nutrition layout renders form pages bare and detail pages without the area tabs.
  - Shared presentation: `src/components/patterns/` (indexed in its `README.md`) — `metrics.tsx` (`SectionCard`, `StatTile`, `MeterBar` with `protein`/`carbs`/`fat` tones, `RingMeter`), `segmented.tsx` (a native radio group), `query-states.tsx`, `tag.tsx` (`Tag`, `KindTag`), `filter-chip.tsx` (`FilterChip`, `ActiveFilterChip`), `list-footer.tsx` ("7 of 32 entries" and Load more), `confirm-action-dialog.tsx` (an alert dialog with no close button and focus on Cancel) and `page-shell.tsx` (`ActionLabel`). Shared domain pieces: `ExerciseThumbnail`, `AlternatingStorageImage` (`frame`, `pager`; no auto-advance under reduced motion), `lib/set-summary.ts`, `MacroLine`, `TodayEnergyEstimate` (`variant` `today`/`log`/`energy`) and the `FoodPicker`/`MealPicker` comboboxes (`mode="select"` for a select-like trigger).
  - Charts: `src/components/charts/trend-chart.tsx` (`TrendChart`; pure model in `trend-chart-model.ts`, legend and swatches in `chart-legend.tsx`) draws one or two series coloured by metric in `daily`/`average`/`line` styles, a partial last point dashed to an open dot, start-aligned left/right axes and baseline-only minis, labels Recharts' interactive SVG directly with `summarizeChart` (so its keyboard/tooltip access stays available), and renders nothing without data. Trend data mirrors the NeoGymKit builders: `lib/rolling-average.ts` (`chartWindow` fetches six warm-up days before the window), `lib/body-trend.ts`, `lib/energy-trend.ts` and `lib/calorie-trend.ts`. `lib/hooks/use-calorie-history.ts` reads snapshot kcal and `dailyEnergyEntries` for a window under `CALORIE_HISTORY_QUERY_KEY` (`["nutrition","days","index","calorie-history", …]`), so nutrition log writes refresh it through their `["nutrition","days"]`-prefix invalidations and daily-energy writers invalidate it explicitly.
  - Today (`routes/_authed/today.tsx`) lays the iOS cards out in an auto-fit grid (columns at least 440 px). `TodayOverview` selects today's `daily_energy` row (`todayEnergy`, with `updatedAt`): Balance shows "Today so far · HH:MM", the signed net, In/Out and the resting (Chart 1) / active (Chart 2) split, then `TodayEnergyEstimate variant="today"` fed the same intake and energy row (`lib/today-summary.ts`). Body plots the raw weight (Chart 1) and body-fat (Chart 2) readings of the last 21 local dates (iOS: 14) in a start-aligned, baseline-only `TrendChart` with first/last dates below, then a column per metric: latest reading and date, 7-day average and the neutral change against the prior week (`lib/body-trend.ts`).
  - Today revalidates its aggregate overview on every mount, even within the app-wide 30-second query freshness window; cached cards remain visible while the request runs. This keeps return visits fresh without relying solely on writer-side invalidations. An overview failure offers Retry without loading skeletons; if cached data exists, its cards remain visible alongside the error.
  - Progress opens on Overview (`routes/_authed/progress/overview.tsx`, cards in `components/progress/overview-*.tsx`): one card per section with "See all" — Muscles (trailing seven-day weighted-set total, six most-trained and three least-trained muscles, `muscleSetOverview`), Strength (best week and this week so far over the weekly volume line), Body (weight and body-fat 7-day averages with the neutral change against the prior seven days, over one start-aligned two-axis chart of 30 days, from Body's `useBodyMeasurements` cache) and Energy (the 7-day average net with consumed and burned per day, over daily net and its average, using the same 30-day `useCalorieHistory` key as Energy's Calories card).
  - Progress › Muscles and Strength read the `muscleSetProgress` / `strengthProgress` roots with the browser time zone through `components/progress/progress-queries.ts`, sharing keys with Overview. Periods are 8 w · 6 m · 1 y (default 8 w, `?weeks=`): Muscles reads `weeks × 7` local dates; Strength starts on the Monday that opens the period (`strengthPeriodStart`), so only the current week is partial. A period change keeps the previous rows on screen until the new ones load, but never across accounts (the placeholder checks the key's user). `lib/muscle-set-progress.ts` lists every muscle on the latest date, zeros included, as stacked direct (`bg-primary`) and ½-secondary (`bg-muscle-secondary`) bars scaled to the top row; `lib/strength-progress.ts` builds weekly buckets from the first week with volume and recent-exercise trends with one point per local date (volume summed, best e1RM kept). Strength shows each exercise logged in the last ten local dates as a card linking to the exercise, with a two-axis Volume/Est. 1RM chart. Workout detail reads `workoutStrengthReport` for up to six sessions in the last 366 inclusive local dates, keyed by workout/date/time zone/user. Never use `strengthHistory(args: {})`: nullable computed-field input fields are not SQL defaults; both absolute bounds are mandatory. Use the report root's required local-day/zone arguments.
  - Progress › Body is one card with a 30 d · 90 d · 1 y · All period (default 30, `?days=`) and a column per metric (`BodyMetricTrendColumn` in `components/body-metrics-chart.tsx`: 7-day average, neutral change against the prior seven days, latest reading, then daily readings under the 7-day average), from all rows under `["body_measurements","list",userId]` (`lib/hooks/use-body-measurements.ts`). Progress › Energy shows the energy trend (`components/daily-energy-chart.tsx`, its own date-bounded range query and 30 d · 90 d · 1 y period, "Average out · N full days"), the Calories card (`components/calories-card.tsx`, its own `?calories=` period) and the day list (`lib/hooks/use-daily-energy.ts`, 30-row pages counted by `dailyEnergyEntriesAggregate`). Both lists show 7 rows with a `ListFooter` and Load more (`lib/progress-entries.ts`). The quick Log card sits beside the content once the page container reaches 860 px (`@container` on `PageShell`) and below it otherwise; the header Log action shows only in the narrower layout. Measurement and energy editors share `components/entry-form-fields.tsx` (`variant` `page`/`quick`); a save on a date that already has an entry shows its error under Date (`bodyMeasurementMutationError` / `dailyEnergyMutationError`) instead of a toast. Writers invalidate through `lib/hooks/use-progress-entry-invalidation.ts`; detail pages use `components/entry-detail.tsx`.
  - Nutrition libraries: Plans is a card grid; Foods and Meals are tables from 768 px, and from 1100 px (`useIsSplit`) a row selects the item into a side panel via the `selected` search param (default: first filtered row) instead of opening its page; below 768 px rows link to detail pages. Table name cells reserve at least 10rem and links wrap; the public-food badge sits below the name. Fiber/Sugar (Foods) and Ingredients (Meals) appear only when the table's own container reaches 36rem (`@xl`), not at a viewport breakpoint: the sidebar and split panel both reduce the space available to names. Those secondary values remain available in the side panel or detail page. The "New plan/food/meal" actions live in the Nutrition area header (`SECTION_ACTIONS` in `routes/_authed/nutrition.tsx`). Plan, meal and food detail pages render their own `PageShell`; the side panels and the food/meal detail pages share `FoodSummary`/`MealSummary` (`components/nutrition-library.tsx`). The Meal editor has a details card and an Ingredients card whose rows hold a select-mode `FoodPicker`, grams, per-row kcal and named move/remove buttons, with live totals in `FormPageAside`; its edit query reads the plans that reference the meal and disables Delete with "Used in N plans (…). Remove it there first." (`lib/meal-template.ts`, like iOS `Meal.deleteBlockedReason`). The plan editor (`components/nutrition-plan-form.tsx`, slots in `nutrition-plan-slots.tsx`, slot logic in `lib/nutrition-plan-draft.ts`) has a details card and one card per time slot: a Time control, rows (drag handle, kind tag, select-mode picker, grams, kcal, a `RowActionsMenu` with Move up/down, Move to another time…, label and food/meal edits, Remove) on one line from 760 px with the picker on its own line below that, and "+ Food"/"+ Meal". Plan detail and day-log rows share `components/nutrition-row-cells.tsx` (P | C | F columns from 760 px, one decimal below 10 g via `lib/nutrition-rows.ts`), and every slot shows its P · C · F line (`MacroLine`).
  - The day log (`components/daily-intake-log.tsx`, slot cards in `daily-intake-slots.tsx`) puts the Day summary rail beside the timeline once its container reaches 880 px and above it otherwise; Clear day log sits at the end of the timeline. Rows keep their delete button and use the grams cell as the edit trigger (an inline grams editor; custom entries open "Edit custom food") rather than opening a sheet from the whole row.
  - Nutrition day navigation is `src/components/nutrition-day-navigator.tsx` (prev/next, native date picker, week strip with logged kcal); the old Days list is gone.
  - Train: the session page builds its cards from `components/session-exercise-card.tsx` and pure helpers in `lib/session-logging.ts`. The open card pairs the alternating photo (`AlternatingStorageImage frame="session" pager`) with a Recent panel of up to three earlier sessions, then a visually tabular logged-set list (one in-flow native button per row, at least 44 px high) and the next-set row on an accent-soft panel (`patterns/number-stepper.tsx`, weight ±2.5 kg, reps ±1); collapsed cards show the thumbnail, logged summary, last reference and a status disc. The open card's header has Collapse and, as on iOS, an options menu (`components/row-actions-menu.tsx`: Exercise details, Remove from session), so removing is never a single tap beside Collapse. Logged-set buttons contain their values and green tick in normal flow; never stretch an absolute edit button across a positioned `<tr>`, which older Safari versions can ignore as a containing block and let cover the page. Cardio dialogs list required metrics first and take a duration as one `mm:ss` (or `h:mm:ss`) field. The Add exercises picker (`components/exercise-picker.tsx`) is a checkbox list; workout, editor, catalog and picker rows lead with `ExerciseThumbnail`. Exercise detail's Progress card draws volume (Chart 1, left) and Est. 1RM (Chart 2, right) per session in one start-aligned `TrendChart` over 30 d · 90 d · 1 y (default 90 d), from `lib/exercise-progress.ts`. The exercise's own cards (photos and muscles, How to) come first in the DOM, so one column reads like iOS (exercise, then Progress and History); a `@min-[860px]` container query moves them to the right-hand column, the board's desktop layout.
  - Imported Body and Energy rows are recognised by the exact note "Imported from Apple Health" that the iPhone and watch importers write; `src/components/health-source-tag.tsx` shows the tag and hides that note.
- **iOS: migrated** (all five areas). Where things live:
  - Shell: `App/Shell/AppShellView.swift` hosts a native `TabView` (Today, Train, Nutrition, Progress, Me), each tab with its own `NavigationStack`. Area roots use a large title with `AreaSectionPicker` (segmented) as the first scroll element via the `areaSectionHeader` environment slot (`App/Shell/AreaChrome.swift`); create/log is a top-trailing `+` (`AreaPrimaryAction`). Routes and section enums live in `App/AppNavigationRoutes.swift`. Train, Nutrition and Progress paths are shell state: Today's section shortcuts pop the destination to its root, while ordinary tab switches keep history; deep links, Today and the accessory can select Train and push a session (`openSession`).
  - Tokens: asset-catalog colours (`App/Assets.xcassets/Theme/*`, `AccentColor` = `#3463E0`) exposed by `NeoGymTheme`; flat `SurfaceCard`/`cardSurface`/`insetCard` replace the glass primitives; `GridBackground` and aurora gradients are gone. Appearance (Dark default / Light / System) and the default rest length are `@AppStorage` keys from NeoGymKit `AppAppearance` / `RestTimerPreference`, set under Me › Account; `RootView` applies `.preferredColorScheme`.
  - Rest timer: `NeoGymKit.RestTimerAccountScope` supplies one per-owner `RestTimerController` to the shell, restoring only same-owner running rests and discarding ownerless/other-owner schedules. AuthStore's clear handler and state binding clear persistence, notifications and Live Activities on sign-out, definitive session loss, auth errors and account switches; invalidated old controllers ignore late callbacks. `RestTimerSystemEffects` (`App/Shell/RestTimerController.swift`) owns the platform mirrors. The timer is shown in `.tabViewBottomAccessory` (`RestTimerAccessory`) while a session is in the Train stack or a rest runs; +30 s, Skip, tap opens the session. Logging a set starts the default rest; ordinary tab switches and same-owner refreshes preserve it.
  - Today (`App/Today/`) replaces Nutrition › Overview and inherits its duties: Balance widget snapshot after a fresh overview, Body HealthKit sync on open/refresh, cached-first reads. Balance (`TodayBalanceSummary`) shows today's net so far with In/Out, the resting/active split recorded so far and the time today's energy row was last written (its `updatedAt`, selected by the overview query), then "By end of day, estimated" Burned ≈/Net ≈ from `DailyEnergyProjection` with the note that net counts only food logged so far. Body (`BodyTrendSummary`) draws weight (Chart 1) and body fat (Chart 2) as raw daily readings with a dot each on start-aligned left/right scales (they overlap where they move in step), joined across missing days, with first/last dates, then a column per metric: latest value and date, 7-day average and the neutral change against the prior week. Training uses NeoGymKit `TodayTrainingViewModel` (`TodayTraining` query, `sessions` cache); the cards use the host-tested summaries in `TodaySummary.swift`.
  - Train (`App/Train/`): Sessions are grouped by Monday week (`SessionWeekGrouping`). Session logging follows the pattern above using NeoGymKit `SessionLogging`/`NextSetDraft`: "last time" comes from the most recent earlier session of the same workout, else the exercise's history; `PriorSessionsPerExercise` bounds both histories strictly before the session's start and skips occurrences without sets/entries before its limit (mirroring the web query); the active card is the first strength exercise with fewer sets than last time (or cardio without entries); manual expand/collapse wins. The next-set row steps weight ±2.5 and reps ±1, tapping a value opens `StrengthSetEditorView`, and Log starts the rest timer. Workouts are cards with Start (loads the cached-first/fresh-second template, skips decorative detail insights, then starts). Workout detail shows the name (Title 2) and label tags, Start session, "Volume by session" bars for up to four recent sessions with positive volume from `workoutStrengthReport` (last 366 local dates, device time zone), exercise rows (thumbnail, name, muscle) with each exercise's last top set, and the markdown notes last (collapsed with Show all), via NeoGymKit `WorkoutDetailInsights`. Add exercises (`ExercisePickerView`) is a multi-select checklist with search, muscle-area chips (`ExercisePickerFilter`), "Recently logged" from the user's latest logged session rows, then "All exercises", and "Add N" in the toolbar; private exercises read "<muscle> · Mine". Exercise rows in sessions, workout detail, the workout editor, the picker and the catalog lead with `ExerciseThumbnail` (the first image cropped to a 48 pt square, radius 12, or the photo glyph); the Storage URL comes from the shell's `storageBaseURL` environment value. Session cards show the thumbnail and name over muscle while collapsed; the open strength card swaps it for a larger image alternating between the exercise's two frames beside a "Recent" list of its three latest earlier sessions (`SessionLogging.recentSessions`/`setsSummary`, from the already-loaded prior history), with tertiary dates and lighter secondary-text values so it sits behind the sets being logged; the open card's set rows and next-set row carry no "last" captions. Exercises use a search field, filter chips and menus. Detail "Edit" links are top trailing; Start session is a content button.
  - Nutrition: Log (`App/Nutrition/DailyIntakeViews.swift`) has a Monday–Sunday week strip with logged kcal (the cached `NutritionCalorieHistory` read for that week), a date-picker sheet, the day summary (kcal against the plan, P/C/F bars, fiber/sugar, energy out, balance, today's estimate, plan menu) and the timeline from NeoGymKit `NutritionTimeline.items`: logged slots are solid cards whose rows open the edit sheets. Expanded logged meals also show their child food snapshots: tapping a food opens `EditLogEntrySheet` for grams/position edits or single-entry deletion, with time still owned by the meal group; the meal row opens `EditMealGroupSheet`. Every selected-plan slot is dashed with one Log action (`logSelectedPlanSlot`); one that shares its time with a logged slot follows it, with a quieter accent-soft Log that asks first (`NutritionTimeline.plannedSlotConfirmationMessage`, the web dialog's wording). Only the first planned slot with nothing logged at its time (`NutritionTimeline.nextPlannedId`) opens by default with the accent Log. Every slot (and every plan detail slot, so a plan and a day log read alike) shows its P · C · F grams under the header with the day summary's bar-colour dots, and each row shows "amount · P · C · F" under its name (one decimal below 10 g, NeoGymKit `NutritionMacroText`) with kcal on the right; the shared `NutritionSlotHeader`/`NutritionSlotItemRow` live in `DailyIntakeRows.swift`. A plan slot holding a single meal is titled with the meal name and a MEAL tag. Plans/Foods/Meals use `SearchField`/`ListRow`; plan detail shows the macro energy split, slot cards and "Use for today" (sets today's day plan). New/Edit food, Edit meal and Edit plan use the grouped form rows in `App/Components/FormRows.swift`: inline Name/Description rows, a `MacroTotalsStrip`, numeric values in recessed wells, red minus to remove, and `NutritionSelectionSheet` to add or change a food/meal (with a create form pushed in the same sheet). Edit meal disables Delete and names the plans while any plan references the meal (`Meal.deleteBlockedReason`). Edit plan has one section per time slot with a single Time control (`NutritionPlanFormModel.setSlotTime` retimes every entry; choosing an existing time merges slots), FOOD/MEAL rows with inline grams, "Add food · Add meal" per slot and "Add time slot"; long-press an entry to reorder it within its slot, move it to another time, or change/edit its food or meal.
  - Progress (`App/Shell/ProgressNavigationView.swift`): one section renders at a time; the Muscles/Strength view models and their loaded tokens live in the area root, so switching sections keeps loaded history and revalidates only after a training mutation (the shell's `trainingRevision`) or a new local day. The tab opens on Overview (`App/ProgressOverviewView.swift`): one card per section with "See all" — Muscles (the trailing seven-day weighted-set total, the six most-trained muscles as bars and the three least-trained after them, `MuscleSetOverview`), Strength (best week and the last weeks of volume with this week's partial total as an open dot, `StrengthWeeklyOverview`), Body (weight and body fat 7-day averages with the change against the prior seven days, above one chart pairing the two averages over 30 days on start-aligned left and right axes, first and last dates only) and Energy (the 7-day average net with consumed and burned per day over the last 30 days, `CalorieTrend`); it shares the Muscles/Strength view models and reads the cached measurement list and calorie history. Muscles shows the selected muscle's history card and stacked direct/½-secondary bars (`MuscleSetBar`); Strength shows the best week and per-exercise e1RM summaries. Body has a card per metric (Weight, Body fat): the 7-day average, the change against the prior seven days and the latest reading over daily readings and the 7-day average line (`BodyTrendSummary`/`BodyMetricTrend`). Energy shows the energy-out chart (today's partial row dashed to open dots) with "Average out" over the 29 full days before today, today's estimate and the Calories card: Consumed and Net (consumed − burned) charts under one Period menu with their 7-day averages above, where today's partial intake is an open dot and averages and net use full days with food logged (`CalorieTrend`). Both end with an Apple Health/Watch source row and an entry list of the latest five with a "5 of 32" count and Load more (`EntryHistoryWindow`; Energy's total comes from the list query's `dailyEnergyEntriesAggregate`, and the first 30-row page fills the default 30-day chart and Load more reads the next page when the window passes the loaded rows); the import note is hidden and imported rows show `HealthImportHeart` after the date (`HealthImportMarker`, `NeoGymTheme.health`). Charts have no border, grid lines use the separator token, and series use `chart1`/`chart2` by metric.
  - Me: Journal shows label chips and entry cards; Account (`App/ProfileView.swift`) groups the profile, Change email, Apple Health / Apple Watch status (the watch row opens Connect Apple Watch), Connect an agent (MCP URL from NeoGymKit `AgentAccess` with copy), Appearance, Default rest and Sign out.
  - Shared presentation: `App/Components/MetricViews.swift` (`CardHeader`, `StatTile`, `MeterBar`, `MeterTrack`, `RingMeter`, `LegendItem`, `MetricValueText`, `AdaptiveRow`, which stacks rows at accessibility text sizes) and `App/Components/ListPrimitives.swift` (`SearchField`, `ListRow`, `RowSeparator`).
  - Editors, states and charts: Edit workout, journal entry, measurement and energy forms and the cardio entry sheet use the same grouped rows as the Nutrition editors (`App/Components/FormRows.swift`); workout and journal labels share `LabelChipsEditor`. Workout exercises reorder by long-press (the design's drag handle is not built). `AppEmptyStateView` draws the States board's empty state (accent-soft icon tile, optional primary action, no card at section level), and deletes confirm with an action-sheet `confirmationDialog`. Chart value axes use NeoGymKit `ChartAxisScale` (three rounded, unit-less labels in secondary text, zero kept for counts/energy/net; two measures on left and right axes start at the same height via `ChartAxisScale.startAligned`, with less round labels), lines join across missing days, every reading has a dot (smaller past 31 points), and a partial period joins with a dashed segment to an open dot.
- **Widgets & Watch: migrated** (the Design canvas's *Widgets & Watch* page). iPhone Balance widget in all five families (`Widgets/EnergyBalanceWidget.swift`), the rest timer Live Activity with Rest over and App Intent buttons (`Widgets/RestTimerLiveActivityWidget.swift`, `Shared/RestTimerIntents.swift`), the watch complication's rectangular and circular families (`WatchWidgets/`), and the watch app's Today / End of day / Account pages with message-layout states (`Watch/`). Formatting is NeoGymKit `EnergyBalanceDisplay`; shared glyph/bar/watch palette are in `WidgetUI/`.
- Update this list as areas migrate.

## Visual galleries

The [web guide](docs/web/README.md) and [iPhone guide](docs/ios/README.md) are
static documentation, not app routes or production build outputs. Their generated
`gallery.html` pages work through `file://` with adjacent `screenshots/`. Shared
HTML/CSS/JS and frame rendering live in `tools/gallery.py`; the iOS adapter keeps
its own layout/copy and original 1206 × 2622 defaults. Shared renderer changes
must preserve the current iOS HTML byte-for-byte unless explicitly redesigning it;
never refresh iOS images/provenance as a side effect of web work.

The web capture lives in `frontend/scripts/gallery/`: `catalog.json` is the
canonical root/frame registry and `profile.json` pins the browser date and
reserved fictional account. The opt-in seed checks this checkout's local Docker
ownership and fixture ID/email/marker before resetting only that account and its
private data. It fixes the account and visible energy timestamps; Playwright
signs in through real OTP/MailHog and writes the remaining fixtures through
user-role GraphQL. There is no production demo, auth bypass, admin secret,
database reset, shared-data write or stored developer session. Browser endpoints
are local and allowlisted. `bun run gallery:serve` uses `http://localhost:5173`,
the origin allowed by local Constellation CORS; do not bypass browser security.
The last layout's gallery data remains in the local DB until the next refresh.

The `docs/web/` gallery covers all web roots at 1440 × 1000 and 390 × 844 plus
representative OTP verification, strength logging/editing and exercise details,
nutrition log and editors, Progress Overview and Calories, Journal CRUD and
appearance. Keep the registry and captured walkthroughs in sync when those
flows change. Mobile is Chromium emulation, not Safari/device validation.
Playwright fixes its application date and explicitly advances it for rest;
Auth, database and provenance clocks are real. Locale/time zone, scale, reduced
motion, fresh contexts and pinned Inter are explicit. Verify quiet recaptures on
the same browser/host with the same profile, and preserve the PNGs, manifest and
provenance on byte-identical runs. Fixture/profile/browser/font changes require a
new complete reviewed baseline. Failed attempts and incomplete catalogs cannot
pass publication. Diagnostics stay in ignored scratch space, never docs.

See [web capture instructions](docs/web/capture.md) for opt-in browser installation,
local setup and scratch-first publication. `tools/web-gallery.py validate|render`
works offline and checks complete retained evidence; it does not rerun workflows.
Run both Python tooling suites plus frontend `bun run check` after tooling changes.
The first web capture also exposed two Journal/Constellation compatibility cases:
`useJournalEntries` sends explicit `where: {}` for an unfiltered list, and
`journalEntryInsert` omits an empty nested labels relationship. Preserve their
regression tests; do not globally rewrite omitted GraphQL variables, whose defaults
can have different semantics.

## Conventions

- **Path alias**: `@/*` → `frontend/src/*`. Wired in `tsconfig.json` (paths) and `vite.config.ts` (`resolve.alias`).
- **File-based routing**: any new file under `src/routes/` is a route. The router plugin regenerates `src/routeTree.gen.ts` when the dev server boots — never edit that file by hand. If `bun run check` reports the generated file is missing in a fresh workspace, generate it first (for example by starting the dev server once); the file is ignored and should not be committed. Pathless layouts use the `_name.tsx` + `_name/` directory pattern (see `_authed`).
- **Forms**: react-hook-form + zod via `@hookform/resolvers/zod`, rendered through `@/components/ui/form` shadcn primitives.
- **Toasts**: `sonner` mounted at root in `__root.tsx` (`AppToaster`, styled by `ui/sonner.tsx`); call `toast.error(...)` etc. from anywhere. Toasts are neutral card-surface notices with only the icon coloured, so don't pass `richColors`; they sit bottom right, and on phones above the tab bar and rest timer pill.
- **Component tiers**: `src/components/ui/` stays generic shadcn-style UI with no NeoGym product semantics. `src/components/patterns/` holds narrow app/product presentation patterns (page shells, headers, query states, form sections/actions, confirm dialogs, picker/dialog footers, ordered-row chrome) with slots/children and no domain imports. Domain components/routes keep GraphQL documents, mutations, validation, navigation, and domain-specific behavior; do not hide them behind a generic CRUD framework.
- **shadcn components are hand-written** under `src/components/ui/`. The `bunx shadcn add` CLI was deliberately *not* used. To add a new primitive, copy from <https://ui.shadcn.com> and adjust the `cn`/import paths to `@/lib/utils`.
- **Biome** is the only formatter/linter. ESLint and Prettier are not used. CSS parser has `tailwindDirectives: true` so `@theme inline`, `@utility`, `@custom-variant` parse cleanly. The `noExcessiveLinesPerFunction` gate is 200 lines. Blank lines between statements count toward it (`skipBlankLines` is unset); blank lines between JSX children do not. Prefer a behavior-preserving simplification or a focused extraction over deleting blank lines or suppressing the rule.
- **DOM integration tests** run Happy DOM fixtures in isolated Bun subprocesses so module mocks and browser globals cannot leak into other tests. For browser timer spies, narrow the target to the DOM `Window` interface; `typeof globalThis.window` also includes Bun/Node timer overloads with incompatible handle types. Wait for query-backed child widgets' own data before asserting it: the nutrition week strip query starts only after the parent day query renders its children. See `frontend/scripts/nutrition-timeline.fixture.tsx` for a controlled clock that exercises the rendered Today and day-log components without a backend. Infinite-query fixtures seed the cache with `{ pages, pageParams }`, but a mocked `gqlRequest` must return a single GraphQL page, not that cache wrapper (see `frontend/scripts/split-index-selection.fixture.tsx`). For fixtures that can exceed Bun's default 5-second test budget, set an explicit `test` timeout longer than the subprocess timeout; `Bun.spawnSync`'s timeout does not extend the enclosing test's budget. GraphQL argument assertions using Node's strict deep equality should normalize null-prototype input objects from `valueFromASTUntyped` or `execute` resolver arguments with `structuredClone`. Assert query-cache errors explicitly for optional history queries, whose failures intentionally leave the UI usable and could otherwise hide a broken fixture. `ConfirmActionDialog` confirmations are `role="alertdialog"`: query that role, and match `[role="dialog"], [role="alertdialog"]` when asserting that dialogs closed, since a `dialog`-only check passes vacuously. Recharts' `ResponsiveContainer` measures zero in Happy DOM: render charts inside a fixed-size `ResponsiveContainer` (see `scripts/trend-chart.fixture.tsx`), or stub `TrendChart` in page fixtures and record its `series` plus `buildTrendChartModel(props).label` (`scripts/today-overview-refresh.fixture.tsx`). Recharts 3 draws line dots in a separate layer from the line's group, so select a series by `TrendChart`'s `trend-chart-line-{style}` / `trend-chart-dot-{style}` classes; tick text sits under `.recharts-{x,y}Axis-tick-labels`. `input-otp` dispatches `new Event(...)`, so OTP fixtures expose `Event: window.Event` globally. For temporary out-of-tree Bun layout probes, symlink the existing frontend `node_modules` into the probe directory rather than setting `NODE_PATH`; that global override can shadow nested dependency versions (for example, Tailwind's `jiti`). When compiling CSS directly with `@tailwindcss/node` for a geometry probe, pass its required `onDependency` callback (a no-op is sufficient without watching); omitting it fails while resolving stylesheet imports. Bar-chart geometry probes should include two-digit date captions and check text bounds/overlap as well as bar ratios; single-digit dates can miss narrow-column collisions. Headless Chromium geometry probes should use an isolated `--user-data-dir`, set the viewport through CDP emulation, and assert `window.innerWidth`; `--window-size=390,844` alone can be clamped to 500 px.
- **Auth state** lives client-side in `lib/nhost/auth-provider.tsx`. The Nhost client uses localStorage by default; SSR renders see `user = null` and `isAuthenticated = false`. Protected routes (`_authed.tsx`) redirect via `useEffect`, not `beforeLoad`, because the SDK's session storage is browser-only.
- **Auth methods**: sign-in and sign-up use `nhost.auth.signInOTPEmail` / `signUpOTPEmail` + `verifySignInOTPEmail` (6-digit codes; no email link, no password). Both code steps render the shared `src/components/otp-code-step.tsx`: the email chip with Change, a "Verification code" fieldset whose complete code auto-submits (Verify and Enter submit too, never twice), and "Resend code" after a 60 s client cooldown. Resend always calls `signInOTPEmail`, on sign-up too: Auth's `signUpOTPEmail` answers OK without emailing once the address has an account, including the unverified one the first sign-up request just created, while `signInOTPEmail` emails a fresh code to it. Sign-in copy stays non-enumerating ("If an account exists for this email, we sent it a 6-digit code."), including the resend toast; don't change it to confirm an account exists. `auth.method.emailPasswordless` is disabled and `auth.method.otp.email` is enabled in `nhost.toml`. Change-email (in `_authed/me/account.tsx`) is the one PKCE flow: it generates a verifier with `generatePKCEPair()` from `@nhost/nhost-js/auth`, stashes it in localStorage under `PKCE_VERIFIER_STORAGE_KEY` (`@/lib/nhost/pkce`), calls `nhost.auth.changeUserEmail({ codeChallenge, options: { redirectTo: ${origin}/verify } })`, and the user clicks the email link. The link routes through Hasura Auth to `/verify?code=...`, where `routes/verify.tsx` exchanges the code via `nhost.auth.tokenExchange({ code, codeVerifier })`. The session middleware (`updateSessionFromResponseMiddleware`) auto-persists the new session because `/token/exchange` matches its URL filter — don't manually `sessionStorage.set`. The verifier is removed from localStorage in the route's `finally`. Any subpath of `auth.redirections.clientUrl` is accepted as a `redirectTo` target by default, so per-route entries (e.g. `/verify`) don't need to be listed. Redirects to a different host/port or scheme must be added to `auth.redirections.allowedUrls` in both `backend/nhost/nhost.toml` (local-dev baseline) and `backend/nhost/overlays/<project-id>.json` (production overrides applied as JSON Patch at deploy time); the native iOS callback currently uses `neogym://verify`.
- **GraphQL data flow**: queries/mutations are authored inline via the typed `graphql(...)` template tag. Operations are sent through the `gqlRequest` helper in `src/lib/graphql.ts`, which is what `@tanstack/react-query`'s `useQuery` / `useMutation` calls. Send nullable input-object variables (`_bool_exp`, `_order_by`, input types) explicitly, as `null` when unused: Constellation (seen with `0.8.0-beta01`) answers an omitted one with an internal server error, although Hasura direct accepts it (see `lib/hooks/use-journal-index.ts`).
- **`bun run codegen` is a two-step pipeline** — both outputs are checked in and neither should be edited by hand:
  1. `codegen:graphql-schema` (needs backend up) runs `backend/gen.sh` with the Nhost CLI from the Nix devshell. For the supported GraphQL roles (`admin`, `user`, `public`; Auth's `me` role has no metadata permissions), `nhost schema dump` introspects both `https://local.hasura.local.nhost.run/v1/graphql` and `https://local.graphql.local.nhost.run/v1/graphql` with the explicit role and admin secret. It writes `backend/schemas/schema.hasura.<role>.graphqls`, `schema.nhost.<role>.graphqls`, and a structural `schema.<role>.diff` via `nhost schema diff`. Outputs resolve relative to the script, not the caller's cwd, and replace the previous snapshots only after every dump/diff succeeds. The same script is available as `make schema` from `backend/`. Defaults are local; `NHOST_SUBDOMAIN`, `NHOST_REGION`, `NHOST_ADMIN_SECRET`, and `DST_PATH` can override the connection/output settings (set the secret explicitly for non-local targets). The canonical app SDL is `backend/schemas/schema.nhost.user.graphqls`; the old `frontend/schema.user.graphqls` copy is removed. Consult the canonical SDL before writing a new `graphql(...)` document. Generate SDL only through this pipeline to avoid ad-hoc ordering/directive churn.
  2. `codegen:graphql` (offline) feeds `backend/schemas/schema.nhost.user.graphqls` plus your `graphql(...)` documents into `graphql-codegen` and writes TypeScript types + the typed `graphql()` tag to `frontend/src/gql/`. Because step 2 reads the user-role SDL, the generated types only expose what permissions actually allow — operations that admin can run but `user` can't will fail to typecheck.
- **Re-run `bun run codegen` after any change that affects what the `user` role can see**: editing a `graphql(...)` document, applying a Hasura migration (database schema), editing Hasura metadata (permissions, relationships, exposed columns), or pulling someone else's metadata/migration changes. This includes body-style metric tables such as `daily_energy` and query additions such as the daily-intake `dailyEnergyEntries` balance selection. Stale outputs cause confusing type errors and "field not found" runtime failures.
- **Nutrition GraphQL/logging shape**: meal logging should use one nested `insertNutritionLogMeal` with child `nutritionLogEntries`, and each child must explicitly include the same `nutritionDayId` as the parent group. Hasura nested inserts populate `nutritionLogMealId` but not the direct day FK used by permissions/composite same-day enforcement. Individual planned-entry log time is user-selected, user-correctable, defaults to now, and must not blindly copy the template slot: planned-meal logging may keep `nutritionPlanMealId` as provenance, and direct plan-food logging should use a standalone food-backed `insertNutritionLogEntry` with matching `foodId` + `nutritionPlanFoodId` (never grouped under `nutritionLogMealId`; deleting the plan/direct-food slot nulls provenance while snapshots remain). Day logging only shows selected-plan tabs/segments, suggestions, and actions when `nutrition_days.nutritionPlanId` resolves to a plan; no selected plan means no plan logging UI. Selected-plan suggestions are grouped by normalized slot time. Clients no longer expose a whole-plan `Log selected plan` action; each selected-plan time slot has its own `Log` action that logs every planned meal/food in that slot in one combined mutation. Normal slots log at their plan slot time, legacy no-time slots default to now, every entry in the slot receives that slot's logged time, empty planned meals fail the slot all-or-nothing before sending, and re-logging appends duplicates just like individual logging. On the web and iOS day timelines, every selected-plan slot stays visible with its Log action even beside same-time logged intake, where that action asks first; the plan picker lives in the day summary rail. Today's **Next in plan** is clock-based (updated once a minute and on focus/visibility changes), not a logged/done-state filter. Plan detail and plan editor screens group mixed meal/direct-food plan entries by normalized slot time. Reorder controls (web drag handle and row-menu Move up/down; iOS long-press) are slot-local. Cross-slot moves use the slot's single Time control, which retimes every entry in the slot (a time another slot already uses merges the two), or an entry's "Move to another time"; either way the existing sorted/renumbered submit shape is saved. The web Time control commits on blur or Enter, never while typing, so passing through another slot's time cannot merge slots by accident; empty slots added with "Add time slot" are not saved until they get an entry. Ad-hoc one-off logs use standalone `source: "ad_hoc"` entries with no `foodId`, `nutritionPlanFoodId`, or `nutritionLogMealId`, and must send name plus kcal/fat/carbs/protein/fiber/sugar snapshot fields per 100g. Standalone entries store their own editable `slotTime`; grouped entries display the parent logged meal's editable `slotTime`. Daily nutrition totals and calories-in/out balance should be computed from logged `snapshot*Per100g` columns, not live `foods`; balance output comes from same-date `daily_energy` and remains read-only.
- **Form/picker navigation must use `replace: true`**: When a form submit, cancel, picker selection, or delete handler redirects away from a "spent" page (e.g., `/train/workouts/$id/edit` → `/train/workouts/$id` after save *or* cancel, `/train/workouts/$id/edit` → `/train/workouts` after delete, `/train/workouts/new` → `/train/workouts` after cancel), pass `replace: true` to `navigate(...)`. Without it, the now-spent form/picker (or the just-deleted record's detail page) stays on the history stack and the back button lands on it instead of the previous screen. A cancelled form is "spent" in the same way a submitted one is — the user explicitly abandoned it. Same rule for redirects out of invalid states (e.g., the non-owner bounce in `train/workouts/$workoutId/edit.tsx`) — the user was never meant to see that page, so don't leave it in history. Auth-flow redirects (`signin`/`signup` → `/`, which opens `/today`) are a separate case and have their own logic.
- **Primary navigation (web)**: five areas — Today, Train, Nutrition, Progress, Me — in a left sidebar from 768 px and a five-item bottom tab bar below it, with no horizontal scrolling. Sections inside an area (Train: Sessions/Workouts/Exercises; Nutrition: Log/Plans/Foods/Meals; Progress: Overview/Muscles/Strength/Body/Energy; Me: Journal/Account) are header tabs, never extra top-level items. See [UI design system](#ui-design-system-web--ios).
- **PWA build outDir**: `vite-plugin-pwa` (≤1.3.0) reads `viteConfig.build.outDir` from the *root* config, but Vite 8's Environments API means Nitro only sets `outDir = ".output/public"` on its `client` environment — the root `build.outDir` stays at the default `"dist"`. Without the override, `sw.js` and `workbox-*.js` get written to `dist/` while everything else lands in `.output/public/`, *and* the precache glob scans `dist/` so the SW only precaches itself + 7 static icons (the actual hashed JS/CSS bundles never make it into the precache manifest). Both bugs are silent — the build succeeds, but the deployed SW is unreachable and offline mode caches nothing useful. Fix: `vite.config.ts` sets `build: { outDir: ".output/public", emptyOutDir: false }` at the root. After upgrading vite-plugin-pwa / TanStack Start / Nitro, sanity-check that `.output/public/sw.js` exists *and* contains a precache entry for `assets/*.js` (e.g. `grep -Eo '"?url"?[[:space:]]*:[[:space:]]*"assets/' .output/public/sw.js | wc -l` should be in the dozens; this counts entries, including minified unquoted keys, not lines). To regenerate icons from `public/logo.svg`, run `bunx pwa-assets-generator` (config in `pwa-assets.config.ts`).

## Web deployment

The frontend deploys as a static SPA using `wrangler` from the Nix devshell
(`flake.nix`, pinned by `flake.lock`), not an npm dependency or the removed
`/tmp/cf` helper. Do not install Wrangler via npm/Bun or add a separate Node.js
package for it; the Nix package provides its runtime. `frontend/wrangler.json`
uses Wrangler's native build hook to remove both the old SPA shell and `sw.js`,
run `bun run build`, and require newly generated, non-empty
`.output/public/index.html` and `.output/public/sw.js` before upload. The hook
also parses the worker with `bun build --outfile /dev/null` (without executing
or replacing it) and checks for the `index.html` precache URL entry, accepting
both quoted and minified unquoted Workbox keys. This guards against the current
TanStack prerelease logging prerender or post-prerender PWA regeneration failure
but exiting successfully: an `onSuccess` throw alone does not block deployment.
Only `.output/public` is uploaded, including the PWA service worker and hashed
bundles; the generated Node server is not deployed. Wrangler's
`assets.not_found_handling = "single-page-application"` preserves deep-link and
PKCE callback navigation. `.wrangler/` is generated local state, ignored by Git
and Biome. The Vite prerender preview binds to `127.0.0.1` so localhost DNS cannot
send its request to a different IPv4/IPv6 listener. SPA `prerender.onSuccess`
regenerates the Workbox service worker through the PWA plugin API after
`index.html` is written: Vite's earlier closeBundle generation alone misses the
shell on clean builds. Keep both the root PWA outDir override and this final
precache generation. Validate `sw.js` precaches `index.html` and hashed JS/CSS.

`bun run deploy` invokes `wrangler deploy --dispatch-namespace nhost-app` with the
unsuffixed Worker name `neogym`; **do not substitute `--env production`**, which
would normally suffix the Worker name and break the infrastructure dispatcher's
hostname lookup. The Terraform-managed `nhost.app` wildcard dispatcher routes
`neogym.nhost.app` to that user Worker. Namespace, DNS, routes, and custom-domain
KV mappings remain infrastructure-owned; do not add a standalone Worker route,
custom domain, or dispatcher binding to the frontend config. `workers_dev` and
`preview_urls` stay disabled. Live publishing requires `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN` for the production account; never commit credentials.
Use `bun run deploy:dry-run` for validation without publishing. The local
`preview:cloudflare` command also builds production assets and does not change
backend Auth redirect allowlists. Manual deployment is configured; no CI upload
workflow is installed. See README.md for operator commands.

## Nhost MCP

An Nhost MCP server (`mcp__nhost__*`) is configured for this repo and exposes tools for inspecting and managing the local Nhost project — listing apps/projects, reading the GraphQL schema, running queries, and managing Hasura metadata/migrations. **When it's available, prefer it** for tasks like:

- Inspecting Hasura metadata, permissions, or the live GraphQL schema instead of guessing or reading dumps.
- Running ad-hoc GraphQL queries against the local backend to verify behavior.
- Applying or reviewing metadata/migration changes.

Always list resources/roots/templates first to see what's exposed, and confirm which environment (`local` vs cloud) you're operating against before making changes.

**If the MCP server is not available** (the `mcp__nhost__*` tools aren't present in the session), warn the user up front before falling back to manual approaches like `bun run codegen`, hand-written SQL, or editing metadata files directly. They likely want to start it rather than have you work around its absence.
