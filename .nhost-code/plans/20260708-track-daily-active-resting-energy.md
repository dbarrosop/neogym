# Track daily active + resting energy with one-way iOS HealthKit import

**Status:** ready
**Created:** 2026-07-08

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

NeoGym already tracks weight and body-fat as a per-day metric with a web CRUD UI and one-way Apple Health import on iOS (`body_measurements`). There is no way to capture daily **energy expenditure** (calories burned). Users want to track daily **active energy** and **resting energy**, import them one-way from Apple Health (import only, never write back), and see calories-in vs calories-out for a day — mirroring how weight/body-fat work today.

### 1.2 Functional requirements

- A new dedicated `daily_energy` table stores one row per `(user, date)` with `active_kcal` and `resting_kcal` (each nullable, at least one required).
- Web users can list, view, chart (trend), create, edit, and delete daily energy rows — full parity with `/body`.
- iOS users can list, view, create, edit, and delete daily energy rows under the **Me** tab — full parity with the Body section.
- iOS can import daily active + resting energy one-way from Apple Health: cumulative samples are **summed per local calendar day**, missing days are filled, and dates that already exist are skipped (same dedup rule as body).
- The nutrition day view (web + iOS) shows a **read-only** calories-in / calories-out / net (deficit/surplus) balance: in = the day's logged nutrition kcal (from snapshot columns), out = `active_kcal + resting_kcal` for the same date.

### 1.3 Non-functional requirements / constraints

- Follow all `CLAUDE.md` conventions: `@/*` alias, file-based routing, react-hook-form + zod via shadcn form primitives, Biome-only lint/format, inline typed `graphql(...)` documents through `gqlRequest`, `replace: true` on spent-form navigation, hand-written shadcn under `components/ui`, app presentation patterns under `components/patterns`.
- `NeoGymKit` must keep SwiftUI/UIKit/HealthKit out of `Sources/` so `swift build`/`swift test` work on macOS; HealthKit code is guarded by `#if canImport(HealthKit) && !os(macOS)`.
- Apple Health access stays **read-only** (`toShare: []`). Energy is never written back to HealthKit.
- Nhost CLI does not hot-reload metadata/`nhost.toml`; apply via `make dev-env-down && make dev-env-up` or the Nhost MCP metadata API, then re-run `bun run codegen`.
- Balance calories-in must be computed from `nutrition_log_entries` snapshot columns (`grams/100 * snapshot_*_per_100g`), never from live `foods`.
- Docs kept in sync **in the same change** (new `docs/developers/energy.md` + updates to `database.md`, `permissions.md`, `nutrition.md`, `CLAUDE.md`, `ios/NeoGym/CLAUDE.md`).

### 1.4 Surfaces in scope

