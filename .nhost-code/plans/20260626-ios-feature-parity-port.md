# iOS feature parity port

**Status:** ready
**Created:** 2026-06-26

---

## 1. Requirements

Captured from the user's request to port the remaining NeoGym web frontend to native iOS, commit this plan, and execute without further prompting.

### 1.1 Problem / motivation

The native iOS app currently covers the scaffolded auth/profile milestone: OTP sign-in/sign-up, saved session bootstrap, sign-out, profile, and PKCE email-change via `neogym://verify`. The TanStack Start web app already contains the rest of the product surface. The goal is to reach native iOS feature parity for workouts, exercises, sessions, journal, nutrition, body measurements, and the signed-in app shell while preserving the existing backend contract.

### 1.2 Functional requirements

- Preserve existing native auth/profile behavior: email OTP sign-in/sign-up, saved session bootstrap, sign-out that always clears local session, profile, and app-side PKCE email change.
- Add a signed-in iOS navigation shell that exposes Workouts, Exercises, Sessions, Body, Nutrition, Journal, and Profile.
- Port exercise catalog list/search/filter, detail/history/progress, public/private visibility, storage images, strength/cardio branching, and ad-hoc session start.
- Port workout list/detail/create/edit/delete, labels, exercise picker, exercise ordering/reordering, and start-session-from-workout.
- Port session list/detail, started-at edit, delete, add/remove exercises, strength set CRUD, cardio entry CRUD from per-exercise metrics schemas, and prior session history.
- Port journal list/detail/create/edit/delete, private labels, label filtering, and native markdown-ish rendering.
- Port body measurement list/chart/detail/create/edit/delete for weight, body fat, and notes.
- Port nutrition landing/dashboard, foods, meals, plans, nutrition days, standalone food logging, meal logging, plan suggestions, editable grams/slot times, logged snapshots, and macro totals.
- Keep the native app aligned with the existing user-role GraphQL schema and Hasura permission model.

### 1.3 Non-functional requirements / constraints

- Keep `ios/NeoGym/Sources/NeoGymKit/` host-testable: no SwiftUI/UIKit in the package sources.
- Put SwiftUI views and visual components under `ios/NeoGym/App/`.
- Use deterministic unit tests with fake services; do not make unit tests depend on a live Nhost backend.
- Use the local Nhost Swift SDK at `../../../../../nhost/nhost/swift/packages/nhost-swift`.
- Use raw GraphQL documents and hand-written DTOs for the parity port; do not introduce Swift GraphQL codegen before parity.
- Preserve the iOS 15 deployment target; do not raise to iOS 16 just to use Swift Charts.
- Do not change backend schema/metadata unless implementation proves a true parity blocker.
- Do not commit generated `.xcodeproj` output.
- Run `cd ios/NeoGym && swift build && swift test` after every iOS code phase. For App changes, also run XcodeGen and simulator `xcodebuild` when available.

### 1.4 Surfaces in scope

- `ios/NeoGym/Sources/NeoGymKit/` — GraphQL service boundary, repositories, DTOs, scalar helpers, pure domain helpers, view models, and fakes.
- `ios/NeoGym/App/` — signed-in shell, list/detail/form/sheet views, reusable components, storage images, custom charts, and native navigation.
- `ios/NeoGym/Tests/NeoGymKitTests/` — deterministic tests for helpers, repositories, view models, fake GraphQL, and mutation variables.
- `ios/NeoGym/project.yml` — only if project settings/resources must change; regenerate but do not commit `.xcodeproj`.
- `frontend/src/routes/_authed/**`, `frontend/src/components/*.tsx`, `frontend/src/lib/*.ts`, `frontend/schema.user.graphqls` — parity references.
- `docs/developers/database.md`, `sessions.md`, `exercises.md`, `nutrition.md`, `permissions.md` — invariants to preserve and update only if implementation discovers doc drift.

### 1.5 Out of scope

- Rewriting the web frontend.
- Backend migrations/metadata changes unless a true parity blocker is found.
- Live-backend-dependent unit tests.
- Committing generated `.xcodeproj` files.
- Native exercise authoring unless a later parity audit finds an existing web UI for it.
- OAuth provider auth parity from `frontend/src/routes/oauth2/login.tsx`; current native auth scope is OTP plus PKCE email change.
- Apple Health, offline-first sync, push notifications, widgets, watchOS, and new product features beyond web parity.

### 1.6 Success criteria

- Every in-scope web route/action has a native iOS equivalent or a documented out-of-scope rationale in `ios/NeoGym/PARITY_CHECKLIST.md`.
- Existing auth/profile/email-change behavior and tests keep passing.
- Each phase is implemented, reviewed, tested, and committed independently.
- Native GraphQL requests match the user-role schema and omit forbidden ownership/discriminator/snapshot columns.
- Core logic has deterministic tests against fakes.
- Final validation runs `swift build`, `swift test`, XcodeGen, and simulator `xcodebuild` when available.

---

## 2. Implementation strategy

### 2.1 Central design decision

Build native parity through a raw-GraphQL, fakeable repository/view-model architecture in `NeoGymKit`, with SwiftUI views kept thin in `App/`. Repositories own raw GraphQL documents and hand-written `Decodable` DTOs that mirror the current web named operations and `frontend/schema.user.graphqls`. A single shared `NhostClient` must back both auth and GraphQL so session storage, auth headers, and token refresh cannot drift. Do not introduce Swift GraphQL codegen until after parity, when raw-document maintenance cost can be judged with real evidence.

### 2.2 Key constraints and invariants

