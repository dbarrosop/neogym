#!/usr/bin/env python3
"""Repeatable demo-only UI walkthroughs for the illustrated iPhone guide.

Start DemoGuideCaptureUITests first on a fresh simulator. Select a group with
--group, or use --group roots for all 15 section roots. Captures and successful
workflow assertions are recorded by capture-demo-guide.py.
"""

import argparse
import datetime
import runpy
from pathlib import Path

CLIENT = runpy.run_path(str(Path(__file__).with_name("capture-demo-guide.py")))
Guide = CLIENT["Guide"]


def persisted_number(value):
    try:
        return float(value)
    except (TypeError, ValueError) as error:
        raise AssertionError("A saved demo value was not numeric") from error


ROOTS = [
    ("today", "Today", None, "01-today", "Today: training and nutrition"),
    ("train/sessions", "Train", "Sessions", "10-sessions", "Train: sessions by week"),
    ("train/workouts", "Train", "Workouts", "12-workouts", "Train: workout library"),
    ("train/exercises", "Train", "Exercises", "13-exercises", "Train: exercise catalog"),
    ("nutrition/log", "Nutrition", "Log", "20-nutrition-log", "Nutrition: day summary and week strip"),
    ("nutrition/plans", "Nutrition", "Plans", "21-plans", "Nutrition: plan library"),
    ("nutrition/foods", "Nutrition", "Foods", "22-foods", "Nutrition: food library"),
    ("nutrition/meals", "Nutrition", "Meals", "23-meals", "Nutrition: meal library"),
    ("progress/overview", "Progress", "Overview", "30-progress-overview", "Progress: overview"),
    ("progress/muscles", "Progress", "Muscles", "31-muscles", "Progress: weighted muscle sets"),
    ("progress/strength", "Progress", "Strength", "32-strength", "Progress: strength and volume"),
    ("progress/body", "Progress", "Body", "33-body", "Progress: body measurements"),
    ("progress/energy", "Progress", "Energy", "34-energy", "Progress: daily energy"),
    ("me/journal", "Me", "Journal", "40-journal", "Me: journal"),
    ("me/account", "Me", "Account", "41-account", "Me: local sample profile and connections"),
]


def capture_root(guide, root):
    screen, area, section, name, title = root
    guide.step("Open " + (area + " → " + section if section else area))
    guide.launch(screen)
    guide.expect(area, kind="navigationBar")
    if section:
        guide.expect(section, kind="button")
    guide.shot(name, title)


def capture_roots(guide):
    for root in ROOTS:
        guide.run_workflow("root-" + root[0].replace("/", "-"), root[4],
                           lambda current, target=root: capture_root(current, target))


def today(guide):
    guide.launch("today")
    guide.step("Open the Today quick-log menu")
    guide.tap("Quick log")
    guide.shot("01-today-quick-log", "Today: quick-log shortcuts")
    guide.call("coordinate", x=0.15, y=0.40)
    guide.step("Inspect the nutrition summary, recorded balance and end-of-day estimate")
    guide.position("Nutrition")
    guide.shot("01-today-nutrition", "Today: logged nutrition and selected plan")
    guide.position("Balance")
    guide.shot("01-today-balance-body", "Today: recorded balance and end-of-day estimate")
    guide.position("Body")
    guide.shot("01-today-body", "Today: body chart and latest measurements")


def confirm(guide, label):
    if label == "Cancel" and not any(item["hittable"] for item in guide.query("Cancel")):
        # iOS 27's anchored confirmation popovers omit the cancel row; tap their backdrop.
        guide.call("coordinate", x=0.05, y=0.42)
        return
    sheets = guide.query(kind="sheet")
    guide.tap(label, **({"scope": guide.element(kind="sheet")} if sheets else {}))


def return_after_delete(guide, area, screenshot):
    if not guide.exists(area, kind="navigationBar", timeout=1)["exists"]:
        guide.shot(screenshot, "Known issue: deleted detail remains until Back")
        guide.note_issue(
            "delete-navigation",
            "Some pushed editors delete the record but leave its now-missing detail page visible. "
            "Tap the native Back button once to return to the section list.",
            screenshot,
        )
        guide.back()
    guide.expect(area, kind="navigationBar")


def open_created_detail(guide, edit_label, name, issue_screenshot, match="prefix"):
    if not guide.exists(edit_label, timeout=2)["exists"]:
        guide.shot(issue_screenshot, "Known issue: creation can leave an unresolved blank destination")
        guide.note_issue(
            "create-navigation-after-nested-editor",
            "After using nested nutrition or label editors, saving a new item can leave a blank pushed destination. "
            "The item was saved: tap Back, then reopen it from its section list.",
            issue_screenshot,
        )
        guide.back()
        guide.reveal(name, match=match, direction="down")
        guide.tap(name, match=match)
    guide.expect(edit_label, kind="button")


def dismiss_keyboard(guide):
    if not guide.exists(None, kind="keyboard", timeout=0.2)["exists"]:
        return
    for label in ["Done", "Return", "Search"]:
        matches = guide.call("query", element=guide.element(label))["elements"]
        if any(item["hittable"] for item in matches):
            guide.tap(label)
            if not guide.exists(None, kind="keyboard", timeout=0.2)["exists"]:
                return
    guide.call("drag", x=0.96, y=0.42, toX=0.96, toY=0.90)


def advance_wheel(guide, index=0):
    wheel = guide.query(kind="pickerWheel")[index]
    x, y, width, height = wheel["frame"]
    guide.call("coordinate", x=(x + width / 2) / 402,
               y=(y + height / 2 + min(32, height * 0.22)) / 874)
    guide.require("The wheel selected its next visible row",
                  guide.query(kind="pickerWheel")[index]["value"] != wheel["value"])


def session(guide):
    guide.launch("train/session/current")
    guide.expect("Log set 2", kind="button")
    guide.step("Open today's partially logged session and inspect the current exercise")
    guide.shot("11-session-strength", "Session: active strength exercise and recent history")
    guide.tap("Edit start date and time")
    guide.shot("11-session-date-editor", "Session: edit start date and time")
    guide.tap("Save")
    guide.step("Edit the first logged set with the native weight/reps wheels")
    guide.tap("1,", match="prefix")
    guide.expect("Edit set 1", kind="navigationBar")
    guide.shot("11-session-set-edit", "Session: edit a logged strength set")
    guide.call("adjust", element=guide.element(kind="pickerWheel", index=2), value="11")
    guide.shot("11-session-set-edit-adjusted", "Session: adjusted repetitions")
    guide.tap("Save")
    guide.step("Open the next-set editor and save a set; this starts a local rest")
    guide.tap("Weight for set 2")
    guide.shot("11-session-set-add", "Session: add a strength set with wheel controls")
    guide.tap("Save")
    guide.expect("Log set 3", kind="button")
    guide.shot("11-session-set-logged", "Session: saved set and running rest timer")
    guide.tap("Add 30 seconds")
    guide.shot("11-session-rest-extended", "Session: extend the rest countdown")
    guide.step("Switch tabs and reopen the session from the rest accessory")
    guide.tap("Today", scope=guide.element(kind="tabBar"))
    guide.shot("11-session-rest-on-today", "Rest timer remains available on Today")
    guide.tap("Rest", match="prefix")
    guide.expect("Log set 3", kind="button")
    guide.tap("Skip rest")
    guide.shot("11-session-rest-skipped", "Session: rest skipped, live session remains open")
    guide.step("Delete a logged strength set; this sheet action is immediate")
    guide.tap("2,", match="prefix")
    guide.tap("Delete set")
    guide.expect("Log set 2", kind="button")
    guide.shot("11-session-set-deleted", "Session: deleted set removed from totals")
    guide.step("Add a cardio exercise using the multi-select exercise picker")
    guide.tap("Add exercise", scope=guide.element(kind="navigationBar"))
    guide.expect("Add exercises", kind="navigationBar")
    guide.shot("11-session-exercise-picker", "Session: exercise selection and filters")
    guide.tap("Treadmill run", match="prefix")
    guide.shot("11-session-exercise-picker-selected", "Session: selected exercise ready to add")
    guide.tap("Add 1")
    guide.reveal("Options for Treadmill run")
    guide.shot("11-session-added-exercise", "Session: added cardio exercise and earlier workout sessions")
    guide.step("Remove an exercise through its options and confirm the removal")
    guide.tap("Options for Treadmill run")
    guide.shot("11-session-exercise-menu", "Session: exercise details and remove actions")
    guide.tap("Remove from session")
    guide.shot("11-session-remove-confirmation", "Session: confirm removing an exercise")
    confirm(guide, "Remove")
    guide.step("Inspect earlier sessions, then confirm deletion of the current session")
    guide.reveal("Delete session")
    guide.shot("11-session-comparison-delete", "Session: earlier sessions and destructive action")
    guide.tap("Delete session")
    guide.shot("11-session-delete-confirmation", "Session: confirm deleting all logged sets")
    confirm(guide, "Delete session")
    guide.expect("Train", kind="navigationBar")
    guide.shot("11-session-deleted", "Session deleted: return to the Train root")


