<!-- markdownlint-disable MD013 -->

# NeoGym iOS parity checklist

This checklist maps each in-scope signed-in web route/action to the native iOS parity phase that owns it. Status values: ☐ planned, ◐ scaffolded, ☑ complete, ⊘ out of scope.

## Native conventions

- Navigation: submitted, cancelled, deleted, or otherwise spent form screens should dismiss/pop instead of staying on the back stack. Invalid-state redirects should also avoid leaving dead screens behind.
- Refresh: every mutation should either update local view-model state deterministically or explicitly refetch affected screens on return/appear.
- GraphQL: native repositories use raw user-role GraphQL documents, send only columns permitted by the user schema, and rely on `FakeGraphQLService` request capture for mutation-contract tests.
- Deep-link regression for Phase 1: `RootView` owns `.onOpenURL` handling above `AppShellView`, so the configured production `neogym://verify` or development `neogym-dev://verify` callback is consumed by `AuthCallbackURLRouter` even when a non-Profile destination is selected. Manual smoke in each variant should verify requesting an email change, switching away from Profile, then opening the callback link updates the session.
- Deployment configuration: ignored root four-key dotenvs provide Team, bundle base, and Nhost values. The strict materializer derives app/widget/App Group/Keychain identities; tracked files retain only public callbacks, display names, and icons. `make check`, development-only `make deploy-device DEVICE_ID=…`, and production-only `make upload-testflight VERSION=x.y` are the complete supported command surface. Routine checks/device builds perform no custom artifact validation. The production archive alone is validated exactly once after creation for one embedded widget, unresolved tokens, shared App Group/Keychain runtime parity, Keychain suffix consistency, and app/widget version parity; export/upload reuses that exact archive with Xcode-managed build numbering, and the processed TestFlight build is manually promoted without rebuilding. Future Watch names are `<base>.watch` and `<base>.watch.widgets`; no Watch target or capability exists.

## App shell and auth/profile

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/_authed` layout navigation | Grouped native shell: Workouts, Nutrition, Me primary tabs with secondary sections for Sessions/Workouts/Exercises, Nutrition subsections, and Profile/Body/Journal | 1 | ☑ complete | All seven signed-in destinations are wired through the grouped shell; the native `TabView` uses only three primary tabs, so iOS 15 does not hide destinations behind `More`. |
| `/profile` view | Profile destination | 1 | ☑ complete | Existing profile UI remains the only non-placeholder Phase 1 destination. |
| Profile sign out | Profile sign-out action | 1 | ☑ complete | Existing `AuthStore.signOut()` still clears local session after remote sign-out attempt. |
| Profile change email request | Change email sheet | 1 | ☑ complete | Existing app-side PKCE flow preserved. |
| `/verify` callback equivalent | Variant callback (`neogym://verify` / `neogym-dev://verify`) | 1 | ☑ complete | Root-level callback routing is independent of selected shell destination; both callback URLs are present in the local config and production overlay. |

## Exercises

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/exercises` list | Exercises list/search/filter | 3 | ☑ complete | Query text, muscle, category, equipment, level, and visibility filters. |
| `/exercises/$exerciseId` detail | Exercise detail | 3 | ☑ complete | Storage images, public/private visibility, strength/cardio sidecar display. |
| Exercise history/progress | Exercise detail history/progress | 3 | ☑ complete | Includes prior session summaries with simple iOS 15-compatible trend visuals. |
| Start ad-hoc session from exercise | Exercise detail start action | 3 | ☑ complete | Insert session with nullable `workoutId` and one session exercise; Sessions detail navigation arrives in Phase 5. |
| Workout-scoped exercise detail `/workouts/$workoutId/exercises/$exerciseId` | Reusable exercise detail from workout context | 4 | ☑ complete | Workout exercise rows navigate to the reusable native exercise detail. |
| Session-scoped exercise detail `/sessions/$sessionId/exercises/$exerciseId` | Reusable exercise detail from session context | 5 | ☑ complete | Session exercise rows navigate to the reusable native exercise detail. |
| Exercise create/edit/delete | Native exercise authoring | TBD | ⊘ out of scope | No current signed-in web exercise authoring route in scope. |

## Workouts

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/workouts` list | Workouts list | 4 | ☑ complete | Includes public/private handling, label badges, and label/visibility filters. |
| `/workouts/$workoutId` detail | Workout detail | 4 | ☑ complete | Ordered exercise rows, labels, description, and owner-only edit affordance. |
| `/workouts/new` | Create workout form | 4 | ☑ complete | Spent form dismisses on submit/cancel. |
| `/workouts/$workoutId/edit` | Edit workout form | 4 | ☑ complete | Includes delete confirmation and spent-screen dismissal. |
| Add/remove/reorder workout exercises | Workout form exercise picker/order controls | 4 | ☑ complete | Native picker prevents duplicate picks and rows can move up/down. |
| Workout labels | Label input/create/attach/detach | 4 | ☑ complete | Mutation variables omit ownership fields and reuse/new-label behavior mirrors web. |
| Start session from workout | Workout detail start action | 4 | ☑ complete | Copies ordered workout exercises into nested session exercises. |