- `backend/nhost/migrations/default/1790000530000_daily_energy/` — new table migration.
- `backend/nhost/metadata/databases/default/tables/` — `public_daily_energy.yaml` + `tables.yaml`.
- `backend/tests/daily-energy.test.ts` — new backend integration tests.
- `frontend/src/routes/_authed/energy/`, `frontend/src/components/daily-energy-*.tsx`, `frontend/src/components/navbar.tsx`, `frontend/src/components/daily-intake-log.tsx` — web CRUD, trend, nav, balance.
- `frontend/schema.user.graphqls`, `frontend/src/gql/` — regenerated (never hand-edited).
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergy*.swift`, `ios/NeoGym/App/DailyEnergyViews.swift`, `AppShellView.swift`, the Me-section view, `App/Info.plist`, `project.yml` — iOS models/repo/VMs/import/UI/wiring.
- `ios/NeoGym/Sources/NeoGymKit/NutritionDayRepositoryDocuments.swift`, `NutritionDayModels.swift`/`NutritionRepositories.swift`, `DailyIntakeViewModel.swift`, `ios/NeoGym/App/Nutrition/DailyIntakeViews.swift` — iOS balance.
- `docs/developers/{energy,database,permissions,nutrition}.md`, `CLAUDE.md`, `ios/NeoGym/CLAUDE.md` — doc sync.

### 1.5 Out of scope

- Writing energy back to Apple Health.
- Any energy source other than Apple Health import + manual entry (no third-party integrations).
- Goal-setting / TDEE estimation beyond the simple active+resting sum and the in/out/net balance display.

### 1.6 Success criteria

- `daily_energy` migration + Hasura metadata apply cleanly on a fresh `dev-env-up`; `make test` passes including new negative tests.
- A user can create/edit/delete/view energy days on web and iOS; HealthKit import adds missing days (summed per day) without duplicating existing dates.
- A read-only calories in/out/net balance renders per day on both surfaces.
- `bun run check`, `bun run codegen`, `swift build`, `swift test`, and the XcodeGen simulator build all pass; docs are updated.

### 1.7 Open questions / blockers (optional)

None blocking. Design defaults resolved during planning and recorded in §2:

- kcal upper bound: `>= 0 AND < 30000` per metric (sane cap; UI mirrors the constant).
- Column name: `energy_on` (mirrors body's `measured_on` `_on` suffix).
- GraphQL root fields: countable "entry" noun (`dailyEnergyEntries`, `dailyEnergyEntry`, `insertDailyEnergyEntry`, …) to avoid pluralizing the uncountable noun "energy". Implementers must confirm final generated root names via Phase 1 codegen and align consumers to whatever is generated.

---

## 2. Implementation strategy

### 2.1 Central design decision

Introduce a dedicated private-per-user `daily_energy` table that mirrors the `body_measurements` ownership/date-uniqueness/nullable-metric/notes/timestamp shape, then clone the entire Body stack (backend metadata, web routes/components, iOS models/repository/view models/views) for energy. Diverge from Body only where energy semantics require it: the HealthKit importer **sums cumulative daily samples** (vs Body's "latest sample wins"), the trend chart uses a single kcal Y axis, and the calories in/out/net balance is a **read-only derived display** computed on the nutrition day view by fetching the day's energy row alongside the existing daily-intake query. Do not build a generic tracking abstraction — mirror the concrete Body pattern.

### 2.2 Key constraints and invariants

- `daily_energy` is private per user; every permission is scoped by `user_id = X-Hasura-User-Id` and `user_id` is set from the session, never client-supplied. `user_id` is excluded from insert/update allowlists.
- At least one of `active_kcal`/`resting_kcal` must be non-null; both are `>= 0 AND < 30000`; `(user_id, energy_on)` is unique.
- HealthKit access is read-only. The importer must drop each metric value independently when `<= 0` or non-finite, and skip a day only when **both** metrics end up nil (so a surviving row still satisfies the at-least-one CHECK) — e.g. `active = 0` (no Watch) but `resting = 1500` imports as a resting-only row.
- HealthKit daily summing must use calendar-day buckets anchored at local midnight with a `DateComponents(day: 1)` interval (DST-safe), over an explicitly bounded enumeration window — never a raw `86400` `TimeInterval`.
- Balance calories-in uses logged nutrition snapshot columns only; calories-out treats a missing metric component as `0`; when no `daily_energy` row exists the card shows intake-only with no misleading `out = 0` net.
- Hasura `numeric` arrives in clients as strings; both web and iOS must decode `activeKcal`/`restingKcal` as string-or-null (reuse body's numeric-string decoding), including the nested selection used for balance.
- The pure grouper/merge/formatter helpers stay host-testable (no HealthKit import) exactly like `HealthBodyMeasurementGrouper`.

### 2.3 Touched surfaces

- `backend/nhost/migrations/default/1790000530000_daily_energy/{up,down}.sql` — new table, constraints, index, `updated_at` trigger; `down.sql` only `DROP TABLE ... CASCADE` (does **not** drop the shared `public.set_current_timestamp_updated_at()` function).
- `backend/nhost/metadata/databases/default/tables/public_daily_energy.yaml` + `tables.yaml` (insert in **alphabetical** position after `public_body_measurements.yaml`).
- `backend/tests/daily-energy.test.ts`.
- `frontend/src/routes/_authed/energy/{index,new,$id,$id_.edit}.tsx`; `frontend/src/components/{daily-energy-form,daily-energy-chart}.tsx`; `frontend/src/components/navbar.tsx`; `frontend/src/components/daily-intake-log.tsx`.
- Regenerated `frontend/schema.user.graphqls` + `frontend/src/gql/`.
- `ios/NeoGym/Sources/NeoGymKit/{DailyEnergyModels,DailyEnergyRepository,DailyEnergyViewModel,DailyEnergyHealthImport}.swift`; `ios/NeoGym/App/DailyEnergyViews.swift`; the Me-section view + `AppShellView.swift`; `App/Info.plist` + `project.yml` HealthKit usage copy.
- iOS balance: `NutritionDayRepositoryDocuments.swift`, `NutritionDayModels.swift`/`NutritionRepositories.swift`, `DailyIntakeViewModel.swift`, `ios/NeoGym/App/Nutrition/DailyIntakeViews.swift`.
- `docs/developers/{energy,database,permissions,nutrition}.md`, `CLAUDE.md`, `ios/NeoGym/CLAUDE.md`.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** Fully additive — a new table, new GraphQL roots, new routes/views, and one additive selection on the existing nutrition-day query. No changes to existing schemas, redirects, or overlays. Existing Body/Nutrition behavior is untouched.
- **Deployment:** Apply the migration + metadata (`make dev-env-down && make dev-env-up` locally, or migration via run_sql v2 endpoint + metadata via Nhost MCP/metadata API — Nhost CLI does not hot-reload). Re-run `bun run codegen` after the user-role schema changes and again after Phase 5's query edit. Generated `frontend/schema.user.graphqls` + `frontend/src/gql/` come from the canonical pipeline; do not hand-edit. Do not commit generated `.xcodeproj` output.
- **Rollback:** Standard revert is sufficient — drop the migration (down migration removes only the table), revert metadata/tables.yaml, and remove the new routes/views/docs. No data migration of existing tables occurs.

---

## 3. Phased plan of action

Phases are implementation slices within a single change/PR. Each is independently mergeable and leaves the system fully functional; doc-sync touches are folded into the phase that changes the relevant behavior, with Phase 6 as the final reconciliation. Phase 3 intentionally ships dead-but-tested code (no user-facing surface until Phase 4).

### Phase 1 — Backend table + metadata + tests + codegen

**Goal:** Ship the `daily_energy` table, user-scoped Hasura exposure, negative tests, and regenerated web types.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/migrations/default/1790000530000_daily_energy/up.sql` — mirror `1790000000000_body_measurements/up.sql`.
- `backend/nhost/migrations/default/1790000530000_daily_energy/down.sql` — `DROP TABLE IF EXISTS public.daily_energy CASCADE;` only.
- `backend/nhost/metadata/databases/default/tables/public_daily_energy.yaml`.
- `backend/nhost/metadata/databases/default/tables/tables.yaml`.
- `backend/tests/daily-energy.test.ts`.
- `docs/developers/energy.md` (initial backend-contract sections), `docs/developers/database.md`, `docs/developers/permissions.md` (both the inline Pattern-A list at line 42 **and** a new section near line 243).

