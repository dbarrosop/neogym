# Native iOS Swift Frontend with nhost-swift

**Status:** ready
**Created:** 2026-06-07

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

NeoGym currently runs as a TanStack/React web/PWA in `frontend/`. Add a native SwiftUI iOS app for native/App Store use while keeping the web frontend supported in parallel. Since Nhost has no official Swift SDK, introduce a reusable NeoGym-scoped `NhostSwift` package so auth, session, GraphQL, and storage behavior stays centralized and close to the current `@nhost/nhost-js` usage.

### 1.2 Functional requirements

- Add a SwiftUI iOS 17+ app under `ios/`.
- Add `NhostSwift` for NeoGym's Nhost Auth + GraphQL transport + Storage use cases.
- Add `NeoGymCore` for pure Swift domain logic ported from `frontend/src/lib/*`.
- Add `NeoGymAPI` for user-role GraphQL operation documents, generated models, and lightweight repositories using the shared `frontend/schema.user.graphqls` contract.
- Reach phased feature parity for auth/profile/change-email verify, protected tabs, sessions, exercises, workouts, body metrics, journal, markdown, charts, labels, storage images, loading/error/empty states, destructive confirmations, and replace-style navigation.
- Preserve the existing backend schema and web frontend. Native work is additive except documentation, shared-contract tooling, and iOS redirect allowlist config.

### 1.3 Non-functional requirements / constraints

- Persist the full last session in Keychain and reuse valid access tokens on cold launch; refresh near expiry through a serialized actor.
- Store the PKCE verifier in Keychain and wipe it in a `defer`/`finally`-equivalent after token exchange.
- Never bundle a Hasura admin secret or private credential in the native app; use user-role GraphQL only.
- Consume the committed user-role SDL at `frontend/schema.user.graphqls`; distinguish offline iOS operation codegen from backend-required SDL regeneration/drift checks.
- Keep docs in sync in the same phase as behavior lands; do not front-load stale future feature claims.
- Xcode is host-provided. Frontend Bun/Biome remain Nix-sourced per `CLAUDE.md`.

### 1.4 Surfaces in scope

