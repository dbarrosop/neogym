# CLAUDE.md

Guidance for future Claude Code sessions in this repo.

## What this is

NeoGym — a TanStack Start (React 19 + Vite 8 + Nitro) frontend talking to a self-hosted Nhost backend. Auth is email/password with email verification (PKCE). UI is Tailwind v4 + shadcn/ui.

## Repo layout

```
.
├── flake.nix          # Nix devshell — provides bun + biome
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
└── backend/           # Nhost CLI project — Hasura + Auth + Storage + Functions
    ├── nhost/nhost.toml       # auth/Hasura config
    ├── nhost/metadata/        # Hasura metadata
    └── nhost/migrations/      # SQL migrations
```

## Toolchain

`bun` and `biome` are NOT on the host — they come from `flake.nix`. Run frontend commands via the devshell:

```sh
cd frontend
nix develop ../ --command bun run <script>
nix develop ../ --command bunx <pkg>
```

**Don't `curl | bash` install bun.** The user wants the toolchain to come from Nix.

## Common commands

From `frontend/` (each prefixed with `nix develop ../ --command` if outside the shell):

| What | Command |
|---|---|
| Install deps | `bun install` |
| Dev server (http://localhost:5173, also exposed on LAN) | `bun run dev` |
| Production build | `bun run build` |
| Typecheck | `bun run typecheck` |
| Lint + format check | `bun run lint` |
| Typecheck + lint (run after every code change) | `bun run check` |
| Auto-fix formatting | `bun run format` |
| Regen GraphQL schema dump + TS types | `bun run codegen` (needs backend up; runs `codegen:graphql-schema` then `codegen:graphql`) |

**Always run `bun run check` after writing or modifying code.** It runs `typecheck` + `lint` together; fix any errors it surfaces before reporting work as done.

From `backend/`:
- `nhost up` — boot Hasura + Auth + Postgres + MailHog locally
- `nhost down` — stop
- `nhost config validate` — sanity-check `nhost.toml` after edits

## Conventions

- **Path alias**: `@/*` → `frontend/src/*`. Wired in `tsconfig.json` (paths) and `vite.config.ts` (`resolve.alias`).
- **File-based routing**: any new file under `src/routes/` is a route. The router plugin regenerates `src/routeTree.gen.ts` when the dev server boots — never edit that file by hand. Pathless layouts use the `_name.tsx` + `_name/` directory pattern (see `_authed`).
- **Forms**: react-hook-form + zod via `@hookform/resolvers/zod`, rendered through `@/components/ui/form` shadcn primitives.
- **Toasts**: `sonner` mounted at root in `__root.tsx`; call `toast.error(...)` etc. from anywhere.
- **shadcn components are hand-written** under `src/components/ui/`. The `bunx shadcn add` CLI was deliberately *not* used. To add a new primitive, copy from <https://ui.shadcn.com> and adjust the `cn`/import paths to `@/lib/utils`.
- **Biome** is the only formatter/linter. ESLint and Prettier are not used. CSS parser has `tailwindDirectives: true` so `@theme inline`, `@utility`, `@custom-variant` parse cleanly.
- **Auth state** lives client-side in `lib/nhost/auth-provider.tsx`. The Nhost client uses localStorage by default; SSR renders see `user = null` and `isAuthenticated = false`. Protected routes (`_authed.tsx`) redirect via `useEffect`, not `beforeLoad`, because the SDK's session storage is browser-only.
- **GraphQL data flow**: queries/mutations are authored inline via the typed `graphql(...)` template tag. Operations are sent through the `gqlRequest` helper in `src/lib/graphql.ts`, which is what `@tanstack/react-query`'s `useQuery` / `useMutation` calls.
- **`bun run codegen` is a two-step pipeline** — both outputs are checked in and neither should be edited by hand:
  1. `codegen:graphql-schema` (needs backend up) introspects Hasura via `rover` with `X-Hasura-Role: user` and writes the SDL to `frontend/schema.user.graphqls`. This is the human-readable map of every query, mutation, type, and field the app is allowed to use; consult it (or point an LLM/IDE at it) to discover what's available before writing a new `graphql(...)` document.
  2. `codegen:graphql` (offline) feeds that SDL plus your `graphql(...)` documents into `graphql-codegen` and writes TypeScript types + the typed `graphql()` tag to `frontend/src/gql/`. Because step 2 reads the user-role SDL, the generated types only expose what permissions actually allow — operations that admin can run but `user` can't will fail to typecheck.
- **Re-run `bun run codegen` after any change that affects what the `user` role can see**: editing a `graphql(...)` document, applying a Hasura migration (database schema), editing Hasura metadata (permissions, relationships, exposed columns), or pulling someone else's metadata/migration changes. Stale outputs cause confusing type errors and "field not found" runtime failures.
- **Form/picker navigation must use `replace: true`**: When a form submit, picker selection, or delete handler redirects to its result page (e.g., `/sessions/new` → `/sessions/$sessionId`, `/workouts/$id/edit` → `/workouts/$id` after save, `/workouts/$id/edit` → `/workouts` after delete), pass `replace: true` to `navigate(...)`. Without it, the now-spent form/picker (or the just-deleted record's detail page) stays on the history stack and the back button lands on it instead of the previous screen. Same rule for redirects out of invalid states (e.g., the non-owner bounce in `workouts/$workoutId/edit.tsx`) — the user was never meant to see that page, so don't leave it in history. Auth-flow redirects (`signin`/`signup` → `/profile`) are a separate case and have their own logic.
- **PWA build outDir**: `vite-plugin-pwa` (≤1.3.0) reads `viteConfig.build.outDir` from the *root* config, but Vite 8's Environments API means Nitro only sets `outDir = ".output/public"` on its `client` environment — the root `build.outDir` stays at the default `"dist"`. Without the override, `sw.js` and `workbox-*.js` get written to `dist/` while everything else lands in `.output/public/`, *and* the precache glob scans `dist/` so the SW only precaches itself + 7 static icons (the actual hashed JS/CSS bundles never make it into the precache manifest). Both bugs are silent — the build succeeds, but the deployed SW is unreachable and offline mode caches nothing useful. Fix: `vite.config.ts` sets `build: { outDir: ".output/public", emptyOutDir: false }` at the root. After upgrading vite-plugin-pwa / TanStack Start / Nitro, sanity-check that `.output/public/sw.js` exists *and* contains a precache entry for `assets/*.js` (e.g. `grep -c '"url":"assets/' .output/public/sw.js` should be in the dozens). To regenerate icons from `public/logo.svg`, run `bunx pwa-assets-generator` (config in `pwa-assets.config.ts`).

## Nhost MCP

An Nhost MCP server (`mcp__nhost__*`) is configured for this repo and exposes tools for inspecting and managing the local Nhost project — listing apps/projects, reading the GraphQL schema, running queries, and managing Hasura metadata/migrations. **When it's available, prefer it** for tasks like:

- Inspecting Hasura metadata, permissions, or the live GraphQL schema instead of guessing or reading dumps.
- Running ad-hoc GraphQL queries against the local backend to verify behavior.
- Applying or reviewing metadata/migration changes.

Always list resources/roots/templates first to see what's exposed, and confirm which environment (`local` vs cloud) you're operating against before making changes.

**If the MCP server is not available** (the `mcp__nhost__*` tools aren't present in the session), warn the user up front before falling back to manual approaches like `bun run codegen`, hand-written SQL, or editing metadata files directly. They likely want to start it rather than have you work around its absence.
