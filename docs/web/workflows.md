# Recorded web walkthroughs

Generated from `capture-manifest.json`; do not edit by hand.

[Gallery](gallery.html) · [Capture instructions](capture.md)

These are retained results, not a new run of the browser workflows.

<a id="desktop-public-auth"></a>

## Inspect sign-up and verify a sign-in code · desktop

**Status:** passed

1. Open /signin
2. Return to sign-in and request a code for the seeded local account
3. Enter the code from local MailHog; the last digit submits automatically

**Verified outcomes**

- The empty code step showed Change, disabled Verify and a resend countdown
- Local verification succeeded and the app opened Today without pressing Verify

**Screenshots**

- [Public sign-in: email OTP request](screenshots/desktop-public-auth-signin.png)
- [Public sign-up: display name and email](screenshots/desktop-public-auth-signup.png)
- [Sign-in: empty verification code with Change and resend countdown](screenshots/desktop-public-auth-code.png)

<a id="desktop-root-today"></a>

## Today · desktop

**Status:** passed

1. Open /today

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Today: desktop section root](screenshots/desktop-root-today-root.png)

<a id="desktop-root-sessions"></a>

## Sessions · desktop

**Status:** passed

1. Open /train/sessions

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Sessions: desktop section root](screenshots/desktop-root-sessions-root.png)

<a id="desktop-root-workouts"></a>

## Workouts · desktop

**Status:** passed

1. Open /train/workouts

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Workouts: desktop section root](screenshots/desktop-root-workouts-root.png)

<a id="desktop-root-exercises"></a>

## Exercises · desktop

**Status:** passed

1. Open /train/exercises

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Exercises: desktop section root](screenshots/desktop-root-exercises-root.png)

<a id="desktop-root-log"></a>

## Nutrition log · desktop

**Status:** passed

1. Open /nutrition

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Nutrition log: desktop section root](screenshots/desktop-root-log-root.png)

<a id="desktop-root-plans"></a>

## Plans · desktop

**Status:** passed

1. Open /nutrition/plans

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Plans: desktop section root](screenshots/desktop-root-plans-root.png)

<a id="desktop-root-foods"></a>

## Foods · desktop

**Status:** passed

1. Open /nutrition/foods

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Foods: desktop section root](screenshots/desktop-root-foods-root.png)

<a id="desktop-root-meals"></a>

## Meals · desktop

**Status:** passed

1. Open /nutrition/meals

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Meals: desktop section root](screenshots/desktop-root-meals-root.png)

<a id="desktop-root-overview"></a>

## Overview · desktop

**Status:** passed

1. Open /progress/overview

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Overview: desktop section root](screenshots/desktop-root-overview-root.png)

<a id="desktop-root-muscles"></a>

## Muscles · desktop

**Status:** passed

1. Open /progress/muscles

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Muscles: desktop section root](screenshots/desktop-root-muscles-root.png)

<a id="desktop-root-strength"></a>

## Strength · desktop

**Status:** passed

1. Open /progress/strength

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Strength: desktop section root](screenshots/desktop-root-strength-root.png)

<a id="desktop-root-body"></a>

## Body · desktop

**Status:** passed

1. Open /progress/body

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Body: desktop section root](screenshots/desktop-root-body-root.png)

<a id="desktop-root-energy"></a>

## Energy · desktop

**Status:** passed

1. Open /progress/energy

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Energy: desktop section root](screenshots/desktop-root-energy-root.png)

<a id="desktop-root-journal"></a>

## Journal · desktop

**Status:** passed

1. Open /me/journal

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Journal: desktop section root](screenshots/desktop-root-journal-root.png)

<a id="desktop-root-account"></a>

## Account · desktop

**Status:** passed

1. Open /me/account

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Account: desktop section root](screenshots/desktop-root-account-root.png)

<a id="desktop-today-summary"></a>

## Read Today’s balance and body trend · desktop

**Status:** passed

1. Open /today
2. Inspect the body trend, then open its full Progress section

**Verified outcomes**

- Balance distinguishes the stamped actual totals from the estimated end of day
- Body renders both metrics and its Trend link opens Progress › Body

**Screenshots**

- [Today: desktop section root](screenshots/desktop-root-today-root.png) (reused view)

<a id="desktop-session"></a>

