# Recorded web walkthroughs

Generated from `capture-manifest.json`; do not edit by hand.

[Gallery](gallery.html) · [Capture instructions](capture.md)

These are retained results, not a new run of the browser workflows.

<a id="desktop-public-auth"></a>

## Inspect public sign-in and sign-up · desktop

**Status:** passed

1. Open /signin

**Verified outcomes**

- Public authentication screens render; screenshots contain no OTP or credentials

**Screenshots**

- [Public sign-in: email OTP request](screenshots/desktop-public-auth-signin.png)
- [Public sign-up: display name and email](screenshots/desktop-public-auth-signup.png)

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

<a id="desktop-session"></a>

## Log a strength set and use the cross-area rest timer · desktop

**Status:** passed

1. Open /train/sessions/01a1e9ee-06e6-7536-9187-4d53b0693ed3
2. Log the prefilled second working set
3. Extend rest, switch to Today, and return using the timer link

**Verified outcomes**

- A fresh backend read contains exactly two Bench press sets
- The timer survived area navigation, linked to the originating session, and cleared on Skip

**Screenshots**

- [Session: inline next-set controls and earlier history](screenshots/desktop-session-before.png)
- [Session: saved set and running rest timer](screenshots/desktop-session-logged.png)
- [Today: the session's rest timer remains available](screenshots/desktop-session-today.png)
- [Session: returned from Today and skipped the rest](screenshots/desktop-session-returned.png)

<a id="desktop-plan-log"></a>

## Append a planned slot beside existing intake · desktop

**Status:** passed

1. Open /nutrition/log/2026-11-17
2. Log the planned 07:15 slot and inspect the append confirmation

**Verified outcomes**

- A fresh backend read contains three additional food snapshots and one additional logged meal
- The planned slot remains visible and can be logged again

**Screenshots**

- [Nutrition: planned breakfast beside existing intake](screenshots/desktop-plan-log-before.png)
- [Nutrition: confirmation before appending planned intake](screenshots/desktop-plan-log-confirm.png)
- [Nutrition: appended breakfast, with its planned slot still available](screenshots/desktop-plan-log-logged.png)

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

## Inspect public sign-in and sign-up · mobile

**Status:** passed

1. Open /signin

**Verified outcomes**

- Public authentication screens render; screenshots contain no OTP or credentials

**Screenshots**

- [Public sign-in: email OTP request](screenshots/mobile-public-auth-signin.png)
- [Public sign-up: display name and email](screenshots/mobile-public-auth-signup.png)

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

<a id="mobile-session"></a>

## Log a strength set and use the cross-area rest timer · mobile

**Status:** passed

1. Open /train/sessions/01a1e9ee-88b9-73cf-b5e7-86b27b5a6bc4
2. Log the prefilled second working set
3. Extend rest, switch to Today, and return using the timer link

**Verified outcomes**

- A fresh backend read contains exactly two Bench press sets
- The timer survived area navigation, linked to the originating session, and cleared on Skip

**Screenshots**

- [Session: inline next-set controls and earlier history](screenshots/mobile-session-before.png)
- [Session: saved set and running rest timer](screenshots/mobile-session-logged.png)
- [Today: the session's rest timer remains available](screenshots/mobile-session-today.png)
- [Session: returned from Today and skipped the rest](screenshots/mobile-session-returned.png)

<a id="mobile-plan-log"></a>

## Append a planned slot beside existing intake · mobile

**Status:** passed

1. Open /nutrition/log/2026-11-17
2. Log the planned 07:15 slot and inspect the append confirmation

**Verified outcomes**

- A fresh backend read contains three additional food snapshots and one additional logged meal
- The planned slot remains visible and can be logged again

**Screenshots**

- [Nutrition: planned breakfast beside existing intake](screenshots/mobile-plan-log-before.png)
- [Nutrition: confirmation before appending planned intake](screenshots/mobile-plan-log-confirm.png)
- [Nutrition: appended breakfast, with its planned slot still available](screenshots/mobile-plan-log-logged.png)

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