- `ios/project.yml` — XcodeGen source of truth for the generated iOS project.
- `ios/Makefile` — native convenience gates (`generate`, `test-packages`, `test-app`, `check`, codegen helpers).
- `ios/Config/*.xcconfig` — public Debug/Release Nhost endpoint config.
- `ios/NeoGym/` — SwiftUI app target and thin views.
- `ios/Packages/NhostSwift/` — Foundation SDK/transport package.
- `ios/Packages/NeoGymCore/` — pure domain package and scalar helper types such as `JSONValue` / `DateOnly`.
- `ios/Packages/NeoGymAPI/` — GraphQL operation documents, generated Swift output, repositories/adapters.
- `ios/Packages/NeoGymFeatures/` — testable QueryStore, navigation helpers, and feature view models that should not require a simulator.
- `backend/nhost/nhost.toml` — add `auth.redirections.allowedUrls` for `neogym://verify` after a local spike.
- `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — production JSON Patch for the same redirect allowlist.
- `CLAUDE.md`, `README.md`, `docs/developers/native-ios.md` — incremental native docs.

### 1.5 Out of scope

- Removing or replacing the web frontend.
- Android or Kotlin Multiplatform.
- Backend schema redesign/migrations for native support.
- A fully general official-grade Nhost Swift SDK beyond NeoGym's Auth + GraphQL + Storage needs.
- Offline-first sync/conflict handling.
- Universal Links/AASA setup.
- App Store signing/TestFlight automation.
- Native OAuth2 consent routing unless the user later approves a strategy that preserves the current web OAuth2 provider login URL.

### 1.6 Success criteria

- Native app builds and runs on an iOS simulator from documented commands.
- `NhostSwift` can authenticate against local/prod Nhost, persist/refresh sessions securely, exchange PKCE verification codes, execute user-role GraphQL, and render storage file URLs.
- iOS feature phases cover the same workflows as the web app: sessions, exercises, workouts, body metrics, and journal.
- Web remains supported; `frontend/` is unchanged except intentional docs/shared-contract work, and web checks pass when touched.
- Automated tests cover SDK, GraphQL transport, scalar mapping, domain logic, view models, and navigation helpers; manual QA covers local Nhost auth and feature flows.

### 1.7 Open questions / blockers (optional)

- Final production bundle identifier, signing team, and App Store metadata — owner: user; blocking: no for simulator/local implementation, yes for device release.
- Physical-device local backend strategy if simulator-local `*.local.nhost.run` endpoints are insufficient — owner: implementer with user input if needed; blocking: no for simulator-first development.

---

## 2. Implementation strategy

### 2.1 Central design decision

Mirror the web layering without sharing the web runtime. `NhostSwift` is the SDK/auth boundary analogous to `@nhost/nhost-js` plus the current `frontend/src/lib/graphql.ts` and `frontend/src/lib/storage.ts`; `NeoGymCore` ports pure domain semantics; `NeoGymAPI` owns typed user-role GraphQL operations; `NeoGymFeatures` owns testable QueryStore/view-model logic; the SwiftUI app stays thin. The shared contract is `frontend/schema.user.graphqls`.

### 2.2 Key constraints and invariants

- Branch on `exercise.kind == "cardio"`, not `category`.
- Sessions' `workout_id` is a nullable template link; workout edits/deletes do not constrain session history.
- The client must not send discriminator columns excluded from Hasura user-role permissions (`kind`, `parent_kind`). Because iOS codegen consumes the user-role SDL, generated insert/update inputs should omit those fields just like the web TS types.
- Cardio metrics schemas are JSON-schema-driven and forward-only; old/malformed/missing shapes degrade gracefully.
- Date-only parsing must avoid UTC off-by-one behavior.
- Body constraints mirror the database (`0 < weight_kg < 500`, `0 <= body_fat_pct < 100`) and duplicate-date errors surface clearly.
- Label creation follows the existing on-conflict semantics for workout labels and journal labels.
- Form submit/cancel/delete and invalid-state redirects use a native replacement/reset equivalent so spent screens and deleted records do not remain on the navigation stack.
- Storage image reads are unauthenticated, matching the current web `<img src={fileUrl(id)}>` behavior in `frontend/src/components/storage-image.tsx`; if storage ever requires bearer auth, that is a cross-platform contract change.

### 2.3 Touched surfaces

- `ios/` — new native workspace.
- `backend/nhost/nhost.toml` — local iOS redirect allowlist after spike.
- `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — production allowlist JSON Patch after spike.
- `CLAUDE.md`, `README.md`, `docs/developers/native-ios.md` — native and shared-contract documentation.
- `frontend/schema.user.graphqls` — reused as shared SDL; not edited by hand.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** Native is additive. The web app remains under `frontend/` and continues to use existing `@nhost/nhost-js`, TanStack Router, and typed GraphQL. Backend schema remains unchanged.
- **Deployment:** `neogym://verify` must be accepted by local Nhost before production overlay edits. When editing `nhost.toml`, local Nhost config is not hot-reloaded; restart with `make dev-env-down && make dev-env-up` (destructive) or explicitly apply config before validating the spike. For production, `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` must add `/auth/redirections/allowedUrls` as a new array because the key is absent today. Deploy backend config before relying on production native change-email verification.
- **Rollback:** Reverting native files leaves web unaffected. Removing the iOS redirect allowlist disables native change-email verify but the web `/verify` route remains covered by `clientUrl` subpaths.

---

## 3. Phased plan of action

### Phase 1 — Scaffold iOS workspace, config, and test gate

**Goal:** Create a reproducible native skeleton with truthful minimal docs and a native check gate.

