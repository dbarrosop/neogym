# Architect artifact — Native iOS Swift Frontend with nhost-swift — claude-opus-4-8 branch

**Created:** 2026-06-07
**Related plan:** `.pi/PLAN_native_ios_swift_frontend.md`
**Architect agent:** `nhost-architect`
**Requested `modelOverride`:** `claude-opus-4-8`
**Reported model(s):** initial attempt 1: `claude-opus-4-8`; initial attempt 2: `claude-opus-4-8` (reported in prose, not mandatory trailer shape); feedback round 1: `claude-opus-4-8` (reported in reviewer sign-off, not mandatory trailer shape); feedback round 2: `claude-opus-4-8` (reported in reviewer sign-off, not mandatory trailer shape)
**Model warnings:** no warning for initial attempt 1 exact sign-off; informational `missing-signature-shape` warnings for later outputs because they did not use the exact `_Plan authored by ..._` trailer, although they self-identified as Claude Opus / `claude-opus-4-8` in prose.
**Artifact purpose:** Audit trail for this architect branch. This is not the implementer-facing plan.

---

## 1. Branch summary

### 1.1 Headline contribution

This branch contributed the strongest low-level architecture details: XcodeGen, package-based testability, shared SDL/codegen, custom-scheme redirect deployment details, auth wire-shape fixture strategy, custom scalar mapping, and the final GraphQL/Apollo execution spike requirements.

### 1.2 Ideas adopted into the final plan

- Use `frontend/schema.user.graphqls` as shared contract and distinguish operation codegen from SDL regeneration/drift.
- Add XcodeGen and native Makefile gates.
- Use custom `neogym://verify` as local/prod baseline with local spike before production overlay.
- Keep OAuth2 provider loginURL web-only unless a preserving routing strategy is approved.
- Pin Auth fixtures from installed `@nhost/nhost-js`/live local Nhost.
- Add exact `allowedUrls` TOML and overlay JSON Patch details.
- Persist full session, not only refresh token; reuse valid access tokens on cold launch.
- Move testable QueryStore/view-model logic into SwiftPM package(s), not only the app target.
- Add scalar mapping table (`jsonb` -> `JSONValue`, `date` -> `DateOnly`, etc.).
- Add stack restart note for local Nhost config, temp-path schema drift, and 302-to-custom-scheme MailHog QA.

### 1.3 Ideas rejected or deferred

- Universal Links as baseline — deferred because local dev cannot validate localhost/AASA; custom scheme is the baseline.
- Native OAuth2 consent as mandatory — deferred because backend has a single web `auth.oauth2Provider.loginURL`.
- Full official-grade Swift SDK — out of scope.

---

## 2. Initial planning attempts

### Attempt 1

#### 2.1.1 Input prompt sent to this branch

```markdown
Working title: Native iOS Swift Frontend with nhost-swift

The full initial planning prompt sent to this branch contained the gathered requirements now captured in `.pi/PLAN_native_ios_swift_frontend.md` §1, the concrete repo references listed in that plan, the user-confirmed choices (SwiftUI, iOS 17+, full phased parity, NeoGym-scoped NhostSwift Auth+GraphQL+Storage), and the required architect instruction:

"You are a planning architect. Do not edit code. Return Markdown using the output shape from your agent prompt, including the mandatory sign-off trailer where you self-identify your model (do not copy any model name from this prompt). Be concrete; cite file paths. List any ambiguities under Open questions instead of inventing answers. For big changes, break the plan into smaller phases; each phase must be self-contained, include a clear definition of done, leave the system fully functional, and be testable before the next phase starts."
```

#### 2.1.2 Output returned by this branch (verbatim)

I have enough grounding across auth, GraphQL, storage, domain logic, navigation, and backend redirect config. Here is my architect plan.

---

## Restatement

