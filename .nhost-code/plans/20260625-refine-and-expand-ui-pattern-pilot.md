# Refine and expand the UI pattern pilot

**Status:** ready
**Created:** 2026-06-25

---

## 1. Requirements

Captured after Phase 1 of `.nhost-code/plans/20260624-unify-tracking-and-template-ui-patterns.md` was implemented in commit `7f55d11 refactor(ui): introduce pattern layer with body pilot`.

### 1.1 Problem / motivation

The Phase 1 body-metrics pilot was a small positive net gain, but its value depends on keeping the new `frontend/src/components/patterns/` layer narrow and proving reuse on one more close-fit surface. The user wants a smaller follow-up plan that refines the existing primitives, migrates one high-similarity surface, and then explicitly evaluates whether to continue, pause, or simplify instead of blindly continuing the old broad rollout.

### 1.2 Functional requirements

- Refine the current pattern primitives only where the body pilot exposed a real rough edge.
- Choose exactly one next surface to migrate as a validation of reuse.
- Preserve GraphQL documents, mutation payloads, query keys, route search schemas, validation rules, and `replace: true` navigation behavior.
- Avoid new abstractions unless required by the chosen surface.
- Include stopping rules and an evaluation checklist before any future route/domain migration.

### 1.3 Non-functional requirements / constraints

- Frontend-only; no backend/schema/metadata changes are expected.
- Run frontend checks through Nix: `cd frontend && nix develop ../ --command bun run check`.
- No `bun run codegen` is expected because no `graphql(...)` document or permission/schema visibility change should occur. If a GraphQL document changes intentionally, run codegen and include generated diffs.
- No UI test framework should be introduced. Use existing `bun test` smoke coverage plus manual browser checks where route behavior is involved.
- Keep phases small and independently reviewable.

### 1.4 Surfaces in scope

- `frontend/src/components/patterns/form-actions.tsx` — collapse the redundant secondary-action API.
- `frontend/src/components/patterns/patterns.test.tsx` — update tests for the refined API and keep smoke coverage meaningful.
- `frontend/src/components/body-measurement-form.tsx` — update the existing body consumer to the refined `FormActions` API.
- `frontend/src/components/patterns/README.md`, `CLAUDE.md` — update only if needed to keep documented pattern contracts accurate.
- `frontend/src/components/journal-entry-form.tsx` and `frontend/src/routes/_authed/journal/*` — migrate journal onto the same primitive set body uses.
- `.nhost-code/plans/20260624-unify-tracking-and-template-ui-patterns.md` and/or this plan — record the evaluation outcome.

### 1.5 Out of scope

- Broad rollout to workouts, exercises, sessions, or nutrition.
- New `FilterPill`, `EntityRow`, `OrderedCollection`, picker, or CRUD/resource abstractions.
- Backend/schema changes.
- Adding a React DOM/UI test framework.
- Aligning the still-unmigrated session confirm-dialog cancel style.

### 1.6 Success criteria

- `FormActions` has a single secondary action slot and all `destructiveActions` references are removed.
- Journal uses the existing body-proven primitives where flows match.
- Journal-specific labels, markdown, filters, pagination, GraphQL, and mutation logic remain obvious in journal files.
- No new primitive or journal-only pattern prop is added to make journal fit.
- The evaluation gate records a clear continue/pause/revert recommendation before any further surface is touched.

---

## 2. Implementation strategy

### 2.1 Central design decision