**Implementation steps:**

1. Create `up.sql` with `public.daily_energy`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE`, `energy_on date NOT NULL`, `active_kcal numeric(7,2) NULL`, `resting_kcal numeric(7,2) NULL`, `notes text NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`. Constraints: `UNIQUE (user_id, energy_on)`; `daily_energy_at_least_one_value_check CHECK (active_kcal IS NOT NULL OR resting_kcal IS NOT NULL)`; `daily_energy_active_kcal_range_check CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal < 30000))`; matching resting range check. Add `daily_energy_user_date_idx ON public.daily_energy(user_id, energy_on DESC)` and `set_public_daily_energy_updated_at` trigger using existing `public.set_current_timestamp_updated_at()`.
2. Create `down.sql` dropping only the table (leave the shared trigger function intact).
3. Clone `public_body_measurements.yaml` into `public_daily_energy.yaml`: custom column names `energyOn/activeKcal/restingKcal/notes/userId/createdAt/updatedAt`, `custom_name: dailyEnergy`, explicit `custom_root_fields` (select `dailyEnergyEntries`, by_pk `dailyEnergyEntry`, insert `insertDailyEnergyEntries`/`insertDailyEnergyEntry`, update `updateDailyEnergyEntries`/`updateDailyEnergyEntry`, delete `deleteDailyEnergyEntries`/`deleteDailyEnergyEntry`, aggregate `dailyEnergyEntriesAggregate`), `object_relationships: user`, and user-role insert/select/update/delete permissions with `user_id: X-Hasura-User-Id` + `set: user_id`. Insert/update column allowlist: `energy_on, active_kcal, resting_kcal, notes` (exclude `user_id`); select adds `id, user_id, created_at, updated_at`; `allow_aggregations: true`.
4. Register the table in `tables.yaml` at its correct **alphabetical** position (`public_daily_energy.yaml` sorts after `public_body_measurements.yaml` and before `public_exercises*`).
5. Apply: `cd backend && make dev-env-down && make dev-env-up` (or migration via run_sql v2 + metadata via Nhost MCP/metadata API; warn if MCP unavailable).
6. Regenerate types: `cd frontend && nix develop ../ --command bun run codegen`. Nothing consumes them yet, so `bun run check` stays green.
7. Write the initial backend-contract docs (table shape, CHECKs, UNIQUE, permission pattern) and add `daily_energy` to `permissions.md` in both touch points and to `database.md`.

**Tests and checks:**

- `backend/tests/daily-energy.test.ts` (structure like `nutrition.test.ts`: `hasuraReachable` guard, `gql`/`gqlAdmin`/`gqlAsUser` helpers, self-contained fixtures with unique dates), covering:
  - Happy path: insert active-only, resting-only, and both; select back.
  - At-least-one CHECK on **insert and update** to both-null → `23514`.
  - Range CHECKs: negative and over-bound kcal rejected on insert and update; boundary-valid values accepted.
  - UNIQUE `(user_id, energy_on)`: duplicate date for same user on insert, and update of a row's date to a colliding date → `23505`.
  - Permission boundary: `gqlAsUser(userB)` cannot select `userA`'s row; cross-user `update_by_pk`/`delete_by_pk` affects zero rows / returns null.
  - Ownership pinning: `user_id`/`userId` supplied in an insert/update input is rejected by GraphQL validation (not in allowlist); inserted rows are pinned to the caller via `set`. A `user_id`-reassignment attempt via update is structurally impossible (locks the invariant).
  - Root-field smoke: exercising the generated `dailyEnergyEntries`/`insertDailyEnergyEntry` roots catches any naming mismatch before consumers are written.
- `cd backend && make test`.
- `cd frontend && nix develop ../ --command bun run codegen && nix develop ../ --command bun run check`.

**Definition of done:**

- Fresh `dev-env-up` applies the migration + metadata; `make test` passes including all new negative tests.
- `bun run codegen` produces a diff exposing the new energy roots in the user-role SDL; `bun run check` still green (no consumers yet).
- `permissions.md`/`database.md`/initial `energy.md` reflect the new contract.

**Phase commit message:** `feat(backend): add daily_energy table, permissions, and tests`

**Implementation log**

- **Implemented:** Added `public.daily_energy` migration/down migration, Hasura metadata with countable `dailyEnergyEntry/Entries` roots, table registration, backend integration tests, initial energy/database/permissions docs, and regenerated user-role GraphQL schema/types.
- **Reviewer verdict:** `ACCEPT` — reviewer verified migration shape, metadata permissions/root fields, tests, docs, and generated schema/types; no blocking concerns.
- **Autonomous assumptions/decisions:** Used the planned `>= 0 AND < 30000` kcal bounds, `energy_on` column, and `Entry/Entries` GraphQL roots. Justification: correctness (invalid values rejected), security (ownership pinned via permissions), and long-term maintenance (explicit countable naming avoids uncountable pluralization drift).
- **Quality gates:** `cd backend && make test` passed (`80 pass, 0 fail`); `cd frontend && nix develop ../ --command bun run codegen` passed; `cd frontend && nix develop ../ --command bun run check` passed (`106 pass, 0 fail`); `git diff --check` passed. Implementer also ran `make dev-env-down && make dev-env-up`, YAML metadata parse checks, and LSP diagnostics successfully. Initial implementer-side plain codegen/check attempts failed due to missing installed frontend deps / ignored `routeTree.gen.ts`, then passed after `bun install` and generation.

### Phase 2 — Web CRUD (list/trend + create/edit/delete + nav)

**Goal:** Full web parity with `/body` for daily energy.

**Depends on:** Phase 1 (codegen types).

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/daily-energy-form.tsx` — clone `body-measurement-form.tsx`; fields `energyOn`, `activeKcal`, `restingKcal`, `notes`; kcal numeric regex; inline zod validation mirroring DB range + at-least-one, with a comment citing the migration.
- `frontend/src/components/daily-energy-chart.tsx` — clone `body-metrics-chart.tsx` but **single Y axis** (active + resting both kcal), two lines, `connectNulls`.
- `frontend/src/routes/_authed/energy/{index,new,$id,$id_.edit}.tsx` — list+trend/detail/create/edit, inline typed `graphql(...)` docs, queryKey `["daily_energy"]`, empty/error/skeleton via `@/components/patterns/*`, `ConfirmActionDialog` for delete, `replace: true` on all spent-form nav (save→detail, cancel→detail/list, delete→list).
- `frontend/src/components/navbar.tsx` — add `{ to: "/energy", label: "Energy", Icon: Flame }` (import `Flame`) to `NAV_ITEMS`; 8th item, mobile tab bar already horizontally scrollable.

