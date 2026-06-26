<!-- markdownlint-disable MD013 -->

# NeoGym iOS parity checklist

This checklist maps each in-scope signed-in web route/action to the native iOS parity phase that owns it. Status values: ☐ planned, ◐ scaffolded, ☑ complete, ⊘ out of scope.

## Native conventions

- Navigation: submitted, cancelled, deleted, or otherwise spent form screens should dismiss/pop instead of staying on the back stack. Invalid-state redirects should also avoid leaving dead screens behind.
- Refresh: every mutation should either update local view-model state deterministically or explicitly refetch affected screens on return/appear.
- GraphQL: native repositories use raw user-role GraphQL documents, send only columns permitted by the user schema, and rely on `FakeGraphQLService` request capture for mutation-contract tests.
- Deep-link regression for Phase 1: `RootView` owns `.onOpenURL` handling above `AppShellView`, so `neogym://verify` callbacks are consumed by `AuthCallbackURLRouter` even when a non-Profile destination is selected. Manual smoke in a simulator should verify requesting an email change, switching away from Profile, then opening the callback link updates the session.

## App shell and auth/profile

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/_authed` layout navigation | Seven-destination native shell: Workouts, Exercises, Sessions, Body, Nutrition, Journal, Profile | 1 | ◐ scaffolded | Custom horizontal shell avoids iOS 15 `TabView` More hiding destinations. |
| `/profile` view | Profile destination | 1 | ☑ complete | Existing profile UI remains the only non-placeholder Phase 1 destination. |
| Profile sign out | Profile sign-out action | 1 | ☑ complete | Existing `AuthStore.signOut()` still clears local session after remote sign-out attempt. |
| Profile change email request | Change email sheet | 1 | ☑ complete | Existing app-side PKCE flow preserved. |
| `/verify` callback equivalent | `neogym://verify` callback | 1 | ☑ complete | Root-level callback routing is independent of selected shell destination. |

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
| `/body` list/chart | Body list and trend | 7 | ☐ planned | iOS 15-compatible chart/fallback. |
| `/body/new` | Create body measurement form | 7 | ☐ planned | Date-only values must not time-zone shift. |
| `/body/$id` detail | Body measurement detail | 7 | ☐ planned | Shows weight/body-fat/notes. |
| `/body/$id/edit` | Edit/delete body measurement | 7 | ☐ planned | Friendly uniqueness constraint errors. |

## Journal

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/journal` list | Journal list/filter | 8 | ☐ planned | Label filtering. |
| `/journal/new` | Create journal entry | 8 | ☐ planned | Label create/attach behavior. |
| `/journal/$id` detail | Journal detail | 8 | ☐ planned | Native markdown-ish rendering. |
| `/journal/$id/edit` | Edit/delete journal entry | 8 | ☐ planned | Spent form dismisses on submit/cancel/delete. |

## Nutrition

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/nutrition` landing | Nutrition overview | 11 | ☐ planned | Top-level Nutrition remains one primary shell destination. |
| `/nutrition/foods` list | Foods list | 9 | ☐ planned | Food search/list. |
| `/nutrition/foods/new` | Create food form | 9 | ☐ planned | Omit ownership/public fields. |
| `/nutrition/foods/$foodId` detail | Food detail | 9 | ☐ planned | Macro values per 100g. |
| `/nutrition/foods/$foodId/edit` | Edit/delete food | 9 | ☐ planned | Surface `ON DELETE RESTRICT` in-use errors. |
| `/nutrition/meals` list | Meals list | 9 | ☐ planned | Template macro totals from live foods. |
| `/nutrition/meals/new` | Create meal form | 9 | ☐ planned | Food picker and ingredient grams. |
| `/nutrition/meals/$mealId` detail | Meal detail | 9 | ☐ planned | Ingredients and totals. |
| `/nutrition/meals/$mealId/edit` | Edit/delete meal | 9 | ☐ planned | Ingredient mutation variables omit immutable/owner fields. |
| `/nutrition/plans` list | Plans list | 10 | ☐ planned | Plan templates. |
| `/nutrition/plans/new` | Create plan form | 10 | ☐ planned | Ordered meal slots and slot times. |
| `/nutrition/plans/$planId` detail | Plan detail | 10 | ☐ planned | Macro summaries from meal slots. |
| `/nutrition/plans/$planId/edit` | Edit/delete plan | 10 | ☐ planned | Surface meal-in-plan restrict errors. |
| `/nutrition/days` list | Nutrition days list | 11 | ☐ planned | Date browsing. |
| `/nutrition/days/$date` detail | Daily intake detail | 11 | ☐ planned | Plan suggestions, logged groups, totals. |
| Standalone food logging | Log food sheet/action | 11 | ☐ planned | User-selected/default-now `slotTime`; snapshot totals. |
| Meal logging | Log meal sheet/action | 11 | ☐ planned | Nested insert children include same `nutritionDayId` as parent group. |
| Edit/delete logs/day | Daily intake edit/delete actions | 11 | ☐ planned | Totals use logged snapshots, never live foods. |

## Final QA

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| Cross-domain navigation/back behavior | Full app QA | 12 | ☐ planned | Verify spent forms, delete flows, refresh-on-return. |
| Auth regression | OTP, saved session, sign-out, profile, email callback | 12 | ☐ planned | Manual smoke plus existing tests. |
| Full parity audit | Checklist closure | 12 | ☐ planned | Every row becomes complete or explicitly out of scope. |
