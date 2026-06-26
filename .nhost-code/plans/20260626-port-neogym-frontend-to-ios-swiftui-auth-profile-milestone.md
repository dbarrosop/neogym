# Port NeoGym frontend to iOS SwiftUI auth/profile milestone

**Status:** ready
**Created:** 2026-06-26

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

NeoGym currently has a TanStack Start React frontend under `frontend/`. The user wants to begin porting that app to native Swift, starting with a buildable iOS SwiftUI app and the existing auth/profile flows rather than the full workout/session/nutrition domain surface.

### 1.2 Functional requirements

- Add a native iOS SwiftUI app scaffold under `ios/NeoGym`.
- Use the local Nhost Swift SDK checkout at `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`.
- Configure Nhost defaults equivalent to `frontend/src/lib/nhost/client.ts`: local development defaults to `subdomain = "local"`, `region = "local"`.
- Persist user sessions using the SDK's default Apple-platform session storage behavior.
- Support email OTP sign-in: request a 6-digit code, verify it, then route to the protected profile/home shell.
- Support email OTP sign-up: collect display name and email, request a code using `AuthSignUpOptions(displayName:)`, verify it, then route to the protected profile/home shell.
- Show a protected profile screen comparable to `frontend/src/routes/_authed/profile.tsx`: avatar/initials, display name, email, locale, default role, user ID, member-since date, email-change action, and sign out.
- Support profile email change with PKCE: generate and persist verifier/challenge, call Nhost change-email with a native redirect, handle the callback, exchange the code, clear the verifier, refresh profile/session state, and show success/error feedback.
- Approximate the web auth/profile design from `frontend/src/components/auth-card.tsx` and `frontend/src/styles.css`: centered rounded cards, subtle borders/shadows, muted text, light/dark support, and a grid/radial background.

### 1.3 Non-functional requirements / constraints

- Target iOS SwiftUI first, iPhone-first; iPad compatibility is acceptable where it falls out naturally.
- Use Swift 6/concurrency style consistent with the Nhost Swift SDK.
- Keep the first milestone independently buildable and testable.
- Do not port workouts, sessions, exercises, body, journal, nutrition, PWA behavior, or other domain GraphQL screens in this plan.
- Do not rewrite the Nhost Swift SDK.
- Do not change backend schema, metadata, migrations, or permissions. Backend auth redirect config may change only if the native email-change callback requires it.
- Keep docs in sync in the same phase as toolchain, navigation, auth-flow, or redirect behavior changes.
- Keep unit tests deterministic by testing app logic against fakes/protocols; do not require a live Nhost backend or real Keychain for unit tests.
- Preserve existing web auth behavior and local backend behavior.

### 1.4 Surfaces in scope

- `ios/NeoGym/` — new iOS app, XcodeGen project spec, SwiftPM package, app target, tests, and iOS README.
- `ios/NeoGym/Sources/NeoGymKit/` — app-local testable logic: Nhost client factory, auth service boundary, auth/session state, validators, profile mapping, PKCE verifier store, and deep-link parser.
- `ios/NeoGym/App/` — SwiftUI app entry, root navigation, auth/profile screens, theme/components, URL handling, and assets.
- `flake.nix` — add XcodeGen through Nix when available without breaking non-Darwin evaluation.
- `.gitignore` / `ios/NeoGym/.gitignore` — ignore generated Xcode/user/build artifacts while keeping source-of-truth files committed.
- `README.md`, `CLAUDE.md`, `ios/NeoGym/README.md` — document the iOS surface, toolchain, commands, SDK path assumption, and auth/deep-link behavior as those behaviors are introduced.
- `backend/nhost/nhost.toml` and `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — only for the native redirect allowlist if custom-scheme support is validated.

### 1.5 Out of scope

- Porting workouts, sessions, exercises, body, journal, nutrition, charts, drag-and-drop, MCP URL surface, PWA, or SSR details.
- OAuth, password, password reset, or change-password flows.
- Profile display-name/avatar editing beyond email change.
- Backend schema/data-model changes.
- CI/signing/device-distribution setup beyond simulator-oriented local commands.
- Production Universal Links unless custom schemes are rejected and the user chooses that fallback.

### 1.6 Success criteria

- The repository contains a buildable/testable iOS SwiftUI app under `ios/NeoGym` that uses the local Nhost Swift SDK.
- Unit tests cover validation, auth state transitions, profile mapping, deep-link parsing, PKCE verifier handling, and token-exchange/session refresh behavior.
- Manual local flow succeeds: launch simulator, sign up with display name/email, retrieve OTP from local MailHog, verify, see profile, sign out, sign back in, request email change, open the verification callback on the simulator, token exchange succeeds, and profile reflects the updated email.
- Existing frontend and backend checks continue to pass after any affected changes.
- Docs describe the shipped iOS setup and auth/deep-link behavior accurately.

### 1.7 Open questions / blockers (optional)

No requirements-level blockers remain for starting implementation. Phase-specific validation gates are captured in the relevant phases:

- Phase 1 must verify XcodeGen availability in the pinned Nixpkgs on Darwin or stop for the documented fallback decision.
- Phase 3/4 must verify whether Nhost Auth accepts `neogym://verify` before committing native redirect config.
- Bundle identifier/team signing can remain simulator-oriented with `io.nhost.neogym` and no team unless the user later provides production signing details.