**Depends on:** none

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/project.yml` — XcodeGen source of truth.
- `ios/Makefile` — `generate`, `test-packages`, `test-app`, `check`, and clear missing-tool hints.
- `ios/Config/Debug.xcconfig` — local public Nhost config (`local`/`local` and/or explicit local service URLs).
- `ios/Config/Release.xcconfig` — prod public values from `frontend/.env.production` (`spmqtxqkdoxvtrkrfnnl`, `eu-central-1`).
- `ios/NeoGym/` — placeholder SwiftUI app target.
- `ios/Packages/NhostSwift/`, `NeoGymCore/`, `NeoGymAPI/`, `NeoGymFeatures/` — package skeletons and placeholder tests.
- `.gitignore` — exclude generated Xcode noise if not committed.
- `README.md`, `CLAUDE.md`, `docs/developers/native-ios.md` — scaffold-only docs and shared-contract rule.

**Implementation steps:**

1. Add XcodeGen `project.yml`; do not commit the generated `.xcodeproj` unless XcodeGen proves unusable.
2. Add a placeholder SwiftUI app that launches on simulator.
3. Add package skeletons and dependency DAG documentation: `NeoGymCore` has no deps; `NhostSwift` depends on `NeoGymCore`; `NeoGymAPI` depends on `NhostSwift` + `NeoGymCore`; `NeoGymFeatures` depends on `NeoGymAPI` + `NeoGymCore`; app depends on all.
4. Add Debug/Release public endpoint config; no admin secret or private token.
5. Add Makefile gates and missing CLI hints for `xcodegen` and `apollo-ios-cli`.
6. Document host Xcode, helper CLI sourcing, simulator-first local backend assumptions, and the SDL sharing rule. Keep docs limited to what exists in this phase.

**Tests and checks:**

- `cd ios && make generate`
- `cd ios && make test-packages`
- `cd ios && make test-app` or a documented `xcodebuild` simulator build/test command.
- `cd ios && make check` aggregates available native checks.

**Definition of done:**

- Placeholder app launches on a simulator.
- All placeholder package tests pass.
- Docs are accurate for the scaffold only and do not claim future features exist.
- Web and backend are unaffected.

**Phase commit message:** `chore(ios): scaffold native workspace and test gate`

### Phase 2 — Implement NhostSwift core, session storage, and PKCE

**Goal:** Establish the reusable SDK foundation without endpoint-specific auth methods.

**Depends on:** Phase 1

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NeoGymCore/` — shared scalar helpers (`JSONValue`, `DateOnly`) with no transport dependency.
- `ios/Packages/NhostSwift/` — endpoint config, session models, storage protocols, HTTP abstraction, PKCE.

**Implementation steps:**

1. Implement local/prod/explicit URL builders for auth, GraphQL, and storage endpoints.
2. Add Codable `Session`/`User` models covering fields used by the web profile/auth provider.
3. Persist the full last session in Keychain via a protocol; provide in-memory storage for tests.
4. Reuse a still-valid access token on cold launch; decode JWT `exp` and mark near-expiry sessions for refresh.
5. Expose session observation with `AsyncStream` or equivalent.
6. Add injectable HTTP client and typed API error model.
7. Implement PKCE generation with CryptoKit, Keychain verifier storage, cleanup API, and non-syncing Keychain accessibility defaults.

**Tests and checks:**

- `swift test` for local/prod URL construction.
- Session encode/decode and Keychain protocol roundtrip tests.
- JWT expiry/reuse/near-expiry decision tests.
- PKCE known-vector tests.
- Sign-out/cleanup behavior for stored session and verifier.

**Definition of done:**

- `NhostSwift` and `NeoGymCore` build and test without app UI.
- No backend, frontend, or app feature behavior changes.

**Phase commit message:** `feat(nhost-swift): add core client session storage and pkce`

### Phase 3 — Implement NhostSwift Auth endpoints and fixtures

**Goal:** Mirror the NeoGym-used `nhost.auth.*` behavior with pinned request/response fixtures.

**Depends on:** Phase 2

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NhostSwift/Sources/NhostSwift/Auth/`
- `ios/Packages/NhostSwift/Tests/NhostSwiftTests/Fixtures/`

**Implementation steps:**

1. Derive exact wire shapes from installed `@nhost/nhost-js` and/or a live local Nhost capture; do not guess endpoints.
2. Pin fixtures for `/signin/otp/email`, `/signin/otp/email/verify`, `/signup/otp/email`, `/user/email/change`, `/token/exchange`, refresh `/token`, and sign-out.
3. Implement `signInOTPEmail`, `signUpOTPEmail(options.displayName)`, `verifySignInOTPEmail`, `changeUserEmail`, `tokenExchange`, refresh, sign-out, and OAuth2 helper methods.
4. Actor-serialize refresh and allow only one refresh/retry per request.
5. Persist any response carrying a session (OTP verify, refresh, token exchange), mirroring the JS middleware behavior.

**Tests and checks:**

- `swift test` with `URLProtocol`/HTTP stubs asserting paths, methods, bodies, headers, and errors.
- Concurrency tests for multiple simultaneous refresh-triggering requests.
- Session persistence tests for every session-bearing endpoint.
- Optional MailHog/local Nhost integration test skipped when services are unreachable.

**Definition of done:**

- Auth package can sign in/up/verify/refresh/sign out through mocked tests.
- Fixture-backed wire contract is committed.
- No backend/web changes.

**Phase commit message:** `feat(nhost-swift): implement auth endpoints`

### Phase 4 — Add GraphQL, Storage, and NeoGymAPI codegen contract

**Goal:** Provide a typed user-role GraphQL path and storage URLs using the shared SDL.

**Depends on:** Phase 3

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NhostSwift/Sources/NhostSwift/GraphQL/`
- `ios/Packages/NhostSwift/Sources/NhostSwift/Storage/`
- `ios/Packages/NeoGymAPI/GraphQL/Operations/*.graphql`
- `ios/Packages/NeoGymAPI/Sources/NeoGymAPI/Generated/`
- `ios/Packages/NeoGymAPI/apollo-codegen-config.json` or equivalent.
- `ios/Makefile`

