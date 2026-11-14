<!-- markdownlint-disable MD013 -->

# NeoGym iOS parity checklist

This checklist maps each in-scope signed-in web route/action to the native iOS parity phase that owns it. Status values: ☐ planned, ◐ scaffolded, ☑ complete, ⊘ out of scope. Phases "UI 1"–"UI 5" are the unified-design migration (root `CLAUDE.md`, "UI design system"); numbered phases are the original parity work.

## Native conventions

- Navigation: submitted, cancelled, deleted, or otherwise spent form screens should dismiss/pop instead of staying on the back stack. Invalid-state redirects should also avoid leaving dead screens behind.
- Refresh: every mutation should either update local view-model state deterministically or explicitly refetch affected screens on return/appear.
- GraphQL: native repositories use raw user-role GraphQL documents, send only columns permitted by the user schema, and rely on `FakeGraphQLService` request capture for mutation-contract tests.
- Deep-link regression for Phase 1: `RootView` owns `.onOpenURL` handling above `AppShellView`, so `neogym://verify` callbacks are consumed by `AuthCallbackURLRouter` even when a non-Profile destination is selected. Manual smoke in a simulator should verify requesting an email change, switching away from Profile, then opening the callback link updates the session.

## App shell and auth/profile

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/_authed` layout navigation | Five-tab `TabView` (Today, Train, Nutrition, Progress, Me) with segmented sections under each large title | UI 1 | ☑ complete | Same areas, sections and order as the web sidebar/tab bar; each tab keeps its own `NavigationStack`; the app targets iPhone/iOS 27. |
| `/today` (signed-in `/`) | Today tab | UI 1 | ☑ complete | Training today or the last session + Start session, nutrition against the plan with the next planned slot (Log logs the slot), yesterday's balance with today's estimate, body trend. Replaces Nutrition › Overview, including its widget snapshot and Body HealthKit sync. |
| Rest timer card/pill | `.tabViewBottomAccessory` rest timer and live session | UI 1 | ☑ complete | Shell-owned timer; logging a set starts the default rest; +30 s, Skip, tap opens the session; Live Activity follows updates. |
| Me › Account appearance and default rest | Me › Account settings | UI 1 | ☑ complete | Dark (default) / Light / System via `.preferredColorScheme`; default rest 30/60/90/180 s. |
| `/me/account` view | Me › Account | UI 5 | ☑ complete | Profile, Change email, Apple Health / Apple Watch status, Connect an agent (MCP URL with copy), appearance, default rest, sign out. |
| Profile sign out | Profile sign-out action | 1 | ☑ complete | Existing `AuthStore.signOut()` still clears local session after remote sign-out attempt. |
| Profile change email request | Change email sheet | 1 | ☑ complete | Existing app-side PKCE flow preserved. |
| `/verify` callback equivalent | `neogym://verify` callback | 1 | ☑ complete | Root-level callback routing is independent of selected shell destination. |

## Exercises

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/train/exercises` list | Exercises list/search/filter | 3 | ☑ complete | Query text, muscle, category, equipment, level, and visibility filters. |
| `/train/exercises/$exerciseId` detail | Exercise detail | 3 | ☑ complete | Storage images, public/private visibility, strength/cardio sidecar display. |
| Exercise history/progress | Exercise detail history/progress | 3 | ☑ complete | Includes prior session summaries with simple trend visuals. |
| Start ad-hoc session from exercise | Exercise detail start action | 3 | ☑ complete | Insert session with nullable `workoutId` and one session exercise; Sessions detail navigation arrives in Phase 5. |
| Workout-scoped exercise detail `/train/workouts/$workoutId/exercises/$exerciseId` | Reusable exercise detail from workout context | 4 | ☑ complete | Workout exercise rows navigate to the reusable native exercise detail. |
| Session-scoped exercise detail `/train/sessions/$sessionId/exercises/$exerciseId` | Reusable exercise detail from session context | 5 | ☑ complete | Session exercise rows navigate to the reusable native exercise detail. |
| Exercise create/edit/delete | Native exercise authoring | TBD | ⊘ out of scope | No current signed-in web exercise authoring route in scope. |

## Workouts

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/train/workouts` list | Workouts list | 4 | ☑ complete | Includes public/private handling, label badges, and label/visibility filters. |
| `/train/workouts/$workoutId` detail | Workout detail | 4 | ☑ complete | Ordered exercise rows, labels, description, and owner-only edit affordance. |
| `/train/workouts/new` | Create workout form | 4 | ☑ complete | Spent form dismisses on submit/cancel. |
| `/train/workouts/$workoutId/edit` | Edit workout form | 4 | ☑ complete | Includes delete confirmation and spent-screen dismissal. |
| Add/remove/reorder workout exercises | Workout form exercise picker/order controls | 4 | ☑ complete | Native picker prevents duplicate picks and rows can move up/down. |
| Workout labels | Label input/create/attach/detach | 4 | ☑ complete | Mutation variables omit ownership fields and reuse/new-label behavior mirrors web. |
| Start session from workout | Workout detail start action | 4 | ☑ complete | Copies ordered workout exercises into nested session exercises. |

