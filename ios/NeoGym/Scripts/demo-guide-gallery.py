#!/usr/bin/env python3
"""Single-page visual workflows, assembled from the existing capture manifest.

The layout is editorial: a capture run may contain several workflows (for
example create/edit/delete). Shared list/detail frames are intentionally reused.
Screenshot files and capture provenance are unchanged by rendering.
"""

import runpy
from pathlib import Path


def story(identifier, title, source, prefix, frames, context=()):
    return {"id": identifier, "title": title, "source": source,
            "images": list(context) + [prefix + name for name in frames.split()]}


def whole(source, context=()):
    return {"id": source, "source": source, "context": list(context)}


# Frame order is explicit, never alphabetic. Context references let each row
# stand alone without pretending these are new, continuous capture sessions.
LAYOUT = [
    ("demo", "Getting started & demo controls", [
        story("enter-demo", "Enter demo from sign-in", "demo-lifecycle", "",
              "00-sign-in 50-demo-reentered"),
        story("public-sign-up", "Inspect public sign-up", "demo-lifecycle", "",
              "00-sign-in 00-sign-up"),
        story("restore-demo", "Relaunch and restore local demo data", "demo-lifecycle", "50-",
              "demo-restored"),
        story("reset-demo", "Open demo controls and reset the dataset", "demo-lifecycle", "50-",
              "demo-controls demo-reset-confirmation demo-reset-complete"),
        story("exit-demo", "Exit demo to normal sign-in", "demo-lifecycle", "",
              "50-demo-controls 00-sign-in"),
        story("invalid-demo-route", "Recover from an invalid demo destination", "demo-recovery", "",
              "50-demo-invalid-configuration 00-sign-in 50-demo-reentered"),
        story("corrupt-demo", "Reset a corrupt local demo dataset", "demo-recovery", "50-",
              "demo-corrupt-data demo-corrupt-data-recovered"),
    ]),
    ("today", "Today", [
        whole("root-today"),
        whole("today", ["01-today"]),
    ]),
    ("train", "Train", [
        whole("root-train-sessions"),
        whole("sessions-pagination", ["10-sessions"]),
        story("view-session", "Open a strength session and its previous-session comparison", "session", "11-",
              "session-strength session-comparison-delete", ["10-sessions"]),
        story("session-date", "Inspect the session date/time editor", "session", "11-",
              "session-strength session-date-editor"),
        story("edit-strength-set", "Edit a logged strength set", "session", "11-",
              "session-strength session-set-edit session-set-edit-adjusted"),
        story("log-strength-set", "Log the next strength set", "session", "11-",
              "session-strength session-set-add session-set-logged"),
        story("rest-timer", "Extend rest, switch tabs, return and skip", "session", "11-",
              "session-set-logged session-rest-extended session-rest-on-today session-rest-skipped"),
        story("delete-strength-set", "Delete a logged strength set", "session", "11-",
              "session-rest-skipped session-set-deleted"),
        story("add-session-exercise", "Add an exercise to a session", "session", "11-",
              "session-strength session-exercise-picker session-exercise-picker-selected session-added-exercise"),
        story("remove-session-exercise", "Remove an exercise from a session", "session", "11-",
              "session-added-exercise session-exercise-menu session-remove-confirmation session-comparison-delete"),
        story("delete-session", "Delete a session", "session", "11-",
              "session-comparison-delete session-delete-confirmation session-deleted"),
        story("log-cardio", "Log cardio, including required-field validation", "cardio", "11-session-cardio-",
              "empty add required-validation add-filled logged expanded", ["13-exercise-cardio-detail"]),
        story("edit-cardio", "Edit a logged cardio entry", "cardio", "11-session-cardio-",
              "expanded edit updated"),
        story("delete-cardio", "Delete a logged cardio entry", "cardio", "11-session-cardio-",
              "updated edit deleted"),
        whole("root-train-workouts"),
        whole("workout-create", ["12-workouts"]),
        story("view-workout", "View a workout, exercise list and expanded notes", "workout-edit", "12-workout-",
              "detail detail-notes notes-expanded", ["12-workouts"]),
        story("edit-workout", "Edit a workout and reorder/remove exercises", "workout-edit", "12-workout-",
              "detail edit exercise-context-menu edit-exercises"),
        story("start-workout", "Start a session from a workout", "workout-edit", "12-workout-",
              "detail started-session"),
        story("delete-workout", "Delete a workout without deleting its sessions", "workout-edit", "12-workout-",
              "detail edit delete-confirmation deleted-detail-issue deleted-sessions-preserved"),
        whole("public-workout", ["12-workouts"]),
        whole("root-train-exercises"),
        whole("exercise-catalog", ["13-exercises"]),
        story("view-strength-exercise", "View strength instructions, progress and history", "exercise-details", "13-exercise-",
              "strength-detail strength-instructions strength-progress strength-history", ["13-exercises"]),
        story("start-ad-hoc-session", "Start an ad-hoc session from an exercise", "exercise-details", "13-exercise-",
              "strength-detail started-ad-hoc"),
        story("view-cardio-exercise", "View cardio details, progress and history", "exercise-details", "13-exercise-",
              "cardio-detail cardio-progress cardio-history", ["13-exercises"]),
    ]),
    ("nutrition", "Nutrition", [
        whole("root-nutrition-log"),
        story("log-dates", "Browse dates, calendar and week strip", "log-navigation", "20-log-",
              "yesterday date-picker next-week", ["20-nutrition-log"]),
        story("log-plan-selection", "Change the day's selected plan or use no plan", "log-navigation", "20-log-",
              "plan-menu no-plan", ["20-nutrition-log"]),
        story("clear-day", "Clear the day's intake", "log-navigation", "20-log-",
              "clear-confirmation cleared-empty", ["20-nutrition-log"]),
        story("log-food", "Log a standalone food", "log-food", "20-log-",
              "food-sheet food-search-picker food-filled food-added", ["20-nutrition-log"]),
        story("edit-logged-food", "Edit a logged food's amount", "log-food", "20-log-",
              "food-added entry-edit entry-edit-adjusted entry-updated"),
        story("delete-logged-food", "Delete a logged standalone food", "log-food", "20-log-",
              "entry-updated entry-edit entry-delete-confirmation entry-deleted"),
        story("log-meal", "Log a meal and its ingredients", "log-meal", "20-log-",
              "meal-sheet meal-search-picker meal-added", ["20-nutrition-log"]),
        story("edit-logged-meal", "Edit a logged meal group", "log-meal", "20-log-",
              "meal-added meal-edit meal-updated"),
        story("delete-logged-meal", "Delete a logged meal group and its children", "log-meal", "20-log-",
              "meal-updated meal-edit meal-delete-confirmation meal-deleted"),
        story("edit-logged-child", "Edit a food inside a logged meal", "log-child", "20-log-",
              "group-child-edit group-child-edit-adjusted group-child-updated", ["20-nutrition-log"]),
        story("delete-logged-child", "Delete one food without deleting its logged meal", "log-child", "20-log-",
              "group-child-updated group-child-edit group-child-delete-confirmation group-child-deleted"),
        story("log-custom-intake", "Log a custom item without creating a catalog food", "log-ad-hoc", "20-log-",
              "ad-hoc-sheet ad-hoc-filled ad-hoc-added", ["20-nutrition-log"]),
        story("edit-custom-intake", "Edit custom intake", "log-ad-hoc", "20-log-",
              "ad-hoc-added ad-hoc-edit ad-hoc-edit-adjusted ad-hoc-updated"),
        story("log-planned-meal", "Log an individual meal from the selected plan", "log-plan", "20-log-",
              "from-plan-sheet from-plan-added", ["20-nutrition-log"]),
        story("log-planned-food", "Log an individual food from the selected plan", "log-plan", "20-log-",
              "from-plan-food-sheet from-plan-food-added", ["20-nutrition-log"]),
        story("log-occupied-slot", "Log a whole planned slot where intake already exists", "log-plan", "20-log-",
              "plan-slot-existing-confirmation plan-slot-appended", ["20-nutrition-log"]),
        story("log-direct-plan-food", "Inspect a directly logged plan food", "log-plan", "20-log-",
              "plan-direct-food", ["20-log-from-plan-food-added"]),
        whole("root-nutrition-plans"),
        whole("plan-browse", ["21-plans"]),
        story("create-plan", "Create a mixed meal/food plan, with an inline new meal", "plan-crud", "21-plan-",
              "create new-slot meal-picker inline-new-meal inline-meal-created food-picker mixed-slot "
              "create-filled created-navigation-issue created", ["21-plans"]),
        story("use-plan-today", "Use a plan for today", "plan-crud", "21-plan-",
              "created used-for-today"),
        story("edit-plan", "Edit a plan: move entries, label meals and merge time slots", "plan-crud", "21-plan-",
              "created entry-menu entry-time-sheet entry-moved-time slot-label-alert slot-label-updated "
              "slot-time-sheet slots-merged updated"),
        story("delete-plan", "Delete a nutrition plan", "plan-crud", "21-plan-",
              "updated delete-confirmation deleted-detail-issue deleted"),
        whole("root-nutrition-foods"),
        whole("food-browse", ["22-foods"]),
        story("create-food", "Create a private food", "food-crud", "22-food-",
              "create create-filled created", ["22-foods"]),
        story("edit-food", "Edit a private food", "food-crud", "22-food-",
              "created edit updated"),
        story("delete-food", "Delete a private food", "food-crud", "22-food-",
              "updated edit delete-confirmation deleted-detail-issue deleted"),
        whole("root-nutrition-meals"),
        whole("meal-browse", ["23-meals"]),
        story("create-meal", "Create a meal, including inline food creation and editing", "meal-crud", "23-meal-",
              "create ingredient-picker inline-new-food inline-food-created ingredient-menu quick-edit-food "
              "create-filled created", ["23-meals"]),
        story("edit-meal", "Edit a meal and remove an ingredient", "meal-crud", "23-meal-",
              "created edit-remove-ingredient updated"),
        story("delete-meal", "Delete an unreferenced meal", "meal-crud", "23-meal-",
              "updated edit-remove-ingredient delete-confirmation deleted-detail-issue deleted"),
    ]),
    ("progress", "Progress", [
        whole("root-progress-overview"),
        story("progress-overview", "Browse the Progress overview cards", "progress-charts", "30-overview-",
              "strength body energy", ["30-progress-overview"]),
        whole("root-progress-muscles"),
        story("select-muscle", "Select a muscle and inspect weighted-set history", "progress-charts", "31-muscles-",
              "stacked-bars selected-quadriceps", ["31-muscles"]),
        whole("root-progress-strength"),
        story("chart-controls", "Inspect a chart point, presets, custom dates and series controls", "progress-charts", "",
              "35-chart-point-callout 35-chart-period-menu 32-strength-last-30-days 35-chart-custom-range "
              "35-chart-custom-date-popover 35-chart-series-toggle", ["32-strength"]),
        story("strength-drill-down", "Inspect exercise strength charts and open exercise detail", "progress-charts", "32-strength-",
              "exercise-charts exercise-drill-down", ["32-strength"]),
        whole("root-progress-body"),
        whole("body-history", ["33-body"]),
        story("create-body", "Add a measurement, including duplicate-date validation", "body-crud", "33-body-",
              "create duplicate-date-error create-date-picker create-filled created", ["33-body"]),
        story("edit-body", "Edit a body measurement", "body-crud", "33-body-",
              "created edit updated"),
        story("delete-body", "Delete a body measurement", "body-crud", "33-body-",
              "updated edit delete-confirmation deleted-detail-issue deleted"),
        whole("root-progress-energy"),
        whole("energy-history", ["34-energy"]),
        story("create-energy", "Add daily energy, including duplicate-date validation", "energy-crud", "34-energy-",
              "create duplicate-date-error create-date-picker create-filled created", ["34-energy"]),
        story("edit-energy", "Edit daily energy", "energy-crud", "34-energy-",
              "created edit updated"),
        story("delete-energy", "Delete daily energy", "energy-crud", "34-energy-",
              "updated edit delete-confirmation deleted-detail-issue deleted"),
    ]),
    ("me", "Me", [
        whole("root-me-journal"),
        whole("journal-browse", ["40-journal"]),
        story("create-journal", "Create a Markdown journal entry and a new label", "journal-crud", "40-journal-",
              "create markdown-editor label-input create-filled created-navigation-issue created", ["40-journal"]),
        story("edit-journal", "Edit a journal entry", "journal-crud", "40-journal-",
              "created edit updated"),
        story("delete-journal", "Delete a journal entry", "journal-crud", "40-journal-",
              "updated delete-confirmation deleted-detail-issue deleted"),
        story("empty-journal", "Inspect a journal label with no matching entries", "journal-crud", "40-journal-",
              "empty-label-filter", ["40-journal"]),
        whole("root-me-account"),
        story("demo-connections", "Inspect the demo profile and disabled live integrations", "account", "41-account-",
              "demo-connections", ["41-account"]),
        story("appearance", "Change Dark, Light and System appearance", "account", "",
              "41-account-preferences 41-account-light-preference 01-today-light 41-account-system-preference",
              ["41-account"]),
        story("default-rest", "Change the default rest duration", "account", "41-account-",
              "preferences default-rest", ["41-account"]),
        story("account-demo-actions", "Find reset and exit actions under Account", "account", "41-account-",
              "demo-actions reset-confirmation", ["41-account"]),
    ]),
]