**Implementation steps:**

1. Add the form and chart components.
2. Add the four routes with inline documents (`DailyEnergy` list query, `DailyEnergyById`, `EditDailyEnergy`, `InsertDailyEnergy`, `UpdateDailyEnergy`, `DeleteDailyEnergy`) matching generated root names; invalidate `["daily_energy"]` on mutations.
3. Add the navbar entry; reuse `frontend/src/lib/dates.ts`.
4. Regenerate types and run checks.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen && nix develop ../ --command bun run check` (codegen is required after adding new `graphql(...)` documents; it generates the operation types `bun run check` needs).
- Manual browser pass at `bun run dev`: create active-only, resting-only, both; edit; delete; duplicate-date friendly error; trend renders with ≥2 points; back-button lands correctly (spent forms replaced); mobile tab-bar horizontal scroll usable.

**Definition of done:**

- A user can list/view/trend/create/edit/delete energy days in the browser against the local backend.
- Duplicate-date and out-of-range inputs surface useful UI errors.
- `bun run check` green; navigation history correct.

**Phase commit message:** `feat(web): add daily energy CRUD, trend, and nav`

**Implementation log**

- **Implemented:** Added daily-energy form validation/helpers, trend chart, full `/energy` CRUD routes, navbar entry, generated GraphQL operation types, and unit tests for validation/error-message helpers.
- **Reviewer verdict:** `ACCEPT_WITH_CONCERNS` — reviewer verified route/root names, query invalidation, `replace: true` spent-form navigation, single-axis chart, navbar wiring, and friendly error mapping. Accepted concerns were cosmetic (`NormalizedDailyEnergyFormValues` redundant field redeclaration) and manual browser pass not run.
- **Autonomous assumptions/decisions:** Accepted extraction of validation/error helpers into `frontend/src/lib/daily-energy.ts` instead of keeping all validation inline. Justification: long-term maintenance and testability; the helper carries the migration-citing invariant comment and is unit-tested. Accepted no manual browser pass because automated codegen/typecheck/lint/tests covered the implemented behavior and manual UI verification remains documented.
- **Quality gates:** `cd frontend && nix develop ../ --command bun run codegen` passed; `cd frontend && nix develop ../ --command bun run check` passed (`110 pass, 0 fail`); implementer also ran router generation, `git diff --check`, and LSP diagnostics successfully. Initial implementer-side check failed on Biome formatting/import ordering and passed after fixes.

### Phase 3 — iOS NeoGymKit models + repository + view models + tests (no HealthKit)

**Goal:** Host-testable Swift package layer for daily energy, including the pure import protocol/value types (no HealthKit).

**Depends on:** Phase 1 (final root-field names).

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyModels.swift` — `DailyEnergy` (Decodable; decode `activeKcal`/`restingKcal` as string-or-null), `DailyEnergyFormValues`, `DailyEnergyValidation` (min/max mirroring the CHECKs), `DailyEnergyFormModel`, chart-point/trend types + `DailyEnergyTrendBuilder` + formatters, `DailyEnergyErrorMapper` (duplicate-date constraint `daily_energy_user_date_key`).
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyRepository.swift` — protocol + struct with the six CRUD ops and query/mutation string constants matching the generated roots; object builder emits `energyOn` (date scalar) and `activeKcal`/`restingKcal` as string-or-null.
- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyViewModel.swift` — list/detail/editor view models; list VM accepts an optional `DailyEnergyHealthImporting` importer and dedups by `energyOn`.
- **Pure import boundary (moved here from Phase 4):** define `DailyEnergyHealthImporting` protocol, `HealthDailyEnergy` value type, and `DailyEnergyHealthSyncSummary` as non-HealthKit types in `Sources/` so the list VM compiles and is testable without HealthKit. The concrete HealthKit importer arrives in Phase 4.
- `ios/NeoGym/Tests/NeoGymKitTests/DailyEnergyTests.swift` — clone `BodyMeasurementsTests.swift` using `FakeGraphQLService`.