- `NeoGymKit` stays SwiftUI/UIKit-free; App-layer SwiftUI may depend on `NeoGymKit` but not vice versa.
- `NhostClient.graphql.request` returns `NhostResponse<GraphQLResponse<ResponseData>>`; wrappers must unwrap `.body.data`, surface GraphQL `errors`, and preserve `extensions.code`/constraint metadata.
- Fake GraphQL must record queries and variables so tests can assert mutation contract details.
- Mutations must not send forbidden columns such as `userId`, `isPublic`, `kind`, `parentKind`, `slug`, immutable FK columns, or trusted snapshot columns unless the user-role schema explicitly allows them.
- Branch on `exercise.kind == "cardio"`, not category.
- Sessions are private containers; nullable `workout_id` is a template link/label, not a contract.
- Session exercise `exercise_id` is immutable to the user role; replace by delete+insert, not update.
- Cardio entries are schema-driven from `exercises_cardio.metrics_schema`; strength entries are fixed reps/weight rows.
- Nutrition daily totals must use logged snapshot columns, never live `foods` values.
- Nested meal logging must give every child `nutritionLogEntry` the same `nutritionDayId` as the parent `nutritionLogMeal`.
- Logged nutrition times are user-selected/default to now; plan provenance must not force the logged time to the template slot.
- Preserve the iOS 15 deployment target; use custom/gated chart rendering rather than requiring Swift Charts.
- Use path-bound `NavigationStack`/dismissal patterns so submitted, cancelled, or deleted forms do not remain as dead screens on the back stack.
- Native post-mutation refresh convention: every mutation either updates local view-model state deterministically or triggers explicit refetch-on-return/refetch-on-appear for affected screens; cross-screen effects like starting a session from exercise/workout must refresh the destination and stale source summaries when revisited.

### 2.3 Touched surfaces

- `ios/NeoGym/Sources/NeoGymKit/` — add GraphQL foundation, pure helpers, repositories, DTOs, view models, fakes.
- `ios/NeoGym/App/` — add signed-in shell and all domain SwiftUI screens/components.
- `ios/NeoGym/Tests/NeoGymKitTests/` — add helper/repository/view-model tests and mutation-variable contract tests.
- `ios/NeoGym/PARITY_CHECKLIST.md` — new mandatory route/action checklist closed phase-by-phase.
- `ios/NeoGym/project.yml` — only for necessary target/resource changes.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** The backend contract remains unchanged. Existing web and iOS auth flows continue to use the same Nhost project and permissions. Native iOS remains iOS 15-compatible.
- **Deployment:** Each phase is a normal app update. No migrations are planned. Regenerate the Xcode project locally when needed, but verify generated project output is not staged.
- **Rollback:** Standard git revert is sufficient for each phase because phases are self-contained and do not change backend schema. If a later phase causes issues, revert that phase commit while keeping earlier committed tabs functional.

---

## 3. Phased plan of action

### Phase 1 — GraphQL foundation, environment, shell, and parity checklist

**Goal:** Establish the reusable data foundation and signed-in shell that every later vertical slice uses.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/GraphQLServicing.swift` — fakeable GraphQL protocol and wrapper types.
- `ios/NeoGym/Sources/NeoGymKit/NhostGraphQLService.swift` — wrapper around `NhostClient.graphql.request`.
- `ios/NeoGym/Sources/NeoGymKit/FakeGraphQLService.swift` — test fake that returns canned responses/errors and records requests/variables.
- `ios/NeoGym/Sources/NeoGymKit/GraphQLDomainError.swift` — error mapping that preserves messages, `extensions.code`, and constraint names when present.
- `ios/NeoGym/Sources/NeoGymKit/GraphQLScalars.swift` — helpers for `uuid`, `date`, `time`, `timestamptz`, `numeric`, `jsonb`, and `JSONValue` variables.
- `ios/NeoGym/Sources/NeoGymKit/Loadable.swift` — shared load state enum.
- `ios/NeoGym/Sources/NeoGymKit/AppEnvironment.swift` — composition model for shared client/service/repositories where appropriate.
- `ios/NeoGym/Sources/NeoGymKit/NhostClientFactory.swift` — vend a shared client and GraphQL service without breaking existing auth construction.
- `ios/NeoGym/App/NeoGymApp.swift`, `RootView.swift`, `AppShellView.swift` — signed-in shell using one shared `NhostClient` for auth and GraphQL.
- `ios/NeoGym/App/Components/` — loading/error/empty states, confirmation component, section shell, storage image URL/view placeholder.
- `ios/NeoGym/PARITY_CHECKLIST.md` — mandatory web route/action to iOS phase checklist.
- `ios/NeoGym/Tests/NeoGymKitTests/` — GraphQL service, error, scalar, and loadable tests.

**Implementation steps:**

1. Create `GraphQLServicing` with an `execute` API that accepts a raw query, optional variables, and operation name, unwraps `NhostResponse<GraphQLResponse<ResponseData>>`, returns non-optional `data`, and maps errors/missing data/decoding failures.
2. Implement `NhostGraphQLService` over `NhostClient.graphql.request`.
3. Implement `FakeGraphQLService` with request capture so later phases can assert exact GraphQL documents and `[String: JSONValue]` variables.
4. Add scalar/numeric/date/time/json helpers and tests.
5. Ensure `NeoGymApp` constructs one `NhostClient` and passes the same client to `AuthStore`/`NhostAuthService` and `NhostGraphQLService`.
6. Replace the signed-in profile-only branch with a native seven-destination shell. Use a custom discoverable shell if a stock iOS 15 `TabView` would hide destinations behind More; Workouts, Exercises, Sessions, Body, Nutrition, Journal, and Profile must all be directly discoverable.
7. Keep Profile as the only non-placeholder destination for this phase.
8. Verify `AuthCallbackURLRouter`/`neogym://verify` still works when a non-profile tab is active.
9. Establish native navigation and refresh conventions in comments or checklist notes: spent forms pop/dismiss; mutations update local state or refetch affected screens on return/appear.
10. Create `ios/NeoGym/PARITY_CHECKLIST.md` with all in-scope web routes/actions and phase mappings, including context-scoped exercise detail entries from workouts and sessions.

**Tests and checks:**

- Unit tests for fake success, missing data, GraphQL errors with `extensions.code`, decoding failures, variable capture, scalar helpers, and `Loadable` behavior.
- Existing auth tests still pass.
- Deep-link regression test or documented manual check for email-change callback while not on Profile.
- `cd ios/NeoGym && swift build`
- `cd ios/NeoGym && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` when available.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Signed-in users see a working native shell and can reach Profile.
- Existing auth/profile/email-change flows remain functional.
- GraphQL foundation is fakeable, records variables, preserves structured error data, and shares the same Nhost client/session source as auth.
- Parity checklist is committed and ready to close phase-by-phase.

