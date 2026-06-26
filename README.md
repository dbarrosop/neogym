# NeoGym

A modern fitness app scaffold built on **TanStack Start** + **Nhost** with **Tailwind v4** and **shadcn/ui**.

The frontend is a fully type-safe React 19 SSR app driven by file-based routing. The backend runs on Nhost Cloud (Hasura + Auth + Postgres + Storage + Functions); the Nhost CLI brings up a local Docker mirror of the same stack for development. Tooling — `bun` and `biome` — is provisioned through a Nix flake so contributors get a reproducible dev environment.

## Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start (React 19, Vite 8, Nitro) |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query + `@nhost/nhost-js` v4 (`nhost.graphql.request`) |
| Auth | Nhost Auth (email OTP for sign-in/sign-up; PKCE email-link verification for change-email) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) + shadcn/ui |
| Forms | react-hook-form + zod |
| Lint/Format | Biome |
| Runtime / pkg manager | Bun |
| Codegen | graphql-codegen `client-preset` |
| Backend | Nhost (Hasura, Auth, Storage, Postgres, MailHog) |
| iOS | SwiftUI app generated with XcodeGen + local `NeoGymKit` SwiftPM package |

## Prerequisites

- [Nix](https://nixos.org/download/) with flakes enabled
- [Docker](https://docs.docker.com/get-docker/) (the Nhost CLI runs the local stack via Docker)
- [Nhost CLI](https://docs.nhost.io/platform/cli) — install via `brew install nhost/cli/nhost` or the upstream installer
- Xcode for iOS simulator builds
- Local Nhost Swift SDK checkout at `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift` for the native app

`bun`, `biome`, and Darwin-available XcodeGen come from the Nix devshell — no host install needed for those tools. If the pinned Nixpkgs ever lacks XcodeGen on Darwin, install `xcodegen` with Homebrew and keep `ios/NeoGym/project.yml` as the committed source of truth.

## Quick start

```sh
# 1. Boot the backend
cd backend
nhost up

# 2. Boot the frontend (separate terminal)
cd frontend
nix develop ../ --command bun install   # first run only — also compiles biome (~15–25 min on first machine setup)
nix develop ../ --command bun run dev
# → http://localhost:5173
```

Try the flow:

1. Visit `http://localhost:5173`, click **Get started**
2. Fill in display name + email — you'll see "Check your inbox"
3. Open MailHog, copy the 6-digit code, paste it into the OTP field → you land on `/profile`
4. From `/profile`, request an email change — open MailHog, click the verification link → you land on `/verify` → the new email is confirmed and you're redirected back to `/profile`
5. Sign out from the navbar, sign back in via `/signin` (email → 6-digit code)

## Available commands

All run from `frontend/` and require `nix develop ../ --command` as a prefix unless you've already entered the devshell with `nix develop ..`.

| Command | What it does |
|---|---|
| `bun install` | Install / sync dependencies |
| `bun run dev` | Start the dev server on `:5173` (HMR + SSR) |
| `bun run build` | Production build (Vite + Nitro) |
| `bun run start` | Run the built server (`.output/server/index.mjs`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `biome check .` (lint + format check) |
| `bun run format` | `biome format --write .` |
| `bun run codegen` | Generate typed GraphQL operations into `src/gql/` (requires backend up) |

Backend (from `backend/`):

| Command | What it does |
|---|---|
| `nhost up` | Start the local stack |
| `nhost down` | Stop the local stack |
| `nhost config validate` | Validate `nhost.toml` after editing |
| `nhost logs <service>` | Tail a service's logs |

Native iOS (from `ios/NeoGym/`):

| Command | What it does |
|---|---|
| `swift build` | Build the host-compatible `NeoGymKit` package |
| `swift test` | Run deterministic `NeoGymKit` unit tests |
| `nix develop ../.. --command xcodegen generate` | Generate `NeoGym.xcodeproj` from `project.yml` |
| `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` | Build the SwiftUI app |

The native app currently supports the same local email OTP sign-in/sign-up shape
as the web app: request a 6-digit code, copy it from MailHog, verify, view the
protected profile, and sign out. Sign-out always clears the local SDK session
store after the remote request attempt.

## Project layout

```
.
├── flake.nix                  # Nix devshell — bun + biome + XcodeGen on Darwin
├── ios/NeoGym/                # SwiftUI app + XcodeGen spec + NeoGymKit package
├── frontend/
│   ├── src/
│   │   ├── routes/            # File-based routes
│   │   │   ├── __root.tsx     # Document shell + providers
│   │   │   ├── index.tsx      # Landing page
│   │   │   ├── signin.tsx
│   │   │   ├── signup.tsx
│   │   │   ├── verify.tsx     # PKCE token exchange (email-change verification)
│   │   │   ├── _authed.tsx    # Protected layout (redirects unauth users)
│   │   │   └── _authed/profile.tsx
│   │   ├── components/
│   │   │   ├── navbar.tsx, auth-card.tsx
│   │   │   └── ui/            # shadcn primitives (hand-written)
│   │   ├── lib/nhost/         # Client + AuthProvider
│   │   ├── lib/utils.ts       # cn() helper
│   │   ├── styles.css         # Tailwind v4 theme + design tokens
│   │   └── router.tsx
│   ├── biome.json
│   ├── codegen.ts
│   ├── components.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── backend/
    ├── nhost/
    │   ├── nhost.toml         # Auth + Hasura config (local-dev baseline)
    │   ├── overlays/          # JSON Patch overrides per environment (prod)
    │   ├── metadata/          # Hasura metadata
    │   └── migrations/        # SQL migrations
    └── functions/             # Serverless functions
```

## Configuration

The frontend reads three env vars. Local dev values live in `frontend/.env`:

```sh
# frontend/.env
VITE_NHOST_SUBDOMAIN=local
VITE_NHOST_REGION=local
VITE_MCP_URL=http://localhost:3000
```

Production build values live in `frontend/.env.production` (committed) and are picked up automatically by `bun run build`. Override any of them on the command line for ad-hoc builds: `VITE_MCP_URL=https://… bun run build`.

`VITE_NHOST_*` point at the Nhost backend; `VITE_MCP_URL` is the MCP endpoint surfaced on the home page so users can connect their agent.

Auth redirect config is split between local-dev defaults in `backend/nhost/nhost.toml` and production overrides in the project overlay at `backend/nhost/overlays/<project-id>.json`:

```toml
# backend/nhost/nhost.toml — local-dev baseline
[auth.redirections]
clientUrl = 'http://localhost:5173'
```

```json
// backend/nhost/overlays/<project-id>.json — production (JSON Patch)
{ "op": "replace", "path": "/auth/redirections/clientUrl",
  "value": "https://neogym.nhost.app" }
{ "op": "add",     "path": "/auth/redirections/allowedUrls",
  "value": [] }
```

Any subpath of `clientUrl` is accepted as a `redirectTo` target by default — that's how the email-change flow lands back on `/verify` without any extra configuration. Only redirects to a different host/port need to be added to `auth.redirections.allowedUrls` (in both files). Keep the dev port in `clientUrl` aligned with `frontend/vite.config.ts`.

## What's not in v1 (yet)

- OAuth providers (Google, GitHub, etc.)
- Password reset / change-password (no passwords — auth is OTP only)
- Profile display-name and avatar editing
- SSR-aware auth via Nhost cookie storage
- CI / deploy preset (will add when the hosting target is known)

## Further reading

- [TanStack Start docs](https://tanstack.com/start/latest)
- [TanStack Router docs](https://tanstack.com/router/latest)
- [Nhost docs](https://docs.nhost.io/)
- [shadcn/ui docs](https://ui.shadcn.com/)
- [Tailwind v4 docs](https://tailwindcss.com/)
- [Biome docs](https://biomejs.dev/)