def workout_create(guide):
    guide.launch("train/workouts")
    guide.step("Create a private workout with a name, label and exercise list")
    guide.tap("New workout", scope=guide.element(kind="navigationBar"))
    guide.expect("New workout", kind="navigationBar")
    guide.shot("12-workout-create", "Workout: new template form")
    guide.type("Name", "Screenshot workout")
    guide.type("Add label", "documented")
    guide.shot("12-workout-label-suggestions", "Workout: create or choose a label")
    guide.tap("Add")
    guide.tap("Add exercise")
    guide.shot("12-workout-exercise-picker", "Workout: multi-select exercise picker")
    guide.tap("Barbell bench press", match="prefix")
    guide.tap("Dumbbell row", match="prefix")
    guide.shot("12-workout-exercise-selection", "Workout: multiple selected exercises")
    guide.tap("Add 2")
    guide.shot("12-workout-create-filled", "Workout: populated create form")
    guide.tap("Create workout")
    guide.expect("Train", kind="navigationBar")
    guide.reveal("Screenshot workout", match="prefix")
    guide.tap("Screenshot workout", match="prefix")
    guide.expect("Edit workout", kind="button")
    guide.shot("12-workout-created", "Workout: newly created private template")


def workout_edit(guide):
    guide.launch("train/workouts")
    original = next(row for row in guide.rows("workouts") if row["name"] == "Strength foundation")
    guide.step("Open a private workout; public workouts remain read-only")
    guide.tap("Strength foundation", match="prefix")
    guide.expect("Edit workout", kind="button")
    guide.shot("12-workout-detail", "Workout: history bars, exercise list and Start session")
    guide.scroll()
    guide.shot("12-workout-detail-notes", "Workout: exercises and markdown notes")
    if any(item["hittable"] for item in guide.query("Show all")):
        guide.tap("Show all")
        guide.shot("12-workout-notes-expanded", "Workout: expanded markdown notes")
    guide.step("Edit the template and reorder its exercise list by long-press")
    guide.tap("Edit workout")
    guide.expect("Edit workout", kind="navigationBar")
    guide.shot("12-workout-edit", "Workout: edit template fields and labels")
    guide.type("Name", "Strength foundation - edited")
    dismiss_keyboard(guide)
    guide.reveal("Barbell bench press", kind="any", match="prefix")
    guide.call("press", element=guide.element("Barbell bench press", kind="any", match="prefix"))
    guide.shot("12-workout-exercise-context-menu", "Workout: reorder or remove an exercise")
    guide.tap("Move down")
    guide.reveal("Delete workout")
    guide.shot("12-workout-edit-exercises", "Workout: reordered exercises and delete action")
    guide.tap("Save changes")
    guide.expect("Strength foundation - edited", kind="text")
    updated = next(row for row in guide.rows("workouts") if row["id"] == original["id"])
    guide.require("Workout rename and exercise reordering were persisted",
                  updated["name"] == "Strength foundation - edited"
                  and updated["exerciseIds"][1] == original["exerciseIds"][0])
    guide.step("Start a new session from the edited workout")
    guide.scroll("down", count=3)
    guide.tap("Start session")
    guide.expect("Add exercise", kind="button")
    guide.shot("12-workout-started-session", "Workout: new session inherits the template exercise order")
    guide.back()
    guide.step("Delete the workout; existing sessions are preserved as ad-hoc")
    sessions_before = len(guide.rows("sessions"))
    guide.tap("Edit workout")
    guide.reveal("Delete workout")
    guide.tap("Delete workout")
    guide.shot("12-workout-delete-confirmation", "Workout: deletion preserves past sessions")
    confirm(guide, "Delete workout")
    guide.require("Deleted workout is absent from the local store",
                  all(row["id"] != original["id"] for row in guide.rows("workouts")))
    guide.require("Workout deletion detached rather than deleted its sessions",
                  len(guide.rows("sessions")) == sessions_before
                  and all(row.get("workoutId") != original["id"] for row in guide.rows("sessions")))
    return_after_delete(guide, "Train", "12-workout-deleted-detail-issue")
    guide.tap("Sessions")
    guide.shot("12-workout-deleted-sessions-preserved", "Workout deleted: detached sessions remain in history")


def exercise_catalog(guide):
    guide.launch("train/exercises")
    guide.step("Filter the catalog to private exercises, then inspect each filter menu")
    guide.tap("Mine")
    guide.shot("13-exercises-mine", "Exercises: private catalog filter")
    guide.tap("Mine")
    for title in ["Muscle", "Category", "Equipment", "Level"]:
        for _ in range(4):
            if guide.exists(title + " filter", timeout=0.2)["hittable"]:
                break
            guide.call("drag", x=0.86, y=0.412, toX=0.20, toY=0.412)
        guide.tap(title + " filter")
        guide.shot("13-exercises-filter-" + title.lower(), "Exercises: " + title.lower() + " filter options")
        guide.tap("Any " + title.lower())
    guide.step("Search for a matching exercise and inspect the no-results state")
    guide.type("Search exercises", "bench")
    dismiss_keyboard(guide)
    guide.shot("13-exercises-search", "Exercises: search results")
    guide.type("Search exercises", "no-such-exercise")
    dismiss_keyboard(guide)
    guide.expect("No exercises match these filters")
    guide.shot("13-exercises-empty-search", "Exercises: no matching results and Clear filters")
    guide.tap("Clear filters")


def exercise_details(guide):
    guide.launch("train/exercises")
    guide.step("Open a strength exercise's illustration, muscles, attributes and instructions")
    guide.tap("Barbell bench press", match="prefix")
    guide.expect("Barbell bench press", kind="navigationBar")
    guide.shot("13-exercise-strength-detail", "Exercise: strength summary and illustration")
    guide.reveal("History")
    guide.shot("13-exercise-strength-instructions", "Exercise: instructions, start action and detail tabs")
    guide.scroll()
    guide.shot("13-exercise-strength-progress", "Exercise: volume and estimated 1RM progress")
    guide.reveal("History", direction="down")
    guide.tap("History")
    guide.shot("13-exercise-strength-history", "Exercise: previously logged strength sets")
    guide.step("Start a one-exercise ad-hoc strength session")
    guide.reveal("Start a session with it", direction="down")
    guide.tap("Start a session with it")
    guide.expect("Add exercise", kind="button")
    guide.shot("13-exercise-started-ad-hoc", "Exercise: new ad-hoc strength session")
    guide.launch("train/exercises")
    guide.step("Open the cardio exercise and inspect its duration progress and entry history")
    guide.tap("Treadmill run", match="prefix")
    guide.shot("13-exercise-cardio-detail", "Exercise: cardio summary and illustration")
    guide.reveal("History")
    guide.scroll()
    guide.shot("13-exercise-cardio-progress", "Exercise: duration progress with duration-formatted axes")
    guide.reveal("History", direction="down")
    guide.tap("History")
    guide.shot("13-exercise-cardio-history", "Exercise: prior cardio entries")