**Phase commit message:** `feat(ios): add graphql foundation and signed-in shell`

**Implementation log**

Implemented GraphQL foundation, signed-in shell, and the mandatory parity checklist.
Added `GraphQLServicing`, `NhostGraphQLService`, `FakeGraphQLService`,
structured `GraphQLDomainError`, scalar helpers, `Loadable`, and shared
`AppEnvironment` composition. Updated `NeoGymApp`/`RootView` so auth and GraphQL
share one `NhostClient`, and added a seven-destination shell with Profile as the
only completed destination. Added shared App loading/error/empty/confirmation and
storage-image placeholder components plus `ios/NeoGym/PARITY_CHECKLIST.md`.

Reviewer verdict: `ACCEPT`. The reviewer verified the diff from
`feaa3f39de79a2663dccba4a457ae69bbf81dbfe`, confirmed the shell keeps all seven
destinations directly discoverable, confirmed deep-link handling remains above
the shell selection state, and reran `swift build` and `swift test` successfully.
Accepted informational concerns: `NhostClientFactory.makeGraphQLService()` can
create an unused separate client if called directly, so later phases should prefer
`AppEnvironment.makeEnvironment()` or document/remove the helper; `numeric(Decimal)`
uses a string while `numeric(Double)` uses a number to preserve precision.

Autonomous decisions recorded:

- **Correctness:** used a shared `NhostClient` in `AppEnvironment` for both auth
  and GraphQL to avoid session/header drift.
- **Long-term maintenance:** used a custom directly discoverable shell instead of
  relying on a seven-item stock `TabView` that could hide destinations behind
  iOS's More UI.
- **Correctness:** accepted a documented/code-reviewed deep-link regression check
  instead of an interactive simulator link-click smoke test; `RootView` owns the
  callback router above `AppShellView`, so callbacks are independent of active tab.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 40 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- `lens_diagnostics mode=all` — no blocking errors; markdown line-length warnings
  remain in the plan artifact only.
- Generated `.xcodeproj` output was not staged.

### Phase 2 — Shared domain helpers