**Implementation steps:**

1. Add `Storage.fileURL(_:)` equivalent to `frontend/src/lib/storage.ts`; assume unauthenticated reads as the web does.
2. Choose and prove the Apollo execution architecture before committing generated output: either ApolloClient + custom interceptor delegating token/refresh to `NhostSwift` (preferred) or NhostSwift manual execution of Apollo-typed documents. If neither works cleanly, stop and ask the user before falling back to hand-written Codable.
3. Configure Apollo iOS codegen against `frontend/schema.user.graphqls`; confirm SDL input format and directives are accepted.
4. Add custom scalar mapping: `uuid` -> string-backed UUID scalar, `numeric` -> `Decimal`, `timestamptz` -> ISO instant type, `date` -> `NeoGymCore.DateOnly`, `jsonb` -> `NeoGymCore.JSONValue`.
5. Commit operation documents and generated Swift output.
6. Add `make codegen-ios` for offline operation codegen.
7. Add `make schema-drift` that regenerates the user-role SDL to a temp path and diffs against `frontend/schema.user.graphqls` without dirtying a clean working tree.
8. Implement GraphQL auth injection, valid-token reuse, one auth refresh/retry max, and Hasura/Nhost error mapping. Do not retry normal validation/permission errors.
9. Add a smoke user-role operation.

**Tests and checks:**

- `swift test` for storage URL, token injection, no-token behavior, one-refresh-retry, non-auth GraphQL error mapping, scalar decoding.
- `cd ios && make codegen-ios`
- Smoke local GraphQL query when local Nhost is reachable.

**Definition of done:**

- Native can run a typed user-role GraphQL operation from the shared SDL.
- Generated files are committed and reproducible.
- Codegen/drift commands are documented and do not require backend-up except for `schema-drift`.

**Phase commit message:** `feat(ios): add graphql codegen and nhost transport`

### Phase 5 — Build app shell, QueryStore, and shared UI primitives

**Goal:** Create app infrastructure consumed by all feature phases while keeping non-view logic testable via SwiftPM.

**Depends on:** Phase 4

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NeoGymFeatures/` — QueryStore, navigation helpers, AuthStore shell, view-model foundations.
- `ios/NeoGym/App/` — thin SwiftUI app shell.
- `ios/NeoGym/Components/` — SwiftUI-only components.

**Implementation steps:**

1. Wire dependency injection for `NhostSwift`, `NeoGymAPI`, and feature stores.
2. Add AuthStore session observation skeleton backed by `NhostSwift`.
3. Add public/protected root and `TabView` placeholders for Workouts, Exercises, Sessions, Body, Journal, Profile, each with explicit "coming soon" empty states.
4. Add a `NavigationStack` replacement/reset helper in a package so it can be unit-tested.
5. Add QueryStore keyed fetch/invalidation/foreground refetch semantics mirroring TanStack Query where practical.
6. Add shared loading/error/empty/destructive confirmation primitives.
7. Add SwiftUI `StorageImage`/`AlternatingStorageImage` and Markdown rendering component. Keep functional ExercisePicker and LabelInput for later phases where their GraphQL/domain needs are available.

**Tests and checks:**

- `swift test` for QueryStore invalidation, foreground refetch policy, navigation replacement helper, and view-model shell logic.
- `xcodebuild build test` as app compile/smoke gate.

**Definition of done:**

- App shell works with six placeholders.
- Most non-view behavior is testable without a simulator.
- Later feature phases can consume shared infrastructure rather than recreating it.

**Phase commit message:** `feat(ios): add app shell and shared infrastructure`

### Phase 6 — Implement native auth UI and iOS change-email deep link

**Goal:** Deliver end-to-end native auth/profile flow with local deep-link validation.

**Depends on:** Phase 5

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/NeoGym/Features/Auth/`
- `ios/NeoGym/Features/Profile/`
- `ios/Packages/NeoGymFeatures/` — auth/profile view models and auth-form validators.
- `ios/NeoGym/App/` — URL handling and scheme registration.
- `backend/nhost/nhost.toml`
- `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json`
- Docs touched in this phase only for actual auth/deeplink behavior.