def cardio(guide):
    guide.launch("train/exercises")
    guide.tap("Treadmill run", match="prefix")
    guide.reveal("Start a session with it")
    guide.tap("Start a session with it")
    guide.reveal("Add entry")
    guide.step("Start an ad-hoc cardio session and add an entry using its metrics schema")
    guide.shot("11-session-cardio-empty", "Session: cardio exercise before its first entry")
    guide.tap("Add entry")
    guide.shot("11-session-cardio-add", "Cardio: schema-driven required and optional fields")
    guide.tap("Save")
    guide.shot("11-session-cardio-required-validation", "Cardio: required-field validation")
    guide.type("Duration, minutes", "20")
    guide.type("Distance, km", "3")
    dismiss_keyboard(guide)
    guide.shot("11-session-cardio-add-filled", "Cardio: duration and distance ready to save")
    guide.tap("Save")
    guide.require("The cardio entry was persisted", len(guide.rows("cardio")) > 0)
    guide.shot("11-session-cardio-logged", "Session: cardio exercise automatically collapses after logging")
    guide.tap("1 entry")
    guide.expect("Add entry", kind="button")
    guide.shot("11-session-cardio-expanded", "Session: reopened cardio exercise and saved metrics")
    guide.step("Edit the logged cardio entry, then delete it from the editor")
    guide.tap("1,", match="prefix")
    guide.shot("11-session-cardio-edit", "Cardio: edit a saved entry")
    guide.type("Distance, km", "3.5")
    dismiss_keyboard(guide)
    guide.tap("Save")
    guide.shot("11-session-cardio-updated", "Session: updated cardio distance")
    guide.tap("1,", match="prefix")
    guide.tap("Delete entry")
    guide.expect("No entries logged yet.")
    guide.shot("11-session-cardio-deleted", "Session: cardio entry removed (immediate sheet action)")


def public_workout(guide):
    guide.launch("train/workouts")
    guide.step("Filter public templates and open a read-only workout")
    guide.tap("Public")
    guide.shot("12-workouts-public-filter", "Workouts: public template filter")
    guide.tap("Simple full body", match="prefix")
    guide.expect("Public")
    if guide.exists("Edit workout", timeout=0.2)["exists"]:
        raise AssertionError("Public workout unexpectedly exposes Edit")
    guide.shot("12-workout-public-read-only", "Workout: public template is usable but read-only")


def food_browse(guide):
    guide.launch("nutrition/foods")
    guide.step("Inspect public food details and their read-only status")
    guide.tap("Public")
    guide.shot("22-foods-public-filter", "Foods: public catalog filter")
    guide.tap("Banana,", match="prefix")
    guide.expect("Food", kind="navigationBar")
    if guide.exists("Edit food", timeout=0.2)["exists"]:
        raise AssertionError("Public food unexpectedly exposes Edit")
    guide.shot("22-food-public-detail", "Food: public per-100 g nutrients (read-only)")
    guide.back()
    guide.tap("Mine")
    guide.shot("22-foods-private-filter", "Foods: private food filter")
    guide.tap("My protein snack,", match="prefix")
    guide.expect("Edit food", kind="button")
    guide.shot("22-food-private-detail", "Food: private nutrients and Edit action")
    guide.back()
    guide.type("Search foods", "no-such-food")
    dismiss_keyboard(guide)
    guide.shot("22-foods-empty-search", "Foods: no matching search results")


def fill_food(guide, name):
    guide.type("Food name", name)
    for title, value in [("Energy, kcal", "180"), ("Protein, g", "18"),
                         ("Carbs, g", "12"), ("Fat, g", "6"),
                         ("Fiber, g", "3"), ("Sugar, g", "5")]:
        guide.type(title, value)
    dismiss_keyboard(guide)


def food_crud(guide):
    guide.launch("nutrition/foods")
    guide.step("Create a private food using the package's per-100 g nutrition values")
    guide.tap("New food", scope=guide.element(kind="navigationBar"))
    guide.shot("22-food-create", "Food: new private food form")
    fill_food(guide, "Guide food")
    guide.shot("22-food-create-filled", "Food: populated per-100 g values")
    guide.tap("Create food")
    guide.expect("Edit food", kind="button")
    guide.shot("22-food-created", "Food: newly created private item")
    guide.step("Edit the food's name and energy value")
    guide.tap("Edit food")
    guide.shot("22-food-edit", "Food: edit private catalog values")
    guide.type("Food name", "Guide food edited")
    guide.type("Energy, kcal", "200")
    dismiss_keyboard(guide)
    guide.tap("Save changes")
    guide.expect("Guide food edited")
    guide.shot("22-food-updated", "Food: updated catalog nutrients")
    guide.step("Delete the unreferenced food after its confirmation dialog")
    guide.tap("Edit food")
    guide.reveal("Delete food")
    guide.tap("Delete food")
    guide.shot("22-food-delete-confirmation", "Food: deletion and template-reference warning")
    confirm(guide, "Delete food")
    guide.require("Deleted private food is absent from the local store",
                  all(row.get("name") != "Guide food edited" for row in guide.rows("foods")))
    return_after_delete(guide, "Nutrition", "22-food-deleted-detail-issue")
    guide.shot("22-food-deleted", "Food deleted: return to the library")


def log_navigation(guide):
    guide.launch("nutrition/log")
    guide.step("Navigate yesterday, return to today, then open the calendar sheet")
    yesterday = datetime.date.fromisoformat(guide.state()["preparedThrough"]) - datetime.timedelta(days=1)
    guide.tap(yesterday.strftime("%A, %B ") + str(yesterday.day), match="prefix")
    guide.shot("20-log-yesterday", "Nutrition Log: yesterday's complete intake")
    guide.tap("Pick a date")
    guide.shot("20-log-date-picker", "Nutrition Log: graphical calendar picker")
    guide.tap("Today", scope=guide.element(kind="navigationBar"))
    guide.step("Swipe the Monday-to-Sunday strip to the next week")
    guide.call("drag", x=0.85, y=0.355, toX=0.15, toY=0.355)
    guide.shot("20-log-next-week", "Nutrition Log: next week, with no logged food")
    guide.tap("Pick a date")
    guide.tap("Today", scope=guide.element(kind="navigationBar"))
    guide.step("Inspect the selected plan menu, then remove the plan without deleting food")
    guide.tap("Selected nutrition plan")
    guide.shot("20-log-plan-menu", "Nutrition Log: choose or clear the day's plan")
    guide.tap("No plan")
    guide.shot("20-log-no-plan", "Nutrition Log: logged food remains without planned suggestions")
    guide.require("Clearing the plan retains today's food snapshots", len(guide.rows("logEntries")) > 0)
    guide.reveal("Clear day log")
    guide.tap("Clear day log")
    guide.shot("20-log-clear-confirmation", "Nutrition Log: clear the whole day's intake")
    confirm(guide, "Clear day log")
    guide.expect("Nothing logged yet")
    guide.shot("20-log-cleared-empty", "Nutrition Log: empty day after clear")