---

## 2. Implementation strategy

### 2.1 Central design decision

Add a new iOS SwiftUI app under `ios/NeoGym` whose project is generated from a checked-in XcodeGen `project.yml`. Put app logic in a local SwiftPM library target, `NeoGymKit`, and keep SwiftUI views in the app target. `NeoGymKit` owns Nhost client construction, auth/session state, validators, profile mapping, PKCE verifier storage, and deep-link parsing behind protocols so the flows can be unit-tested with fakes. The production Nhost client uses `createClient(NhostClientOptions(subdomain: "local", region: "local"))` and the SDK's default Keychain-backed storage; email change uses a native `neogym://verify` PKCE callback only after custom-scheme support is validated.

### 2.2 Key constraints and invariants

- `ios/NeoGym/Package.swift` must declare both `.iOS(.v15)` and `.macOS(.v12)` so `swift build` / `swift test` work on the macOS host.
- `NeoGymKit` must stay host-compatible: no SwiftUI/UIKit/AppKit dependencies in the package code that is exercised by `swift test`. SwiftUI views live in `ios/NeoGym/App/`.
- The local SDK dependency path from `ios/NeoGym/Package.swift` is `../../../../../nhost/nhost/swift/packages/nhost-swift`; document this workspace-layout assumption.
- Use real SDK request types: `AuthSignInOTPEmailRequest`, `AuthSignUpOTPEmailRequest`, `AuthSignInOTPEmailVerifyRequest`, `AuthSignOutRequest`, `AuthUserEmailChangeRequest`, and `AuthTokenExchangeRequest`.
- Use `PKCE.generatePair()` from the `Nhost` module for email-change PKCE.
- Initial auth loading must have an explicit loading state to avoid flashing signed-out UI before async Keychain/session loading completes.
- Sign-out must remove local persisted session state. Call Nhost sign-out when a refresh token is available and verify/ensure `clearSession()` is called if sign-out does not clear the store.
- Profile mapping must account for Swift SDK types: `AuthUser.email` is optional, `displayName`/`locale`/`defaultRole` are strings that may be empty, and `createdAt` is already a `Date`.
- `neogym://verify?code=...` parses as scheme `neogym`, host `verify`, usually empty path. Tests must anchor this behavior and reject malformed variants.
- Backend config changes for native redirects must preserve the existing web `clientUrl` and web `/verify` behavior.

### 2.3 Touched surfaces

- `ios/NeoGym/project.yml` — source-of-truth XcodeGen project spec.
- `ios/NeoGym/Package.swift` — `NeoGymKit`, `NeoGymKitTests`, and local SDK dependency.
- `ios/NeoGym/App/` — SwiftUI app entry, root view, theme, auth/profile screens, URL scheme handling, assets, and Info.plist.
- `ios/NeoGym/Sources/NeoGymKit/` — testable app logic and Nhost boundary.
- `ios/NeoGym/Tests/NeoGymKitTests/` — deterministic unit tests.
- `flake.nix` — Darwin-safe XcodeGen tool availability.
- `.gitignore`, `ios/NeoGym/.gitignore` — generated Xcode/build/user artifacts.
- `README.md`, `CLAUDE.md`, `ios/NeoGym/README.md` — docs for layout, toolchain, checks, SDK path, auth, and redirect behavior.
- `backend/nhost/nhost.toml`, `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — native redirect allowlist only after validation.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** The iOS app is additive. Existing web routes, GraphQL documents, backend schema, permissions, and migrations remain unchanged. The only backend config change is an additive auth redirect allowlist for `neogym://verify`, gated by validation.
- **Deployment:** Xcode itself is a host prerequisite. XcodeGen should come from the Nix devshell when available; if the pinned Nixpkgs cannot provide it on Darwin, stop and choose the documented fallback before proceeding. Backend config is not hot-reloaded by Nhost CLI; restart the local stack before validating any redirect config change.
- **Rollback:** Standard revert is sufficient for additive `ios/` and docs/tooling changes. If the native redirect allowlist causes issues, revert the allowlist entries from `backend/nhost/nhost.toml` and `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json`; the web `clientUrl` remains unchanged.