## Log and edit a strength set, with rest across tabs · desktop

**Status:** passed

1. Open /train/sessions/:fixture-id
2. Log the prefilled second working set
3. Extend rest, advance the clock ten seconds, and switch to Today
4. Return using the timer link, then Skip the rest
5. Tap the saved second set, change its reps to 8, and save

**Verified outcomes**

- A fresh backend read contains exactly two Bench press sets, with 8 reps on set 2
- Rest extended from 1:30 to 2:00, reached 1:50 after ten seconds, survived navigation and cleared on Skip

**Screenshots**

- [Session: inline next-set controls and earlier history](screenshots/desktop-session-before.png)
- [Session: saved set and running rest timer](screenshots/desktop-session-logged.png)
- [Today: the session's rest timer remains available](screenshots/desktop-session-today.png)
- [Session: edit the saved set in place after returning from Today](screenshots/desktop-session-edit.png)

<a id="desktop-exercise-detail"></a>

## Open exercise details from a session · desktop

**Status:** passed

1. Open /train/sessions/:fixture-id
2. Open the exercise options and choose Exercise details

**Verified outcomes**

- Exercise details opened the matching catalog route with a strength progress chart

**Screenshots**

- [Session: Bench press and earlier sets in the Recent panel](screenshots/desktop-exercise-detail-recent.png)
- [Session: exercise details and removal sit behind Options](screenshots/desktop-exercise-detail-options.png)
- [Exercise detail: muscles and instructions](screenshots/desktop-exercise-detail-details.png)

<a id="desktop-plan-log"></a>

## Append a planned slot beside existing intake · desktop

**Status:** passed

1. Open /nutrition/log/2025-01-15
2. Log the planned 07:15 slot and inspect the append confirmation

**Verified outcomes**

- A fresh backend read contains three additional food snapshots and one additional logged meal
- The planned slot remains visible and can be logged again

**Screenshots**

- [Nutrition: planned breakfast beside existing intake](screenshots/desktop-plan-log-before.png)
- [Nutrition: confirmation before appending planned intake](screenshots/desktop-plan-log-confirm.png)
- [Nutrition: appended breakfast and its per-food macro rows](screenshots/desktop-plan-log-logged.png)

<a id="desktop-plan-edit"></a>

## Move a planned food into an existing time slot · desktop

**Status:** passed

1. Open /nutrition/plans/:fixture-id/edit
2. Use Banana’s row menu to move it into the existing 12:30 slot
3. Save the plan and inspect the mixed lunch slot on its detail page

**Verified outcomes**

- Backend confirms the shared lunch time and positions, with Banana still at 120 g

**Screenshots**

- [Plan editor: Banana in its original afternoon slot](screenshots/desktop-plan-edit-slot.png)
- [Plan editor: choose a destination time for one planned food](screenshots/desktop-plan-edit-move.png)
- [Plan editor: the existing lunch slot now contains both meal and food](screenshots/desktop-plan-edit-merged.png)
- [Plan detail: saved lunch shows the meal, food and slot macros](screenshots/desktop-plan-edit-saved.png)

<a id="desktop-meal-edit"></a>

## Edit a meal used by a nutrition plan · desktop

**Status:** passed

1. Open /nutrition/meals/:fixture-id/edit
2. Open the current ingredient’s food picker, then close it without changing the food
3. Change the ingredient amount and inspect the recalculated live totals
4. Save the meal without changing its plan reference

**Verified outcomes**

- The editor named the referencing plan and disabled Delete
- A fresh backend read confirms 70 g of oats and all three ingredients

**Screenshots**

- [Meal editor: search foods from an existing ingredient row](screenshots/desktop-meal-edit-ingredients.png)
- [Meal editor: the linked Training day plan blocks deletion](screenshots/desktop-meal-edit-delete-guard.png)
- [Meal detail: the saved ingredient portions and nutrition totals](screenshots/desktop-meal-edit-saved.png)

<a id="desktop-progress-calories"></a>

## Open Calories from Progress Overview · desktop

**Status:** passed

1. Open /progress
2. Follow See all energy to compare consumed and net calories
3. Switch the Calories period to 90 days without changing the energy-out period

**Verified outcomes**

- Progress lands on Overview and its Energy link opens both populated Calories charts
- Changing Calories to 90 days left the energy-out trend on 30 days

**Screenshots**

- [Progress Overview: Energy card and its See all link](screenshots/desktop-progress-calories-overview-energy.png)
- [Calories: starting period and consumed calories so far](screenshots/desktop-progress-calories-consumed.png)
- [Calories: net calories and their 7-day average over the wider period](screenshots/desktop-progress-calories-net.png)

<a id="desktop-journal-crud"></a>

## Create, edit and delete a journal entry · desktop

**Status:** passed

1. Open /me/journal/new
2. Write a Markdown journal entry and save it
3. Edit the entry and save the changed title
4. Open the editor, confirm Delete, and return to the journal list

**Verified outcomes**

- The create form navigated to a detail route and a fresh backend read confirms its title
- A fresh backend read confirms the edited title
- A fresh backend read confirms deletion and the deleted detail is no longer displayed

**Screenshots**

- [Journal: blank create form](screenshots/desktop-journal-crud-new.png)
- [Journal: completed Markdown form and responsive Save actions](screenshots/desktop-journal-crud-filled.png)
- [Journal: saved entry with rendered Markdown](screenshots/desktop-journal-crud-created.png)
- [Journal: edit form](screenshots/desktop-journal-crud-edit.png)
- [Journal: updated entry](screenshots/desktop-journal-crud-updated.png)
- [Journal: destructive confirmation](screenshots/desktop-journal-crud-confirm.png)
- [Journal: returned to surviving entries after deletion](screenshots/desktop-journal-crud-deleted.png)

<a id="desktop-appearance"></a>

## Change appearance and return to Today · desktop

**Status:** passed

1. Open /me/account
2. Select Light, inspect Today, then restore Dark
3. Open /today
4. Open /me/account

**Verified outcomes**

- The real theme control changed the document appearance and persisted across navigation

**Screenshots**

- [Account: Light appearance selected](screenshots/desktop-appearance-light.png)
- [Today: Light appearance persists across navigation](screenshots/desktop-appearance-today.png)
- [Account: Dark appearance restored](screenshots/desktop-appearance-dark.png)

<a id="mobile-public-auth"></a>

## Inspect sign-up and verify a sign-in code · mobile

**Status:** passed

1. Open /signin
2. Return to sign-in and request a code for the seeded local account
3. Enter the code from local MailHog; the last digit submits automatically

**Verified outcomes**

- The empty code step showed Change, disabled Verify and a resend countdown
- Local verification succeeded and the app opened Today without pressing Verify

**Screenshots**

- [Public sign-in: email OTP request](screenshots/mobile-public-auth-signin.png)
- [Public sign-up: display name and email](screenshots/mobile-public-auth-signup.png)
- [Sign-in: empty verification code with Change and resend countdown](screenshots/mobile-public-auth-code.png)

<a id="mobile-root-today"></a>

## Today · mobile

**Status:** passed

1. Open /today

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Today: mobile section root](screenshots/mobile-root-today-root.png)