def log_food(guide):
    guide.launch("nutrition/log")
    before = len(guide.rows("logEntries"))
    guide.step("Log a food with a searchable picker, grams, time and calculated preview")
    guide.tap("Log food", scope=guide.element(kind="navigationBar"))
    guide.shot("20-log-food-sheet", "Log intake: food mode, grams and time")
    guide.type(None, "Greek yogurt", index=0)
    dismiss_keyboard(guide)
    guide.shot("20-log-food-search-picker", "Log food: filtered wheel and nutrition preview")
    guide.type(None, "150", index=1, selection="doubleTap", tap_x=0.97)
    dismiss_keyboard(guide)
    guide.shot("20-log-food-filled", "Log food: 150 grams ready to append")
    guide.tap("Log", scope=guide.element(kind="navigationBar"))
    guide.require("Food logging appended one snapshot", len(guide.rows("logEntries")) == before + 1)
    guide.reveal("^Greek yogurt,.*150.*", match="regex")
    guide.shot("20-log-food-added", "Nutrition Log: newly logged standalone food")
    guide.tap("^Greek yogurt,.*150.*", match="regex")
    guide.step("Edit grams and entry position, then delete with confirmation")
    guide.shot("20-log-entry-edit", "Log entry: standalone time, grams, position and Delete")
    guide.type(None, "175", index=0, selection="doubleTap", tap_x=0.97)
    dismiss_keyboard(guide)
    guide.tap("Increment")
    guide.tap("Save", scope=guide.element(kind="navigationBar"))
    guide.reveal("^Greek yogurt,.*175.*", match="regex")
    guide.shot("20-log-entry-updated", "Nutrition Log: updated logged quantity")
    guide.tap("^Greek yogurt,.*175.*", match="regex")
    guide.tap("Delete entry")
    guide.shot("20-log-entry-delete-confirmation", "Log entry: destructive confirmation")
    confirm(guide, "Delete entry")
    guide.require("Deleting the entry restored the snapshot count", len(guide.rows("logEntries")) == before)
    guide.scroll("down", count=5)
    guide.shot("20-log-entry-deleted", "Nutrition Log: standalone entry removed")


def log_meal(guide):
    guide.launch("nutrition/log")
    before = len(guide.rows("logEntries"))
    groups_before = len(guide.rows("logMeals"))
    guide.step("Log a reusable meal with per-ingredient quantities")
    guide.tap("Log food", scope=guide.element(kind="navigationBar"))
    guide.tap("Meal")
    guide.shot("20-log-meal-sheet", "Log intake: meal mode and ingredient quantities")
    guide.tap("Log", scope=guide.element(kind="navigationBar"))
    guide.require("Meal logging appended one group with three food snapshots",
                  len(guide.rows("logMeals")) == groups_before + 1
                  and len(guide.rows("logEntries")) == before + 3)
    guide.reveal("Chicken rice bowl,", match="prefix")
    guide.shot("20-log-meal-added", "Nutrition Log: meal group with child food snapshots")
    guide.tap("Chicken rice bowl,", match="prefix")
    guide.step("Edit a logged meal group's name, time and ordering independently of the template")
    guide.shot("20-log-meal-edit", "Logged meal: group editor")
    guide.type("Name", "Guide lunch")
    guide.tap("Increment")
    dismiss_keyboard(guide)
    guide.tap("Save", scope=guide.element(kind="navigationBar"))
    guide.reveal("Guide lunch,", match="prefix")
    guide.shot("20-log-meal-updated", "Nutrition Log: renamed logged meal")
    guide.tap("Guide lunch,", match="prefix")
    guide.tap("Delete logged meal")
    guide.shot("20-log-meal-delete-confirmation", "Logged meal: group and child deletion confirmation")
    confirm(guide, "Delete logged meal")
    guide.require("Deleting a logged group also removed its three snapshots",
                  len(guide.rows("logMeals")) == groups_before
                  and len(guide.rows("logEntries")) == before)
    guide.shot("20-log-meal-deleted", "Nutrition Log: logged meal and children removed")


def log_child(guide):
    guide.launch("nutrition/log")
    groups_before = len(guide.rows("logMeals"))
    foods_before = len(guide.rows("foods"))
    original = {row["id"]: row for row in guide.rows("logEntries")}
    guide.step("Edit one food snapshot inside a logged meal; the meal still owns its time")
    guide.reveal("Greek yogurt, 200", match="prefix")
    guide.tap("Greek yogurt, 200", match="prefix")
    guide.shot("20-log-group-child-edit", "Logged meal child: grams and ordering, with time owned by the meal")
    guide.type(None, "180", index=0, selection="doubleTap", tap_x=0.97)
    guide.tap("Save", scope=guide.element(kind="navigationBar"))
    edited = [row for row in guide.rows("logEntries")
              if row.get("nutritionLogMealId") and persisted_number(row["grams"]) == 180
              and persisted_number(original[row["id"]]["grams"]) != 180]
    guide.require("Editing a meal child preserved its meal and changed only that snapshot amount", len(edited) == 1)
    guide.reveal("Greek yogurt, 180", match="prefix")
    guide.shot("20-log-group-child-updated", "Nutrition Log: one meal ingredient's logged amount updated")
    guide.step("Delete only that logged ingredient, preserving the group and reusable food")
    guide.tap("Greek yogurt, 180", match="prefix")
    guide.tap("Delete entry")
    guide.shot("20-log-group-child-delete-confirmation", "Logged meal child: single-snapshot deletion confirmation")
    confirm(guide, "Delete entry")
    guide.require("Single-child deletion preserved the logged group and reusable food catalog",
                  all(row["id"] != edited[0]["id"] for row in guide.rows("logEntries"))
                  and len(guide.rows("logMeals")) == groups_before
                  and len(guide.rows("foods")) == foods_before)
    guide.shot("20-log-group-child-deleted", "Nutrition Log: meal remains with its other logged ingredients")


def log_ad_hoc(guide):
    guide.launch("nutrition/log")
    guide.step("Log an ad-hoc item without adding it to the food catalog")
    foods_before = len(guide.rows("foods"))
    guide.tap("Log food", scope=guide.element(kind="navigationBar"))
    guide.tap("Custom")
    guide.shot("20-log-ad-hoc-sheet", "Log intake: ad-hoc name, per-100 g nutrients, grams and time")
    guide.type("Food name", "Guide cafe snack")
    # The legacy custom nutrient grid has no field labels; its six numeric wells
    # follow the name and grams fields in Calories/Fat/Carbs/Protein/Fiber/Sugar order.
    for index, value in enumerate(["250", "10", "30", "10", "2", "8"], start=2):
        guide.type(None, value, index=index, selection="doubleTap", tap_x=0.97)
    dismiss_keyboard(guide)
    guide.shot("20-log-ad-hoc-filled", "Ad-hoc log: complete nutrient snapshot")
    guide.tap("Log", scope=guide.element(kind="navigationBar"))
    guide.require("Ad-hoc logging did not create a reusable food", len(guide.rows("foods")) == foods_before)
    guide.reveal("Guide cafe snack,", match="prefix")
    guide.shot("20-log-ad-hoc-added", "Nutrition Log: standalone ad-hoc item")
    guide.tap("Guide cafe snack,", match="prefix")
    guide.shot("20-log-ad-hoc-edit", "Ad-hoc entry: editable snapshot nutrients as well as grams")
    guide.type("Food name", "Guide cafe snack edited")
    dismiss_keyboard(guide)
    guide.tap("Save", scope=guide.element(kind="navigationBar"))
    guide.reveal("Guide cafe snack edited,", match="prefix")
    guide.shot("20-log-ad-hoc-updated", "Nutrition Log: renamed ad-hoc snapshot")