**Implementation steps:**

1. Add the models, repository, and view models (mirror the Body equivalents).
2. Add the pure import protocol + value types so the list VM's importer parameter has a home without HealthKit.
3. Add deterministic tests: decode fixture + sort query, insert vars omit ownership and null optionals, validation success/failure (at-least-one + range), error-mapper duplicate date, list-VM dedup with a fake importer.

**Tests and checks:**

- `cd ios/NeoGym && swift build && swift test`.

**Definition of done:**

- `swift build`/`swift test` pass with new deterministic tests; no SwiftUI/HealthKit imports in `Sources/`.
- Code is mergeable but not yet user-facing (no view/wiring until Phase 4) — stated explicitly.

**Phase commit message:** `feat(ios): add daily energy NeoGymKit models, repository, and view models`

**Implementation log**

- **Implemented:** Added host-testable `DailyEnergy` models, validation, form model, formatters/trend builder, repository GraphQL CRUD documents, list/detail/editor view models, pure health-import boundary types, and deterministic NeoGymKit tests.
- **Reviewer verdict:** `ACCEPT` — reviewer verified GraphQL roots/types against generated SDL, confirmed no SwiftUI/UIKit/HealthKit imports in the new `Sources/` files, confirmed Phase 4/5 work was not started, and noted only non-blocking observations.
- **Autonomous assumptions/decisions:** Accepted organizing trend/chart types in `DailyEnergyTrend.swift` rather than `DailyEnergyModels.swift`. Justification: long-term maintenance; it keeps the model file smaller while preserving the required public API. Accepted the reviewer’s low-severity `skippedExistingCount` labeling observation for Phase 4 consideration because the Phase 4 grouper will drop both-nil days before sync, minimizing user-visible impact.
- **Quality gates:** Plain `swift build`/`swift test` failed in this Nix-inherited shell due SDK/toolchain mismatch (`SwiftShims`/SDK compiler mismatch), so the strongest available equivalent was used: `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u TOOLCHAINS /usr/bin/xcrun swift build` passed and `cd ios/NeoGym && env -u SDKROOT -u DEVELOPER_DIR -u TOOLCHAINS /usr/bin/xcrun swift test` passed (`202 tests, 0 failures`). `git diff --check` passed; grep confirmed no `SwiftUI`, `UIKit`, or `HealthKit` imports in new `DailyEnergy*.swift` source files.