---

## 3. Phased plan of action

### Phase 1 — Scaffold iOS app and session shell

**Goal:** Add a buildable SwiftUI app shell and host-testable SwiftPM library with local SDK dependency, local Nhost config, async session bootstrap, placeholder protected/signed-out shell, URL scheme registration, and docs/tooling.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `flake.nix` — add XcodeGen to the devshell only when available without breaking non-Darwin systems; document or implement fallback if unavailable.
- `.gitignore` and `ios/NeoGym/.gitignore` — ignore generated `.xcodeproj`, `.build/`, `DerivedData/`, `xcuserdata/`, and `*.xcuserstate` as appropriate.
- `ios/NeoGym/project.yml` — XcodeGen spec for app target `NeoGym`, bundle id `io.nhost.neogym`, iOS 15 deployment target, Info.plist, assets, and local package dependency on `NeoGymKit`.
- `ios/NeoGym/Package.swift` — `NeoGymKit` library and `NeoGymKitTests`, `platforms: [.iOS(.v15), .macOS(.v12)]`, local dependency `.package(path: "../../../../../nhost/nhost/swift/packages/nhost-swift")`, product `Nhost`.
- `ios/NeoGym/App/NeoGymApp.swift`, `RootView.swift`, `Info.plist`, `Assets.xcassets/` — SwiftUI entry, loading/signed-out/signed-in placeholders, `neogym` URL scheme registration.
- `ios/NeoGym/Sources/NeoGymKit/NhostConfig.swift`, `NhostClientFactory.swift`, `AuthService.swift`, `AuthStore.swift` — local config defaults, live/fake auth boundary, async session load, session subscription, state model.
- `ios/NeoGym/Tests/NeoGymKitTests/` — tests for config defaults, loading state/session bootstrap, fake session updates, and sign-out/session clearing behavior where possible.
- `README.md`, `CLAUDE.md`, `ios/NeoGym/README.md` — introduce iOS app layout, Xcode/XcodeGen requirements, Swift/iOS commands, SDK path assumption, and current placeholder auth scope.

**Implementation steps:**

1. Verify whether `pkgs.xcodegen` exists in the pinned Nixpkgs on Darwin. Add it with a `pkgs.stdenv.isDarwin` guard or equivalent so Linux flake evaluation/checks do not fail. If unavailable/broken, stop and choose between a separate pinned tool input or committing a generated `.xcodeproj` before continuing.
2. Add the `ios/NeoGym` source layout and XcodeGen spec. Keep generated project output out of git unless the XcodeGen fallback decision requires committing it.
3. Add `NeoGymKit` as a host-compatible SwiftPM package. Keep SwiftUI/UIKit out of `Sources/NeoGymKit`.
4. Implement `NhostConfig` with `local` defaults and `NhostClientFactory` using `createClient(NhostClientOptions(subdomain:region:))`.
5. Implement an `@MainActor ObservableObject` `AuthStore` with explicit loading/signed-out/signed-in/error states. It must call async `getUserSession()`, subscribe to `sessionStore.subscribe`, and show loading UI until the first session load completes.
6. Wire `NeoGymApp` and `RootView` to show a loading state, signed-out placeholder, or placeholder profile shell.
7. Register the `neogym` URL scheme in Info.plist for later phases.
8. Add docs in the same phase as the new toolchain/layout.

**Tests and checks:**