def log_plan(guide):
    guide.launch("nutrition/log")
    guide.step("Log a selected-plan entry using From plan in the intake sheet")
    guide.tap("Log food", scope=guide.element(kind="navigationBar"))
    guide.tap("From plan")
    guide.shot("20-log-from-plan-sheet", "Log intake: selected-plan entry picker")
    guide.tap("Log", scope=guide.element(kind="navigationBar"))
    guide.shot("20-log-from-plan-added", "Nutrition Log: selected-plan meal appended")
    guide.step("Choose the direct planned Banana entry in the same intake sheet")
    guide.tap("Log food", scope=guide.element(kind="navigationBar"))
    guide.tap("From plan")
    for _ in range(4):
        if "Banana" in guide.query(kind="pickerWheel")[0]["value"]:
            break
        advance_wheel(guide)
    guide.require("The planned-entry wheel selected a direct food",
                  "Banana" in guide.query(kind="pickerWheel")[0]["value"])
    guide.shot("20-log-from-plan-food-sheet", "Log intake: direct planned food and editable grams")
    ids_before = {row["id"] for row in guide.rows("logEntries")}
    guide.tap("Log", scope=guide.element(kind="navigationBar"))
    new_rows = [row for row in guide.rows("logEntries") if row["id"] not in ids_before]
    guide.require("From plan logged one standalone food snapshot with plan-food provenance",
                  len(new_rows) == 1 and new_rows[0].get("nutritionPlanFoodId")
                  and not new_rows[0].get("nutritionLogMealId"))
    guide.shot("20-log-from-plan-food-added", "Nutrition Log: direct planned food appended from the sheet")
    guide.step("Log an entire planned time slot that already has food; confirm the append")
    guide.reveal("^Log .+ slot$", match="regex", index=0)
    before = len(guide.rows("logEntries"))
    guide.tap("^Log .+ slot$", match="regex", index=0)
    guide.shot("20-log-plan-slot-existing-confirmation", "Planned slot: existing food warning before duplicate logging")
    confirm(guide, "Log slot")
    guide.require("Re-logging a planned meal appended rather than replaced snapshots",
                  len(guide.rows("logEntries")) == before + 3)
    guide.shot("20-log-plan-slot-appended", "Nutrition Log: planned breakfast appended to the existing slot")
    guide.step("Log a direct planned food at its own slot time")
    guide.reveal("^Log .+ slot$", match="regex", index=2)
    before = len(guide.rows("logEntries"))
    guide.tap("^Log .+ slot$", match="regex", index=2)
    guide.require("A direct plan food appended a standalone snapshot with provenance",
                  len(guide.rows("logEntries")) == before + 1
                  and any(row.get("nutritionPlanFoodId") for row in guide.rows("logEntries")))
    guide.shot("20-log-plan-direct-food", "Nutrition Log: direct planned food logged at 16:00")


def meal_browse(guide):
    guide.launch("nutrition/meals")
    guide.step("Browse a meal's live nutrient totals and ingredient quantities")
    guide.tap("Yogurt and oats", match="prefix")
    guide.shot("23-meal-detail", "Meal: reusable template and ingredients")
    guide.tap("Edit meal")
    guide.shot("23-meal-edit-referenced", "Meal: grouped ingredient editor")
    guide.reveal("Delete meal")
    guide.shot("23-meal-delete-blocked", "Meal: deletion disabled while a plan references it")
    guide.require("A plan-referenced meal has Delete disabled", not guide.exists("Delete meal")["enabled"])
    guide.tap("Cancel", scope=guide.element(kind="navigationBar"))
    guide.back()
    guide.type("Search meals or ingredients", "yogurt")
    dismiss_keyboard(guide)
    guide.shot("23-meals-search", "Meals: filtered totals and matching templates")
    guide.type("Search meals or ingredients", "no-such-meal")
    dismiss_keyboard(guide)
    guide.shot("23-meals-empty-search", "Meals: no matching templates")


def meal_crud(guide):
    guide.launch("nutrition/meals")
    guide.step("Create a meal, including a new food pushed inside the ingredient picker")
    guide.tap("New meal", scope=guide.element(kind="navigationBar"))
    guide.shot("23-meal-create", "Meal: new template form")
    guide.type("Name", "Guide meal")
    dismiss_keyboard(guide)
    guide.tap("Add ingredient")
    guide.shot("23-meal-ingredient-picker", "Meal: searchable ingredient selection sheet")
    guide.tap("New food", scope=guide.element(kind="navigationBar"))
    guide.shot("23-meal-inline-new-food", "Ingredient picker: nested new-food form")
    fill_food(guide, "Guide quick food")
    guide.tap("Create food")
    guide.expect("New meal", kind="navigationBar")
    guide.shot("23-meal-inline-food-created", "Meal: newly created food selected as an ingredient")
    guide.tap("Add ingredient")
    guide.tap("Banana,", match="prefix")
    guide.type("Banana grams", "120", selection="doubleTap")
    dismiss_keyboard(guide)
    guide.step("Long-press an ingredient to reorder it, or edit its private source food")
    guide.call("press", element=guide.element("Banana", kind="button", match="prefix"))
    guide.shot("23-meal-ingredient-menu", "Meal ingredient: change food or reorder")
    guide.tap("Move up")
    guide.call("press", element=guide.element("Guide quick food", kind="button", match="prefix"))
    guide.tap("Edit food")
    guide.shot("23-meal-quick-edit-food", "Meal: private food editor in a modal stack")
    guide.type("Energy, kcal", "200")
    dismiss_keyboard(guide)
    guide.tap("Save changes")
    guide.shot("23-meal-create-filled", "Meal: reordered ingredients and live updated totals")
    guide.tap("Create meal")
    open_created_detail(guide, "Edit meal", "Guide meal", "23-meal-created-navigation-issue")
    guide.require("Created meal persisted with two ingredients",
                  any(row.get("name") == "Guide meal" for row in guide.rows("meals")))
    guide.shot("23-meal-created", "Meal: newly created template")
    guide.step("Edit the name, remove an ingredient and save the template")
    guide.tap("Edit meal")
    guide.type("Name", "Guide meal edited")
    dismiss_keyboard(guide)
    guide.tap("Remove Banana")
    guide.shot("23-meal-edit-remove-ingredient", "Meal: ingredient removed from the draft")
    guide.tap("Save changes")
    guide.expect("Guide meal edited")
    guide.shot("23-meal-updated", "Meal: edited template")
    guide.tap("Edit meal")
    guide.reveal("Delete meal")
    guide.tap("Delete meal")
    guide.shot("23-meal-delete-confirmation", "Meal: delete an unreferenced template")
    confirm(guide, "Delete meal")
    guide.require("Deleted meal is absent from the local store",
                  all(row.get("name") != "Guide meal edited" for row in guide.rows("meals")))
    return_after_delete(guide, "Nutrition", "23-meal-deleted-detail-issue")
    guide.shot("23-meal-deleted", "Meal deleted: return to the template library")


def plan_browse(guide):
    guide.launch("nutrition/plans")
    guide.step("Inspect the plan's daily totals and all four planned time slots")
    guide.tap("Training day", match="prefix")
    guide.shot("21-plan-detail", "Plan: daily macro-energy split and Use for today")
    guide.scroll()
    guide.shot("21-plan-detail-slots", "Plan: mixed meal and direct-food time slots")
    guide.scroll()
    guide.shot("21-plan-detail-later-slots", "Plan: afternoon food and evening meal")
    guide.back()
    guide.type("Search plans or meals", "no-such-plan")
    dismiss_keyboard(guide)
    guide.shot("21-plans-empty-search", "Plans: no matching templates")