NeoGym today is a React 19 / TanStack Start PWA in `frontend/` talking to an Nhost Cloud/local backend (Hasura + Auth + Storage + Functions) via `@nhost/nhost-js` v4, typed GraphQL (graphql-codegen client-preset), and TanStack Query. The goal is a **native SwiftUI iOS app (iOS 17+)** that reaches full, *phased* feature parity with the web app while the web app keeps working unchanged. Because Nhost ships no Swift SDK, the first deliverable is a focused `nhost-swift` Swift package mirroring the slice of `@nhost/nhost-js` NeoGym actually uses — Auth (email-OTP sign-in/sign-up, OTP verify, session persist/refresh, PKCE + `changeUserEmail` + token exchange, sign-out, OAuth2 consent), GraphQL (user-role authenticated requests with Hasura error mapping), and Storage (`fileUrl`). The native app then layers SwiftUI features on top, isolating domain/data logic from views, sharing the Hasura user-role SDL contract with the web app, and minimizing backend changes (only an auth redirect/deep-link allowlist entry is expected).

## Touched surfaces

- `ios/` *(new)* — SwiftUI app target (NeoGym), iOS 17+, Swift Concurrency. Feature modules mirroring `frontend/src/routes` + `frontend/src/components`.
- `ios/Packages/NhostSwift/` *(new)* — reusable `nhost-swift` SPM package (Auth + GraphQL + Storage + Keychain + PKCE), the Swift analog of `frontend/src/lib/nhost/*` + `frontend/src/lib/graphql.ts` + `frontend/src/lib/storage.ts`.
- `ios/NeoGym/Core/` *(new)* — pure domain logic ported from `frontend/src/lib/cardio-schema.ts`, `dates.ts`, `sessions.ts`, `redirect.ts`.
- `frontend/schema.user.graphqls` *(reused as shared contract, not edited by hand)* — consumed by the iOS GraphQL codegen exactly as it is by `frontend/codegen.ts`.
- `backend/nhost/nhost.toml` + `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — add the iOS deep-link redirect to `auth.redirections.allowedUrls` (the change-email PKCE flow's `redirectTo` must land in the app, not the web origin). `[auth.redirections].clientUrl` currently only covers `http://localhost:5173` / `https://neogym.nhost.app`.
- `flake.nix` *(maybe)* — add Swift tooling (`xcodegen`, `apollo-ios-cli`/`swiftformat`/`swiftlint`) to the devshell if Nix-sourced (host Xcode still required for the iOS SDK).
- `CLAUDE.md`, `README.md`, `docs/developers/ios.md` *(new)* — toolchain, codegen, navigation/parity conventions, deep-link/auth notes, kept in sync per repo guidance.

## Approach