SHARED = runpy.run_path(str(Path(__file__).resolve().parents[3] / "tools/gallery.py"))


def build_sections(manifest):
    return SHARED["build_sections"](manifest, LAYOUT)


def render_gallery_html(manifest):
    return SHARED["render_gallery_html"](manifest, LAYOUT, PAGE)


PAGE = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NeoGym iPhone — all visual workflows</title>
<style>
$style
</style>
</head>
<body>
<header id="top">
<p class="eyebrow">NeoGym · iPhone demo guide</p>
<h1>Every workflow, screen by screen.</h1>
<p class="stats">$row_count visual workflow rows · $image_count original screenshots · $workflow_count source walkthroughs</p>
<p><a href="widgets-watch/gallery.html">Widgets &amp; Watch · 45 production-view visual fixtures</a> —
separate simulator fixture apps, not system-hosted surfaces or verified interactive workflows.
<a href="widgets-watch/README.md">Scope and reproduction</a>. The iPhone walkthrough counts below are unchanged.</p>
<p>One workflow per row, read <strong>left to right</strong>. Scroll each strip sideways for the remaining screens.
Click a screenshot to open the full-resolution PNG in a new tab.</p>
<p class="muted">These visual sequences are assembled from recorded simulator walkthroughs, not new continuous recordings.
List, detail and editor views are intentionally reused so you can follow each row on its own.
“Reused view” marks an image appearing in more than one row.</p>
<details><summary>Scope, evidence and known limitations</summary>
<p>Actual iPhone 17 · iOS 27 · English · portrait captures, with fictional offline demo data.
Dark by default; Light/System preference changes are labeled. Dates are not frozen.</p>
<p>Bundled capture runs are split into smaller view/create/edit/delete workflows. Expand a row's source actions
and checks for the original recorded run, which may cover several rows. Known navigation defects remain
called out beside their evidence; a passed run does not mean those defects are fixed.</p>
<p>Real OTP authentication, Apple Health/Watch, widgets, notifications, Live Activities, signing and App Review
approval require separate live or hardware validation. Public auth screens here stop before submitting.</p>
<p><a href="README.md">Full guide and coverage</a> · <a href="workflows.md">Recorded action log</a> ·
<a href="capture-manifest.json">Capture provenance</a> · <a href="capture.md">Refresh instructions</a></p>
</details>
</header>
<div class="toolbar">
<div class="toolbar-inner">
<nav aria-label="Workflow sections">$navigation</nav>
<div class="controls">
<label>Find workflow <input id="workflow-search" type="search" placeholder="e.g. edit food" autocomplete="off"></label>
<label>Screen size <select id="screen-size"><option value="170">Small</option><option value="220" selected>Medium</option><option value="300">Large</option></select></label>
</div>
<p id="result-count" role="status" aria-live="polite">Showing all $row_count workflows</p>
</div>
</div>
<main id="workflows">$content<p id="no-results" hidden>No workflows match. Try a different search.</p></main>
<footer><p>Local, dependency-free HTML. All workflow content is on this page; images are loaded from the adjacent
<code>screenshots/</code> folder without copying them for repeated views. No server or simulator is required.</p>
<p><a href="#top">Back to top</a></p></footer>
<script>
$script
</script>
</body>
</html>
'''