### Phase 4 — iOS HealthKit importer + SwiftUI views + Me wiring

**Goal:** One-way HealthKit energy import (summed per day) plus full CRUD UI under the Me tab, building via XcodeGen.

**Depends on:** Phase 3.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/DailyEnergyHealthImport.swift`:
  - Pure host-testable `HealthDailyEnergyGrouper.sum(active:resting:)` that sums samples per `measuredOn`, drops each metric value when `<= 0` or non-finite **independently**, and skips a day only when both are nil.
  - `#if canImport(HealthKit) && !os(macOS)` `HealthKitDailyEnergyImporter` reading `.activeEnergyBurned` + `.basalEnergyBurned` in `.kilocalorie()`, summed per local calendar day via `HKStatisticsCollectionQuery` (`.cumulativeSum`, `anchorDate` = local midnight, `intervalComponents = DateComponents(day: 1)`, enumerated over an explicitly bounded window via `enumerateStatistics(from:to:)`), read-only auth (`toShare: []`), error enum mirroring `HealthKitBodyMeasurementImportError`.
- `ios/NeoGym/App/DailyEnergyViews.swift` — clone `BodyViews.swift`; kcal copy, `flame` SF Symbol, preview repository.
- Me-section wiring: add the energy case to the Me section enum, route to `DailyEnergyListView(repository:healthImporter:)`, extend the Me nav view's stored properties + init; `AppShellView.swift` constructs `DailyEnergyRepository(graphQL:)` + `makeEnergyHealthImporter()` (guarded `HealthKitDailyEnergyImporter()` / `nil`).
- `ios/NeoGym/App/Info.plist` + `ios/NeoGym/project.yml` — update `NSHealthShareUsageDescription` in **both** to mention active/resting energy alongside weight/body-fat. Entitlement unchanged.

**Implementation steps:**

1. Add the pure grouper + guarded HealthKit importer with a bounded, DST-safe enumeration window.
2. Extend the list VM's sync to skip existing `energyOn` dates and to treat a unique-conflict on create as "skipped existing" (not a fatal import error) for race/stale-list safety, annotating imported rows (e.g. "Imported from Apple Health").
3. Add SwiftUI views and wire the Me tab + `AppShellView`.
4. Update both HealthKit usage strings.

**Tests and checks:**