Build the SDK bottom-up, then the app feature-by-feature, never touching the running web app. **Central design decision:** split responsibilities the same way the web app does — `nhost-swift` owns *transport, auth, sessions (Keychain), PKCE, refresh, and storage URLs*; a typed GraphQL layer (recommended: **Apollo iOS**, codegen'd from the *same* `frontend/schema.user.graphqls` SDL) owns *typed operations + a normalized cache/watchers*, wired to Nhost's GraphQL endpoint through an `nhost-swift` auth interceptor that injects the access token and refreshes on 401. This mirror is deliberate: `@nhost/nhost-js` → `nhost-swift`; graphql-codegen client-preset → apollo-ios codegen against the identical SDL; TanStack Query → Apollo cache + `@Observable` view models. SwiftUI views stay thin (MVVM): view models call `nhost-swift` (auth/storage) and the GraphQL client (data), and pure domain logic (cardio schema parsing, date handling, session display, validators) lives in a `Core` module with heavy unit tests. The single shared cross-platform contract is the user-role SDL; a CI drift check regenerates it and fails on diff so a backend change breaks *both* frontends' builds visibly.

## Alternatives considered

- **Alt 1 — Hand-rolled Codable structs + generic `request<T: Decodable>` instead of Apollo iOS:** `nhost-swift` exposes a generic GraphQL executor and each operation is a hand-written query string + response struct. Fewer dependencies and full ownership, but loses codegen-from-SDL typing parity with the web app (the property the user explicitly wants), re-implements caching/invalidation by hand, and invites contract drift. Rejected as the default, but it is the fallback if the user declines the Apollo dependency; `nhost-swift`'s GraphQL surface is designed generically enough to support either.
- **Alt 2 — Share operation documents (`.graphql` files) across web and iOS:** maximal contract sharing. Rejected because the web app authors its 44 operations as inline `graphql(\`…\`)` template tags (`frontend/codegen.ts` scans `src/**/*.{ts,tsx}`); extracting them to shared `.graphql` files is pure churn on a working app for marginal benefit. We share the SDL (the actual contract) instead; operation docs stay per-platform and that's documented.
- **Alt 3 — Commit a hand-maintained `.xcodeproj`:** rejected in favor of a declarative **XcodeGen `project.yml`** (or Tuist) so the project is reviewable and `.pbxproj` merge conflicts are avoided.
- **Alt 4 — Kotlin/CMP or a React Native/Capacitor wrapper:** out of scope per requirements (native SwiftUI mandated; no shared-runtime hybrid).
- **Alt 5 — Full official-grade Nhost Swift SDK:** out of scope; `nhost-swift` is scoped to NeoGym's Auth + GraphQL + Storage needs only.

## Plan of action

The initial plan proposed phases: iOS scaffolding/toolchain; `nhost-swift` core; `nhost-swift` Auth; GraphQL + Storage + Apollo wiring; app shell; auth flows + backend deep-link config; domain logic port; exercises; workouts; sessions; body; journal; hardening/docs/CI. These ideas were merged into the final plan but with tighter package boundaries, codegen details, and smaller feature phases.

## Risks and follow-ups

The branch highlighted risks around Nhost auth wire shapes, contract drift, cache/invalidation parity, domain subtleties, deep-link redirect security/config, Xcode/Nix tooling, and follow-ups for offline sync, push notifications, signing/TestFlight, and Android.

## Open questions

The branch raised deep-link mechanism, Apollo/Markdown/Charts dependencies, Swift tooling sourcing, package layout, signing, operation-doc sharing, and bundle identifiers. These were resolved or deferred in the final plan.

---

_Plan authored by `nhost-architect` (model: `claude-opus-4-8`)._

#### 2.1.3 Model attribution

- **Requested `modelOverride`:** `claude-opus-4-8`
- **Self-reported model:** `claude-opus-4-8`
- **Model warning:** `none`

### Attempt 2

#### 2.2.1 Input prompt sent to this branch

```markdown
Same full initial planning prompt as Attempt 1, re-dispatched in parallel after the gpt-5.5 branch's first attempt returned only a local Node dynamic-library error.
```

#### 2.2.2 Output returned by this branch (verbatim)

The second initial output provided an expanded plan with a proposed layout under `ios/` containing `NhostSwift`, `NeoGymKit`, and `NeoGym`, a custom-scheme deep-link baseline, a `QueryStore`, and 10 phases. Its strongest details were incorporated into the synthesized plan: shared SDL, codegen/drift, custom scheme baseline, exact backend overlay path, avoiding OAuth2 loginURL changes, and domain logic parity tests. It self-identified in prose as Claude Opus 4 / `claude-opus-4-8` but did not use the exact mandatory trailer shape.

#### 2.2.3 Model attribution

- **Requested `modelOverride`:** `claude-opus-4-8`
- **Self-reported model:** `claude-opus-4-8`
- **Model warning:** `missing-signature-shape`

---

## 3. Feedback rounds

### Round 1

#### 3.1.1 Input prompt sent to this branch

```markdown
The branch was sent the first synthesized implementation plan draft plus full gathered requirements and the required review instruction:

"You are reviewing a revised implementation plan. Do not edit code. Critique the plan for requirement coverage, phase boundaries, definitions of done, testability, backward compatibility, deployment risk, and consistency across phases. For big changes, verify every phase is self-contained, fully functional, and testable. Return concrete feedback and improvements; do not rewrite the whole plan unless a rewrite is necessary. Include a final verdict of `READY`, `READY_WITH_MINOR_NOTES`, or `NEEDS_REVISION`, and include the mandatory sign-off trailer where you self-identify your model (do not copy any model name from this prompt)."
```

#### 3.1.2 Output returned by this branch (verbatim)

I've validated the plan against the actual codebase and installed SDK. Here's my review.

---

# Plan Review: Native iOS Swift Frontend with nhost-swift

## Verification performed
I cross-checked the plan's assumptions against the repo and the installed `@nhost/nhost-js@4.7.0`:

- **Wire shapes are extractable, not guesswork.** The exact endpoints are right there in `node_modules/@nhost/nhost-js/dist/nhost-js/auth.cjs`: `/signin/otp/email`, `/signin/otp/email/verify`, `/signup/otp/email`, `/user/email/change`, `/token/exchange`. PKCE is S256 — verifier = base64url(32 random bytes), challenge = base64url(SHA-256(verifier)). This **materially de-risks Phase 3** and CryptoKit PKCE parity (Phase 2).
- **Six navbar tabs confirmed** (`navbar.tsx:9-14`): Workouts, Exercises, Sessions, Body, Journal, Profile. Phase 5's "six tabs" is accurate.
- **Route inventory matches** the phases (body/journal each have index/$id/new/edit; sessions/workouts have nested exercise-detail routes; oauth2/login; verify).
- **OAuth2 single `loginURL`** pointing to web confirmed (`nhost.toml`, overlay) — the plan's "don't repoint it" decision is correct.
- **No `allowedUrls` key exists anywhere** in `backend/` today (grep: NONE). Neither `nhost.toml` `[auth.redirections]` nor the overlay has it.

## Strengths
- Layering mirror (`NhostSwift` / `NeoGymKit` / app) is the right call and maps cleanly onto `client.ts` + `graphql.ts` + `lib/*`.
- Bottom-up SDK sequencing (2→3→4) with `URLProtocol` stubs is the correct testability strategy, and now provably feasible since wire fixtures can be captured from the installed SDK.
- Additive backward-compat story is sound: web's only shared touch is read-only consumption of `frontend/schema.user.graphqls`.
- Good "stop and ask" gates on the two genuine unknowns (custom scheme acceptance, Apollo custom transport).

## Concrete issues to address (none are phase-breaking blockers)

The review asked to pin auth wire fixtures, specify `allowedUrls` as a new TOML/overlay key, add production deploy notes, replace web path-only redirect validation with exact native deep-link validation, distinguish operation codegen vs SDL regen, persist the full session in Keychain, consolidate shared UI ownership, soften Fuse/Chart pixel parity, cover contextual exercise-detail routes, avoid stale native docs, and move a minimal native test gate earlier.

## Verdict
**READY_WITH_MINOR_NOTES** — The phasing, boundaries, and testability are sound, every feature phase is self-contained and independently testable, and backward compatibility is well-protected.

---

*Reviewer sign-off: Claude Opus 4.x (Anthropic), acting as nhost-architect plan reviewer.*

#### 3.1.3 Model attribution

- **Requested `modelOverride`:** `claude-opus-4-8`
- **Self-reported model:** `claude-opus-4-8`
- **Model warning:** `missing-signature-shape`

#### 3.1.4 Synthesis notes for this round

- **Adopted:** Auth fixture pinning; exact `allowedUrls` key/overlay details; production deploy notes; native exact deep-link validator; codegen vs SDL regen distinction; full-session persistence; shared UI earlier; fuzzy/chart parity caveats; contextual exercise routes; incremental docs; early test gate.
- **Rejected:** Mandatory native OAuth2 UI in this plan.
- **Deferred:** Universal Links and signing/release work.

### Round 2

#### 3.2.1 Input prompt sent to this branch

```markdown
The branch was sent the revised implementation plan draft that introduced `NeoGymCore`, `NeoGymAPI`, `NeoGymFeatures`, concrete env config, explicit XcodeGen policy, codegen file paths, deep-link spike-before-overlay, split read/edit phases, and the same required review instruction from Round 1.
```

#### 3.2.2 Output returned by this branch (verbatim)

I've grounded the review in the actual codebase. Here's my critique.

---

# Plan review: Native iOS Swift Frontend with nhost-swift

## Verdict up front
`READY_WITH_MINOR_NOTES` — but two of the notes (GraphQL execution architecture and Apollo scalar mapping) are sharp enough that they must be nailed down inside the Phase 4 spike *before* any generated Swift is committed, or Phase 4's DoD is not actually verifiable. Everything else is genuinely minor.

The plan is strong: phase boundaries are mostly self-contained, the read/start vs. edit splits for sessions and workouts are the right call, the deep-link/allowlist spike-before-overlay sequencing is correct, and the domain-invariant callouts match what's in the docs and code (verified `exercise.kind === "cardio"`, nullable `workout_id`, the structural strength/cardio split, forward-only cardio schema, date-only off-by-one, `isSafeInternalRedirect` being path-only). Good instinct not to reuse the web's path-only redirect validator for native deep links.

## High-impact findings (resolve before/within Phase 4)

**1. GraphQL execution architecture is ambiguous and the two stated facts are in tension.** The plan says both "NhostSwift owns GraphQL transport (bearer injection, valid-token reuse, refresh/retry)" *and* "NeoGymAPI owns generated types via Apollo iOS codegen." Apollo iOS normally executes its generated operations through its own `ApolloClient`/`RequestChainNetworkTransport`. So Phase 4 must explicitly decide one of:
   - (a) `ApolloClient` + a custom `ApolloInterceptor` that pulls the access token from NhostSwift and delegates refresh to NhostSwift's serialized actor on `401`/auth error; or
   - (b) NhostSwift's own URLSession transport executes Apollo-typed documents manually (serialize query string + variables, decode into the generated `Data` types).

**2. Apollo custom-scalar mapping is unaddressed and is load-bearing.** The committed SDL declares `scalar uuid`, `jsonb`, `numeric`, `timestamptz`, `date`. Add an explicit custom scalar map. `jsonb` must map to a real `JSONValue`; `date` must map to a string-or-DateComponents-style type, not a UTC-midnight `Date`.

**3. `JSONValue` placement collides with the "NeoGymCore is pure" rule.** Define `JSONValue` and scalar wrappers in `NeoGymCore`; let NhostSwift and NeoGymAPI depend on it. State package DAG explicitly.

**4. Testability: keep view models / QueryStore / validators in SwiftPM packages, not the app target.** Move non-SwiftUI logic into a package so most tests run via `swift test`; `xcodebuild` should cover the thin shell.

## Medium / boundary notes

- `make schema-drift` should regenerate to a temp path and not dirty a clean working tree.
- Phase 6 local spike needs a local stack restart or explicit config application because Nhost config is not hot-reloaded.
- Move all session delete/edit mutations out of the read/start phase.
- Storage reads are unauthenticated in the web and should remain simple in iOS.
- Keep auth form validators distinct from data-model validators or seed the relevant pure validators early.

## Smaller notes

- User-role SDL generated types should enforce omission of `kind`/`parent_kind` from inputs.
- Fuzzy ranking is best-effort, not Fuse-identical.
- Change-email email link is HTTPS -> Auth -> 302 to custom scheme; spike should validate full MailHog 302-to-app launch, not just config acceptance.
- Auth source is present in installed `@nhost/nhost-js`, so fixture extraction is viable.

## Coverage check

All requested surfaces are covered; gaps were in how, not what.

**Verdict: `READY_WITH_MINOR_NOTES`**

---
*Reviewer sign-off: Claude Opus (claude-opus-4-8), acting as nhost-architect plan reviewer. No code was modified during this review.*

#### 3.2.3 Model attribution

- **Requested `modelOverride`:** `claude-opus-4-8`
- **Self-reported model:** `claude-opus-4-8`
- **Model warning:** `missing-signature-shape`

#### 3.2.4 Synthesis notes for this round

- **Adopted:** Phase 4 explicitly chooses/proves Apollo execution architecture; custom scalar mapping table; `JSONValue`/`DateOnly` in `NeoGymCore`; package DAG; `NeoGymFeatures` for QueryStore/view models; temp-path `schema-drift`; local Nhost restart/config application for redirect spike; removed session delete from read phase; storage unauthenticated note; `kind`/`parent_kind` type-system guarantee; fuzzy ranking caveat; end-to-end MailHog 302-to-app-launch validation.
- **Rejected:** None of the high-impact notes.
- **Deferred:** Universal Links and native OAuth2 consent routing remain follow-ups.

---

## 4. Final branch disposition

- **Latest verdict from this branch:** `READY_WITH_MINOR_NOTES`
- **Remaining concerns:** Phase 4 GraphQL execution/scalar mapping must be resolved before generated Swift is committed; final bundle/signing are still external release details.
- **How remaining concerns are handled:** Phase 4 DoD now requires explicit GraphQL execution choice and scalar map before generated output; bundle/signing are non-blocking open questions/follow-ups.