- `nix develop . --command xcodegen --version` on Darwin, or documented fallback command if XcodeGen is not available from Nix.
- `nix flake check` after editing `flake.nix`.
- `cd ios/NeoGym && swift build && swift test`.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- `xcodebuild -project ios/NeoGym/NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Optional simulator smoke run if available locally.

**Definition of done:**

- A clean checkout can generate the Xcode project from `project.yml` or follows a documented fallback.
- `NeoGymKit` builds/tests on the macOS host because it declares macOS support and avoids UI frameworks.
- The app builds for an iOS simulator and launches to a loading-aware placeholder shell without a signed-out flash before session load completes.
- The SDK path and iOS commands are documented in `README.md`, `CLAUDE.md`, and `ios/NeoGym/README.md`.
- Existing web/backend behavior is untouched.

**Phase commit message:** `feat(ios): scaffold SwiftUI app shell`

**Implementation log**

- **Implementation notes:** Added the Phase 1 native iOS scaffold under `ios/NeoGym`: an XcodeGen `project.yml`, SwiftUI app shell, app Info.plist/assets, host-compatible `NeoGymKit` SwiftPM package, local Nhost SDK dependency, `NhostConfig`, `NhostClientFactory`, `AuthServicing`/`NhostAuthService`, loading-aware `AuthStore`, and deterministic `AuthStoreTests`/`URLSchemeRegistrationTests`. Added Darwin-guarded XcodeGen availability in `flake.nix`, generated-artifact ignores, and root/iOS docs for the new app layout, SDK path, and build/test commands.
- **Reviewer verdict:** Initial review rejected the phase because the docs claimed `neogym` URL-scheme registration but `Info.plist` did not contain `CFBundleURLTypes`. The implementer fixed this by making `project.yml` the source of truth for `CFBundleURLTypes`, regenerating `App/Info.plist`, adding a plist unit test, and documenting the regeneration rule. Follow-up review returned `ACCEPT`.
- **Autonomous decisions:** Treated XcodeGen availability and native redirect support as phase validation gates rather than requirements-level blockers because this preserves correctness while allowing Phase 1 scaffolding to proceed. Accepted the pre-existing `nix flake check` formatter failure as a validation limitation for this phase because reviewer confirmed the same `nixpkgs-fmt` mismatch existed at the phase-start commit; reformatting unrelated Nix style would be out of scope and worse for long-term maintenance.
- **Quality gate:** `nix develop . --command xcodegen --version` passed (`2.44.1`); `nix flake check` failed on the pre-existing `nixpkgs-fmt` mismatch; `cd ios/NeoGym && swift build && swift test` passed (7 tests); `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` passed; `plutil -lint App/Info.plist` passed; `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed; built app Info.plist contains URL name `io.nhost.neogym` and scheme `neogym`. Optional simulator launch was not run because this host reports an out-of-date CoreSimulator, but the generic simulator build passed.

### Phase 2 — Implement OTP auth, profile UI, sign out, and design parity

**Goal:** Implement the native OTP sign-in/sign-up flows, protected profile, sign out, and SwiftUI design components approximating the web auth-card/grid theme.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/NhostAuthService.swift` / `AuthService.swift` — live implementations for `AuthSignInOTPEmailRequest`, `AuthSignUpOTPEmailRequest`, `AuthSignInOTPEmailVerifyRequest`, and `AuthSignOutRequest`.
- `ios/NeoGym/Sources/NeoGymKit/SignInModel.swift`, `SignUpModel.swift`, `Validation.swift`, `UserProfile.swift` — testable view models, validators, and profile field mapping.
- `ios/NeoGym/App/Theme/` and `ios/NeoGym/App/Components/` — color tokens, grid/radial background, auth card, OTP code field, feedback/banner/alert component.
- `ios/NeoGym/App/SignInView.swift`, `SignUpView.swift`, `ProfileView.swift`, `RootView.swift` — SwiftUI screens and protected routing.
- `ios/NeoGym/Tests/NeoGymKitTests/` — tests for validators, model state transitions, sign-out clearing behavior, and profile mapping.
- `README.md`, `CLAUDE.md`, `ios/NeoGym/README.md` — update if auth commands/manual flow or sign-out behavior documentation changes.

**Implementation steps:**

1. Extend the auth service protocol and live Nhost implementation for OTP sign-in, OTP sign-up, OTP verification, and sign-out using SDK request structs with `body:` arguments.
2. Confirm whether SDK `auth.signOut` updates local session storage. Regardless, ensure local persisted session is removed by calling `clearSession()` when needed and test that `AuthStore` becomes signed out.
3. Add validators matching web behavior: email format, required display name with max length 60, and 6-digit OTP.
4. Add sign-in and sign-up models mirroring web `sentTo`, `otp`, sending/verifying, reset, and error behavior.
5. Add `UserProfile` mapping anchored to SDK types: optional email, empty-string display name fallback to `Athlete`, initials based on display name/email, `Date`-based member-since formatting, string locale/default role handling.
6. Add SwiftUI design components approximating the web card and background with system light/dark support.
7. Add sign-in, sign-up, and profile views; route to profile once a session is present and show signed-out auth options otherwise.
8. Keep domain screens out of scope; profile is the only protected content for this milestone.

**Tests and checks:**

- `cd ios/NeoGym && swift test` covering validation, sign-in/sign-up success/failure paths, profile initials/fallback/date formatting, and sign-out local clearing.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- `xcodebuild -project ios/NeoGym/NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- Manual local check with `make -C backend dev-env-up`: sign up with display name/email, retrieve OTP from MailHog, verify, view profile, sign out, sign in again, verify, and confirm session persistence across app relaunch.

