# Architect artifact — Native iOS Swift Frontend with nhost-swift — gpt-5.5 branch

**Created:** 2026-06-07
**Related plan:** `.pi/PLAN_native_ios_swift_frontend.md`
**Architect agent:** `nhost-architect`
**Requested `modelOverride`:** `gpt-5.5`
**Reported model(s):** initial attempt 1: `missing`; initial attempt 2: `unknown-openai`; feedback round 1: `unknown-openai`; feedback round 2: `unknown-openai`
**Model warnings:** informational warnings: first attempt returned no architect plan/sign-off due to local Node dynamic-library failure; later outputs self-reported `unknown-openai` rather than exact requested `gpt-5.5`.
**Artifact purpose:** Audit trail for this architect branch. This is not the implementer-facing plan.

---

## 1. Branch summary

### 1.1 Headline contribution

This branch pushed the final plan toward clearer package boundaries, explicit native environment config, explicit XcodeGen policy, tighter GraphQL codegen details, and smaller read/edit feature phases.

### 1.2 Ideas adopted into the final plan

- Separate pure domain and GraphQL/API concerns — final plan uses `NeoGymCore`, `NeoGymAPI`, `NhostSwift`, and `NeoGymFeatures`.
- Make native Debug/Release endpoint config concrete — final plan uses `ios/Config/*.xcconfig` with local/prod public values.
- Make XcodeGen policy explicit — final plan uses `ios/project.yml` as source of truth and does not commit generated `.xcodeproj` by default.
- Split large Sessions and Workouts phases — final plan splits sessions into read/start, strength lifecycle, and cardio logging; workouts into browse/start and authoring.
- Move delete out of read-only Sessions phase and keep OAuth2 native UI out of DoD unless a routing strategy is approved.
- Add local networking, Keychain cleanup, deep-link parser, and Makefile failure-hint details.

### 1.3 Ideas rejected or deferred

- Blocking on bundle identifier/signing — deferred as non-blocking for simulator/local implementation.
- Native OAuth2 consent as required parity — deferred because current Nhost OAuth2 provider has one web `loginURL`, and changing it would risk web support.

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

```text
dyld[74130]: Library not loaded: @rpath/libnode.147.dylib
  Referenced from: <6769D014-22BE-3E37-90A0-D7C18CDAF2F6> /opt/homebrew/Cellar/node/26.0.0/bin/node
  Reason: tried: '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open()), '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open())
dyld[74145]: Library not loaded: @rpath/libnode.147.dylib
  Referenced from: <6769D014-22BE-3E37-90A0-D7C18CDAF2F6> /opt/homebrew/Cellar/node/26.0.0/bin/node
  Reason: tried: '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open()), '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open())
dyld[78368]: Library not loaded: @rpath/libnode.147.dylib
  Referenced from: <6769D014-22BE-3E37-90A0-D7C18CDAF2F6> /opt/homebrew/Cellar/node/26.0.0/bin/node
  Reason: tried: '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open()), '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open())
dyld[78372]: Library not loaded: @rpath/libnode.147.dylib
  Referenced from: <6769D014-22BE-3E37-90A0-D7C18CDAF2F6> /opt/homebrew/Cellar/node/26.0.0/bin/node
  Reason: tried: '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open()), '/opt/homebrew/Cellar/node/26.0.0/bin/libnode.147.dylib' (no such file), '/opt/homebrew/Cellar/node/26.0.0/bin/../lib/libnode.147.dylib' (file system sandbox blocked open())
```

#### 2.1.3 Model attribution

- **Requested `modelOverride`:** `gpt-5.5`
- **Self-reported model:** `missing`
- **Model warning:** `missing-signature`

### Attempt 2

#### 2.2.1 Input prompt sent to this branch

```markdown
Same full initial planning prompt as Attempt 1, re-dispatched in parallel with the claude-opus-4-8 branch after Attempt 1 returned only a local Node dynamic-library error.
```