**Implementation steps:**

1. Start with a local spike proving Nhost accepts `neogym://verify` in `auth.redirections.allowedUrls` and that the Auth email link's HTTPS -> custom-scheme 302 launches the app from MailHog on the simulator.
2. Because Nhost config is not hot-reloaded, restart local stack or otherwise explicitly apply config before validating the spike.
3. If the spike succeeds, add `allowedUrls = ['neogym://verify']` under `[auth.redirections]` in `nhost.toml` and add overlay JSON Patch `op: "add"`, `path: "/auth/redirections/allowedUrls"`, `value: ["neogym://verify"]`.
4. Register the URL scheme in app config.
5. Implement landing, sign-in, sign-up, OTP entry, profile, sign-out, theme, and change-email request.
6. Add a native exact allowlist deep-link parser for scheme/host/path and accepted query/error params. Do not reuse the web path-only `isSafeInternalRedirect` semantics except for any web-style internal path redirect.
7. On `neogym://verify`, run `tokenExchange`, persist the session, and always wipe the verifier.
8. Add same-device copy before sending change-email: custom-scheme links may not open on desktop/off-device, matching the PKCE verifier locality constraint.

**Tests and checks:**

- `swift test` for auth validators, AuthStore state transitions, accepted/rejected deep-link URLs, verifier cleanup.
- `xcodebuild build test`
- `cd backend && nhost config validate`
- `cd backend && make test` after backend config changes.
- Manual MailHog sign-in, sign-up, sign-out, and change-email verify through the app.

**Definition of done:**

- Local native auth and change-email verify work end-to-end.
- Production native verify is explicitly blocked until overlay deployment is completed.
- Web auth flow remains unaffected.

**Phase commit message:** `feat(ios): add native auth and verify deep link`

### Phase 7 — Port pure domain logic to NeoGymCore

**Goal:** Add testable Swift equivalents of web domain helpers before feature UI consumes them.

**Depends on:** Phase 6

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NeoGymCore/`
- `docs/developers/native-ios.md` — add only the domain parity section that now exists.

**Implementation steps:**

1. Port cardio schema parsing, iteration, formatting, duration parsing, validation, and aggregation, including the `3600s` hours boundary and `average` semantics.
2. Port date-only helpers (`todayLocalISO`, parse/format without UTC off-by-one).
3. Port `sessionDisplayName`.
4. Port progress data calculations (strength volume, Epley 1RM, cardio sum/average data shaping).
5. Add body, journal, set, and workout validators.
6. Add exercise filter/facet counts and a reasonable in-house fuzzy ranker; do not promise Fuse-identical ranking order.
7. Preserve graceful nil/fallback behavior for missing or malformed cardio schemas.

**Tests and checks:**

- `swift test` parity/table tests modeled on existing TS tests plus added edge cases.
- Tests for date-only timezone behavior and body DB constraint mirrors.

**Definition of done:**

- Domain tests pass.
- Feature phases can depend on core helpers instead of duplicating logic.

**Phase commit message:** `feat(ios-core): port domain helpers`

### Phase 8 — Implement Sessions read/start foundation

**Goal:** Let users list, inspect, and create sessions without full logging edits yet.

**Depends on:** Phase 7

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Packages/NeoGymAPI/GraphQL/Operations/` — sessions read/start operations.
- `ios/Packages/NeoGymFeatures/` — sessions read/start view models and ExercisePicker view model.
- `ios/NeoGym/Features/Sessions/`
- `ios/NeoGym/Components/ExercisePicker.swift` or equivalent.

**Implementation steps:**

1. Add session history pagination/grouping and read-only session detail.
2. Show display name, startedAt, totals, exercise rows, and kind branch.
3. Add contextual exercise links/placeholders for session exercise detail paths.
4. Implement functional ExercisePicker needed for ad-hoc start.
5. Implement start-session use case for ad-hoc sessions via ExercisePicker.
6. Keep all edit/delete/logging mutations out of this phase; show clear disabled/coming-soon affordances.