**Definition of done:**

- Native OTP sign-up/sign-in flows work against the local Nhost backend.
- Profile displays the expected user fields and handles optional/empty SDK values safely.
- Sign-out removes local persisted session and returns to signed-out UI.
- Unit tests and simulator build pass.
- Manual OTP flow succeeds with MailHog.

**Phase commit message:** `feat(ios): add OTP auth and profile`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — Implement app-side PKCE email change and deep-link handling

**Goal:** Validate the custom-scheme direction before investing heavily, then implement the app-side PKCE email-change flow, deep-link parsing, token exchange handling, verifier clearing, and tests.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/PKCEVerifierStore.swift` — injectable durable production store and in-memory test fake.
- `ios/NeoGym/Sources/NeoGymKit/AuthDeepLink.swift` — pure parser for `neogym://verify` callbacks.
- `ios/NeoGym/Sources/NeoGymKit/ChangeEmailModel.swift` — PKCE generation, verifier persistence, change-email request, callback handling, token exchange, verifier clearing, state/feedback.
- `ios/NeoGym/Sources/NeoGymKit/NhostAuthService.swift` — live methods for `AuthUserEmailChangeRequest` and `AuthTokenExchangeRequest`.
- `ios/NeoGym/App/ChangeEmailSheet.swift`, `ProfileView.swift`, `NeoGymApp.swift` — email-change UI and `.onOpenURL` wiring.
- `ios/NeoGym/Tests/NeoGymKitTests/` — tests for parser, verifier store, change-email model, and token-exchange session persistence/refresh behavior.
- Temporary/local spike notes in `ios/NeoGym/README.md` if needed; do not commit backend allowlist changes until Phase 4.

**Implementation steps:**

1. Before building the full UI, run a short custom-scheme compatibility spike against local Nhost config/API behavior. If `neogym://verify` is rejected by Nhost Auth, stop and ask the user whether to switch to Universal Links or a hosted web/native relay. Do not silently implement a workaround.
2. Implement `PKCEVerifierStore` with durable production storage that survives leaving the app for MailHog/link handling, preferably Keychain-backed; tests use an in-memory fake.
3. Implement `AuthDeepLink` parsing for `neogym://verify?code=...`, error callbacks, missing code, `errorDescription` and `error_description`. Explicitly reject malformed variants such as `neogym:/verify`, `neogym://other`, and unsupported web URLs unless the implementation deliberately supports them.
4. Extend the auth service with `AuthUserEmailChangeRequest(newEmail:options: AuthOptionsRedirectTo(redirectTo: "neogym://verify"), codeChallenge:)` and `AuthTokenExchangeRequest(code:codeVerifier:)`.
5. Add `ChangeEmailModel`: same-email guard, `PKCE.generatePair()`, persist verifier before request, call change-email, show link-sent state, handle callback errors, missing verifier, token-exchange success/failure, and clear the verifier in a `defer`-style path on all callback outcomes.
6. After token exchange, explicitly verify/ensure session state refreshes via `SessionStore.subscribe` and/or an explicit session reload. Add a test with fake transport/service returning a session payload and assert the store/model updates.
7. Add `ChangeEmailSheet` to profile and wire `.onOpenURL` in `NeoGymApp`.