<a id="mobile-root-sessions"></a>

## Sessions · mobile

**Status:** passed

1. Open /train/sessions

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Sessions: mobile section root](screenshots/mobile-root-sessions-root.png)

<a id="mobile-root-workouts"></a>

## Workouts · mobile

**Status:** passed

1. Open /train/workouts

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Workouts: mobile section root](screenshots/mobile-root-workouts-root.png)

<a id="mobile-root-exercises"></a>

## Exercises · mobile

**Status:** passed

1. Open /train/exercises

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Exercises: mobile section root](screenshots/mobile-root-exercises-root.png)

<a id="mobile-root-log"></a>

## Nutrition log · mobile

**Status:** passed

1. Open /nutrition

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Nutrition log: mobile section root](screenshots/mobile-root-log-root.png)

<a id="mobile-root-plans"></a>

## Plans · mobile

**Status:** passed

1. Open /nutrition/plans

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Plans: mobile section root](screenshots/mobile-root-plans-root.png)

<a id="mobile-root-foods"></a>

## Foods · mobile

**Status:** passed

1. Open /nutrition/foods

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Foods: mobile section root](screenshots/mobile-root-foods-root.png)

<a id="mobile-root-meals"></a>

## Meals · mobile

**Status:** passed

1. Open /nutrition/meals

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Meals: mobile section root](screenshots/mobile-root-meals-root.png)