def plan_crud(guide):
    guide.launch("nutrition/plans")
    guide.step("Create a nutrition plan and add a first time slot")
    guide.tap("New plan", scope=guide.element(kind="navigationBar"))
    guide.shot("21-plan-create", "Plan: name, description and Add time slot")
    guide.type("Name", "Guide day")
    dismiss_keyboard(guide)
    guide.tap("Add time slot")
    guide.shot("21-plan-new-slot", "Plan: pending slot with one shared Time control")
    guide.tap("Add meal")
    guide.shot("21-plan-meal-picker", "Plan: reusable meal selection sheet")
    guide.step("Create a meal inside the plan's meal picker")
    guide.tap("New meal", scope=guide.element(kind="navigationBar"))
    guide.shot("21-plan-inline-new-meal", "Plan picker: nested new-meal form")
    guide.type("Name", "Guide inline meal")
    dismiss_keyboard(guide)
    guide.tap("Add ingredient")
    guide.tap("Banana,", match="prefix")
    guide.tap("Create meal")
    guide.shot("21-plan-inline-meal-created", "Plan: newly created meal added to the slot")
    guide.tap("Add food")
    guide.shot("21-plan-food-picker", "Plan: direct-food selection sheet")
    guide.tap("Banana,", match="prefix")
    guide.shot("21-plan-mixed-slot", "Plan: meal and direct food sharing a time slot")
    guide.tap("Add time slot")
    guide.reveal("Add food", index=1)
    guide.tap("Add food", index=1)
    guide.tap("Rolled oats,", match="prefix")
    guide.shot("21-plan-create-filled", "Plan: two complete time slots")
    guide.tap("Create plan")
    open_created_detail(guide, "Edit plan", "Guide day", "21-plan-created-navigation-issue")
    plan = next(row for row in guide.rows("plans") if row.get("name") == "Guide day")
    guide.shot("21-plan-created", "Plan: newly created template")
    guide.tap("Use for today")
    guide.expect("Today now follows Guide day.")
    guide.require("Use for today selected the new plan on today's nutrition day",
                  any(row.get("nutritionPlanId") == plan["id"]
                      and row.get("logDate") == guide.state()["preparedThrough"] for row in guide.rows("days")))
    guide.shot("21-plan-used-for-today", "Plan: successfully selected for today's log")
    guide.step("Move an entry to a different time and inspect its slot-local reorder menu")
    guide.tap("Edit plan")
    guide.type("Name", "Guide day edited")
    dismiss_keyboard(guide)
    guide.reveal("Food, Banana,", match="prefix")
    guide.call("press", element=guide.element("Food, Banana,", kind="button", match="prefix"))
    guide.shot("21-plan-entry-menu", "Plan entry: change, reorder or move to another time")
    guide.tap("Move to another time")
    guide.shot("21-plan-entry-time-sheet", "Plan entry: wheel-based time editor")
    advance_wheel(guide)
    advance_wheel(guide)
    guide.tap("Done", scope=guide.element(kind="navigationBar"))
    guide.shot("21-plan-entry-moved-time", "Plan: direct food moved into its own time slot")
    guide.step("Edit a meal slot label using the native alert")
    guide.reveal("Meal, Guide inline meal,", match="prefix", direction="down")
    guide.call("press", element=guide.element("Meal, Guide inline meal,", kind="button", match="prefix"))
    guide.tap("Edit label")
    guide.shot("21-plan-slot-label-alert", "Plan meal: optional slot label alert")
    guide.type("Label", "Guide breakfast")
    guide.tap("Save", scope=guide.element(kind="alert"))
    guide.shot("21-plan-slot-label-updated", "Plan: custom meal label with source meal caption")
    guide.step("Retime a whole slot into an existing slot; its entries merge")
    guide.reveal("Time,", match="prefix", index=0, direction="down")
    guide.tap("Time,", match="prefix", index=0)
    guide.shot("21-plan-slot-time-sheet", "Plan: shared time editor for every entry in the slot")
    advance_wheel(guide)
    guide.tap("Done", scope=guide.element(kind="navigationBar"))
    guide.shot("21-plan-slots-merged", "Plan: changing a slot time merges it with an existing slot")
    guide.tap("Save changes")
    guide.expect("Guide day edited")
    guide.shot("21-plan-updated", "Plan: updated name, label and entry time")
    guide.step("Delete the plan; today's selected plan is detached without deleting logged food")
    logs_before = len(guide.rows("logEntries"))
    guide.tap("Edit plan")
    guide.reveal("Delete plan")
    guide.tap("Delete plan")
    guide.shot("21-plan-delete-confirmation", "Plan: deletion detaches selected days and provenance")
    confirm(guide, "Delete plan")
    guide.require("Plan deletion detached days and preserved logged snapshots",
                  all(row["id"] != plan["id"] for row in guide.rows("plans"))
                  and all(row.get("nutritionPlanId") != plan["id"] for row in guide.rows("days"))
                  and len(guide.rows("logEntries")) == logs_before)
    return_after_delete(guide, "Nutrition", "21-plan-deleted-detail-issue")
    guide.shot("21-plan-deleted", "Plan deleted: return to the library")


def choose_tomorrow(guide, screenshot):
    tomorrow = datetime.date.fromisoformat(guide.state()["preparedThrough"]) + datetime.timedelta(days=1)
    guide.tap("Date", kind="datePicker")
    guide.shot(screenshot, "Form date: native calendar popover")
    label = ".*" + tomorrow.strftime("%B") + " " + str(tomorrow.day) + ".*"
    guide.tap(label, match="regex")
    guide.call("coordinate", x=0.50, y=0.16)
    return tomorrow.isoformat()


def body_history(guide):
    guide.launch("progress/body")
    guide.step("Inspect both daily-reading and 7-day-average charts")
    guide.position("Body fat")
    guide.shot("33-body-fat-chart", "Body: body-fat readings and rolling average")
    guide.step("Open a measurement, return, then load more than the initial five entries")
    guide.reveal(".*kg.*", match="regex")
    guide.shot("33-body-history", "Body: Apple Health source and latest five measurements")
    guide.tap(".*kg.*", match="regex")
    guide.expect("Edit measurement", kind="button")
    guide.shot("33-body-detail", "Measurement: recorded weight, body fat and source note")
    guide.back()
    guide.reveal("Load more")
    guide.tap("Load more")
    guide.reveal("Load more")
    guide.shot("33-body-history-loaded-more", "Body: expanded entry history")


def body_crud(guide):
    guide.launch("progress/body")
    before = len(guide.rows("body"))
    guide.step("Create a measurement; today's existing date demonstrates duplicate-date validation")
    guide.tap("Log measurement", scope=guide.element(kind="navigationBar"))
    guide.shot("33-body-create", "Measurement: new date, weight, body fat and notes")
    guide.type("Weight, kg", "78.4")
    guide.type("Body fat, %", "17.5")
    dismiss_keyboard(guide)
    guide.tap("Save")
    guide.shot("33-body-duplicate-date-error", "Measurement: one-entry-per-date validation")
    tomorrow = choose_tomorrow(guide, "33-body-create-date-picker")
    guide.shot("33-body-create-filled", "Measurement: unique date and complete readings")
    guide.tap("Save")
    guide.expect("Edit measurement", kind="button")
    guide.require("The new measurement persisted on the selected date",
                  len(guide.rows("body")) == before + 1
                  and any(row.get("measuredOn") == tomorrow for row in guide.rows("body")))
    guide.shot("33-body-created", "Measurement: newly created detail")
    guide.step("Edit the measurement, then delete it with confirmation")
    guide.tap("Edit measurement")
    guide.shot("33-body-edit", "Measurement: edit form and destructive action")
    guide.type("Weight, kg", "79.1")
    dismiss_keyboard(guide)
    guide.tap("Save changes")
    guide.require("Measurement changes were persisted",
                  any(row.get("measuredOn") == tomorrow and persisted_number(row.get("weightKg", 0)) == 79.1
                      for row in guide.rows("body")))
    guide.shot("33-body-updated", "Measurement: updated weight")
    guide.tap("Edit measurement")
    guide.reveal("Delete measurement")
    guide.tap("Delete measurement")
    guide.shot("33-body-delete-confirmation", "Measurement: delete confirmation")
    confirm(guide, "Delete measurement")
    guide.require("Measurement deletion restored the fixture count", len(guide.rows("body")) == before)
    return_after_delete(guide, "Progress", "33-body-deleted-detail-issue")
    guide.shot("33-body-deleted", "Measurement deleted: return to Body")