**Tests and checks:**

- `cd ios && make codegen-ios`
- `swift test` for pagination/grouping, display name, start payload, and invalidation.
- `xcodebuild build test`
- Manual local list/detail/start QA.

**Definition of done:**

- User can view sessions and start an ad-hoc session.
- Unsupported edits are clearly unavailable until later phases.
- System remains functional and testable without partial logging behavior.

**Phase commit message:** `feat(ios): add sessions read and start flow`

### Phase 9 — Add session lifecycle and strength logging

**Goal:** Add non-cardio session editing and strength set logging.

**Depends on:** Phase 8

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Sessions mutations in `NeoGymAPI`.
- `NeoGymFeatures` sessions view models.
- `ios/NeoGym/Features/Sessions/` strength/session editing views.

**Implementation steps:**

1. Add started-at editing.
2. Add/remove exercises by delete+insert; never re-point `exercise_id` on an existing workout_session_exercise.
3. Add strength set insert/update/delete.
4. Add prior strength session hints if practical in this phase; otherwise keep explicit placeholder for Phase 10/11 integration.
5. Add delete session with replace-style navigation.
6. Surface permission/FK errors clearly.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for next set number, mutation payloads, invalidation, replace navigation, and error mapping.
- `xcodebuild build test`
- Manual strength CRUD and session delete QA.

**Definition of done:**

- Strength session lifecycle parity is complete.
- Cardio-specific entry logging remains disabled with clear copy until Phase 10.

**Phase commit message:** `feat(ios): add session editing and strength logging`

### Phase 10 — Add cardio session logging

**Goal:** Complete schema-driven cardio logging parity.

**Depends on:** Phase 9

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Cardio entries operations in `NeoGymAPI`.
- `NeoGymFeatures` cardio form view models.
- `ios/NeoGym/Features/Sessions/Cardio*` views.

**Implementation steps:**

1. Implement cardio entry insert/update/delete.
2. Build schema-driven form from `NeoGymCore` specs, including duration h/m/s inputs, required/range validation, seeding, and all-empty guard.
3. Add prior cardio hints.
4. Add missing/malformed schema fallback that does not render strength UI for cardio rows.
5. Ensure branch remains `kind == "cardio"`.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for cardio parse/seed/validate, next entry number, mutation payloads, invalidation.
- `xcodebuild build test`
- Manual cardio insert/update/delete against local Nhost, including validation/FK errors.

**Definition of done:**

- Full session logging parity across strength and cardio is complete.
- Cardio schema invariants are covered by tests and manual QA.

**Phase commit message:** `feat(ios): add cardio session logging`

### Phase 11 — Implement Exercises catalog, detail, and charts

**Goal:** Deliver exercise catalog/detail/progress parity.

**Depends on:** Phase 10

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Exercise operations in `NeoGymAPI`.
- Exercise view models in `NeoGymFeatures`.
- `ios/NeoGym/Features/Exercises/`
- Shared chart components as needed.

**Implementation steps:**

1. Implement catalog fuzzy search, facets, visibility, grouping, and flat ranked results for non-empty search.
2. Implement detail images, attributes, instructions, secondary muscles, and double-weight hints.
3. Implement strength and cardio progress/history charts with Swift Charts; parity is data semantics, not pixel-identical rendering.
4. Add start ad-hoc session using the Phase 8/9 session use case.
5. Support contextual entry points from session/workout exercise links.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for filter/facet/ranking behavior and chart data shaping.
- `xcodebuild build test`
- Manual strength/cardio detail/start QA.

**Definition of done:**

- Exercises match web behavior semantically.
- Search ranking is best-effort and documented as not Fuse-identical.
- Exercise detail uses `kind` for cardio branching.

**Phase commit message:** `feat(ios): add exercises catalog and detail`

### Phase 12 — Implement Workouts browse, detail, and start

**Goal:** Let users browse workout templates and start templated sessions.

**Depends on:** Phase 11

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Workout read/start operations in `NeoGymAPI`.
- Workout browse/detail view models in `NeoGymFeatures`.
- `ios/NeoGym/Features/Workouts/`

**Implementation steps:**

1. Implement workouts list with mine/public and label filters.
2. Implement workout detail with markdown, labels, exercise list/images, and owner edit affordance placeholder.
3. Implement templated start-session seeding session exercises from workout exercises.
4. Add contextual workout exercise detail links.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for filters, markdown data, start payload, and invalidation.
- `xcodebuild build test`
- Manual browse/detail/start QA.