- Grouper tests: multiple samples same day summed; active-only, resting-only, both; `active = 0, resting > 0` imports as resting-only; both-zero/non-finite/negative dropped; rounded values still satisfy DB validation. Plus `HealthDailyEnergy.formValues`.
- `cd ios/NeoGym && swift build && swift test`.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` then `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`; confirm no generated `.xcodeproj` is committed.
- Manual: on-device/simulator HealthKit read is manual verification (unit tests cover only the pure grouper). Note that `basalEnergyBurned` is often absent without an Apple Watch, so imports are frequently active-only — expected, not a bug.

**Definition of done:**

- `swift build`/`swift test` pass including grouper tests; XcodeGen regenerates and the app builds for the simulator.
- Energy appears as a Me subsection with working CRUD; the importer fills missing days (summed) and skips existing dates without failing on conflicts.

**Phase commit message:** `feat(ios): add daily energy HealthKit import and Me-tab UI`

**Implementation log**

_(filled by `nhost-implement` during execution.)_

### Phase 5 — Calories in/out/net balance (web + iOS)

**Goal:** Read-only calories-in/out/net (deficit/surplus) balance on the nutrition day view, on both surfaces.

**Depends on:** Phase 1 (table + codegen) and Phase 3 (iOS `DailyEnergy` Decodable). **Not** dependent on Phase 4.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- Web `frontend/src/components/daily-intake-log.tsx` — extend `DailyIntakeLogQuery($date: date!)` with a **top-level sibling** selection `dailyEnergyEntries(where: { energyOn: { _eq: $date } }, limit: 1) { activeKcal restingKcal }` (sibling to `nutritionDays`, so the card renders even when no `nutrition_day` row exists). Add a small unit-tested pure helper for balance math if the frontend test setup supports it.
- iOS `NutritionDayRepositoryDocuments.swift` — add the same top-level selection to the daily-intake query; `NutritionDayModels.swift`/`NutritionRepositories.swift` — decode `dailyEnergy: DailyEnergy?` into `DailyIntakePayload` (string-or-null numeric decode) and expose derived `caloriesIn/caloriesOut/net`; `DailyIntakeViewModel.swift`/`ios/NeoGym/App/Nutrition/DailyIntakeViews.swift` — add a read-only balance section near the macro summary.
- `docs/developers/nutrition.md` — document that balance uses nutrition snapshots + `daily_energy` (not live foods).

**Implementation steps:**

1. Web: add the sibling query selection, compute `in = loggedMacroTotals(...).kcal`, `out = (activeKcal ?? 0) + (restingKcal ?? 0)`, `net = in - out`; render a read-only balance card near `MacroSummary` labeled deficit/surplus (not just "net"); when no energy row exists show intake-only + a "no energy logged" affordance linking to `/energy/new?date=$date` (preserve the viewed date, do not default to today). Re-run codegen.
2. iOS: add the selection, decode + derive, render the read-only balance section with the same null semantics; add balance-math tests (nutrition-only, energy-only, active-only, both, neither).
3. Note the cross-route cache expectation: editing energy on `/energy` won't refresh an already-cached nutrition-day card (different query keys); rely on `refetchOnMount`/documented invalidation as a deliberate decision.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run codegen && nix develop ../ --command bun run check` + browser check on `/nutrition/days/<today>` (with and without an energy row).
- `cd ios/NeoGym && swift build && swift test` (balance-math tests).

**Definition of done:**

- Both surfaces show in/out/net (deficit/surplus) for a date with nutrition + energy; gracefully show intake-only when no energy row exists; missing metric component counts as 0.
- All gates pass.

**Phase commit message:** `feat: add read-only calorie balance to nutrition day view`

**Implementation log**

_(filled by `nhost-implement` during execution.)_

### Phase 6 — Docs + final acceptance sweep

**Goal:** Reconcile all docs with final behavior and run the full gate sweep.

**Depends on:** Phases 1–5.

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `docs/developers/energy.md` — finalize: table shape, CHECKs, UNIQUE, one-way summed HealthKit import + skip-existing dedup + per-metric zero handling, read-only in/out/net balance.
- `docs/developers/database.md` — `DAILY_ENERGY` entity + `USERS ||--o{ DAILY_ENERGY` + `daily_energy.user_id → auth.users CASCADE` cascade note.
- `docs/developers/permissions.md` — confirm `daily_energy` present in both the inline Pattern-A list (line 42) and the dedicated section.
- `docs/developers/nutrition.md` — confirm balance note.
- `CLAUDE.md` — update the "seven entries" mobile tab-bar sentence to **eight**; mention the `/energy` route, `daily_energy` table, the new backend test file, and the codegen re-run rule where the Body pattern is described.
- `ios/NeoGym/CLAUDE.md` — document the `DailyEnergy*` NeoGymKit types, the summing HealthKit importer (bounded/DST-safe), the Me energy subsection, and the updated `NSHealthShareUsageDescription` in both Info.plist and project.yml.