## Sessions

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/train/sessions` list | Sessions list | UI 2 | ☑ complete | Grouped by week ("This week", "Last week", "Week of …") with session and set counts; Apple Health workout sync status. |
| `/train/sessions/$sessionId` detail | Session logging | UI 2 | ☑ complete | Exercise cards in session order; finished ones collapse to one line; the active one shows the image beside a Recent panel of three earlier sessions, its sets and an inline next-set row (weight ±2.5, reps ±1, Log starts the rest timer); totals under the title; earlier sessions of the workout and Delete at the end. |
| Edit session started-at | Session detail edit action | 5 | ☑ complete | Refetches detail and affected session summaries. |
| Delete session | Session delete confirmation | 5 | ☑ complete | Spent detail dismisses after delete. |
| Add/remove session exercise | Session exercise picker/delete | 5 | ☑ complete | Uses insert/delete only; never updates `exercise_id`. |
| Strength set add/edit/delete | Strength logging UI | 5 | ☑ complete | Omits `kind`/`parentKind`; double-weight UI shows per-side and volume hints. |
| Cardio entry add/edit/delete | Schema-driven cardio logging UI | 6 | ☑ complete | Uses `exercises_cardio.metrics_schema`; mutation variables omit `parentKind`. |
| Prior session history per exercise | Prior history on session detail | 6 | ☑ complete | Strength and cardio summaries, excluding current session and capped to 3 per exercise. |

## Body measurements

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/progress/body` list/chart | Body list and trend | 7 | ☑ complete | Uses a custom `Path` chart and Phase 2 date-only helpers. |
| `/progress/body/new` | Create body measurement form | 7 | ☑ complete | Date-only values use `DateOnly` and mutation variables omit ownership fields. |
| `/progress/body/$id` detail | Body measurement detail | 7 | ☑ complete | Shows weight/body-fat/notes. |
| `/progress/body/$id/edit` | Edit/delete body measurement | 7 | ☑ complete | Surfaces friendly same-date uniqueness constraint errors. |

## Journal

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/me/journal` list | Journal list/filter | 8 | ☑ complete | AND-semantics label filtering with private journal labels. |
| `/me/journal/new` | Create journal entry | 8 | ☑ complete | Label create/attach behavior mirrors web `LabelInput`. |
| `/me/journal/$id` detail | Journal detail | 8 | ☑ complete | Native markdown-ish rendering via Phase 2 helper. |
| `/me/journal/$id/edit` | Edit/delete journal entry | 8 | ☑ complete | Spent form dismisses on submit/cancel/delete. |

## Nutrition

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/nutrition` landing | Nutrition › Log for today | UI 3 | ☑ complete | Sections Log/Plans/Foods/Meals; the old Overview moved to Today and Progress › Energy. |
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
| Nutrition day navigator | Log week strip and date picker | UI 3 | ☑ complete | Monday–Sunday strip with logged kcal per day, swipe/adjustable to move, graphical date picker with Today. Replaces the Days list. |
| `/nutrition/log/$date` | Log timeline and day summary | UI 3 | ☑ complete | Logged slots solid; selected-plan slots without a logged slot at the same time dashed with one Log action; summary with kcal against the plan, P/C/F bars, energy out and balance. |
| Standalone food logging | Log food sheet/action | 11 | ☑ complete | User-selected/default-now `slotTime`; mutation omits snapshot/ownership writes. |
| Meal logging | Log meal sheet/action | 11 | ☑ complete | Nested insert children include same `nutritionDayId` as parent group and preserve plan provenance. |
| Edit/delete logs/day | Daily intake edit/delete actions | 11 | ☑ complete | Entry/group grams/position/time edits and deletes; totals use logged snapshots, never live foods. |

## Final QA

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| Cross-domain navigation/back behavior | Full app QA | 12 | ☑ complete | Code audit verified context exercise detail links, spent form dismissal/delete flows, and refresh-on-return hooks; full gates passed. |
| Auth regression | OTP, saved session, sign-out, profile, email callback | 12 | ☑ complete | Existing deterministic auth/profile/email-change tests passed; unavailable interactive OTP/callback smoke gap is recorded in the Phase 12 plan log. |
| Full parity audit | Checklist closure | 12 | ☑ complete | Every checklist row is complete or explicitly out of scope; no in-scope native parity row remains planned/scaffolded. |

## Progress

| Web route/action | Native destination/action | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| `/progress/overview` (design; not built on the web yet) | Progress › Overview (the tab's first section) | UI 4 | ☑ complete | Native first; the web route is still to build. One card per section with See all: top/least-trained muscles, weekly volume with this week's partial total, weight and body fat 7-day averages, 7-day average net. |
| `/progress/muscles` | Progress › Muscles | UI 4 | ☑ complete | Server `muscleSetProgress`; stacked direct/½-secondary bars select the history chart. |
| `/progress/strength` | Progress › Strength | UI 4 | ☑ complete | Server `strengthProgress`; weekly volume with best week, per-exercise e1RM summaries and charts linking to exercise detail. |
| `/progress/body` | Progress › Body | UI 4 | ☑ complete | Weight and body fat cards (7-day average, change vs prior 7 days, latest; daily readings under the average line), Apple Health sync row, latest 5 entries with a count and Load more; create/detail/edit as before. |
| `/progress/energy` | Progress › Energy | UI 4 | ☑ complete | Average out, trend, today's estimate, Calories card (Consumed and Net charts with 7-day averages), watch import source row, latest 5 entries with a count and Load more. Web has no Calories card yet. |