**Definition of done:**

- Users can browse workouts and start templated sessions.
- Authoring remains explicitly unavailable until Phase 13.

**Phase commit message:** `feat(ios): add workouts browse and start`

### Phase 13 — Implement Workout authoring

**Goal:** Add create/edit/delete parity for private workouts.

**Depends on:** Phase 12

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Workout mutation operations in `NeoGymAPI`.
- Workout authoring view models in `NeoGymFeatures`.
- `ios/NeoGym/Features/Workouts/WorkoutForm*`
- `ios/NeoGym/Components/LabelInput.swift` or equivalent.

**Implementation steps:**

1. Implement create/edit/delete private workouts.
2. Implement LabelInput with autocomplete, new-label creation, normalization, and existing on-conflict behavior.
3. Reuse ExercisePicker.
4. Implement reorder positions and save mutation shape.
5. Add owner-only edit controls and non-owner bounce.
6. Apply replace-style navigation on cancel/save/delete.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for label create/attach payloads, reorder positions, permissions UI decisions, and replace navigation.
- `xcodebuild build test`
- Manual workout CRUD/reorder/label QA.

**Definition of done:**

- Workout authoring parity is complete for private owned workouts.
- Public/non-owned workouts are not mutated.

**Phase commit message:** `feat(ios): add workout authoring`

### Phase 14 — Implement Body measurements

**Goal:** Deliver body measurements list/detail/form/chart parity.

**Depends on:** Phase 13

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Body operations in `NeoGymAPI`.
- Body view models in `NeoGymFeatures`.
- `ios/NeoGym/Features/Body/`

**Implementation steps:**

1. Implement body measurements list and detail.
2. Implement new/edit/delete forms.
3. Use validators mirroring DB constraints.
4. Use local date-only handling.
5. Add Swift Charts trend data and display.
6. Surface duplicate-date and constraint errors.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for validators, date handling, chart data.
- `xcodebuild build test`
- Manual body CRUD/chart QA.

**Definition of done:**

- Body measurements flow is complete and consistent with the web app.

**Phase commit message:** `feat(ios): add body measurements`

### Phase 15 — Implement Journal

**Goal:** Deliver journal list/detail/form/label parity.

**Depends on:** Phase 14

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- Journal operations in `NeoGymAPI`.
- Journal view models in `NeoGymFeatures`.
- `ios/NeoGym/Features/Journal/`

**Implementation steps:**

1. Implement journal list/detail/new/edit/delete.
2. Implement journal label creation/filtering using existing on-conflict semantics.
3. Render markdown through the shared Markdown component.
4. Apply validators and replace-style navigation.

**Tests and checks:**

- `make codegen-ios`
- `swift test` for validators and label filtering/payloads.
- `xcodebuild build test`
- Manual journal CRUD/markdown QA.

**Definition of done:**

- Journal flow is complete and consistent with the web app.

**Phase commit message:** `feat(ios): add journal`

### Phase 16 — Hardening, docs, QA, and optional OAuth2 follow-up

**Goal:** Finish operating model, polish, and explicitly close/defer parity gaps.

**Depends on:** Phase 15

**Routed implementer:** `nhost-generic-implementer`

**Routed reviewer:** `nhost-generic-reviewer`

**Scope / files:**

- `ios/Makefile` / CI docs.
- `docs/developers/native-ios.md`
- `README.md`
- `CLAUDE.md`
- Optional native OAuth2 UI only if routing strategy is approved.

**Implementation steps:**

1. Do not change backend OAuth2 provider `loginURL` in this plan; document that OAuth2 provider consent remains web-routed while `NhostSwift` has helper methods.
2. If the user approves a native OAuth2 routing strategy later, add native UI as a separate follow-up that preserves web.
3. Polish accessibility, loading/error/empty states, destructive confirmations, and image fallbacks.
4. Write a full manual QA runbook for local Nhost auth, change-email deep link, sessions, exercises, workouts, body, journal, and storage images.
5. Document local/native check commands, `codegen-ios`, and `schema-drift` semantics.
6. Final incremental docs sync; avoid stale future claims.

**Tests and checks:**

- `cd ios && make check`
- `cd frontend && nix develop ../ --command bun run check` if frontend files were touched.
- `cd backend && nhost config validate` if backend config was touched in final docs/checks.

**Definition of done:**