**Goal:** Port reusable web helper semantics into tested, pure Swift before domain UI depends on them.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/DateOnly.swift` — date-only parse/format helpers from `frontend/src/lib/dates.ts`.
- `ios/NeoGym/Sources/NeoGymKit/SessionDisplayName.swift` — session display fallback from `frontend/src/lib/sessions.ts`.
- `ios/NeoGym/Sources/NeoGymKit/CardioMetricsSchema.swift` — metrics schema/spec/format/input logic from `frontend/src/lib/cardio-schema.ts`.
- `ios/NeoGym/Sources/NeoGymKit/NutritionMath.swift` — macro normalization/totals/formatting from `frontend/src/lib/nutrition.ts`.
- `ios/NeoGym/Sources/NeoGymKit/IntakeGrouping.swift` — nutrition time-slot grouping helpers needed later.
- `ios/NeoGym/Sources/NeoGymKit/MarkdownRendering.swift` — minimal native renderer model for paragraphs, headings, lists, and inline markdown.
- `ios/NeoGym/Tests/NeoGymKitTests/*Tests.swift` — mirrored tests from TS helper tests plus edge cases.

**Implementation steps:**

1. Port date-only helpers so `YYYY-MM-DD` never shifts across time zones.
2. Port session display name logic: workout name, first exercise, `+N more`, or `Untitled session`.
3. Port cardio metric schema parsing from `JSONValue`, metric ordering, required fields, numeric/duration parsing, formatting, averaging-vs-summing, and the 3600-second hidden-hours boundary.
4. Port nutrition numeric normalization for Hasura numeric strings, macro totals from live template foods and logged snapshots, formatting, and in-use error recognition helpers.
5. Add minimal markdown block parsing with inline `AttributedString(markdown:)` where available; do not add dependencies unless implementation proves this cannot meet current web parity.
6. Add tests that mirror existing TS tests and cover edge cases used by later phases.

**Tests and checks:**

- Unit tests for date-only, session display, cardio schema, macro math, intake grouping skeleton behavior, markdown parsing, and numeric string normalization.
- `cd ios/NeoGym && swift build`
- `cd ios/NeoGym && swift test`

**Definition of done:**

- Later domain view models can reuse tested helpers instead of duplicating parsing, display, and math in SwiftUI views.
- Helper behavior matches the web semantics that affect persisted data or user-visible totals.

**Phase commit message:** `feat(ios): port shared domain helpers`

**Implementation log**

Implemented pure Foundation helpers for date-only values, session display names,
cardio metric schemas and validation, nutrition math, intake grouping, and minimal
markdown rendering. Added tests for date parsing/formatting, session name
fallbacks, cardio metric ordering/formatting/validation and duration boundaries,
macro normalization/totals including snapshot totals, intake time-slot grouping,
and markdown stripping/block parsing.

Reviewer verdict: `ACCEPT`. The reviewer compared the new helpers against the
web counterparts and reran `swift build` and `swift test` successfully. Accepted
informational concerns: equal `x-order` cardio metrics sort alphabetically in
Swift because `JSONValue.object` is dictionary-backed and cannot recover JSON
insertion order; Swift `<` is used instead of JS `localeCompare` for UUID/time
strings, which is equivalent for current data shapes.

Autonomous decisions recorded:

- **Correctness:** mirrored web helper semantics and tests rather than inventing
  native-only behavior, so later domain phases match persisted/user-visible web
  behavior.
- **Long-term maintenance:** split cardio validation and intake source-unit logic
  into small focused files while keeping all APIs pure `NeoGymKit`.
- **Correctness/security:** added explicit logged snapshot total helpers so later
  nutrition phases do not accidentally compute history from mutable live foods.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 82 tests.
- `lens_diagnostics mode=all` — no blocking errors; markdown style warnings remain
  in the plan artifact only.

### Phase 3 — Exercises catalog and exercise detail

**Goal:** Provide native exercise browse/detail/history parity and allow starting ad-hoc sessions from an exercise.

**Depends on:** Phases 1-2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/ExerciseModels.swift` — exercise DTO/domain models.
- `ios/NeoGym/Sources/NeoGymKit/ExercisesRepository.swift` — raw GraphQL for `ExercisesIndex`, `ExerciseDetail`, `ExercisePickerExercises`, `PriorSessionsPerExercise`, and ad-hoc `StartSession`.
- `ios/NeoGym/Sources/NeoGymKit/ExerciseViewModels.swift` — list/detail/search/filter/start-session logic.
- `ios/NeoGym/App/Exercises*.swift` — SwiftUI list, filters, detail, history/progress, and start action.
- `ios/NeoGym/App/Components/StorageImageView.swift` — async storage image display.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close exercise list/detail actions and note no native exercise authoring because web has no route for it.

**Implementation steps:**

1. Mirror `frontend/src/routes/_authed/exercises/index.tsx` list fields and filters: query text, muscle, category, equipment, level, and visibility.
2. Mirror `frontend/src/components/exercise-detail.tsx` detail fields, storage images, sidecar display, and history/progress summaries.
3. Branch logging/detail behavior on `kind == "cardio"` and use `cardio.metricsSchema` through the Phase 2 helper.
4. Implement ad-hoc session start with nested `insertWorkoutSession(object:)` using `workoutId: null`, `startedAt`, and one `workoutSessionExercises.data` row at position 0.
5. Add navigation from workout/session context-scoped exercise-detail entry points later by exposing reusable detail destinations.
6. Do not add exercise create/edit/delete unless the parity checklist finds a current web UI for it.

**Tests and checks:**

- Fixture decoding tests for list/detail/history payloads.
- Search/filter view-model tests.
- Mutation-variable test for ad-hoc start proving no forbidden `userId`, `kind`, or `parentKind` fields.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Exercises tab supports browse, filter, detail, history/progress, and ad-hoc session start.
- Exercise authoring is explicitly documented as out of scope unless web parity says otherwise.
- App remains functional if history/progress has to be split into a sub-step inside this phase; the phase is not complete until it is present or explicitly deferred in the checklist.

**Phase commit message:** `feat(ios): add exercise catalog and detail`

**Implementation log**

Implemented native exercise catalog models, repository GraphQL operations,
list filtering/search/visibility, detail history/progress builders, and ad-hoc
session start. Wired the Exercises shell destination to real list/detail SwiftUI
screens with filters, storage images, strength/cardio sidecar display, history,
and simple iOS 15-compatible trend visuals. Added reusable exercise detail
surfaces for later workout/session context entry points and updated the parity
checklist to mark Phase 3 exercise items complete.

Reviewer verdict: `ACCEPT`. The reviewer verified GraphQL parity for
`ExercisesIndex`, `ExerciseDetail`, and `StartSession`; checked strength/cardio
progress math against the web implementation; and reran `swift build`,
`swift test`, XcodeGen, and simulator `xcodebuild` successfully. Accepted
non-blocking concerns: the unused `priorSessionsPerExerciseQuery` currently
diverges from the web prior-session query and must be reconciled in Phase 6;
search uses a custom fuzzy matcher instead of Fuse.js, so edge-case ordering may
differ; start-session destination navigation is deferred to Phase 5.

Autonomous decisions recorded:

- **Correctness:** kept exercise authoring out of scope because the current web
  route inventory has exercise list/detail only.
- **Long-term maintenance:** exposed reusable exercise detail surfaces so later
  workout/session context entry points can link to the same implementation.
- **Security/correctness:** added mutation-variable tests proving ad-hoc session
  start omits forbidden ownership/discriminator columns.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 89 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 4 — Workouts

**Goal:** Add full native workout template CRUD and start-session-from-workout parity.

**Depends on:** Phases 1-3

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/WorkoutModels.swift` — workout/label/exercise row models.
- `ios/NeoGym/Sources/NeoGymKit/WorkoutsRepository.swift` — GraphQL operations for list/detail/create/edit/delete/labels/start.
- `ios/NeoGym/Sources/NeoGymKit/WorkoutFormModel.swift` — validation, ordering, labels, exercise row state.
- `ios/NeoGym/Sources/NeoGymKit/WorkoutViewModels.swift` — screen view models.
- `ios/NeoGym/App/Workouts*.swift` — list, detail, create/edit forms, delete confirmation.
- `ios/NeoGym/App/ExercisePicker*.swift`, `LabelInput*.swift` — reusable picker/input views.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close workout routes/actions and context exercise navigation from workouts.

**Implementation steps:**

1. Port workout list/detail fields and public/private handling.
2. Port create/edit forms with name, description, labels, exercise picker, ordered/reorderable exercise rows.
3. Implement label creation/attachment/detachment according to web mutation shapes.
4. Implement delete with confirmation and friendly errors where applicable.
5. Implement start-session-from-workout using nested `workoutSessionExercises.data` copied from the workout's ordered exercise list.
6. Ensure form submit/cancel/delete pops/dismisses spent form screens rather than leaving them navigable.
7. Wire exercise detail navigation from workouts to the reusable exercise detail destination.

**Tests and checks:**

- Fixture decoding tests for list/detail/edit payloads.
- Form model tests for ordering, duplicate prevention if matching web behavior, labels, and validation.
- Mutation-variable tests for create/edit/delete/start proving no forbidden ownership/discriminator columns.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Workouts tab supports list, detail, create, edit, delete, labels, exercise order, and start session.
- Context exercise detail navigation from a workout works.
- Existing Exercises and Profile tabs still work.

**Phase commit message:** `feat(ios): add workout management`

**Implementation log**

Implemented native workout management: list, detail, create, edit, delete,
labels, exercise picker, ordering controls, and start-session-from-workout. Added
Workout models, repository operations, form model, view models, SwiftUI list/detail
/form/picker/label views, and tests for fixture decoding, form behavior, filtering,
and mutation-variable contracts. Wired the Workouts shell destination and workout
context exercise detail navigation, and updated the parity checklist.

Reviewer verdict: `ACCEPT_WITH_CONCERNS`. The reviewer verified the workout
GraphQL operations match the web documents, including label and workout-label
conflict constraints and position rewrite semantics; verified forbidden columns
are omitted; and reran build/test/Xcode checks successfully. Accepted concerns:
Phase 4 log needed this bookkeeping update before commit; `ExercisePickerView`
uses dictionary values for multi-select confirmation, so insertion order may differ
from the web picker, but users can reorder after adding.

Autonomous decisions recorded:

- **Correctness:** mirrored web mutation shapes and omitted ownership,
  public/private, and discriminator columns from write variables.
- **Long-term maintenance:** reused Phase 3 exercise list/detail surfaces for
  workout exercise picking and workout-context detail navigation.
- **Correctness:** accepted the picker multi-select ordering concern as
  non-blocking because the form exposes ordering controls and mutation tests
  verify persisted positions.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 100 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 5 — Sessions list/detail and strength logging

**Goal:** Make strength sessions fully usable before adding cardio-specific logging.

**Depends on:** Phases 1-4

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/SessionModels.swift` — sessions, session exercises, strength sets, cardio entry shells.
- `ios/NeoGym/Sources/NeoGymKit/SessionsRepository.swift` — GraphQL operations for sessions index/detail, startedAt update, delete, session exercise insert/delete, strength set CRUD.
- `ios/NeoGym/Sources/NeoGymKit/SessionViewModels.swift` — list/detail/strength logging state.
- `ios/NeoGym/App/Sessions*.swift` — list/detail, startedAt editing, add/remove exercise, strength set UI, delete confirmation.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close sessions list/detail strength actions and context exercise navigation from sessions.

**Implementation steps:**

1. Port sessions list and `sessionDisplayName` usage.
2. Port session detail with workout attribution and ordered session exercises.
3. Implement startedAt edit and session delete.
4. Implement add/remove session exercises using insert/delete, not `exercise_id` update.
5. Implement strength set add/edit/delete for strength session exercises, including double-weight display/volume hints where web shows them.
6. Do not implement session exercise reordering unless the current web UI exposes it; update positions only if parity requires it.
7. Never send `kind` or `parentKind` in session exercise or strength set mutations.
8. Wire exercise detail navigation from sessions to the reusable exercise detail destination.

**Tests and checks:**

- Fixture decoding tests for sessions index/detail.
- View-model tests for display names, startedAt edit, add/remove exercise, delete session, and strength set CRUD.
- Mutation-variable tests proving forbidden fields are absent and immutable FK updates are not attempted.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Sessions tab supports list/detail, startedAt edit, delete, exercise add/remove, and strength set logging.
- Strength users can complete a session workflow while cardio logging waits for Phase 6.
- App remains functional with all previously implemented tabs.

**Phase commit message:** `feat(ios): add session strength logging`

**Implementation log**

Implemented native session list/detail and strength logging. Added session DTOs,
raw GraphQL repository operations, list/detail view models, a Sessions shell tab,
started-at editing, delete confirmation, add/remove exercise via insert/delete,
strength set add/edit/delete, and session-context exercise detail navigation.
Cardio session exercises render a Phase 6 placeholder while preserving remove and
detail navigation. Updated the parity checklist for completed Phase 5 routes and
added deterministic repository/view-model/mutation-variable tests.

Reviewer verdict: `ACCEPT_WITH_CONCERNS`. The reviewer verified byte-faithful
session queries and mutation shapes, confirmed no `exerciseId` update path or
forbidden discriminator/ownership fields are present, and reran build/test/Xcode
checks successfully. Accepted concerns: strength rows show an extra per-set volume
hint beyond the web UI, and start-session deep-link navigation may occasionally
fall back to the sessions list rather than opening detail immediately; both
degrade harmlessly and Phase 6/ongoing navigation work can refine them.

Autonomous decisions recorded:

- **Correctness/security:** session exercise changes use insert/delete only; no
  `exerciseId` update path was added, and mutation-variable tests assert no
  `kind`, `parentKind`, or ownership columns are sent.
- **Correctness:** session exercise reordering was not implemented because the
  current web session UI does not expose it.
- **Long-term maintenance:** reused the Phase 3 exercise picker/detail surfaces
  for session add-exercise and context exercise navigation.
- **Correctness:** accepted the per-set volume and conditional NavigationLink
  concerns as non-blocking because total volume remains visible, persisted data
  semantics match the web, and failed detail deep-link still lands users on the
  sessions list.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 108 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 6 — Sessions cardio logging and prior history

**Goal:** Complete session detail parity by adding schema-driven cardio entries and prior session history.

**Depends on:** Phases 1-5

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/SessionsRepository.swift` — add cardio entry CRUD and prior session query.
- `ios/NeoGym/Sources/NeoGymKit/CardioEntryFormModel.swift` — schema-driven form seeding/validation.
- `ios/NeoGym/Sources/NeoGymKit/SessionViewModels.swift` — integrate cardio entries and prior history.
- `ios/NeoGym/App/CardioMetricsFormView.swift`, `CardioEntriesListView.swift`, session prior-history UI.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close cardio logging and prior-history session actions.

**Implementation steps:**

1. Port cardio entry list/add/edit/delete UI from `cardio-metrics-form.tsx` and `cardio-entries-list.tsx`.
2. Use `exercise.cardio.metricsSchema` and Phase 2 validation/formatting for required fields, min/max, duration, integer/decimal, and average metrics.
3. Implement `PriorSessionsPerExercise` query and display prior strength/cardio entries per exercise.
4. Never send `parentKind`; rely on DB default/check/FK.
5. Ensure malformed client-side metrics are blocked before mutation and server errors are shown if DB validation still rejects.

**Tests and checks:**

- Cardio form seeding/validation tests, including duration and average formats.
- Mutation-variable tests for insert/update/delete cardio entries proving `parentKind` is absent.
- Fixture/view-model tests for prior history.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Session detail supports both strength and cardio logging with prior history.
- Cardio metrics behave according to per-exercise schemas.
- Sessions parity is complete.

**Phase commit message:** `feat(ios): add session cardio logging`

**Implementation log**

Implemented schema-driven cardio logging and prior session history. Added cardio
entry insert/update/delete repository operations, corrected the prior-session
query to match the web shape (`limit: 3` and exclude current session), added
`CardioEntryFormModel`, native cardio entry list/form sheets, prior history
summary views, and integration in session detail. Updated tests for form
seeding/validation, cardio mutation variables, prior history, and checklist
completion.

Reviewer verdict: `ACCEPT`. The reviewer verified the prior-session query and
cardio mutations match the web documents, confirmed cardio variables omit
`parentKind`, `kind`, and `userId`, and reran build/test/Xcode checks
successfully. Accepted concern: `CardioEntriesListView` has a non-wrapping
`FlowLayout`/`HStack`, so many metric tags may truncate on narrow screens; this is
cosmetic and can be refined later.

Autonomous decisions recorded:

- **Correctness/security:** cardio insert/update/delete variables omit
  `parentKind` and other forbidden discriminator/ownership columns.
- **Correctness:** reconciled the Phase 3 prior-session query divergence by
  matching the web query's current-session exclusion and per-exercise limit.
- **Long-term maintenance:** reused Phase 2 cardio parsing/validation helpers in
  `CardioEntryFormModel` rather than duplicating schema logic in SwiftUI views.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 113 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 7 — Body measurements

**Goal:** Add native body measurement CRUD and trend visualization parity.

**Depends on:** Phases 1-2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/BodyMeasurementModels.swift` — DTO/domain models.
- `ios/NeoGym/Sources/NeoGymKit/BodyMeasurementsRepository.swift` — GraphQL operations.
- `ios/NeoGym/Sources/NeoGymKit/BodyMeasurementsViewModel.swift` — list/detail/form/chart state.
- `ios/NeoGym/App/Body*.swift` — list, detail, form, delete confirmation, chart/trend view.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close body routes/actions.

**Implementation steps:**

1. Port list, detail, create, edit, and delete flows from `frontend/src/routes/_authed/body/*`.
2. Port validation from `body-measurement-form.tsx`.
3. Handle `(user_id, measured_on)` uniqueness/constraint errors with friendly copy using structured GraphQL error metadata where possible.
4. Implement an iOS-15-compatible chart/trend view with `Path`/`GeometryReader` or a gated chart wrapper with equivalent fallback data display.
5. Use Phase 2 `DateOnly` helpers for measured dates.

**Tests and checks:**

- Fixture decoding tests.
- Form validation tests.
- Mutation-variable tests for insert/update/delete.
- Chart data normalization tests.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Body tab supports measurement list, detail, create, edit, delete, and trend display.
- Date-only values do not shift with time zone.
- Previously implemented tabs remain functional.

**Phase commit message:** `feat(ios): add body measurements`

**Implementation log**

Implemented native body measurements: raw GraphQL repository operations, DTOs,
form validation, list/detail/editor view models, list/detail/create/edit/delete
SwiftUI flows, and an iOS 15-compatible custom trend chart. Wired the Body shell
destination and updated the parity checklist to mark body routes complete.
Added deterministic decoding, form-validation, mutation-variable, constraint-error,
and chart-normalization tests.

Reviewer verdict: `ACCEPT`. The reviewer verified GraphQL parity with the web body
routes, mutation safety, validation ranges, duplicate-date constraint mapping,
DateOnly usage, and iOS 15-compatible trend rendering. All build/test/Xcode gates
passed. Accepted concern: the trend chart and date formatting are native
approximations rather than pixel-identical web rendering, which matches the plan's
native parity goal.

Autonomous decisions recorded:

- **Correctness:** used Phase 2 `DateOnly` helpers for form defaults, date picker
  round-tripping, list/detail formatting, and chart normalization so Postgres
  `date` values do not shift with timezone.
- **Correctness/security:** body measurement mutations only send `measuredOn`,
  `weightKg`, `bodyFatPct`, and `notes`; tests assert no `userId` ownership write.
- **Compatibility:** used a custom `Path`/`GeometryReader` chart instead of Swift
  Charts to preserve the iOS 15 deployment target.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 126 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 8 — Journal

**Goal:** Add native journal entries, labels, filtering, editing, and rendering parity.

**Depends on:** Phases 1-2 and Phase 4 label-input patterns

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/JournalModels.swift` — entries, labels, junctions.
- `ios/NeoGym/Sources/NeoGymKit/JournalRepository.swift` — GraphQL operations.
- `ios/NeoGym/Sources/NeoGymKit/JournalViewModels.swift` — list/detail/form/filter state.
- `ios/NeoGym/App/Journal*.swift` — list, filters, detail, create/edit, delete, markdown render.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close journal routes/actions.

**Implementation steps:**

1. Port journal list and label filter behavior.
2. Port detail, create, edit, and delete flows.
3. Port private label create/attach/detach behavior through the same semantics as web `LabelInput`.
4. Render body with the minimal native markdown renderer from Phase 2; keep raw body editable.
5. Ensure spent forms pop/dismiss on submit/cancel/delete.

**Tests and checks:**

- Fixture decoding tests.
- Label normalization/attach/detach tests.
- Mutation-variable tests for entry/label/junction operations.
- Markdown helper tests already from Phase 2 plus any journal-specific cases.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Journal tab supports list, filters, detail, create, edit, delete, labels, and markdown-ish read rendering.
- Journal labels remain private/user-scoped through existing permissions.

**Phase commit message:** `feat(ios): add journal entries`

**Implementation log**

Implemented native journal entries: models, raw GraphQL repository operations,
list/detail/editor view models, and SwiftUI list/detail/create/edit/delete
screens. Wired the Journal shell destination, ported AND-semantics label
filtering, reused the Phase 4 label input semantics for private journal label
create/attach/detach, rendered read bodies through the Phase 2 markdown helper,
and updated the parity checklist.

Reviewer verdict: `ACCEPT`. The reviewer verified web parity for label filtering,
preview stripping, label normalization and diffing, and GraphQL mutation shapes;
confirmed user-role mutation variables omit ownership/public/discriminator fields;
and reran build/test/diagnostic checks successfully. Accepted low-severity notes:
`journalLabelsFilterQuery` duplicates the labels-for-form query and can be cleaned
later; journal label chips use a non-wrapping row consistent with earlier label
views; markdown rendering remains intentionally minimal per plan scope.

Autonomous decisions recorded:

- **Correctness:** mirrored web journal mutations, including nested new-label creation with `journal_labels_user_name_key`, join-row conflict handling, and edit-time label diffing.
- **Long-term maintenance:** kept journal label normalization/form behavior in `NeoGymKit` and used a Journal-specific SwiftUI input patterned after the existing Phase 4 label input.
- **Security/correctness:** added mutation-variable tests proving entry, label, and junction writes omit ownership/discriminator/public columns and use user-role-permitted shapes.

Quality gate:

- `cd ios/NeoGym && swift build` — passed.
- `cd ios/NeoGym && swift test` — passed, 136 tests.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` — passed.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — passed.
- Generated `.xcodeproj` output was not staged.

### Phase 9 — Nutrition foods and meals

**Goal:** Add native nutrition food and meal template management.

**Depends on:** Phases 1-2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/FoodModels.swift`, `MealModels.swift` — DTO/domain models.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — food and meal GraphQL operations.
- `ios/NeoGym/Sources/NeoGymKit/NutritionFoodMealViewModels.swift` — list/detail/form/picker state.
- `ios/NeoGym/App/Nutrition/NutritionShellView.swift` — top-level Nutrition sub-navigation scaffold with Overview, Days, Plans, Foods, Meals.
- `ios/NeoGym/App/Nutrition/Foods*.swift`, `Meals*.swift` — food/meal screens.
- `ios/NeoGym/App/Nutrition/FoodPicker*.swift`, `MacroSummary*.swift` — shared picker/summary.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close nutrition foods/meals actions.

**Implementation steps:**

1. Add Nutrition sub-navigation inside the single top-level Nutrition destination so Overview/Days/Plans/Foods/Meals stay discoverable.
2. Port foods list/detail/create/edit/delete from web routes.
3. Port meal list/detail/create/edit/delete with ingredients and food picker.
4. Compute template macro totals from live food values for meals.
5. Handle `ON DELETE RESTRICT` food-in-use failures with friendly copy.
6. Ensure food/meal mutations omit ownership/public fields and immutable `foodId` updates.

**Tests and checks:**

- Fixture decoding tests for food/meal payloads.
- Macro math tests from Phase 2 plus meal-specific totals.
- Mutation-variable tests for food CRUD and nested meal/ingredient operations.
- In-use error mapping tests.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Nutrition tab has a working sub-navigation scaffold.
- Foods and meals support CRUD, pickers, and macro summaries.
- Delete restrictions are surfaced clearly.

**Phase commit message:** `feat(ios): add nutrition foods and meals`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 10 — Nutrition plans

**Goal:** Add native nutrition plan template management.

**Depends on:** Phases 1-2 and 9

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanModels.swift` — plans and slots.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — plan GraphQL operations.
- `ios/NeoGym/Sources/NeoGymKit/NutritionPlanViewModels.swift` — list/detail/form/slot state.
- `ios/NeoGym/App/Nutrition/Plans*.swift` — list, detail, create/edit forms, delete.
- `ios/NeoGym/App/Nutrition/MealPicker*.swift` — meal picker.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close nutrition plans actions.

**Implementation steps:**

1. Port plans list/detail/create/edit/delete from web routes.
2. Port ordered meal slots with `slotTime`, labels, and positions.
3. Reuse meal picker and macro totals to show plan summaries.
4. Handle `ON DELETE RESTRICT` meal-in-plan failures with friendly copy.
5. Ensure mutations do not attempt immutable `mealId` updates; use delete+insert for slot meal changes if matching web behavior.

**Tests and checks:**

- Fixture decoding tests for plan payloads.
- Slot ordering/time tests.
- Mutation-variable tests for plan/slot create/edit/delete.
- In-use error mapping tests.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Nutrition Plans sub-section supports full CRUD with ordered meal slots and macro totals.
- Foods and Meals from Phase 9 remain functional.

**Phase commit message:** `feat(ios): add nutrition plans`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 11 — Nutrition days, dashboard, and daily logging

**Goal:** Complete nutrition parity with day browsing, plan suggestions, food/meal logging, editable logs, and snapshot-based totals.

**Depends on:** Phases 1-2, 9-10

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NutritionDayModels.swift` — days, log groups, log entries, slots.
- `ios/NeoGym/Sources/NeoGymKit/NutritionRepositories.swift` — day/log GraphQL operations.
- `ios/NeoGym/Sources/NeoGymKit/DailyIntakeViewModel.swift` — day open/create/update/delete, grouping, logging.
- `ios/NeoGym/App/Nutrition/NutritionOverview*.swift` — landing/dashboard.
- `ios/NeoGym/App/Nutrition/DailyIntake*.swift` — days list/detail/log UI.
- `ios/NeoGym/App/Nutrition/LogFood*.swift`, `LogMeal*.swift` — logging sheets/dialogs.
- `ios/NeoGym/PARITY_CHECKLIST.md` — close nutrition days/logging actions.

**Implementation steps:**

1. Port nutrition overview and day/date browsing.
2. Implement create/update/delete `nutritionDay` and plan selection/clearing as suggestions.
3. Implement standalone food logging with user-selected/default-now `slotTime`, grams, and position.
4. Implement meal logging with one nested `insertNutritionLogMeal`; every child entry must explicitly include the same `nutritionDayId` as the parent group.
5. Implement edit grams/positions and supported times; delete entries/groups/day.
6. Compute daily totals exclusively from logged `snapshot*Per100g` fields.
7. Preserve plan provenance but never force logged `slotTime` to a plan template slot.
8. Use the native refresh convention so day totals and nutrition overview update after logging changes.

**Tests and checks:**

- Fixture decoding tests for daily intake payloads.
- Intake grouping/time-slot tests.
- Mutation-variable tests for log-food/log-meal proving same `nutritionDayId` on children and no snapshot/ownership writes.
- Snapshot total tests proving live food values are not used for logged totals.
- `cd ios/NeoGym && swift build && swift test`
- XcodeGen and simulator `xcodebuild` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- Nutrition supports overview, day browsing, plan suggestions, standalone food logging, meal logging, edits, deletes, and snapshot-based totals.
- Nutrition parity is complete.
- Phase may be split internally if `daily-intake-log.tsx` parity becomes too large, but the phase is not complete until all daily logging checklist items are closed.

**Phase commit message:** `feat(ios): add nutrition daily logging`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 12 — Cross-domain parity QA and polish

**Goal:** Close the parity checklist, polish cross-domain behavior, and validate feature parity end-to-end.

**Depends on:** Phases 1-11

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/PARITY_CHECKLIST.md` — mark every in-scope route/action complete or explicitly out of scope.
- `ios/NeoGym/App/` — polish navigation, loading, empty, errors, confirmations, formatting, and discoverability.
- `ios/NeoGym/Sources/NeoGymKit/` — fix any helper/view-model inconsistencies found during QA.
- `ios/NeoGym/Tests/NeoGymKitTests/` — add regression tests for any defects found.

**Implementation steps:**

1. Verify every web route/action in the checklist, including context-scoped exercise detail navigation from workouts and sessions.
2. Verify native navigation/back behavior and spent-form dismissal across all forms and delete flows.
3. Verify destructive confirmations, loading/error/empty states, refresh-on-return/refetch-on-appear behavior, date/time/numeric formatting, and storage image fallbacks.
4. Run auth regression checks: OTP sign-in/sign-up, sign-out clear, profile, email change callback.
5. Run local backend manual smoke tests when available for exercise browse/start, workout CRUD/start, strength/cardio logging, journal CRUD, body CRUD, and nutrition logging.
6. Document any manual test gaps in the implementation log.

**Tests and checks:**

- Full `cd ios/NeoGym && swift build`
- Full `cd ios/NeoGym && swift test`
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` when available.
- `cd ios/NeoGym && xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` when available.
- Verify generated `.xcodeproj` changes are not staged.

**Definition of done:**

- The checklist shows feature parity for every in-scope web route/action.
- All configured tests/checks pass or any unavailable simulator/local-backend checks are explicitly documented.
- No auth/profile regressions remain.

**Phase commit message:** `test(ios): verify native feature parity`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Preserve OTP auth, saved session, sign-out clear, profile, PKCE email change | 1, 12 | Existing auth tests, deep-link regression, manual smoke |
| Signed-in primary navigation | 1 | Shell build, direct destination discovery, xcodebuild |
| Shared helper semantics | 2 | Date/cardio/nutrition/session/markdown unit tests |
| Exercise browse/detail/history/ad-hoc start | 3 | Repository/view-model tests, mutation-variable tests, checklist |
| Workout CRUD/labels/exercise ordering/start | 4 | Form tests, mutation-variable tests, checklist |
| Session list/detail/strength logging | 5 | Session display and strength mutation tests, checklist |
| Session cardio logging/prior history | 6 | Cardio schema/form/prior-history tests, checklist |
| Body measurement CRUD/chart | 7 | CRUD/error/chart data tests, checklist |
| Journal CRUD/labels/markdown | 8 | Label/markdown/mutation tests, checklist |
| Nutrition foods/meals | 9 | Macro, picker, CRUD, in-use error tests, checklist |
| Nutrition plans | 10 | Slot/time/order/mutation tests, checklist |
| Nutrition days/logging/snapshot totals | 11 | Intake grouping, same-day nested mutation, snapshot total tests, checklist |
| Full parity and polish | 12 | Completed checklist, full gates, manual smoke notes |
| Backend contract unchanged | all | No backend files changed unless explicitly justified; mutation tests omit forbidden fields |

---

## 6. Risks and mitigations

- **Risk:** Raw GraphQL documents and DTOs drift from `frontend/schema.user.graphqls`. — **Mitigation:** Mirror web named operations, keep repository documents close to DTO tests, use realistic fixtures, and add mutation-variable contract tests for every write path.
- **Risk:** Auth and GraphQL use different Nhost clients/session stores. — **Mitigation:** Phase 1 requires a single shared `NhostClient` for auth and GraphQL.
- **Risk:** Hasura scalar decoding differs across `numeric`, `date`, `time`, `timestamptz`, and `jsonb`. — **Mitigation:** Centralize scalar helpers in Phase 1 and pure helper tests in Phase 2.
- **Risk:** Forbidden columns are accidentally sent in mutations and fail at runtime. — **Mitigation:** FakeGraphQL request capture and per-phase mutation-variable tests assert forbidden fields are absent.
- **Risk:** Sessions and nutrition are too large for a single safe pass. — **Mitigation:** Split sessions into strength/cardio phases and nutrition into foods/meals, plans, and daily logging. Allow internal sub-steps but keep phase DoD strict.
- **Risk:** iOS 15 chart limitations. — **Mitigation:** Use a custom/gated chart/fallback rather than raising deployment target.
- **Risk:** Markdown is not pixel-perfect with web rendering. — **Mitigation:** Provide minimal block and inline native rendering that meets current product parity; add no dependency unless proven necessary.
- **Risk:** Lack of UI automation misses visual regressions. — **Mitigation:** Keep logic in tested view models, run xcodebuild, and document manual smoke checks in Phase 12.

---

## 7. Follow-ups (out of scope for this plan)

- Swift GraphQL codegen — tracked in: TBD after parity if raw-document maintenance becomes painful.
- Exercise authoring UI — tracked in: TBD only if web adds or is found to have an exercise authoring surface.
- OAuth provider native auth parity — tracked in: TBD; current native auth scope is OTP and PKCE email-change.
- Offline-first sync, Apple Health, push notifications, widgets, watchOS — tracked in: TBD future product planning.