**Implementation steps:**

1. Re-read each changed doc against the final code; fix any drift.
2. Confirm `frontend/schema.user.graphqls` + `frontend/src/gql/` were produced by the canonical pipeline (not hand-edited) and no generated `.xcodeproj` is committed.
3. Run the full gate set if anything changed during cleanup.

**Tests and checks:**

- `git status --short`.
- `cd backend && make test`; `cd frontend && nix develop ../ --command bun run check`; `cd ios/NeoGym && swift build && swift test`; `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.

**Definition of done:**

- Every doc statement reads true post-change; no "TODO: update docs".
- All gates pass; schema/codegen/xcodeproj policy confirmed.

**Phase commit message:** `docs: document daily energy tracking and HealthKit import`

**Implementation log**

_(filled by `nhost-implement` during execution.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and `nhost-implementer`. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and `nhost-reviewer`. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it, scoped to the current phase unless a safe fix requires adjusting the plan.
4. **Repeat:** Continue review/improve until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified. Backend phases must pass `make test`; frontend phases `bun run check` (after `bun run codegen`); iOS phases `swift build && swift test` + XcodeGen build.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, Swift, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Dedicated `daily_energy` table, one row per user+date, nullable metrics w/ at-least-one | 1 | Migration applies; `daily-energy.test.ts` at-least-one/range/unique negative tests; `make test` |
| Private per-user permissions (no cross-user read/write, ownership pinned) | 1 | `gqlAsUser` permission-boundary + forged-`userId` + reassignment tests |
| Web CRUD + trend + nav parity with Body | 2 | `bun run check`; manual browser create/edit/delete/trend/nav |
| iOS CRUD parity under Me | 3, 4 | `swift test` (VM/repo tests); XcodeGen simulator build; manual Me navigation |
| One-way HealthKit import, summed per local day, skip existing dates | 4 | `HealthDailyEnergyGrouper.sum` tests (summing, per-metric zero handling); read-only auth; manual device verification |
| Read-only calories in/out/net balance on nutrition day (both surfaces) | 5 | Balance-math tests (iOS + web helper); `bun run check`; browser check with/without energy row |
| Docs kept in sync same-change | 1, 5, 6 | `energy.md` + `database.md`/`permissions.md`/`nutrition.md`/`CLAUDE.md`/`ios/NeoGym/CLAUDE.md` updated; final doc review |
| All gates pass | all | `make test`, `bun run check`, `bun run codegen`, `swift build`/`swift test`, `xcodebuild` |

---

## 6. Risks and mitigations

- **Risk:** HealthKit cumulative summing done wrong (latest-wins reuse, per-day zero-drop, DST/off-by-one, unbounded enumeration). — **Mitigation:** Explicit spec: sum per calendar day, per-metric independent `<= 0` drop, `DateComponents(day: 1)` at local midnight, bounded enumeration window; pure grouper tests cover the edge cases.
- **Risk:** Generated Hasura root/input type names differ from the assumed `dailyEnergyEntry*` names. — **Mitigation:** Phase 1 runs `bun run codegen` and a root-field smoke test before any consumer is written; implementers align to generated names.
- **Risk:** Web GraphQL documents fail to typecheck because codegen wasn't re-run. — **Mitigation:** Phase 2 and Phase 5 checks are `bun run codegen && bun run check`, not `bun run check` alone.
- **Risk:** Balance card renders `out = 0`/misleading net when no energy row, or discards valid single-metric data. — **Mitigation:** Defined null semantics (intake-only when no row; missing component = 0); tests for nutrition-only/energy-only/both/neither.
- **Risk:** Cross-route staleness (energy edited on `/energy` doesn't refresh a cached nutrition-day card). — **Mitigation:** Documented `refetchOnMount`/invalidation expectation as a deliberate decision.
- **Risk:** Eighth top-level nav item crowds desktop/mobile. — **Mitigation:** Reuse existing horizontally scrollable tab bar; manual narrow-viewport check; update the CLAUDE.md count note.
- **Risk:** Doc drift (CLAUDE.md "seven entries", permissions.md two touch points). — **Mitigation:** Phase 6 explicitly updates each cited line.

---

## 7. Follow-ups (out of scope for this plan)

- TDEE/BMR estimation, energy goals/targets, and weekly/monthly energy summaries — TBD.
- Writing energy (or any metric) back to Apple Health — TBD.
- Third-party energy sources (non-HealthKit imports) — TBD.