- QA runbook passes.
- Docs are accurate.
- Remaining follow-ups are listed and not silently bundled into this plan.

**Phase commit message:** `docs(ios): finalize native qa and operating docs`

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `modelOverride: "gpt-5.5"`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `modelOverride: "claude-opus-4-8"`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| all Go | `nhost-go-implementer` | `nhost-go-reviewer` |
| all JS/TS | `nhost-javascript-implementer` | `nhost-javascript-reviewer` |
| mixed, Swift, docs, or backend config | `nhost-generic-implementer` | `nhost-generic-reviewer` |

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Native SwiftUI app scaffold | 1 | XcodeGen, package tests, simulator build/launch |
| Nhost SDK core/session/PKCE | 2 | `swift test` for URL/session/Keychain/PKCE/JWT behavior |
| Nhost Auth parity | 3 | Fixture-backed Auth tests; optional MailHog integration |
| User-role GraphQL + storage | 4 | Apollo/codegen smoke, scalar tests, auth injection/error mapping tests |
| App shell + shared infra | 5 | QueryStore/navigation tests; app compile/smoke |
| Auth/profile/change-email verify | 6 | Deep-link tests, backend validation/tests, MailHog manual QA |
| Domain invariants and helpers | 7 | `NeoGymCore` parity/table tests |
| Session read/start | 8 | Codegen, view-model tests, manual list/detail/start QA |
| Strength session editing | 9 | Mutation/invalidation tests, manual strength CRUD QA |
| Cardio session logging | 10 | Cardio form tests, manual cardio CRUD/validation QA |
| Exercises | 11 | Filter/chart tests, manual catalog/detail/start QA |
| Workouts read/start | 12 | Filter/start payload tests, manual browse/detail/start QA |
| Workout authoring | 13 | Label/reorder/permission/navigation tests, manual CRUD QA |
| Body measurements | 14 | Validator/date/chart tests, manual body QA |
| Journal | 15 | Validator/label tests, manual journal QA |
| Hardening/docs/QA | 16 | Full native `make check`, web/backend checks when touched, QA runbook |
| Parallel web support | All | Native is additive; run `cd frontend && nix develop ../ --command bun run check` after frontend changes |

---

## 6. Risks and mitigations

- **Risk:** Nhost rejects or mishandles `neogym://verify` or the HTTPS -> custom-scheme redirect from Auth emails. — **Mitigation:** Phase 6 spike validates config and MailHog end-to-end before production overlay edits; stop and ask user if rejected.
- **Risk:** Apollo iOS codegen/execution does not fit the desired custom auth behavior. — **Mitigation:** Phase 4 explicitly chooses and proves the execution architecture before committing generated output; stop before fallback.
- **Risk:** GraphQL scalar mapping corrupts domain semantics. — **Mitigation:** Phase 4 custom scalar table maps `jsonb` to `JSONValue` and `date` to `DateOnly`; scalar tests are required before feature work.
- **Risk:** Auth endpoint drift from `nhost-js`. — **Mitigation:** Pin fixtures from installed `@nhost/nhost-js` and/or live local Nhost; assert Swift request bodies and headers.
- **Risk:** GraphQL contract drift between web and native. — **Mitigation:** Shared SDL, committed generated Swift, `schema-drift` temp-path check, and docs requiring dual codegen after backend schema/permission changes.
- **Risk:** Refresh races and cold-launch session gaps. — **Mitigation:** Persist full session in Keychain and actor-serialize refresh.
- **Risk:** Feature phases become too large. — **Mitigation:** Sessions split into read/start, strength editing, and cardio logging; workouts split into browse/start and authoring.
- **Risk:** Domain subtleties drift from web. — **Mitigation:** Core parity tests land before feature UI; feature phases consume core helpers and avoid duplicating logic.
- **Risk:** Local backend networking differs between simulator and physical device. — **Mitigation:** Phase 1 docs simulator-first local development, explicit URL overrides, and any Debug-only ATS/device guidance if needed.

---

## 7. Follow-ups (out of scope for this plan)

- Universal Links/AASA production enhancement — tracked in future native auth/deployment work.
- App Store signing/TestFlight automation — tracked with release engineering once bundle/team values are known.
- Offline-first sync/conflict handling — tracked as a future product/architecture effort.
- Android/KMP — not planned.
- Native OAuth2 consent routing — only after the user approves a strategy that preserves the current web OAuth2 provider login URL.
