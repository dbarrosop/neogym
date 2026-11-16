# NeoGym iPhone — illustrated demo guide

**255 actual simulator screenshots · all 15 section roots · 46 verified walkthroughs.**

This is a tour of the current iPhone app, driven through its normal SwiftUI screens
with the isolated, interactive demo dataset. It is useful both for agents checking
UI changes and for people learning what an App Review visitor can explore without
an account. It is **not** evidence that Apple has approved demo-only review access.

## Start here

- **[All workflows on one HTML page](gallery.html)** — 97 visual workflow rows,
  grouped into Getting started, Today, Train, Nutrition, Progress and Me. Each row
  shows its screenshots left to right, reusing list/detail/editor views where
  useful. Create, edit and delete have separate rows. Use section links, workflow
  search and Small/Medium/Large screenshot sizing; scroll long rows horizontally
  and click a screenshot for its original PNG. Source actions/checks and known
  issues are included on the page. Open it with `open docs/ios/gallery.html` from
  the repository root; no server is needed. Keep the adjacent `screenshots/`
  folder when sharing the page.
- **[Step-by-step walkthroughs](workflows.md)** — the recorded actions, verified
  outcomes, screenshots and observed issues for every captured workflow.
- **[Capture / refresh instructions](capture.md)** — reproduce the walkthroughs on
  a fresh, dedicated simulator and validate a replacement catalog.
- **[Demo implementation and isolation contract](../developers/ios-demo.md)** —
  build/install commands, launch arguments, data behavior and App Review caveats.
- **[Capture manifest](capture-manifest.json)** — machine-readable coverage,
  timestamps, source revision, image dimensions/hashes and verification results.

The 97 visual rows are curated from the 46 recorded walkthroughs, not 97 new
independent capture runs. Shared images retain their original provenance and are
marked **Reused view**. Every one of the 255 original captures appears on the page.

The images were captured on **iPhone 17, iOS 27.0, English, portrait**, with Dark as
the default. Light and System preferences are demonstrated separately. The
simulator status bar is cosmetically set to 9:41. This published catalog includes
legacy captures whose app dates/clock were not frozen. The capture tooling now
supports a versioned **15 Jan 2025, 09:41 UTC** profile and preserves unchanged
images/provenance; profile adoption requires a deliberate baseline refresh, not
re-dating old images. See the [capture instructions](capture.md). Samples and newly
created records are fictional. Screenshots use the original **1206 × 2622**
resolution, with lossless PNG recompression only.

## Enter and leave demo

1. On the normal signed-out **Sign in** screen, tap **Try demo**. No email or code
   is required. From Sign up, use **Sign in** first.
2. Confirm the persistent **Demo · fictional data** banner and the sample profile
   **Alex Morgan · Demo** under Me → Account.
3. Explore the five tabs. Records can be created, edited, logged and deleted locally.
4. **Demo controls** in the banner, or **Me → Account**, offers **Reset demo data**.
   Reset replaces the fictional data and demo preferences, running rest and drafts.
5. **Exit demo** returns to normal sign-in/session restoration. It preserves the
   demo dataset for re-entry and does not sign out or replace an existing real session.