**Tests and checks:**

- `cd ios/NeoGym && swift test` covering:
  - `neogym://verify?code=...` host-based parsing;
  - error callback parsing;
  - missing code;
  - `errorDescription` and `error_description`;
  - malformed scheme/host/path rejection;
  - verifier set/get/clear;
  - verifier cleared on success and failure;
  - same-email guard;
  - token-exchange success updates session/auth state.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- `xcodebuild -project ios/NeoGym/NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- `xcrun simctl openurl booted 'neogym://verify?code=fake'` drives the app callback path to a controlled error state when a simulator is available.

**Definition of done:**

- App-side email-change flow is implemented and covered by deterministic tests.
- Custom-scheme support has been validated enough to proceed, or the phase stops for user input before committing unsupported code/config.
- Fake and hand-crafted callback paths prove verifier-clearing and error behavior.
- Real email-change callback may still require committed backend allowlist in Phase 4.

**Phase commit message:** `feat(ios): add PKCE email change flow`

**Implementation log**

- **Implementation notes:** Added Phase 2 OTP auth/profile functionality. `NeoGymKit` now includes live OTP request/verify methods using the Nhost SDK request structs, validators, sign-in/sign-up state models, and `UserProfile` mapping for optional/empty SDK user fields. The SwiftUI app now has sign-in, sign-up, protected profile, sign-out routing, themed auth cards, feedback banners, OTP code entry, and grid/background styling inspired by the web app. Root and iOS docs now describe the native OTP flow and manual MailHog checklist.
- **Reviewer verdict:** `ACCEPT_WITH_CONCERNS`. Reviewer verified deterministic tests and generic simulator build, with the sole concern that live MailHog OTP e2e and relaunch persistence were not demonstrated because this host reports an out-of-date CoreSimulator and disabled simulator device support.
- **Autonomous decisions:** Accepted the reviewer concern as non-blocking for this phase because correctness is supported by unit tests, live SDK call wiring, and successful app build, while falsely claiming live e2e would be worse for correctness. Recorded the manual validation gap for later execution on a host with a working simulator/backend.
- **Quality gate:** `cd ios/NeoGym && swift test` passed (18 tests); `cd ios/NeoGym && nix develop ../.. --command xcodegen generate` passed; `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` passed. Manual MailHog OTP flow was not run due the CoreSimulator environment limitation.

### Phase 4 — Add native redirect allowlist, docs, and end-to-end email-change verification

**Goal:** Commit the required native redirect config and docs, restart/validate the backend, and prove the real local email-change flow end to end.

**Depends on:** Phase 3 custom-scheme validation

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `backend/nhost/nhost.toml` — add `allowedUrls = ['neogym://verify']` under `[auth.redirections]` if custom schemes are accepted.
- `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — add or update the JSON Patch for `/auth/redirections/allowedUrls` to include `neogym://verify`, preserving existing production `clientUrl` web behavior.
- `README.md`, `CLAUDE.md`, `ios/NeoGym/README.md` — document native redirect behavior, backend config requirement, local restart requirement, and manual email-change runbook.
- `ios/NeoGym/` — any small app fixes discovered during real callback testing.

**Implementation steps:**

1. Re-confirm the custom-scheme validation result before editing committed backend config. If rejected, stop and ask the user to choose Universal Links or a hosted relay.
2. Add the local auth redirect allowlist in `backend/nhost/nhost.toml` while preserving `clientUrl = 'http://localhost:5173'`.
3. Add/update the production overlay allowlist patch in `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json`; do not remove the existing web client URL patch.
4. Update docs in the same phase as the config behavior change.
5. Restart the local Nhost stack because config is not hot-reloaded.
6. Run backend, frontend, and iOS checks; then perform the real MailHog email-change flow from the simulator.

**Tests and checks:**

- `cd backend && nhost config validate`.
- `make -C backend dev-env-down && make -C backend dev-env-up` if local config needs to be applied for manual verification.
- `cd backend && make test` after backend config changes.
- `cd ios/NeoGym && swift test`.
- `cd ios/NeoGym && nix develop ../.. --command xcodegen generate`.
- `xcodebuild -project ios/NeoGym/NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build`.
- `cd frontend && nix develop ../ --command bun run check`.
- Manual e2e: from the app, request email change, open the MailHog verification link on the simulator, app opens via `neogym://verify`, token exchange succeeds, verifier is cleared, and profile shows the updated email.

