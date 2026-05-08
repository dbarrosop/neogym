# NeoGym

A modern fitness app scaffold built on **TanStack Start** + **Nhost** with **Tailwind v4** and **shadcn/ui**.

The frontend is a fully type-safe React 19 SSR app driven by file-based routing. The backend is a self-hosted Nhost stack (Hasura + Auth + Postgres + Storage + Functions) managed via the Nhost CLI. Tooling — `bun` and `biome` — is provisioned through a Nix flake so contributors get a reproducible dev environment.

## Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start (React 19, Vite 8, Nitro) |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query + `@nhost/nhost-js` v4 (`nhost.graphql.request`) |
| Auth | Nhost Auth (email/password, PKCE email verification) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) + shadcn/ui |
| Forms | react-hook-form + zod |
| Lint/Format | Biome |
| Runtime / pkg manager | Bun |
| Codegen | graphql-codegen `client-preset` |
| Backend | Nhost (Hasura, Auth, Storage, Postgres, MailHog) |

## Prerequisites

- [Nix](https://nixos.org/download/) with flakes enabled
- [Docker](https://docs.docker.com/get-docker/) (the Nhost CLI runs the local stack via Docker)
- [Nhost CLI](https://docs.nhost.io/platform/cli) — install via `brew install nhost/cli/nhost` or the upstream installer

`bun` and `biome` come from the Nix devshell — no host install needed.

## Quick start

```sh
# 1. Boot the backend
cd backend
nhost up

# 2. Boot the frontend (separate terminal)
cd frontend
nix develop ../ --command bun install   # first run only — also compiles biome (~15–25 min on first machine setup)
nix develop ../ --command bun run dev
# → http://localhost:3000
```

Try the flow:

1. Visit `http://localhost:3000`, click **Get started**
2. Fill in display name + email + password — you'll see "Check your inbox"
3. Open MailHog, click the verification link → you land on `/verify` → redirected to `/profile`
4. Sign out from the navbar, sign back in via `/signin`

## Available commands

All run from `frontend/` and require `nix develop ../ --command ` as a prefix unless you've already entered the devshell with `nix develop ..`.

| Command | What it does |
|---|---|
| `bun install` | Install / sync dependencies |
| `bun run dev` | Start the dev server on `:3000` (HMR + SSR) |
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

## Project layout

```
.
├── flake.nix                  # Nix devshell — bun + biome
├── frontend/
│   ├── src/
│   │   ├── routes/            # File-based routes
│   │   │   ├── __root.tsx     # Document shell + providers
│   │   │   ├── index.tsx      # Landing page
│   │   │   ├── signin.tsx
│   │   │   ├── signup.tsx
│   │   │   ├── verify.tsx     # PKCE token exchange
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
    │   ├── nhost.toml         # Auth + Hasura config
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

The Auth `clientUrl` and `allowedUrls` are pinned in `backend/nhost/nhost.toml`:

```toml
[auth.redirections]
clientUrl = 'http://localhost:3000'
allowedUrls = ['http://localhost:3000/verify']
```

Keep the dev port in `frontend/vite.config.ts` aligned with `clientUrl`.

## What's not in v1 (yet)

- OAuth providers (Google, GitHub, etc.)
- Password reset / change-password
- Profile edits and avatar uploads
- SSR-aware auth via Nhost cookie storage
- CI / deploy preset (will add when the hosting target is known)

## Further reading

- [TanStack Start docs](https://tanstack.com/start/latest)
- [TanStack Router docs](https://tanstack.com/router/latest)
- [Nhost docs](https://docs.nhost.io/)
- [shadcn/ui docs](https://ui.shadcn.com/)
- [Tailwind v4 docs](https://tailwindcss.com/)
- [Biome docs](https://biomejs.dev/)