#### 2.2.2 Output returned by this branch (verbatim)

## Restatement

Plan a native iOS SwiftUI frontend for NeoGym that runs alongside the existing TanStack/Nhost web app, reaches full feature parity in phases, and first introduces a reusable `nhost-swift` library so auth, GraphQL, storage, session refresh, PKCE, and error handling are centralized instead of embedded in SwiftUI views.

## Touched surfaces

- `ios/NhostSwift/` — new Swift Package mirroring NeoGym-scoped `@nhost/nhost-js` behavior.
- `ios/NeoGym/` — new SwiftUI iOS 17+ app, Xcode project, app tests, UI tests.
- `frontend/src/**` — parity reference only; avoid churn unless shared GraphQL contract extraction is justified.
- `frontend/schema.user.graphqls` — current user-role GraphQL schema contract for native codegen/validation.
- `backend/nhost/nhost.toml` and `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — only if native verify/deep-link redirect URLs are required.
- `docs/developers/database.md`, `docs/developers/sessions.md`, `docs/developers/exercises.md`, `docs/developers/permissions.md` — domain invariants native must preserve.
- `CLAUDE.md`, `README.md`, new `docs/developers/native-ios.md` — document native layout, commands, parity rules, and `nhost-swift` conventions. No `AGENTS.md` or `.claude/docs/*` language-rule files are present today.

## Approach

Build `nhost-swift` first as the single Nhost boundary, then layer a SwiftUI app with MVVM/repository-style feature modules over it. The central design decision is to keep native and web coupled through the same backend/user-role GraphQL contract, not through shared UI code or backend schema changes. Native features should mirror the web route/component split where useful, but keep domain logic in Swift packages/models that can be unit-tested independently from views.

## Alternatives considered

- **Alt 1 — WebView/PWA wrapper:** fastest App Store path, but rejected because it would not deliver native UX or justify a Swift SDK boundary.
- **Alt 2 — Direct URLSession calls in views:** small initially, but rejected because auth refresh, Keychain, PKCE cleanup, GraphQL errors, and storage URLs would sprawl across features.
- **Alt 3 — Full official-grade Nhost SDK:** broader reuse, but rejected as too large. Scope `nhost-swift` to NeoGym Auth + GraphQL + Storage + OAuth2 helpers.

## Plan of action

1. **Bootstrap docs and native repo layout.**  
   Add `ios/README.md`, `docs/developers/native-ios.md`, update `README.md`, `CLAUDE.md`, and `.gitignore` for Xcode noise. Proposed layout: `ios/NhostSwift/Package.swift` and `ios/NeoGym/NeoGym.xcodeproj`. Check: docs review; no frontend/backend build needed unless those files change.

2. **Implement `NhostSwift` core package.**  
   Add endpoint configuration from subdomain/region or explicit URLs, matching JS defaults like `https://local.auth.local.nhost.run/v1` and `https://<subdomain>.graphql.<region>.nhost.run/v1`. Add injectable HTTP client, typed API error model, session structs, JWT expiry decoding, and Keychain-backed session store. Check: `cd ios/NhostSwift && swift test`.

3. **Implement `NhostSwift` Auth.**  
   Cover `signInOTPEmail`, `signUpOTPEmail`, `verifySignInOTPEmail`, refresh via `/token`, sign-out via `/signout`, `changeUserEmail`, PKCE generation/storage, `/token/exchange`, auth-state observation, and refresh serialization with an actor. Tests should prove session persistence, refresh margin behavior, PKCE cleanup, and response-session updates for `/signin/`, `/signup/`, `/token`, `/token/exchange`. Check: `swift test`.

4. **Implement `NhostSwift` GraphQL, Storage, and OAuth2 helpers.**  
   Add authenticated GraphQL request execution with bearer token refresh and Hasura/Nhost error mapping. Add `storage.fileURL(fileId)` equivalent. Add `oauth2LoginGet` and `oauth2LoginPost` helpers, even if native OAuth2 UI is deferred. Check: `swift test` with mocked requests and error fixtures.

5. **Create the SwiftUI app shell.**  
   Add `ios/NeoGym` app target, iOS 17+ deployment target, environment config for local/prod public endpoints, dependency injection for `NhostClient`, `TabView` shell with Workouts, Exercises, Sessions, Body, Journal, Profile placeholders, loading/error/empty primitives, theme support, and protected-navigation state. Check:  
   `xcodebuild test -project ios/NeoGym/NeoGym.xcodeproj -scheme NeoGym -destination 'platform=iOS Simulator,name=iPhone 15'`.

6. **Implement native auth flows and deep-link verification.**  
   Add landing, sign-in, sign-up, OTP entry, profile, sign-out, theme setting, change-email request, and verify completion. If native redirect is required, add `neogym://verify`/dev equivalent or universal-link URLs to `backend/nhost/nhost.toml` and production overlay. Checks: `xcodebuild test`, local MailHog manual auth QA, and if backend config changed: `cd backend && nhost config validate && make test`.

7. **Add native GraphQL contract/codegen and repositories.**  
   Prefer Apollo iOS or equivalent generated Swift operation types using `frontend/schema.user.graphqls` as the user-role schema source. Add `ios/NeoGym/GraphQL/Operations/*.graphql`, generated Swift outputs, repositories for workouts/exercises/sessions/body/journal, and pure domain helpers ported from `frontend/src/lib/sessions.ts`, `dates.ts`, and `cardio-schema.ts`. Check: codegen command, `xcodebuild test`, and domain unit tests.

8. **Implement Workouts and Exercises read/start flows.**  
   Add workouts list/detail with mine/public/label filters, markdown description, labels, exercise images, and start-session. Add exercises catalog search/filter/detail, storage image fallback/alternation, attributes, instructions, strength/cardio history/progress charts. Check: `xcodebuild test` plus manual local GraphQL smoke.

9. **Implement Sessions history and strength logging.**  
   Add paginated/grouped session list, session detail, started-at editing, add/remove exercises, delete session, strength set CRUD, prior-session hints, and `sessionDisplayName` behavior. Preserve native equivalent of `replace: true` for spent/deleted screens. Check: `xcodebuild test` and manual session CRUD QA.

10. **Implement cardio session logging.**  
    Port schema-driven cardio entry UI: parse/format metrics, duration inputs, required/range validation, malformed-schema fallback, entry CRUD, and cardio prior hints. Keep branching on `exercise.kind == "cardio"`, not category. Check: cardio-schema unit tests, `xcodebuild test`, and manual insert/update/delete against local Nhost.

11. **Implement workout authoring.**  
    Add create/edit/delete private workouts, label autocomplete/creation, exercise picker, drag/reorder equivalent, owner-only edit controls, destructive confirmations, and proper navigation replacement after save/cancel/delete. Check: `xcodebuild test` and manual workout CRUD QA.

12. **Implement Body feature.**  
    Add measurement list/detail/new/edit/delete, validation mirroring DB constraints, date-only local parsing, and trend charts. Check: validator/date/chart model tests and `xcodebuild test`.

13. **Implement Journal feature.**  
    Add list/detail/new/edit/delete, labels/filtering, markdown rendering, label creation/on-conflict behavior, destructive confirmations, and spent-form navigation replacement. Check: repository/form tests and `xcodebuild test`.

14. **Finalize OAuth2 consent, docs, and parity QA.**  
    If native OAuth2 consent is required, add the SwiftUI route using `NhostSwift` helpers; otherwise document that the existing web `/oauth2/login` remains the provider login URL. Add manual QA scripts for local/prod auth, deep links, workouts, exercises, sessions, body, journal, and storage images. Re-run web check only if frontend files changed: `cd frontend && nix develop ../ --command bun run check`.

## Risks and follow-ups

- Risk: Nhost redirect handling may not accept custom iOS URL schemes. Mitigation: spike locally first; fall back to universal links if needed.
- Risk: GraphQL contract drift between web and native. Mitigation: generate Swift from the same user-role SDL and keep generated outputs checked in.
- Risk: token refresh races. Mitigation: actor-serialized refresh and tests that mimic concurrent authenticated requests.
- Risk: domain invariant drift. Mitigation: keep `kind`, nullable `workout_id`, cardio schema, and permission docs in sync with native assumptions.
- Follow-up: CI/App Store signing and offline-first sync are out of scope for the initial parity plan.

## Open questions

- Should native email-change verification use a custom scheme (`neogym://verify`) or universal links?
- Is native OAuth2 consent required now, or should `/oauth2/login` remain web-only initially?
- What bundle IDs, Apple team ID, and production associated domains should be used?

---

_Plan authored by `nhost-architect` (model: `unknown-openai`)._

#### 2.2.3 Model attribution

- **Requested `modelOverride`:** `gpt-5.5`
- **Self-reported model:** `unknown-openai`
- **Model warning:** `unknown-model (reported unknown-openai; requested gpt-5.5)`

---

## 3. Feedback rounds

### Round 1

#### 3.1.1 Input prompt sent to this branch

```markdown
The branch was sent the first synthesized implementation plan draft plus full gathered requirements and the required review instruction:

"You are reviewing a revised implementation plan. Do not edit code. Critique the plan for requirement coverage, phase boundaries, definitions of done, testability, backward compatibility, deployment risk, and consistency across phases. For big changes, verify every phase is self-contained, fully functional, and testable. Return concrete feedback and improvements; do not rewrite the whole plan unless a rewrite is necessary. Include a final verdict of `READY`, `READY_WITH_MINOR_NOTES`, or `NEEDS_REVISION`, and include the mandatory sign-off trailer where you self-identify your model (do not copy any model name from this prompt)."
```

#### 3.1.2 Output returned by this branch (verbatim)

Reviewed after loading repo guidance (`CLAUDE.md`, `README.md`), domain docs, and representative frontend/backend files. No `AGENTS.md` or `.claude/docs/*` language rules are present. Nhost MCP is unavailable (`0/0 servers`), matching the task context.

## Verdict: NEEDS_REVISION

The plan is directionally strong and preserves the web/backend contract, but it needs revision before implementation because several central decisions are still ambiguous or inconsistent.

## Required improvements

1. **Resolve `NeoGymKit` purity vs GraphQL codegen**
   - The plan says `NeoGymKit` is pure domain logic, but Phase 4 puts Apollo GraphQL models there.
   - Pick one:
     - keep `NeoGymKit` pure and place Apollo codegen in `ios/NeoGym/GraphQL` or a separate `NeoGymAPI` package, or
     - explicitly make `NeoGymKit` non-pure and split targets inside it.
   - This matters for testability and dependency boundaries.

2. **Define native environment config**
   - Add a concrete plan for Debug local vs Release/prod Nhost config:
     - local `subdomain=local`, `region=local`
     - prod values from `frontend/.env.production`
     - optional explicit base URLs if simulator/device local networking differs.
   - Store these via `.xcconfig`, generated plist, or another committed convention.
   - State that no admin secret is ever included.

3. **Make XcodeGen policy explicit**
   - “Generated project may be committed or generated per docs” is too vague.
   - Decide whether `ios/NeoGym.xcodeproj` is committed.
   - Pin/document how `xcodegen` is installed or provisioned, and make `ios/Makefile` fail with a clear hint.

4. **Split oversized phases**
   - Phase 7 is too large: sessions list/detail + strength CRUD + cardio CRUD + prior hints + start-session.
   - Phase 9 is also large: workout browsing + detail + start + create/edit/delete + labels + reorder.
   - Split into read-only phase(s), then mutation/editing phase(s). Each should be buildable, testable, and manually QA-able.

5. **Strengthen Apollo/codegen contract**
   - Specify:
     - operation file location,
     - generated output location,
     - whether generated files are committed,
     - exact command,
     - drift check against `frontend/schema.user.graphqls`.
   - Include a Phase 4 smoke operation using user-role SDL before feature work proceeds.

6. **Move custom-scheme validation earlier**
   - `neogym://verify` is a deployment risk.
   - Start Phase 5 with a spike proving Nhost accepts custom schemes before changing production overlay.
   - Add exact parser tests for accepted/rejected deep links.
   - Document deployment order: backend allowlist first, then app release.

7. **Clarify OAuth2 parity**
   - Since `auth.oauth2Provider.loginURL` remains web-only, native consent UI will not naturally receive provider login requests.
   - Treat native OAuth2 UI as optional/future unless a routing strategy is approved.
   - Keep SDK helper endpoints, but don’t make native OAuth2 consent a Phase 12 DoD without that decision.

## Minor notes

- Add feature DoDs for label normalization/on-conflict behavior, date-only timezone helpers, body DB constraint mirrors, missing/malformed cardio schema fallback, and replace-style navigation.
- Phase 5 should define placeholder behavior for tabs whose features are not yet implemented.
- Backend config phase correctly includes `nhost config validate` and `make test`; keep that.
- No backend schema redesign is implied, which is correct.

---

_Plan authored by `nhost-architect` (model: `unknown-openai`)._

#### 3.1.3 Model attribution

- **Requested `modelOverride`:** `gpt-5.5`
- **Self-reported model:** `unknown-openai`
- **Model warning:** `unknown-model (reported unknown-openai; requested gpt-5.5)`

#### 3.1.4 Synthesis notes for this round

- **Adopted:** Split `NeoGymKit` into `NeoGymCore` + `NeoGymAPI`; added `ios/Config/*.xcconfig`; made XcodeGen policy explicit; specified codegen locations/generated output/commands; moved deep-link spike before overlay; clarified OAuth2 native UI as follow-up; split sessions/workouts phases.
- **Rejected:** None of the required improvements were rejected.
- **Deferred:** Bundle/signing values remain non-blocking open questions.

### Round 2

#### 3.2.1 Input prompt sent to this branch

```markdown
The branch was sent the revised implementation plan draft that introduced `NeoGymCore`, `NeoGymAPI`, `NeoGymFeatures`, concrete env config, explicit XcodeGen policy, codegen file paths, deep-link spike-before-overlay, and split read/edit phases, plus the same required review instruction from Round 1.
```

#### 3.2.2 Output returned by this branch (verbatim)

## Restatement

I reviewed the revised native iOS/`nhost-swift` plan against the repo guidance and current web/backend files. The plan is broadly additive, respects the web frontend, preserves the backend model, and now has clear package boundaries. No code edits were made. I also confirmed there is no `.claude/docs/` directory in this repo.

## Touched surfaces

- `CLAUDE.md`, `README.md`, `docs/developers/*.md` — repo rules and domain invariants.
- `frontend/src/lib/nhost/*`, `graphql.ts`, `storage.ts` — auth/session/GraphQL/storage behavior to mirror.
- `frontend/src/routes/*` and `_authed/*` — current feature parity target.
- `backend/nhost/nhost.toml`, `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json` — redirect/deep-link deployment risk.
- New `ios/` tree — all native implementation is additive.

## Approach

The plan is structurally sound and does not need a rewrite. The central layering decision — `NhostSwift` transport, `NeoGymCore` pure domain, `NeoGymAPI` GraphQL/repositories, SwiftUI app on top — is the right one. I would only tighten a few phase boundaries and add sharper acceptance checks for local networking, deep links, codegen, and large feature phases.

## Alternatives considered

- **Rewrite the plan:** rejected; the revised plan already covers the major requirements and accepted decisions.
- **Block until Apollo/deep-link unknowns are resolved:** rejected; the plan correctly uses spike gates before committing to risky paths.

## Plan of action

1. Tighten Phase 1 tooling details: specify package dependency direction, `xcodebuild` scheme/destination strategy, and exact `ios/Makefile` failure hints for missing `xcodegen` / `apollo-ios-cli`.

2. Make native local config concrete early. iOS local Nhost may hit DNS/TLS/ATS/device-networking friction. Add explicit Debug keys for auth/graphql/storage URLs, simulator vs physical-device guidance, and any Debug-only ATS exception policy if needed.

3. Adjust Phase 5 shared UI scope. `ExercisePicker` and `LabelInput` depend on domain filtering/label semantics and GraphQL data. Either make them skeletons in Phase 5 or move their functional implementation to the first feature phase that uses them.

4. Remove optional scope from Phase 8. “Delete if low-risk” should move to Phase 9 so Phase 8 stays read/start-only and testable.

5. Consider splitting Phase 9. Full session logging is large: started-at edits, exercise add/remove, strength CRUD, cardio schema forms, prior hints, delete, navigation. A safer split is strength/session lifecycle first, then cardio schema-driven logging and hints.

6. Deep-link phase needs exactness: name the canonical redirect string (`neogym://verify`), expected `URLComponents` shape, accepted query/error params, Info.plist URL registration, and reject-list tests. Keep the local allowlist spike before overlay edits.

7. Phase 4 should explicitly prove Apollo iOS can consume `frontend/schema.user.graphqls` and work with the custom auth transport. Also require one-refresh-retry max and no refresh retry for normal Hasura validation/permission errors.

8. Add Keychain specifics in Phase 2/3: accessibility class, non-syncing behavior, sign-out cleanup, PKCE cleanup, and actor-serialized refresh tests with concurrent callers.

9. Add a docs cleanup note: `README.md` currently shows an overlay `allowedUrls` example that is not present in `backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json`. Fix or clarify this when Phase 6 touches redirect docs.

## Risks and follow-ups

- Risk: custom-scheme redirects may not be accepted by Nhost or may behave differently with query strings.
- Risk: local iOS networking/cert trust may block manual QA unless documented early.
- Risk: Phase 9 is the only phase that still feels too large for one implementer pass.
- Follow-up: native OAuth2 consent UI remains correctly out of scope until a routing strategy preserves web.

## Open questions

- What final bundle identifier should `ios/project.yml` use?
- Should Debug default to simulator-local endpoints, or require explicit URL overrides for all local runs?

Final verdict: `READY_WITH_MINOR_NOTES`

---

_Plan authored by `nhost-architect` (model: `unknown-openai`)._

#### 3.2.3 Model attribution

- **Requested `modelOverride`:** `gpt-5.5`
- **Self-reported model:** `unknown-openai`
- **Model warning:** `unknown-model (reported unknown-openai; requested gpt-5.5)`

#### 3.2.4 Synthesis notes for this round

- **Adopted:** Added dependency DAG; Debug/Release explicit endpoint config and local networking docs; moved functional ExercisePicker/LabelInput to feature phases; moved all session delete/edit mutations out of read phase; split session logging into strength/lifecycle and cardio phases; added deep-link exactness; added one-refresh-retry/no-retry-on-validation-errors; added Keychain cleanup specifics.
- **Rejected:** Blocking implementation on final bundle ID; final plan keeps it non-blocking for simulator work.
- **Deferred:** ATS/device-local details are documented as implementation-time guidance in Phase 1 rather than prescribed until tested.

---

## 4. Final branch disposition

- **Latest verdict from this branch:** `READY_WITH_MINOR_NOTES`
- **Remaining concerns:** final bundle identifier and Debug device-local endpoint strategy.
- **How remaining concerns are handled:** listed as non-blocking open questions in the final plan; Phase 1 can use simulator-safe defaults and placeholder bundle ID until the user supplies release values.