<a id="mobile-root-overview"></a>

## Overview · mobile

**Status:** passed

1. Open /progress/overview

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Overview: mobile section root](screenshots/mobile-root-overview-root.png)

<a id="mobile-root-muscles"></a>

## Muscles · mobile

**Status:** passed

1. Open /progress/muscles

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Muscles: mobile section root](screenshots/mobile-root-muscles-root.png)

<a id="mobile-root-strength"></a>

## Strength · mobile

**Status:** passed

1. Open /progress/strength

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Strength: mobile section root](screenshots/mobile-root-strength-root.png)

<a id="mobile-root-body"></a>

## Body · mobile

**Status:** passed

1. Open /progress/body

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Body: mobile section root](screenshots/mobile-root-body-root.png)

<a id="mobile-root-energy"></a>

## Energy · mobile

**Status:** passed

1. Open /progress/energy

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Energy: mobile section root](screenshots/mobile-root-energy-root.png)

<a id="mobile-root-journal"></a>

## Journal · mobile

**Status:** passed

1. Open /me/journal

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Journal: mobile section root](screenshots/mobile-root-journal-root.png)

<a id="mobile-root-account"></a>

## Account · mobile

**Status:** passed

1. Open /me/account

**Verified outcomes**

- The real route and its data requests settled without browser or GraphQL errors

**Screenshots**

- [Account: mobile section root](screenshots/mobile-root-account-root.png)

<a id="mobile-today-summary"></a>

## Read Today’s balance and body trend · mobile

**Status:** passed

1. Open /today
2. Inspect the body trend, then open its full Progress section

**Verified outcomes**

- Balance distinguishes the stamped actual totals from the estimated end of day
- Body renders both metrics and its Trend link opens Progress › Body

**Screenshots**

- [Today: recorded balance and the separate end-of-day estimate](screenshots/mobile-today-summary-balance.png)
- [Today: weight and body fat with latest readings and weekly averages](screenshots/mobile-today-summary-body.png)

<a id="mobile-session"></a>

## Log and edit a strength set, with rest across tabs · mobile

**Status:** passed

1. Open /train/sessions/:fixture-id
2. Log the prefilled second working set
3. Extend rest, advance the clock ten seconds, and switch to Today
4. Return using the timer link, then Skip the rest
5. Tap the saved second set, change its reps to 8, and save

**Verified outcomes**

- A fresh backend read contains exactly two Bench press sets, with 8 reps on set 2
- Rest extended from 1:30 to 2:00, reached 1:50 after ten seconds, survived navigation and cleared on Skip

**Screenshots**