def energy_history(guide):
    guide.launch("progress/energy")
    guide.step("Inspect today's end-of-day estimate and the consumed/net calorie charts")
    guide.position("Estimated today")
    guide.shot("34-energy-estimate", "Energy: today's recorded totals and end-of-day estimate")
    guide.position("Consumed")
    guide.shot("34-energy-calories-consumed", "Energy: consumed calories and 7-day average")
    guide.position("Net (consumed − burned)")
    guide.shot("34-energy-calories-net", "Energy: net calories and 7-day average")
    guide.step("Inspect the source disclosure and paginate the daily active/resting entries")
    guide.reveal("Load more")
    guide.shot("34-energy-history", "Energy: source row and latest five entries")
    guide.tap("Load more")
    guide.reveal("Load more")
    guide.shot("34-energy-history-loaded-more", "Energy: expanded entry history")
    guide.reveal(".*, Resting .+, active .+", match="regex", direction="down")
    guide.tap(".*, Resting .+, active .+", match="regex")
    guide.expect("Edit energy", kind="button")
    guide.shot("34-energy-detail", "Energy entry: active, resting, total and notes")


def energy_crud(guide):
    guide.launch("progress/energy")
    before = len(guide.rows("energy"))
    guide.step("Create a manual energy entry, validating the unique daily date")
    guide.tap("Log energy", scope=guide.element(kind="navigationBar"))
    guide.shot("34-energy-create", "Energy: new date, active/resting kcal and notes")
    guide.type("Active, kcal", "450")
    guide.type("Resting, kcal", "1700")
    dismiss_keyboard(guide)
    guide.tap("Save energy")
    guide.shot("34-energy-duplicate-date-error", "Energy: one-entry-per-date validation")
    tomorrow = choose_tomorrow(guide, "34-energy-create-date-picker")
    guide.shot("34-energy-create-filled", "Energy: unique date and manual values")
    guide.tap("Save energy")
    guide.expect("Edit energy", kind="button")
    guide.require("The energy entry persisted on the selected date",
                  len(guide.rows("energy")) == before + 1
                  and any(row.get("energyOn") == tomorrow for row in guide.rows("energy")))
    guide.shot("34-energy-created", "Energy: newly created entry")
    guide.tap("Edit energy")
    guide.shot("34-energy-edit", "Energy: edit active/resting readings")
    guide.type("Resting, kcal", "1750")
    dismiss_keyboard(guide)
    guide.tap("Save changes")
    guide.require("Energy changes were persisted",
                  any(row.get("energyOn") == tomorrow and persisted_number(row.get("restingKcal", 0)) == 1750
                      for row in guide.rows("energy")))
    guide.shot("34-energy-updated", "Energy: updated resting and total calories")
    guide.tap("Edit energy")
    guide.reveal("Delete energy")
    guide.tap("Delete energy")
    guide.shot("34-energy-delete-confirmation", "Energy: delete confirmation")
    confirm(guide, "Delete energy")
    guide.require("Energy deletion restored the fixture count", len(guide.rows("energy")) == before)
    return_after_delete(guide, "Progress", "34-energy-deleted-detail-issue")
    guide.shot("34-energy-deleted", "Energy deleted: return to history")


def progress_charts(guide):
    guide.launch("progress/overview")
    guide.step("Inspect every overview card and use its See all shortcut")
    guide.position("Strength", anchor=guide.element("Muscles", kind="text"))
    guide.shot("30-overview-strength", "Progress Overview: weekly strength summary")
    guide.position("Body")
    guide.shot("30-overview-body", "Progress Overview: body averages and chart")
    guide.position("Energy", anchor=guide.element("Body", kind="text"))
    guide.shot("30-overview-energy", "Progress Overview: energy and calorie balance summary")
    guide.tap("See all energy")
    guide.expect("Log energy", kind="button")
    guide.launch("progress/muscles")
    guide.step("Select another muscle, then return to its weighted-set history")
    guide.position("Quadriceps", kind="button", anchor=guide.element("Chest", kind="text"))
    guide.shot("31-muscles-stacked-bars", "Muscles: direct and half-secondary weighted-set bars")
    guide.tap("Quadriceps")
    guide.position("Quadriceps", anchor=guide.element("Quadriceps"))
    guide.shot("31-muscles-selected-quadriceps", "Muscles: selected quadriceps history")
    guide.launch("progress/strength")
    guide.step("Select a plotted point and inspect the common Period menu")
    guide.call("coordinate", x=0.23, y=0.58)
    guide.shot("35-chart-point-callout", "Chart: nearest plotted-point callout")
    guide.tap("Period", match="prefix", index=0)
    guide.shot("35-chart-period-menu", "Chart: preset periods and custom date range")
    guide.tap("Last 30d")
    guide.shot("32-strength-last-30-days", "Strength: weekly volume over the last 30 days")
    guide.tap("Period", match="prefix", index=0)
    guide.tap("Custom…")
    guide.shot("35-chart-custom-range", "Chart: shared custom From/To date controls")
    guide.tap(None, kind="datePicker", index=0)
    guide.shot("35-chart-custom-date-popover", "Chart: custom range calendar popover")
    guide.call("coordinate", x=0.15, y=0.16)
    guide.step("Toggle a chart series, then open an exercise from its strength trend")
    guide.reveal("Volume (kg) series")
    guide.tap("Volume (kg) series", index=0)
    guide.shot("35-chart-series-toggle", "Chart: series visibility control")
    guide.tap("Volume (kg) series", index=0)
    guide.reveal("Barbell bench press", match="prefix")
    guide.scroll()
    guide.shot("32-strength-exercise-charts", "Strength: per-exercise volume and estimated 1RM")
    guide.reveal("Barbell bench press", match="prefix", direction="down")
    guide.tap("Barbell bench press", match="prefix")
    guide.expect("Barbell bench press", kind="navigationBar")
    guide.shot("32-strength-exercise-drill-down", "Strength: exercise-detail drill-down in the Progress stack")


def journal_browse(guide):
    guide.launch("me/journal")
    guide.step("Filter journal entries by an existing label")
    labels = guide.rows("journalLabels")
    guide.tap(labels[0]["name"])
    guide.shot("40-journal-label-filter", "Journal: label-filtered entries")
    guide.tap("All")
    entries = guide.query(kind="button")
    entry = next(item for item in entries if item["hittable"] and "Training note" in item["label"])
    guide.tap(entry["label"])
    guide.expect("Edit entry", kind="button")
    guide.shot("40-journal-detail", "Journal: date, labels and rendered markdown")


def journal_crud(guide):
    guide.launch("me/journal")
    before = len(guide.rows("journal"))
    guide.step("Create a dated journal entry with Markdown and a new label")
    guide.tap("New journal entry", scope=guide.element(kind="navigationBar"))
    guide.shot("40-journal-create", "Journal: new entry form")
    guide.type("Title", "Guide entry")
    guide.type("Entry, markdown", "## Demo note\n\nA fictional training reflection.\n\n- Kept the session steady.\n- Made time for recovery.",
               kind="textField")
    guide.shot("40-journal-markdown-editor", "Journal: plain-text Markdown editor")
    guide.type("Add label", "guide-note")
    guide.shot("40-journal-label-input", "Journal: add or choose a label")
    guide.tap("Add")
    guide.shot("40-journal-create-filled", "Journal: Markdown and label ready to save")
    guide.tap("Save entry")
    open_created_detail(guide, "Edit entry", "Guide entry", "40-journal-created-navigation-issue", match="contains")
    guide.require("The journal entry and its label were persisted", len(guide.rows("journal")) == before + 1)
    guide.shot("40-journal-created", "Journal: newly created rendered entry")
    guide.step("Edit the title, then delete the entry with confirmation")
    guide.tap("Edit entry")
    guide.shot("40-journal-edit", "Journal: existing entry editor")
    guide.type("Title", "Guide entry edited")
    guide.tap("Save changes")
    guide.expect("Guide entry edited", kind="text")
    guide.shot("40-journal-updated", "Journal: edited title and retained Markdown")
    guide.tap("Edit entry")
    guide.reveal("Delete entry")
    guide.tap("Delete entry")
    guide.shot("40-journal-delete-confirmation", "Journal: delete confirmation")
    confirm(guide, "Delete entry")
    guide.require("Journal deletion restored the fixture count", len(guide.rows("journal")) == before)
    return_after_delete(guide, "Me", "40-journal-deleted-detail-issue")
    guide.shot("40-journal-deleted", "Journal deleted: return to the list")
    guide.tap("guide-note")
    guide.expect("No entries match these labels")
    guide.shot("40-journal-empty-label-filter", "Journal: an unused label has no matching entries")
    guide.tap("Clear filters")