Use journal as the single next validation surface because it is closest to body: dated list/detail/new/edit routes, one domain form, create/edit/delete flow, repeated shell/card/state chrome, and a delete confirmation dialog. Refine only the one proven rough edge in the current primitives (`FormActions`' dual secondary slots), then migrate journal using the same primitives. Keep filter pills, list rows, and read-only detail cards inline because there are not yet enough near-identical instances to justify new abstractions.

### 2.2 Key constraints and invariants

- `JournalEntryForm` keeps its local state and body-required validation.
- Journal label selection/filtering stays local to journal code.
- Journal GraphQL documents, nested label save mutation, query keys, route search schema, and pagination remain unchanged.
- `FormActions` should remain generic and presentation-only; destructive meaning belongs to the caller-provided button, not a separate pattern prop.
- `PageHeader` remains route-level `h1` chrome; do not add heading-level/size props in this plan.
- Read-only detail content stays inline because there is no content-card primitive and the body pilot also kept detail cards inline.

### 2.3 Touched surfaces

- `frontend/src/components/patterns/form-actions.tsx` — API refinement.
- `frontend/src/components/patterns/patterns.test.tsx` — mandatory update for removed prop and optional smoke improvements.
- `frontend/src/components/body-measurement-form.tsx` — caller update.
- `frontend/src/routes/_authed/journal/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx` — shell/state/card/dialog migration.
- `frontend/src/components/journal-entry-form.tsx` — form section/action migration.
- Pattern docs and plan log — only to keep contracts/evaluation accurate.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No backend/API/schema compatibility impact. `FormActions` is an internal pattern component currently used by body and pattern tests only; journal adopts the refined API in this plan.
- **Deployment:** Standard frontend deployment. No migrations, config changes, codegen, or feature flags expected.
- **Rollback:** Each phase can be reverted with a standard git revert. If Phase 2 makes journal less clear, revert Phase 2 and keep the refined `FormActions` only if Phase 1 was beneficial.

---

## 3. Phased plan of action

### Phase 1 — Refine `FormActions` to one secondary slot

**Goal:** Remove the redundant `extraActions` / `destructiveActions` split before journal becomes a second consumer.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/patterns/form-actions.tsx` — remove `destructiveActions`; render only `extraActions` below the divider.
- `frontend/src/components/body-measurement-form.tsx` — change `destructiveActions={extraActions}` to `extraActions={extraActions}`.
- `frontend/src/components/patterns/patterns.test.tsx` — mandatory update from `destructiveActions` to `extraActions`; add/keep smoke coverage for `FormCardShell` and `ConfirmActionDialog` if not already present.
- `frontend/src/components/patterns/README.md`, `CLAUDE.md` — update only if they mention the old dual-slot API.

**Implementation steps:**

1. Remove `destructiveActions` from `FormActionsProps` and implementation.
2. Gate the secondary divider solely on `extraActions`.
3. Update the body form and pattern tests.
4. Search the repository for `destructiveActions` and remove every prop/type reference.
5. Leave public `BodyMeasurementForm`'s `extraActions` prop unchanged.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- Repository search confirms no `destructiveActions` references remain.
- Manual spot check if available: body new/edit cancel/save/delete still renders the same footer and delete action below the divider.

**Definition of done:**

- `FormActions` has exactly one secondary slot named `extraActions`.
- `patterns.test.tsx` compiles and asserts the single-slot API.
- Body behavior and visual footer remain unchanged.
- No `graphql(...)` documents changed; no codegen needed.

**Phase commit message:** `refactor(ui): collapse FormActions secondary slot`

**Implementation log**

- **Implementation notes:** Collapsed `FormActions` to a single secondary `extraActions` slot and removed the `destructiveActions` prop/fallback path. Updated `BodyMeasurementForm` to forward its existing public `extraActions` prop into the unified `FormActions` slot. Updated `patterns.test.tsx` to use the single-slot API and added smoke coverage for `FormCardShell` and `ConfirmActionDialog`.
- **Reviewer verdict:** `ACCEPT`. Reviewer confirmed the phase satisfied its definition of done: `FormActions` now has one secondary slot, `patterns.test.tsx` asserts the new API, body public props and footer behavior are structurally unchanged, no GraphQL/codegen surfaces changed, and the work did not jump ahead into journal migration.
- **Autonomous decisions / assumptions:** Removed an accidental untracked root file named `inline` that contained only subagent summary text before review. Justification: **correctness** (keep the phase diff limited to planned files), **security** (avoid committing orchestration artifacts), **long-term maintenance** (avoid repository clutter). Accepted the lack of browser/manual spot check as a recorded residual risk because automated checks and reviewer inspection passed and the markup path is structurally unchanged. Justification: **correctness** (do not claim unrun validation), **long-term maintenance** (record limitation for future evaluation).
- **Quality gate history:** Implementer ran targeted pattern tests, full `bun run check`, and grep for `destructiveActions`; all passed. Reviewer independently ran `cd frontend && nix develop ../ --command bun run check`; passed. Orchestrator mandatory gate also ran `cd frontend && nix develop ../ --command bun run check`; passed (`tsc --noEmit`, `biome check .`, and `bun test`; 84 tests passed, 0 failed). Repository search found no remaining `destructiveActions` references. No codegen was needed.

### Phase 2 — Migrate journal onto the existing primitives

**Goal:** Validate reuse by moving journal onto the same primitive set body uses, changing chrome only and never data flow.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `frontend/src/components/journal-entry-form.tsx` — use `FormSection` and `FormActions`.
- `frontend/src/routes/_authed/journal/new.tsx` — use `PageShell maxWidth="2xl"` and `FormCardShell`.
- `frontend/src/routes/_authed/journal/$id.tsx` — use `PageShell maxWidth="2xl"`, `ErrorState`, `EmptyState`, and `SkeletonState`; keep read-only detail card inline.
- `frontend/src/routes/_authed/journal/index.tsx` — use `PageShell maxWidth="3xl"`, `PageHeader`, `ErrorState`, `EmptyState`, and `SkeletonState`; keep filter pills and list rows inline.
- `frontend/src/routes/_authed/journal/$id_.edit.tsx` — use `PageShell maxWidth="2xl"`, `FormCardShell`, `ErrorState`, `EmptyState`, `SkeletonState`, and `ConfirmActionDialog`.

**Implementation steps:**

1. Migrate `JournalEntryForm` first. Preserve `entryDate`, `title`, `body`, labels state, body-required validation, pending label, and `onSubmit` payload. Translate `canSubmit = trimmedBody.length > 0 && !isSubmitting` to `submitDisabled={trimmedBody.length === 0}` because `FormActions` already disables while submitting.
2. Migrate `new.tsx` without changing label query, create mutation, toast, or `replace: true` navigation.
3. Migrate `$id.tsx` to page/query-state primitives while keeping the inline read-only detail card. Rationale: body detail also keeps its content card inline; there is no content-card primitive in this plan.
4. Migrate `index.tsx` to page/query-state primitives. Preserve URL search schema, label-filter toggle/clear behavior, infinite pagination, and current label-query behavior: label-filter query failures must not become a new blocking page error unless deliberately accepted.
5. Migrate `$id_.edit.tsx` last. Replace the inline delete `Dialog` with `ConfirmActionDialog`; keep diff-based label mutation, toasts, query invalidation, and `replace: true` navigation unchanged.
6. Clean up now-unused imports; Biome/typecheck should catch any missed `Dialog*`, `Card`, or `Skeleton` leftovers.

**Tests and checks:**

- `cd frontend && nix develop ../ --command bun run check`.
- No `bun run codegen` is needed unless a `graphql(...)` document changes intentionally; none should change.
- If no route-level tests are added, record why: no route DOM test framework exists and this is presentation-shell migration.
- Manual checks if available: journal empty and non-empty list; filtered-empty state has no CTA while unfiltered-empty state has the "Write your first entry" CTA; label filter toggle/clear and URL updates; load more if present; detail view; new save/cancel; edit save/cancel/delete; browser back after save/cancel/delete.

**Definition of done:**

- All four journal routes plus `JournalEntryForm` use the existing body-proven primitives where flows match.
- No new primitives and no new pattern props are added for journal.
- No GraphQL documents, mutation payloads, query keys, route search schemas, validation rules, filter mechanisms, pagination behavior, or `replace: true` calls change.
- Intentional visual deltas are documented in the implementation log: journal error/not-found render as body-style cards; journal edit eyebrow moves inside the `FormCardShell`; delete dialog gets body-style footer spacing/loading spinner.
- Filter pills, list rows, and read-only detail card remain inline.

**Phase commit message:** `refactor(ui): migrate journal onto pattern layer`

**Implementation log**

- **Implementation notes:** Migrated the journal form to `FormSection`/`FormActions`, preserving local entry-date/title/body/label state, body-required submission guard, label suggestions, pending labels, and the submitted payload. Migrated journal new/detail/index/edit routes onto `PageShell`, `PageHeader`, `FormCardShell`, `ErrorState`, `EmptyState`, `SkeletonState`, and `ConfirmActionDialog` where their flows match the body pilot. Filter pills, list rows, and the read-only detail card remain inline, and no GraphQL documents, query keys, search schema, mutation payloads, pagination, label behavior, or `replace: true` navigation calls were changed.
- **Intentional visual deltas:** Journal error and not-found states now render as body-style state cards; the journal edit eyebrow moved inside `FormCardShell`; and the delete confirmation now uses the body-style dialog footer spacing and pending spinner.
- **Tests / validation notes:** Added a server-render smoke test for `JournalEntryForm` to cover the migrated fields, labels, extra action slot, and blank-body submit disablement. No route-level tests were added because this repository does not have a route DOM test framework and the route changes are a presentation-shell migration. Manual browser checks are still pending for journal empty/non-empty list, filtered-empty CTA behavior, filter URL updates, load-more, detail, new/edit save/cancel/delete, and browser back behavior.
- **Reviewer verdict:** `ACCEPT`. Reviewer confirmed all four journal routes plus `JournalEntryForm` use the existing body-proven primitives where appropriate, no new pattern files/props were added, filter pills/list rows/read-only detail card stayed inline, label-query non-blocking behavior was preserved, and no GraphQL/search/mutation/query/navigation behavior changed. Reviewer noted a weak but acceptable server-render assertion for blank-body submit disablement and accepted deferring Pi-lens complexity/fan-out warnings because this phase intentionally preserves data flow.
- **Autonomous decisions / assumptions:** Removed an accidental untracked root file named `inline` containing only subagent summary text before review. Justification: **correctness** (keep the phase diff scoped), **security** (avoid committing orchestration artifacts), **long-term maintenance** (avoid repository clutter). Accepted no browser/manual checks as a recorded residual risk because automated checks and reviewer inspection passed and no route DOM test framework exists. Justification: **correctness** (do not overstate validation), **long-term maintenance** (preserve explicit follow-up evidence for Phase 3 evaluation).
- **Quality gate history:** Implementer ran targeted journal/pattern tests and full `bun run check`; passed. Reviewer ran `bun run check`; passed. Orchestrator mandatory gate ran `cd frontend && nix develop ../ --command bun run check`; passed (`tsc --noEmit`, `biome check .`, and `bun test`; 86 tests passed, 0 failed). No codegen was needed because no `graphql(...)` document changed.

### Phase 3 — Evaluate the pilot before further rollout

**Goal:** Decide continue, pause, or simplify based on body + journal evidence before touching any third surface.

**Depends on:** Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- This plan's `Implementation log` for Phase 3 — record evaluation results.
- Optionally `.nhost-code/plans/20260624-unify-tracking-and-template-ui-patterns.md` — add a short note that broad rollout should not resume automatically and that this refinement pilot supersedes the next decision point.
- `CLAUDE.md` or `frontend/src/components/patterns/README.md` — only if Phase 2 revealed a contract change that should be documented.

**Implementation steps:**

1. Compare the journal diff against the evaluation checklist below.
2. Produce a single recommendation: `continue`, `pause`, or `simplify/revert`, with justification.
3. Record whether any manual browser checks were skipped and why.
4. Do not start another production migration in this phase.

**Tests and checks:**

- If files changed, run `cd frontend && nix develop ../ --command bun run check`.
- If Phase 3 only updates the plan log, note that it has no functional artifact beyond the decision record.

**Definition of done:**

- Evaluation checklist results are recorded.
- A clear continue/pause/revert recommendation exists.
- No primitive gained domain imports or speculative props during the pilot.
- The system remains fully functional.

**Phase commit message:** `docs(ui): record journal pilot evaluation and decision`

**Implementation log**

- **Evaluation notes:** Phase 1 left `FormActions` with one secondary `extraActions` slot and repository search confirms no `destructiveActions` references remain. Phase 2 migrated journal shell/header/state/form/dialog chrome onto the existing body-proven primitives without adding primitive files, journal-only primitive props, render-prop/config indirection, or domain imports in `frontend/src/components/patterns/`. Journal GraphQL documents, query keys, search schema, mutation payloads, label filtering, pagination, and `replace: true` navigation stayed local to journal routes/components.
- **Checklist outcome:** Code clarity improved for repeated shell, form footer, state, and confirm-dialog blocks while filter pills, list rows, label behavior, markdown detail content, and read-only cards stayed inline where they remain domain-specific. UI consistency now matches body by intent for page padding/max width, header sizing, empty/error cards, form footer divider, and confirm-dialog shape. The accepted visual deltas are the Phase 2 deltas already logged: body-style journal error/not-found cards, edit eyebrow inside `FormCardShell`, and body-style delete dialog footer/loading treatment.
- **Recommendation:** `pause`. The body + journal evidence supports keeping the refined pattern layer and does not justify simplify/revert, but broad rollout should not resume automatically: manual journal/browser checks remain unrun, and likely third surfaces would need unproven filter/list-row/ordered-row abstractions that this pilot intentionally deferred. Treat any next surface as a separate decision with its own scope rather than continuing the old broad rollout.
- **Tests / validation notes:** Phase 3 is documentation/evaluation only and has no functional artifact beyond this decision record. No new tests were added. Existing Phase 2 automation and gates passed (`bun run check`, 86 tests), but manual browser checks for journal empty/non-empty list, filtered-empty CTA behavior, filter URL updates, load-more, detail, new/edit save/cancel/delete, and browser back behavior were skipped because this pass had no browser session or running app flow available; do not count them as passed.
- **Reviewer verdict:** Pending review.
- **Autonomous decisions / assumptions:** Did not update the superseded 2026-06-24 broad plan because it already says Phase 2+ must not continue without explicit re-approval and points to this refinement pilot. Did not update `CLAUDE.md` or `frontend/src/components/patterns/README.md` because Phase 2 revealed no additional pattern contract change beyond the already-documented `ui`/`patterns`/domain taxonomy. Justification: **correctness** (avoid widening Phase 3 beyond the requested decision record), **long-term maintenance** (avoid duplicate or noisy docs), **security** (no production or runtime surface changed).

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Gate:** Before committing or moving on, run all configured checks for the affected project. For frontend-only phases, run `cd frontend && nix develop ../ --command bun run check`; if GraphQL documents changed, run codegen; if backend changed, run backend tests as required by `CLAUDE.md`.
6. **Commit:** Commit all changes made during the phase with the phase commit message only after gates pass or skipped checks are explicitly justified.
7. **Continue:** Move to the next phase and repeat until requested phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| Refine current primitives before expansion | 1 | Single-slot `FormActions`, no `destructiveActions` references, tests updated |
| Validate reuse on one high-similarity surface | 2 | Journal uses body-proven primitives; no new primitives/props |
| Preserve journal behavior | 2 | No GraphQL/search/mutation/query/navigation changes; manual journal checks |
| Avoid broad rollout | all | Scope excludes workouts/exercises/sessions/nutrition migrations |
| Decide before continuing | 3 | Evaluation checklist and continue/pause/revert recommendation recorded |
| Keep frontend gates green | all | `cd frontend && nix develop ../ --command bun run check` when files change |

---

## 6. Evaluation checklist and stopping rules

### 6.1 Evaluation checklist

**Code clarity**

- Journal route chrome is easier to scan after shell/header/state/dialog blocks are replaced by primitive calls.
- No domain logic moves into primitives.
- No render-prop gymnastics, config objects, or journal-specific primitive props are required.

**UI consistency**

- Journal list/detail/new/edit chrome matches body by intent: shell padding, header sizing, empty/error cards, form footer/divider, and confirm-dialog shape.
- Intentional visual deltas are understood and accepted.

**Abstraction burden**

- Primitive count remains unchanged.
- No primitive gains a prop solely for journal.
- `FormActions` remains single-slot after Phase 1.

### 6.2 Stopping rules

- **Continue** only if journal removes meaningful chrome duplication, requires zero new primitive props, adds zero new primitives, and checks/manual flows pass. Treat the next surface as a separate decision, not an automatic continuation.
- **Pause** if journal fits cleanly but a third surface would require unproven new abstractions such as filter/list-row/ordered-row primitives.
- **Simplify or revert** if journal forces domain-aware pattern props, multiple optional slots, render-prop indirection, or obscures journal data flow.
- **Keep duplication** when fewer than roughly three near-identical instances exist or when instances diverge in domain-meaningful ways.

---

## 7. Risks and mitigations

- **Risk:** `FormActions` API change breaks current body usage. — **Mitigation:** only two current references need edits; typecheck and grep for `destructiveActions` catch misses.
- **Risk:** Journal migration accidentally changes label filtering or label queries. — **Mitigation:** keep filter/query logic local and explicitly preserve non-blocking label-query behavior.
- **Risk:** Visual changes surprise reviewers. — **Mitigation:** list all intentional deltas in Phase 2 and manual-check them.
- **Risk:** Pattern layer grows speculative props. — **Mitigation:** Phase 2 forbids new primitives and new journal-only props; Phase 3 evaluates before any expansion.
- **Risk:** Missing manual browser checks. — **Mitigation:** record skipped manual checks explicitly and do not overstate validation evidence.

---

## 8. Follow-ups (out of scope for this plan)

- Decide whether workouts should be the third validation surface — tracked in: Phase 3 recommendation.
- Extract `FilterPill` or list row primitives — deferred until at least one future migration proves enough near-identical reuse.
- Align session confirm dialog styling — deferred; sessions are outside this refinement plan.
