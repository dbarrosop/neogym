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

The `NeoGym` app target is iOS 26-only. Keep the widget extension and the
host-testable `NeoGymKit` package at their lower deployment floors unless their
own code needs newer APIs.

- `swift build` — build the host-compatible `NeoGymKit` package. It must keep SwiftUI/UIKit out of `Sources/NeoGymKit` so this works on macOS.
- `swift test` — run deterministic package tests against fakes; do not require a live Nhost backend or real Keychain for unit tests.
- `nix develop ../.. --command xcodegen generate` — generate `NeoGym.xcodeproj` from `project.yml`.
  After adding/removing Swift app files, wait for XcodeGen to finish before running `xcodebuild`; a stale generated project can omit new `App/*.swift` sources and surface misleading `cannot find type/member` compile errors.
  The spec's post-generation script patches the shared scheme to keep XPC
  Services, Queue Debugging/backtrace recording, View Debugging, and related
  default diagnostics disabled after regeneration.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` — build the SwiftUI app for a simulator destination.

Keep `ios/NeoGym/App/LaunchScreen.storyboard` wired through `UILaunchStoryboardName` in both `App/Info.plist` and `project.yml`. The storyboard can stay visually minimal, but it is required for iOS to opt the app into modern full-screen sizing on current devices; removing it can make the simulator/device run the app letterboxed with large empty top/bottom bands.

The iOS package depends on the local Nhost Swift SDK at `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to `ios/NeoGym/` (normally `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Update `Package.swift` and docs together if that workspace assumption changes.

The native app uses the same email OTP auth shape as the web app for
sign-in/sign-up. `NeoGymKit` owns validators, `SignInModel`, `SignUpModel`,
`UserProfile`, `ChangeEmailModel`, `AuthDeepLink`, `PKCEVerifierStore`, and the
`AuthServicing` boundary; SwiftUI views under `ios/NeoGym/App/` call those
models and route signed-in sessions into the full-screen `AppShellView`. The
native shell uses iOS 26 value-based root tabs for the three primary areas
(Workouts, Nutrition, Me), typed per-root `NavigationStack(path:)` state, and
root-only inline navigation title menus for Sessions/Workouts/Exercises,
Nutrition subsections, and Profile/Body/Journal. Root primary actions (New
workout/food/meal/plan, Log measurement, New entry) live in shell-owned
`.bottomBar` toolbars keyed to the active top-level section. Pushed detail/form
routes use native bottom toolbar actions (`.bottomBar`,
confirmation/cancellation/destructive roles where appropriate) instead of hiding
the tab bar; session details reserve bottom chrome for the rest timer plus Add
exercise, with Delete session in the top-trailing overflow menu. The rest timer
is bottom-integrated, not a floating overlay. Root list pages rely on standard
navigation-title spacing and native tab bar safe-area insets; do not add custom
dock clearance constants or extra bottom padding for custom bottom chrome.
Reduce Motion should suppress custom section scaling/animated tab-minimize polish
while preserving native navigation structure. Sheet-local `NavigationView`
wrappers remain intentional for modal editors/pickers. Do not add older OS
fallbacks, UIKit parent-chain tab-bar hiding, the removed
`.hidesBottomTabBarWhenPushed()` alias, custom dock chrome, or new hidden-link
navigation. Keep
unit tests deterministic with fake auth services and the in-memory verifier
store, not a live backend or real Keychain. Sign-out
must always call `clearSession()` after
attempting remote sign-out so local persisted sessions are removed even when the
network request fails. SwiftUI previews can set Dynamic Type with
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

**Add new tests when you change the backend in a way that's already covered by the suite, or when you introduce a new invariant.** The backend suite includes `backend/tests/kind-enforcement.test.ts` for workout/exercise invariants and `backend/tests/nutrition.test.ts` for nutrition permissions, snapshots, provenance, and cascade behavior. The kind-enforcement file is organized into describes by concern:

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
- **Re-run `bun run codegen` after any change that affects what the `user` role can see**: editing a `graphql(...)` document, applying a Hasura migration (database schema), editing Hasura metadata (permissions, relationships, exposed columns), or pulling someone else's metadata/migration changes. Stale outputs cause confusing type errors and "field not found" runtime failures.
- **Nutrition GraphQL/logging shape**: meal logging should use one nested `insertNutritionLogMeal` with child `nutritionLogEntries`, and each child must explicitly include the same `nutritionDayId` as the parent group. Hasura nested inserts populate `nutritionLogMealId` but not the direct day FK used by permissions/composite same-day enforcement. Log time is user-selected, user-correctable, and defaults to now: planned-meal logging may keep `nutritionPlanMealId` as provenance, but must not hardcode the logged `slotTime` to the template slot. Direct plan-food logging should use a standalone food-backed `insertNutritionLogEntry` with matching `foodId` + `nutritionPlanFoodId`; it cannot be grouped under `nutritionLogMealId`, and deleting the plan/direct-food slot nulls provenance while snapshots remain. Ad-hoc one-off logs use standalone `source: "ad_hoc"` entries with no `foodId`, `nutritionPlanFoodId`, or `nutritionLogMealId`, and must send name plus kcal/fat/carbs/protein/fiber/sugar snapshot fields per 100g. Standalone entries store their own editable `slotTime`; grouped entries display the parent logged meal's editable `slotTime`. Daily nutrition totals should be computed from logged `snapshot*Per100g` columns, not live `foods`.
- **Form/picker navigation must use `replace: true`**: When a form submit, cancel, picker selection, or delete handler redirects away from a "spent" page (e.g., `/sessions/new` → `/sessions/$sessionId`, `/workouts/$id/edit` → `/workouts/$id` after save *or* cancel, `/workouts/$id/edit` → `/workouts` after delete, `/workouts/new` → `/workouts` after cancel), pass `replace: true` to `navigate(...)`. Without it, the now-spent form/picker (or the just-deleted record's detail page) stays on the history stack and the back button lands on it instead of the previous screen. A cancelled form is "spent" in the same way a submitted one is — the user explicitly abandoned it. Same rule for redirects out of invalid states (e.g., the non-owner bounce in `workouts/$workoutId/edit.tsx`) — the user was never meant to see that page, so don't leave it in history. Auth-flow redirects (`signin`/`signup` → `/profile`) are a separate case and have their own logic.
- **Mobile primary nav can scroll horizontally**: With the Nutrition top-level item the mobile tab bar has seven entries. Keep one top-level Nutrition item (not separate Foods/Meals/Plans/Days items) and preserve usability on narrow screens with the existing horizontally scrollable tab bar/min-width items rather than hiding primary destinations.
- **PWA build outDir**: `vite-plugin-pwa` (≤1.3.0) reads `viteConfig.build.outDir` from the *root* config, but Vite 8's Environments API means Nitro only sets `outDir = ".output/public"` on its `client` environment — the root `build.outDir` stays at the default `"dist"`. Without the override, `sw.js` and `workbox-*.js` get written to `dist/` while everything else lands in `.output/public/`, *and* the precache glob scans `dist/` so the SW only precaches itself + 7 static icons (the actual hashed JS/CSS bundles never make it into the precache manifest). Both bugs are silent — the build succeeds, but the deployed SW is unreachable and offline mode caches nothing useful. Fix: `vite.config.ts` sets `build: { outDir: ".output/public", emptyOutDir: false }` at the root. After upgrading vite-plugin-pwa / TanStack Start / Nitro, sanity-check that `.output/public/sw.js` exists *and* contains a precache entry for `assets/*.js` (e.g. `grep -c '"url":"assets/' .output/public/sw.js` should be in the dozens). To regenerate icons from `public/logo.svg`, run `bunx pwa-assets-generator` (config in `pwa-assets.config.ts`).

## Nhost MCP

An Nhost MCP server (`mcp__nhost__*`) is configured for this repo and exposes tools for inspecting and managing the local Nhost project — listing apps/projects, reading the GraphQL schema, running queries, and managing Hasura metadata/migrations. **When it's available, prefer it** for tasks like:

- Inspecting Hasura metadata, permissions, or the live GraphQL schema instead of guessing or reading dumps.
- Running ad-hoc GraphQL queries against the local backend to verify behavior.
- Applying or reviewing metadata/migration changes.

Always list resources/roots/templates first to see what's exposed, and confirm which environment (`local` vs cloud) you're operating against before making changes.

**If the MCP server is not available** (the `mcp__nhost__*` tools aren't present in the session), warn the user up front before falling back to manual approaches like `bun run codegen`, hand-written SQL, or editing metadata files directly. They likely want to start it rather than have you work around its absence.