- [Session: inline next-set controls and earlier history](screenshots/mobile-session-before.png)
- [Session: saved set and running rest timer](screenshots/mobile-session-logged.png)
- [Today: the session's rest timer remains available](screenshots/mobile-session-today.png)
- [Session: edit the saved set in place after returning from Today](screenshots/mobile-session-edit.png)

<a id="mobile-exercise-detail"></a>

## Open exercise details from a session · mobile

**Status:** passed

1. Open /train/sessions/:fixture-id
2. Open the exercise options and choose Exercise details

**Verified outcomes**

- On mobile, the exercise instructions are above the Progress card
- Exercise details opened the matching catalog route with a strength progress chart

**Screenshots**

- [Session: Bench press and earlier sets in the Recent panel](screenshots/mobile-exercise-detail-recent.png)
- [Session: exercise details and removal sit behind Options](screenshots/mobile-exercise-detail-options.png)
- [Exercise detail: muscles and instructions](screenshots/mobile-exercise-detail-details.png)
- [Exercise detail: volume and estimated 1RM over earlier sessions](screenshots/mobile-exercise-detail-progress.png)

<a id="mobile-plan-log"></a>

## Append a planned slot beside existing intake · mobile

**Status:** passed

1. Open /nutrition/log/2025-01-15
2. Log the planned 07:15 slot and inspect the append confirmation

**Verified outcomes**

- A fresh backend read contains three additional food snapshots and one additional logged meal
- The planned slot remains visible and can be logged again

**Screenshots**

- [Nutrition: planned breakfast beside existing intake](screenshots/mobile-plan-log-before.png)
- [Nutrition: confirmation before appending planned intake](screenshots/mobile-plan-log-confirm.png)
- [Nutrition: appended breakfast and its per-food macro rows](screenshots/mobile-plan-log-logged.png)

<a id="mobile-plan-edit"></a>

## Move a planned food into an existing time slot · mobile

**Status:** passed

1. Open /nutrition/plans/:fixture-id/edit
2. Use Banana’s row menu to move it into the existing 12:30 slot
3. Save the plan and inspect the mixed lunch slot on its detail page

**Verified outcomes**

- Backend confirms the shared lunch time and positions, with Banana still at 120 g

**Screenshots**

- [Plan editor: Banana in its original afternoon slot](screenshots/mobile-plan-edit-slot.png)
- [Plan editor: choose a destination time for one planned food](screenshots/mobile-plan-edit-move.png)
- [Plan editor: the existing lunch slot now contains both meal and food](screenshots/mobile-plan-edit-merged.png)
- [Plan detail: saved lunch shows the meal, food and slot macros](screenshots/mobile-plan-edit-saved.png)

<a id="mobile-meal-edit"></a>

## Edit a meal used by a nutrition plan · mobile

**Status:** passed

1. Open /nutrition/meals/:fixture-id/edit
2. Open the current ingredient’s food picker, then close it without changing the food
3. Change the ingredient amount and inspect the recalculated live totals
4. Save the meal without changing its plan reference

**Verified outcomes**

- The editor named the referencing plan and disabled Delete
- A fresh backend read confirms 70 g of oats and all three ingredients

**Screenshots**

- [Meal editor: search foods from an existing ingredient row](screenshots/mobile-meal-edit-ingredients.png)
- [Meal editor: the linked Training day plan blocks deletion](screenshots/mobile-meal-edit-delete-guard.png)
- [Meal detail: the saved ingredient portions and nutrition totals](screenshots/mobile-meal-edit-saved.png)

<a id="mobile-progress-calories"></a>

## Open Calories from Progress Overview · mobile

**Status:** passed

1. Open /progress
2. Follow See all energy to compare consumed and net calories
3. Switch the Calories period to 90 days without changing the energy-out period

**Verified outcomes**

- Progress lands on Overview and its Energy link opens both populated Calories charts
- Changing Calories to 90 days left the energy-out trend on 30 days

**Screenshots**

- [Progress Overview: Energy card and its See all link](screenshots/mobile-progress-calories-overview-energy.png)
- [Calories: starting period and consumed calories so far](screenshots/mobile-progress-calories-consumed.png)
- [Calories: net calories and their 7-day average over the wider period](screenshots/mobile-progress-calories-net.png)

<a id="mobile-journal-crud"></a>

## Create, edit and delete a journal entry · mobile

**Status:** passed

1. Open /me/journal/new
2. Write a Markdown journal entry and save it
3. Edit the entry and save the changed title
4. Open the editor, confirm Delete, and return to the journal list

**Verified outcomes**

- The create form navigated to a detail route and a fresh backend read confirms its title
- A fresh backend read confirms the edited title
- A fresh backend read confirms deletion and the deleted detail is no longer displayed

**Screenshots**

- [Journal: blank create form](screenshots/mobile-journal-crud-new.png)
- [Journal: completed Markdown form and responsive Save actions](screenshots/mobile-journal-crud-filled.png)
- [Journal: saved entry with rendered Markdown](screenshots/mobile-journal-crud-created.png)
- [Journal: edit form](screenshots/mobile-journal-crud-edit.png)
- [Journal: updated entry](screenshots/mobile-journal-crud-updated.png)
- [Journal: destructive confirmation](screenshots/mobile-journal-crud-confirm.png)
- [Journal: returned to surviving entries after deletion](screenshots/mobile-journal-crud-deleted.png)

<a id="mobile-appearance"></a>

## Change appearance and return to Today · mobile

**Status:** passed

1. Open /me/account
2. Select Light, inspect Today, then restore Dark
3. Open /today
4. Open /me/account

**Verified outcomes**

- The real theme control changed the document appearance and persisted across navigation

**Screenshots**

- [Account: Light appearance selected](screenshots/mobile-appearance-light.png)
- [Today: Light appearance persists across navigation](screenshots/mobile-appearance-today.png)
- [Account: Dark appearance restored](screenshots/mobile-appearance-dark.png)

<a id="desktop-progress-photos"></a>

## Check in, browse, compare, correct and delete private progress photos · desktop

**Status:** passed

1. Open /progress/body
2. Open the photo card on Body and go to the empty history
3. Check in Front A and Back A illustrations on one earlier date
4. Check in a later Front A only
5. Open the newer Front A, step to the older one and back
6. Correct the newer photo's date in the edit dialog
7. Compare the older and newer Front A photos
8. Filter the gallery to Front A
9. Open /progress/body/photos
10. Open the older Front A and confirm Delete photo
11. Return to Body and check its photo card
12. Open /progress/body

**Verified outcomes**

- A fresh backend read has three ready files: Front A and Back A on the first date, Front A on the later one
- The edit changed only the date, keeping the same file ID and label
- Body shows two ready photos, the latest date and that date's photo
- A fresh backend read confirms that the deleted photo is inaccessible and the other two remain
- The runner removed the remaining synthetic upload through Storage after capture

**Screenshots**

- [Progress photos: empty private history and the Add photos action](screenshots/desktop-progress-photos-empty.png)
- [Add photos: one date, with a generated illustration in the Front A and Back A slots](screenshots/desktop-progress-photos-prepared.png)
- [Photo viewer: the label as title, then older and newer Front A photos](screenshots/desktop-progress-photos-viewer.png)
- [Edit details: correct the date without replacing the image](screenshots/desktop-progress-photos-edit.png)
- [Gallery: the Front A filter shows that label over time](screenshots/desktop-progress-photos-filtered.png)
- [Delete photo: explicit confirmation before removing the image](screenshots/desktop-progress-photos-confirm.png)
- [Gallery: the first date keeps its Back A, with an Add slot where Front A was](screenshots/desktop-progress-photos-deleted.png)
- [Contact sheet: a row per date, labels in columns, and an Add slot for the missing Back A](screenshots/desktop-progress-photos-timeline.png)
- [Compare: older and newer Front A, with the time between and the body-weight change](screenshots/desktop-progress-photos-compare.png)

<a id="mobile-progress-photos"></a>

## Check in, browse, compare, correct and delete private progress photos · mobile

**Status:** passed

1. Open /progress/body
2. Open the photo card on Body and go to the empty history
3. Check in Front A and Back A illustrations on one earlier date
4. Check in a later Front A only
5. Open the newer Front A, step to the older one and back
6. Correct the newer photo's date in the edit dialog
7. Compare the older and newer Front A photos
8. Filter the gallery to Front A
9. Open /progress/body/photos
10. Open the older Front A and confirm Delete photo
11. Return to Body and check its photo card
12. Open /progress/body

**Verified outcomes**

- A fresh backend read has three ready files: Front A and Back A on the first date, Front A on the later one
- The edit changed only the date, keeping the same file ID and label
- Body shows two ready photos, the latest date and that date's photo
- A fresh backend read confirms that the deleted photo is inaccessible and the other two remain
- The runner removed the remaining synthetic upload through Storage after capture

**Screenshots**

- [Progress photos: empty private history and the Add photos action](screenshots/mobile-progress-photos-empty.png)
- [Add photos: one date, with a generated illustration in the Front A and Back A slots](screenshots/mobile-progress-photos-prepared.png)
- [Photo viewer: the label as title, then older and newer Front A photos](screenshots/mobile-progress-photos-viewer.png)
- [Edit details: correct the date without replacing the image](screenshots/mobile-progress-photos-edit.png)
- [Gallery: the Front A filter shows that label over time](screenshots/mobile-progress-photos-filtered.png)
- [Delete photo: explicit confirmation before removing the image](screenshots/mobile-progress-photos-confirm.png)
- [Gallery: the first date keeps its Back A, with an Add slot where Front A was](screenshots/mobile-progress-photos-deleted.png)
- [Contact sheet: a row per date, labels in columns, and an Add slot for the missing Back A](screenshots/mobile-progress-photos-timeline.png)
- [Compare: older and newer Front A, with the time between and the body-weight change](screenshots/mobile-progress-photos-compare.png)