def account(guide):
    guide.launch("me/account")
    guide.step("Inspect the fictional profile and explicit disconnected-service disclosures")
    guide.scroll()
    guide.shot("41-account-demo-connections", "Account: Health, Watch, MCP and other live-only features are not connected")
    guide.reveal("Light")
    guide.scroll()
    guide.shot("41-account-preferences", "Account: appearance and default rest preferences")
    guide.step("Switch to Light, inspect Today, then test System and restore Dark")
    guide.tap("Light")
    guide.shot("41-account-light-preference", "Account: Light appearance selected")
    guide.tap("Today", scope=guide.element(kind="tabBar"))
    guide.shot("01-today-light", "Today: Light appearance")
    guide.tap("Me", scope=guide.element(kind="tabBar"))
    guide.tap("System")
    guide.shot("41-account-system-preference", "Account: System follows the simulator's dark appearance")
    guide.tap("Dark")
    guide.tap("1 min")
    guide.shot("41-account-default-rest", "Account: changed default rest to one minute")
    guide.tap("1:30")
    guide.step("Open the account's Reset demo data confirmation and cancel it")
    guide.reveal("Reset demo data")
    guide.tap("Reset demo data")
    guide.shot("41-account-reset-confirmation", "Account: reset affects fictional demo data only")
    confirm(guide, "Cancel")
    guide.reveal("Exit demo")
    guide.shot("41-account-demo-actions", "Account: reset and exit instead of real-account sign-out")


def demo_lifecycle(guide):
    guide.launch("me/journal")
    guide.step("Create an identifiable local record, then terminate and relaunch without reset")
    guide.tap("New journal entry", scope=guide.element(kind="navigationBar"))
    guide.type("Title", "Guide persistence check")
    guide.type("Entry, markdown", "This fictional note verifies local demo persistence.", kind="textField")
    guide.tap("Save entry")
    guide.expect("Edit entry", kind="button")
    guide.call("terminate")
    guide.launch("today", reset=False)
    guide.require("A local demo edit survives process termination and relaunch",
                  any(row.get("title") == "Guide persistence check" for row in guide.rows("journal")))
    guide.shot("50-demo-restored", "Demo: restored local changes after relaunch")
    guide.step("Exit demo and capture the public sign-in/sign-up screens without requesting OTP")
    guide.tap("Demo controls")
    guide.shot("50-demo-controls", "Demo: always-available Reset and Exit menu")
    guide.tap("Exit demo")
    guide.expect("demo.enter", kind="button")
    guide.shot("00-sign-in", "Public entry: email OTP sign-in and Try demo (no email submitted)")
    guide.tap("Create an account")
    guide.shot("00-sign-up", "Public entry: sign-up (no live workflow submitted)")
    guide.tap("Sign in")
    guide.tap("demo.enter")
    guide.expect("demo.banner", kind="any")
    guide.require("Exit and Try demo preserved local demo edits",
                  any(row.get("title") == "Guide persistence check" for row in guide.rows("journal")))
    guide.shot("50-demo-reentered", "Demo: Try demo re-entry keeps local changes")
    guide.step("Confirm Reset demo data and verify the local edit is removed")
    guide.tap("Demo controls")
    guide.tap("Reset demo data")
    guide.shot("50-demo-reset-confirmation", "Demo: reset confirmation")
    confirm(guide, "Reset demo data")
    guide.expect("Today", kind="navigationBar")
    guide.require("Reset removed the synthetic edit and recreated valid fixtures",
                  all(row.get("title") != "Guide persistence check" for row in guide.rows("journal"))
                  and guide.state()["version"] == 1)
    guide.shot("50-demo-reset-complete", "Demo: fresh sample dataset after reset")


def demo_recovery(guide):
    guide.step("Launch an invalid explicit demo destination; recover through normal sign-in")
    guide.call("launch", arguments=["--demo", "--demo-screen", "not-a-screen"])
    guide.expect("Couldn't configure demo")
    guide.shot("50-demo-invalid-configuration", "Demo: malformed launch-configuration recovery")
    guide.tap("Open normal sign-in")
    guide.expect("demo.enter", kind="button")
    guide.tap("demo.enter")
    guide.expect("demo.banner", kind="any")
    guide.step("On this dedicated simulator only, corrupt the isolated demo JSON and recover with Reset")
    guide.call("terminate")
    guide.state_path().write_text("not valid demo JSON\n")
    guide.call("launch", arguments=["--demo"])
    guide.expect("Couldn't load demo")
    guide.shot("50-demo-corrupt-data", "Demo: corrupt saved-data recovery without live-account access")
    guide.tap("Reset demo data")
    guide.expect("demo.banner", kind="any")
    guide.require("Recovery replaced corrupt demo JSON with a valid store", guide.state()["version"] == 1)
    guide.shot("50-demo-corrupt-data-recovered", "Demo: valid sample data after recovery")


def sessions_pagination(guide):
    guide.launch("train/sessions")
    guide.step("Start session from Sessions opens the workout library")
    guide.tap("Start session", scope=guide.element(kind="navigationBar"))
    guide.expect("Workouts", kind="button")
    guide.shot("10-session-start-browse-workouts", "Start session: choose a workout, or start ad-hoc from an exercise")
    guide.tap("Sessions")
    guide.step("Load an older page of sessions grouped by week")
    guide.reveal("Load more", attempts=15)
    guide.shot("10-sessions-load-more", "Sessions: weekly history and Load more")
    guide.tap("Load more")
    guide.shot("10-sessions-older-page", "Sessions: older history appended")


GROUPS = {
    "roots": capture_roots, "today": today, "session": session,
    "workout-create": workout_create, "workout-edit": workout_edit,
    "exercise-catalog": exercise_catalog, "exercise-details": exercise_details,
    "cardio": cardio, "public-workout": public_workout,
    "food-browse": food_browse, "food-crud": food_crud,
    "log-navigation": log_navigation, "log-food": log_food, "log-meal": log_meal,
    "log-child": log_child, "log-ad-hoc": log_ad_hoc, "log-plan": log_plan,
    "meal-browse": meal_browse, "meal-crud": meal_crud,
    "plan-browse": plan_browse, "plan-crud": plan_crud,
    "body-history": body_history, "body-crud": body_crud,
    "energy-history": energy_history, "energy-crud": energy_crud,
    "progress-charts": progress_charts,
    "journal-browse": journal_browse, "journal-crud": journal_crud,
    "account": account, "demo-lifecycle": demo_lifecycle, "demo-recovery": demo_recovery,
    "sessions-pagination": sessions_pagination,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", required=True)
    parser.add_argument("--output", type=Path, default=CLIENT["DEFAULT_OUTPUT"])
    parser.add_argument("--group", choices=[*GROUPS, "all"], required=True)
    arguments = parser.parse_args()
    guide = Guide(arguments.device, arguments.output)
    selected = GROUPS.items() if arguments.group == "all" else [(arguments.group, GROUPS[arguments.group])]
    for name, callback in selected:
        if name == "roots":
            capture_roots(guide)
        else:
            title = name.replace("-", " ").title().replace("Crud", "CRUD")
            guide.run_workflow(name, title, callback)


if __name__ == "__main__":
    main()