**Definition of done:**

- Native redirect allowlist is committed only if validated.
- Local backend config validates and backend tests pass.
- Frontend check still passes and web redirect behavior remains unchanged.
- iOS tests/build pass.
- Real local email-change e2e succeeds and docs describe exactly that shipped behavior.

**Phase commit message:** `feat(ios): enable native email verification redirect`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing or moving phases, run all configured linters/builds/tests for the affected project/repository. If any command fails, send exact failures back to the implementer, run a fresh reviewer pass after the fix, and rerun the full gate.
6. **Commit:** Commit all changes made during the phase with the phase commit message only after the relevant checks pass or any skipped checks are explicitly justified.
7. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Swift, JS/TS, backend/config, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Native iOS SwiftUI scaffold under `ios/NeoGym` | Phase 1 | XcodeGen generation, `xcodebuild` simulator build, docs updated |
| Use local Nhost Swift SDK | Phase 1 | `swift build`, `swift test`, generated Xcode project resolves package |
| Local Nhost config defaults | Phase 1 | Unit tests for config defaults and live factory compilation |
| Persisted session and protected shell | Phase 1, Phase 2 | AuthStore tests, cold-start loading DoD, manual relaunch check |
| OTP sign-in | Phase 2 | Sign-in model tests, manual MailHog sign-in flow |
| OTP sign-up with display name | Phase 2 | Sign-up model tests, manual MailHog sign-up flow |
| Profile fields match web intent | Phase 2 | UserProfile mapping tests and manual profile check |
| Sign out | Phase 2 | Unit tests proving local session clearing and manual sign-out flow |
| Web-like visual design | Phase 2 | SwiftUI components present; manual visual check |
| PKCE email-change app flow | Phase 3 | ChangeEmailModel, verifier store, parser, and token-exchange/session tests |
| Native callback redirect config | Phase 4 | Custom-scheme validation, `nhost config validate`, backend tests |
| Real email-change e2e | Phase 4 | Manual MailHog callback/token exchange/profile refresh |
| Existing frontend/backend not broken | Phase 4 and as needed | `bun run check` for frontend, `make test` after backend config changes |
| Docs remain accurate | Every phase that changes behavior/tooling | README/CLAUDE/iOS README updated in same phase |

---

## 6. Risks and mitigations

- **Risk:** Nhost Auth rejects custom-scheme redirects such as `neogym://verify`. — **Mitigation:** Validate before committing backend config or investing beyond app-side tests; stop and ask the user to choose Universal Links or a hosted relay if rejected.
- **Risk:** XcodeGen is unavailable or broken in the pinned Nixpkgs, especially across `eachDefaultSystem`. — **Mitigation:** Add it Darwin-safely, verify with `xcodegen --version`, and stop for fallback selection if unavailable.
- **Risk:** `swift test` accidentally stops working because UI frameworks enter `NeoGymKit`. — **Mitigation:** Declare macOS platform support and keep SwiftUI/UIKit in the app target only; enforce with `swift test` in every phase.
- **Risk:** Relative SDK path is machine-layout dependent. — **Mitigation:** Centralize it in `ios/NeoGym/Package.swift`, verify it resolves for the user's current layout, and document how to adjust if the SDK checkout moves.
- **Risk:** Token exchange does not refresh local session state as expected. — **Mitigation:** Add a Phase 3 test proving token-exchange success updates session/model state and explicitly reload/observe session after exchange.
- **Risk:** Simulator destination names differ by machine. — **Mitigation:** Document `xcrun simctl list devices available` and allow an `IOS_DESTINATION` override in `ios/NeoGym/README.md`.
- **Risk:** Docs drift as a new app/toolchain is added. — **Mitigation:** Phase 1 updates root/iOS docs immediately; Phase 4 updates redirect/auth docs with config behavior.

---

## 7. Follow-ups (out of scope for this plan)

- Port workout/session/exercise/body/journal/nutrition domain screens — tracked in: TBD.
- Add native GraphQL code generation or typed domain data layer — tracked in: TBD.
- Add production signing, TestFlight, CI on macOS runners, and device deployment — tracked in: TBD.
- Switch to Universal Links for production email verification if desired — tracked in: TBD.
- Add profile display-name/avatar editing — tracked in: TBD.