## Sessions

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/sessions` list | Sessions list | 5 | ☑ complete | Uses session display-name helper from Phase 2, month grouping, and entry counts. |
| `/sessions/$sessionId` detail | Session detail | 5 | ☑ complete | Workout attribution and ordered exercises. |
| Edit session started-at | Session detail edit action | 5 | ☑ complete | Refetches detail and affected session summaries. |
| Delete session | Session delete confirmation | 5 | ☑ complete | Spent detail dismisses after delete. |
| Add/remove session exercise | Session exercise picker/delete | 5 | ☑ complete | Uses insert/delete only; never updates `exercise_id`. |
| Strength set add/edit/delete | Strength logging UI | 5 | ☑ complete | Omits `kind`/`parentKind`; double-weight UI shows per-side and volume hints. |
| Cardio entry add/edit/delete | Schema-driven cardio logging UI | 6 | ☑ complete | Uses `exercises_cardio.metrics_schema`; mutation variables omit `parentKind`. |
| Prior session history per exercise | Prior history on session detail | 6 | ☑ complete | Strength and cardio summaries, excluding current session and capped to 3 per exercise. |

## Body measurements

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/body` list/chart | Body list and trend | 7 | ☑ complete | Uses a custom iOS 15-compatible `Path` chart and Phase 2 date-only helpers. |
| `/body/new` | Create body measurement form | 7 | ☑ complete | Date-only values use `DateOnly` and mutation variables omit ownership fields. |
| `/body/$id` detail | Body measurement detail | 7 | ☑ complete | Shows weight/body-fat/notes. |
| `/body/$id/edit` | Edit/delete body measurement | 7 | ☑ complete | Surfaces friendly same-date uniqueness constraint errors. |

## Journal

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/journal` list | Journal list/filter | 8 | ☑ complete | AND-semantics label filtering with private journal labels. |
| `/journal/new` | Create journal entry | 8 | ☑ complete | Label create/attach behavior mirrors web `LabelInput`. |
| `/journal/$id` detail | Journal detail | 8 | ☑ complete | Native markdown-ish rendering via Phase 2 helper. |
| `/journal/$id/edit` | Edit/delete journal entry | 8 | ☑ complete | Spent form dismisses on submit/cancel/delete. |

## Nutrition

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/nutrition` landing | Nutrition overview | 11 | ☑ complete | Top-level Nutrition remains one primary shell destination with Overview/Days/Plans/Foods/Meals sub-navigation. |
| `/nutrition/foods` list | Foods list | 9 | ☑ complete | Food search/list with Mine/Public filters inside Nutrition sub-navigation. |
| `/nutrition/foods/new` | Create food form | 9 | ☑ complete | Mutation variables omit ownership/public fields. |
| `/nutrition/foods/$foodId` detail | Food detail | 9 | ☑ complete | Macro values per 100g and public/private edit affordance. |
| `/nutrition/foods/$foodId/edit` | Edit/delete food | 9 | ☑ complete | Surfaces `ON DELETE RESTRICT` food-in-meal errors with friendly copy. |
| `/nutrition/meals` list | Meals list | 9 | ☑ complete | Template macro totals computed from live food values. |
| `/nutrition/meals/new` | Create meal form | 9 | ☑ complete | Food picker, ingredient grams, ordering, and live macro summary. |
| `/nutrition/meals/$mealId` detail | Meal detail | 9 | ☑ complete | Ingredients and totals from live food values. |
| `/nutrition/meals/$mealId/edit` | Edit/delete meal | 9 | ☑ complete | Ingredient updates omit immutable `foodId`; food changes use delete+insert. |
| `/nutrition/plans` list | Plans list | 10 | ☑ complete | Plan search/list with macro totals inside Nutrition sub-navigation. |
| `/nutrition/plans/new` | Create plan form | 10 | ☑ complete | Meal picker, ordered slots, labels, slot times, and live macro summary. |
| `/nutrition/plans/$planId` detail | Plan detail | 10 | ☑ complete | Timed meal slots and macro summaries from live meal values. |
| `/nutrition/plans/$planId/edit` | Edit/delete plan | 10 | ☑ complete | Slot `mealId` changes use delete+insert; meal-in-plan restrict errors stay friendly. |
| `/nutrition/days` list | Nutrition days list | 11 | ☑ complete | Recent day list and local-date browsing/open-today actions. |
| `/nutrition/days/$date` detail | Daily intake detail | 11 | ☑ complete | Plan suggestions, logged groups, date navigation, and snapshot-based totals. |
| Standalone food logging | Log food sheet/action | 11 | ☑ complete | User-selected/default-now `slotTime`; mutation omits snapshot/ownership writes. |
| Meal logging | Log meal sheet/action | 11 | ☑ complete | Nested insert children include same `nutritionDayId` as parent group and preserve plan provenance. |
| Edit/delete logs/day | Daily intake edit/delete actions | 11 | ☑ complete | Entry/group grams/position/time edits and deletes; totals use logged snapshots, never live foods. |

## Final QA

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| Cross-domain navigation/back behavior | Full app QA | 12 | ☑ complete | Code audit verified context exercise detail links, spent form dismissal/delete flows, and refresh-on-return hooks; full gates passed. |
| Auth regression | OTP, saved session, sign-out, profile, email callback | 12 | ☑ complete | Existing deterministic auth/profile/email-change tests passed; unavailable interactive OTP/callback smoke gap is recorded in the Phase 12 plan log. |
| Full parity audit | Checklist closure | 12 | ☑ complete | Every checklist row is complete or explicitly out of scope; no in-scope native parity row remains planned/scaffolded. |