See [entry, persistence, reset and exit](workflows.md#demo-lifecycle),
[recovery](workflows.md#demo-recovery), and [account preferences](workflows.md#account).
The public sign-in/sign-up captures stop before sending an email or requesting OTP.

## Screen index

Every section root has its own full-resolution capture:

| Area | Section | Screenshot |
|---|---|---|
| Today | Today | [Training and nutrition](screenshots/01-today.png) |
| Train | Sessions | [Sessions by week](screenshots/10-sessions.png) |
| Train | Workouts | [Private/public templates](screenshots/12-workouts.png) |
| Train | Exercises | [Catalog](screenshots/13-exercises.png) |
| Nutrition | Log | [Week strip, summary and timeline](screenshots/20-nutrition-log.png) |
| Nutrition | Plans | [Plans](screenshots/21-plans.png) |
| Nutrition | Foods | [Foods](screenshots/22-foods.png) |
| Nutrition | Meals | [Meals](screenshots/23-meals.png) |
| Progress | Overview | [Section summaries](screenshots/30-progress-overview.png) |
| Progress | Muscles | [Weighted sets](screenshots/31-muscles.png) |
| Progress | Strength | [Weekly volume](screenshots/32-strength.png) |
| Progress | Body | [Weight and body fat](screenshots/33-body.png) |
| Progress | Energy | [Recorded energy and estimate](screenshots/34-energy.png) |
| Me | Journal | [Entries and labels](screenshots/40-journal.png) |
| Me | Account | [Sample profile and disconnected integrations](screenshots/41-account.png) |

## Today

[Walkthrough](workflows.md#today) · [Root](screenshots/01-today.png) ·
[Light appearance](screenshots/01-today-light.png)

- The Training card opens the current session and links to Sessions.
- Nutrition shows logged intake against the selected plan and the clock-based next
  planned slot. Quick log exposes the available logging shortcuts.
- Balance distinguishes recorded intake/out/net from the end-of-day estimate; an
  estimate is not a prediction of future food or activity.
- Body shows the paired weight/body-fat trend and recent averages.

The long page is documented in separate [Nutrition](screenshots/01-today-nutrition.png),
[Balance](screenshots/01-today-balance-body.png), and [Body](screenshots/01-today-body.png)
captures rather than a stitched or altered app screenshot.

## Train

| Workflow | What to do / what is shown | Walkthrough |
|---|---|---|
| Find and start a session | Browse weekly history; Start session leads to Workouts; load older sessions | [Sessions](workflows.md#sessions-pagination) |
| Log strength | Open today's partial session; edit its date/time; edit an existing set; add a set with the wheels | [Session logging](workflows.md#session) |
| Use the rest accessory | Log starts rest; add 30 seconds; switch tabs; reopen the session from the accessory; Skip | [Rest across tabs](workflows.md#session) |
| Change a session | Delete a logged set, add an exercise, log cardio, remove an exercise, and delete the session with confirmation | [Session actions](workflows.md#session) |
| Create a workout | Enter name/notes, add labels and exercises, save, then inspect the resulting template | [Create workout](workflows.md#workout-create) |
| Edit and delete a workout | Edit fields, reorder/remove exercises, expand notes and confirm deletion | [Edit workout](workflows.md#workout-edit) |
| Inspect a public template | Read-only public detail and Start session | [Public workout](workflows.md#public-workout) |
| Find an exercise | Search; Mine/Public, muscle and category filters; no-result state | [Catalog](workflows.md#exercise-catalog) |
| Inspect strength history | Instructions, Progress/History, earlier sets and ad-hoc session start | [Exercise detail](workflows.md#exercise-details) |
| Log cardio | Cardio detail/history, schema-driven metrics form, add/edit/delete entries | [Cardio](workflows.md#cardio) |

The native exercise catalog is currently read-only: there is no native exercise
create/edit form to capture. Bundled demo illustrations do not require Storage or
an external image request. The in-app rest works, but demo does not request
notification permission or create Live Activities.

## Nutrition

The timeline has solid logged slots and dashed selected-plan slots. A planned
slot remains available even when food was already logged at that time; logging
it again appends food after confirmation rather than treating the slot as done.

| Workflow | What to do / what is shown | Walkthrough |
|---|---|---|
| Navigate dates and plan | Previous/next date, week strip, calendar picker, selected-plan menu, no-plan/empty-day states, clear-day confirmation | [Log navigation](workflows.md#log-navigation) |
| Log a food | Open +, use Food, tap Change to search the two-line food list, set grams and inspect the macro preview; edit/delete the standalone snapshot | [Food logging](workflows.md#log-food) |
| Log a meal | Use Meal; search the meal list with the current choice checked; inspect ingredient amounts; save, edit and delete the logged group | [Meal logging](workflows.md#log-meal) |
| Edit a meal's logged child | Tap a food inside the expanded meal; change grams and compare live nutrition totals with the saved amount; delete only that snapshot | [Grouped food](workflows.md#log-child) |
| Log an ad-hoc item | Use Custom; enter name, amount and per-100g nutrients; edit its snapshot nutrients and inspect the recalculated preview without changing the food catalog | [Custom logging](workflows.md#log-ad-hoc) |
| Log planned intake | From plan supports meals and direct foods; timeline Log acts on a whole slot; an occupied slot asks first | [Plan logging](workflows.md#log-plan) |
| Browse foods | Search, public/owned details and no-result state | [Food library](workflows.md#food-browse) |
| Maintain foods | Create, edit and delete a private food | [Food CRUD](workflows.md#food-crud) |
| Browse meals | Search, ingredient detail and deletion restriction while a plan references the meal | [Meal library](workflows.md#meal-browse) |
| Maintain meals | Create/edit/delete; choose, reorder and remove ingredients; create/edit a food inside the picker | [Meal CRUD](workflows.md#meal-crud) |
| Browse plans | Search, meal/food slot cards, macros and Use for today | [Plan library](workflows.md#plan-browse) |
| Maintain plans | Create mixed slots; create a meal inside its picker; move a row's time; label a meal; retime/merge slots; edit/delete the plan | [Plan CRUD](workflows.md#plan-crud) |

The log and entry editor show kcal and protein/carbs/fat together, with fiber and
sugar below. Changing the amount or custom nutrients recalculates the preview;
the editor compares changed totals with the saved amount. Energy estimates use
whole kcal, not decimal precision.

Logged food uses its stored nutrient snapshot, not today's edited catalog values.
A grouped child's time belongs to its logged meal; editing that child does not
retime the meal. Direct planned-food logging is standalone and retains plan-food
provenance. The walkthrough checks these outcomes against the isolated demo file.

## Progress

| Workflow | What to do / what is shown | Walkthrough |
|---|---|---|
| Overview | Inspect all four cards; See all opens the corresponding section | [Overview and charts](workflows.md#progress-charts) |
| Muscles | Inspect direct/half-secondary bars, select Quadriceps and view its history | [Muscle selection](workflows.md#progress-charts) |
| Strength | Weekly volume, exercise volume/e1RM, nearest-point callout and exercise-detail drill-down | [Strength charts](workflows.md#progress-charts) |
| Shared chart controls | Period presets, Custom From/To dates, calendar popover and series visibility | [Chart controls](workflows.md#progress-charts) |
| Body history | Separate weight/body-fat daily and rolling-average charts, latest-five list, detail and Load more | [Body browsing](workflows.md#body-history) |
| Body entries | Create a manual reading; observe the duplicate-date error; choose a new date; edit/delete | [Body CRUD](workflows.md#body-crud) |
| Energy history | Active/resting chart, today's estimate, consumed/net charts, latest-five list, detail and Load more | [Energy browsing](workflows.md#energy-history) |
| Energy entries | Create a manual entry; observe duplicate-date validation; choose a new date; edit/delete | [Energy CRUD](workflows.md#energy-crud) |

These are fictional recorded measurements and calculated reports. Demo does not
import Apple Health or Watch data. The Account connection disclosure remains
visible even though the ordinary data/chart/editor views are shared with live mode.

## Me and lifecycle

| Workflow | What to do / what is shown | Walkthrough |
|---|---|---|
| Browse Journal | Label filters, rendered Markdown, detail | [Journal browsing](workflows.md#journal-browse) |
| Maintain Journal | Title/Markdown editor, new label, save, edit, confirmed deletion and an empty label filter | [Journal CRUD](workflows.md#journal-crud) |
| Account | Fictional profile; unavailable connections; Dark/Light/System; default rest; Reset confirmation and Exit | [Account](workflows.md#account) |
| Persistence and public entry | Save a note, terminate/relaunch, Exit, inspect public sign-in/sign-up without submitting, Try demo again, Reset | [Demo lifecycle](workflows.md#demo-lifecycle) |
| Recovery | Invalid launch destination and corrupt isolated demo JSON; recover with normal entry/Reset | [Recovery](workflows.md#demo-recovery) |

## Observed issues — captured, not silently fixed

Two existing navigation issue categories appeared during the tour:

1. **Some creates leave a blank pushed destination.** Observed when creating a
   meal after nested editing and a journal entry after adding a label. The record
   was saved. Tap **Back**, then reopen the new record from its list.
2. **Some deletes leave the deleted detail on screen.** The store confirms the
   deletion, but the pushed detail becomes missing/unavailable until **Back**.

The walkthrough records the issue screen and the successful workaround separately.
See the issue evidence under [Meal CRUD](workflows.md#meal-crud),
[Journal CRUD](workflows.md#journal-crud), and the other affected delete workflows.
A `passed` capture means its stated actions/outcomes were verified, **not** that
these navigation defects disappeared. This documentation change does not fix them.

## Coverage boundaries

This is a catalog of the **currently reachable demo screen families and canonical
workflows**, not every possible combination of record, navigation path, date,
keyboard, chart point, device, accessibility setting or localization. Shared
editors/pickers are exercised in representative contexts. The gallery also
includes intermediate, validation, confirmation, empty-result and recovery states.

The following need separate live/hardware testing and are deliberately **not**
presented as successful demo workflows:

- OTP verification/resend, actual sign-up/sign-in, PKCE change-email callbacks,
  real session recovery and real sign-out/revocation.
- Apple Health permissions/import, real imported-workout detail, Watch pairing/PAT,
  watch screens/complications, iPhone widgets and background delivery.
- Agent/MCP production access, system notification authorization and Live Activities.
- Network/cache/offline-fallback fault scenarios, arbitrary corrupt-state variants,
  backward clock changes, all Dynamic Type/Reduce Motion combinations or all themes.
- Device signing/archive, paired-device acceptance, TestFlight and App Review approval.

The demo itself stays local. After Exit, normal mode may restore a real session;
this is why reproduction requires a **fresh, credential-free simulator**. See the
[full isolation contract](../developers/ios-demo.md) for independently running
watch/widget processes and the [App Review credential caveat](../developers/ios-demo.md#app-review-notes-operator-reviewed-draft).
