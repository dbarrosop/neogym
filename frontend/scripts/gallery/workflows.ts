import { expect } from "@playwright/test";
import type { CaptureBackend } from "./backend";
import catalog from "./catalog.json";
import type { GalleryDriver } from "./driver";
import type { FixtureIDs } from "./fixtures";
import fixture from "./profile.json";

const SKIP_REST = /^Skip/;
const OCCUPIED_SLOT = /Food is already logged at 7:15 AM/;
const EDIT_PATH = /\/edit$/;
const DARK_CLASS = /dark/;
const ACTUAL_BALANCE = /^Today so far · \d{1,2}:\d{2} [AP]M$/;
const BODY_CARD_CHART = /^Weight and body fat/;
const BODY_PATH = /\/progress\/body$/;
const BENCH_CHART = /^Bench press volume and estimated one-rep max/i;
const OVERVIEW_PATH = /\/progress\/overview$/;
const ENERGY_PATH = /\/progress\/energy$/;
const CONSUMED_CHART = /^Calories consumed per day/;
const NET_CHART = /^Net calories/;
const CALORIES_90_DAYS = /\?calories=90$/;

export const CHECK_DOCUMENTS = {
  sets: `query GalleryCheckSets($id: uuid!) { workoutSession(id: $id) {
    workoutSessionExercises { exercise { name } workoutSessionStrengthSets { setNumber reps } }
  } }`,
  logs: `query GalleryCheckLog($id: uuid!) { nutritionDay(id: $id) {
    nutritionLogEntries { id } nutritionLogMeals { id }
  } }`,
  journal: `query GalleryCheckJournal($id: uuid!) { journalEntry(id: $id) { title body } }`,
  plan: `query GalleryCheckPlan($id: uuid!) { nutritionPlan(id: $id) {
    nutritionPlanFoods { slotTime position grams food { name } }
    nutritionPlanMeals { slotTime position meal { name } }
  } }`,
  meal: `query GalleryCheckMeal($id: uuid!) { meal(id: $id) {
    mealIngredients { grams food { name } }
  } }`,
};

export async function captureRoots(guide: GalleryDriver, id?: string): Promise<void> {
  await catalog.roots
    .filter((root) => id === undefined || root.id === id)
    .reduce(async (previous, root) => {
      await previous;
      await guide.run(`root-${root.id}`, root.title, async () => {
        await guide.open(root.path, root.heading);
        if (root.id === "body") {
          const summary = guide.page.getByRole("region", { name: "Progress photos", exact: true });
          await expect(summary.getByText("No photos yet", { exact: true })).toBeVisible();
        }
        // Skeletons and GraphQL errors are checked by the driver, including the
        // optional report/history reads that otherwise leave browsing usable.
        await guide.shot("root", `${root.title}: ${guide.profile} section root`);
        guide.check(
          "The real route and its data requests settled without browser or GraphQL errors",
        );
      });
    }, Promise.resolve());
}

export async function captureTodaySummary(guide: GalleryDriver) {
  const { page } = guide;
  await guide.open("/today", "Today");
  const balance = page.getByRole("region", { name: "Energy balance", exact: true });
  await balance.scrollIntoViewIfNeeded();
  await expect(balance.getByText(ACTUAL_BALANCE)).toBeVisible();
  await expect(balance.getByText("By end of day, estimated", { exact: true })).toBeVisible();
  // The desktop Today root already shows both cards; only mobile needs the scrolled views.
  if (guide.profile === "mobile") {
    await guide.shot("balance", "Today: recorded balance and the separate end-of-day estimate");
  }
  guide.step("Inspect the body trend, then open its full Progress section");
  const body = page.getByRole("region", { name: "Body", exact: true });
  await body.scrollIntoViewIfNeeded();
  await expect(body.getByLabel(BODY_CARD_CHART)).toBeVisible();
  if (guide.profile === "mobile") {
    await guide.shot("body", "Today: weight and body fat with latest readings and weekly averages");
  }
  await body.getByRole("link", { name: "Trend", exact: true }).click();
  await expect(page).toHaveURL(BODY_PATH);
  guide.check("Balance distinguishes the stamped actual totals from the estimated end of day");
  guide.check("Body renders both metrics and its Trend link opens Progress › Body");
}

export async function captureSession(
  guide: GalleryDriver,
  backend: CaptureBackend,
  ids: FixtureIDs,
) {
  const { page } = guide;
  await guide.open(`/train/sessions/${ids.session}`);
  const bench = page.getByRole("region", { name: "Bench press", exact: true });
  const form = bench.getByRole("form", { name: "Log set 2", exact: true });
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
  await guide.shot("before", "Session: inline next-set controls and earlier history");
  guide.step("Log the prefilled second working set");
  await form.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(bench.getByRole("button", { name: "Edit set 2", exact: true })).toBeVisible();
  const timer = page.getByRole("region", { name: "Rest timer", exact: true });
  await expect(timer).toBeVisible();
  await guide.shot("logged", "Session: saved set and running rest timer");
  guide.step("Extend rest, advance the clock ten seconds, and switch to Today");
  const clock = timer.getByRole("timer");
  await expect(clock).toHaveText("1:30");
  await timer.getByRole("button", { name: "+30 s", exact: true }).click();
  await expect(clock).toHaveText("2:00");
  await page.clock.setFixedTime(new Date(Date.parse(fixture.now) + 10_000));
  await expect(clock).toHaveText("1:50");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(timer).toBeVisible();
  await expect(clock).toHaveText("1:50");
  await guide.shot("today", "Today: the session's rest timer remains available");
  guide.step("Return using the timer link, then Skip the rest");
  await timer.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/train/sessions/${ids.session}$`));
  await timer.getByRole("button", { name: SKIP_REST }).click();
  await expect(timer).toHaveCount(0);
  await page.clock.setFixedTime(new Date(fixture.now));
  guide.step("Tap the saved second set, change its reps to 8, and save");
  await bench.getByRole("button", { name: "Edit set 2", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit set 2", exact: true });
  // Let the dialog finish its scheduled weight selection before moving to Reps.
  await expect(edit.getByLabel("Weight (kg)", { exact: true })).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await edit.getByLabel("Reps", { exact: true }).fill("8");
  await guide.shot("edit", "Session: edit the saved set in place after returning from Today");
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await expect(edit).toHaveCount(0);
  const saved = await backend.query<{
    workoutSession: {
      workoutSessionExercises: {
        exercise: { name: string };
        workoutSessionStrengthSets: { setNumber: number; reps: number }[];
      }[];
    };
  }>(CHECK_DOCUMENTS.sets, { id: ids.session });
  const sets = saved.workoutSession.workoutSessionExercises.find(
    (row) => row.exercise.name === "Bench press",
  )?.workoutSessionStrengthSets;
  expect(sets).toHaveLength(2);
  expect(sets?.find((set) => set.setNumber === 2)?.reps).toBe(8);
  guide.check("A fresh backend read contains exactly two Bench press sets, with 8 reps on set 2");
  guide.check(
    "Rest extended from 1:30 to 2:00, reached 1:50 after ten seconds, survived navigation and cleared on Skip",
  );
}

export async function captureExerciseDetail(guide: GalleryDriver, ids: FixtureIDs) {
  const { page } = guide;
  await guide.open(`/train/sessions/${ids.session}`);
  const bench = page.getByRole("region", { name: "Bench press", exact: true });
  await expect(bench.getByRole("heading", { name: "Recent", exact: true })).toBeVisible();
  const options = bench.getByRole("button", { name: "Options for Bench press", exact: true });
  await options.scrollIntoViewIfNeeded();
  await guide.shot("recent", "Session: Bench press and earlier sets in the Recent panel");
  guide.step("Open the exercise options and choose Exercise details");
  await options.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Remove from session" })).toBeVisible();
  await guide.shot("options", "Session: exercise details and removal sit behind Options");
  await menu.getByRole("menuitem", { name: "Exercise details" }).click();
  await expect(page).toHaveURL(new RegExp(`/train/exercises/${ids.bench}$`));
  const instructions = page.getByRole("region", { name: "How to", exact: true });
  const progress = page.getByRole("region", { name: "Progress", exact: true });
  if (guide.profile === "mobile") {
    const [howToBox, progressBox] = await Promise.all([
      instructions.boundingBox(),
      progress.boundingBox(),
    ]);
    expect(howToBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
      progressBox?.y ?? Number.NEGATIVE_INFINITY,
    );
    guide.check("On mobile, the exercise instructions are above the Progress card");
  }
  await expect(instructions).toBeVisible();
  await guide.shot("details", "Exercise detail: muscles and instructions");
  const chart = progress.getByLabel(BENCH_CHART);
  await expect(chart).toBeVisible();
  if (guide.profile === "mobile") {
    await chart.scrollIntoViewIfNeeded();
    await guide.shot("progress", "Exercise detail: volume and estimated 1RM over earlier sessions");
  }
  guide.check("Exercise details opened the matching catalog route with a strength progress chart");
}

interface LogResult {
  nutritionDay: { nutritionLogEntries: { id: string }[]; nutritionLogMeals: { id: string }[] };
}

export async function capturePlanLog(
  guide: GalleryDriver,
  backend: CaptureBackend,
  ids: FixtureIDs,
) {
  const { page } = guide;
  await guide.open(`/nutrition/log/${ids.today}`, "Nutrition");
  const before = await backend.query<LogResult>(CHECK_DOCUMENTS.logs, { id: ids.day });
  const planned = page.getByRole("region", { name: "7:15 AM, planned", exact: true });
  await planned.scrollIntoViewIfNeeded();
  await guide.shot("before", "Nutrition: planned breakfast beside existing intake");
  guide.step("Log the planned 07:15 slot and inspect the append confirmation");
  await planned.getByRole("button", { name: "Log slot", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Log this planned slot?", exact: true });
  await expect(dialog.getByText(OCCUPIED_SLOT)).toBeVisible();
  await guide.shot("confirm", "Nutrition: confirmation before appending planned intake");
  await dialog.getByRole("button", { name: "Log slot", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await guide.settle();
  const after = await backend.query<LogResult>(CHECK_DOCUMENTS.logs, { id: ids.day });
  expect(after.nutritionDay.nutritionLogEntries.length).toBe(
    before.nutritionDay.nutritionLogEntries.length + 3,
  );
  expect(after.nutritionDay.nutritionLogMeals.length).toBe(
    before.nutritionDay.nutritionLogMeals.length + 1,
  );
  await page.getByRole("region", { name: "7:15 AM, logged", exact: true }).scrollIntoViewIfNeeded();
  await guide.shot("logged", "Nutrition: appended breakfast and its per-food macro rows");
  guide.check(
    "A fresh backend read contains three additional food snapshots and one additional logged meal",
  );
  await expect(planned.getByRole("button", { name: "Log slot", exact: true })).toBeVisible();
  guide.check("The planned slot remains visible and can be logged again");
}

export async function capturePlanEdit(
  guide: GalleryDriver,
  backend: CaptureBackend,
  ids: FixtureIDs,
) {
  const { page } = guide;
  const planPath = `/nutrition/plans/${ids.plan}`;
  await guide.open(`${planPath}/edit`, "Edit plan");
  const source = page.getByRole("region", { name: "Time slot 4:00 PM", exact: true });
  const lunch = page.getByRole("region", { name: "Time slot 12:30 PM", exact: true });
  const banana = source.getByRole("button", { name: "More actions for Banana", exact: true });
  await banana.scrollIntoViewIfNeeded();
  await guide.shot("slot", "Plan editor: Banana in its original afternoon slot");
  guide.step("Use Banana’s row menu to move it into the existing 12:30 slot");
  await banana.click();
  await page.getByRole("menuitem", { name: "Move to another time…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Move Banana", exact: true });
  await dialog.getByLabel("Time", { exact: true }).fill("12:30");
  await guide.shot("move", "Plan editor: choose a destination time for one planned food");
  await dialog.getByRole("button", { name: "Move", exact: true }).click();
  await expect(source).toHaveCount(0);
  await expect(lunch.getByText("Chicken & rice", { exact: true })).toBeVisible();
  const grams = lunch.getByLabel("Banana grams", { exact: true });
  await expect(grams).toHaveValue("120");
  await grams.scrollIntoViewIfNeeded();
  await guide.shot(
    "merged",
    "Plan editor: the existing lunch slot now contains both meal and food",
  );
  guide.step("Save the plan and inspect the mixed lunch slot on its detail page");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${planPath}$`));
  const savedLunch = page.getByText("Chicken & rice", { exact: true });
  await savedLunch.scrollIntoViewIfNeeded();
  await guide.shot("saved", "Plan detail: saved lunch shows the meal, food and slot macros");
  const { nutritionPlan } = await backend.query<{
    nutritionPlan: {
      nutritionPlanFoods: {
        food: { name: string };
        slotTime: string;
        grams: number;
        position: number;
      }[];
      nutritionPlanMeals: { meal: { name: string }; slotTime: string; position: number }[];
    };
  }>(CHECK_DOCUMENTS.plan, { id: ids.plan });
  const food = nutritionPlan.nutritionPlanFoods.find((row) => row.food.name === "Banana");
  const meal = nutritionPlan.nutritionPlanMeals.find((row) => row.meal.name === "Chicken & rice");
  expect(meal?.slotTime).toBe("12:30:00");
  expect(food).toMatchObject({ slotTime: "12:30:00", grams: 120, position: 1 });
  expect(meal?.position).toBe(0);
  guide.check("Backend confirms the shared lunch time and positions, with Banana still at 120 g");
}

export async function captureMealEdit(
  guide: GalleryDriver,
  backend: CaptureBackend,
  ids: FixtureIDs,
) {
  const { page } = guide;
  const mealPath = `/nutrition/meals/${ids.breakfast}`;
  await guide.open(`${mealPath}/edit`, "Edit meal");
  guide.step("Open the current ingredient’s food picker, then close it without changing the food");
  const picker = page.getByRole("combobox", { name: "Food for ingredient 1", exact: true });
  await picker.click();
  const choices = page.getByRole("listbox");
  await expect(choices).toBeVisible();
  await guide.shot("ingredients", "Meal editor: search foods from an existing ingredient row");
  await picker.press("Escape");
  await expect(choices).toHaveCount(0);
  guide.step("Change the ingredient amount and inspect the recalculated live totals");
  const grams = page.getByLabel("Grams of Rolled oats", { exact: true });
  await grams.fill("70");
  await expect(page.getByText("272 kcal", { exact: true })).toBeVisible();
  const remove = page.getByRole("button", { name: "Delete meal", exact: true });
  await expect(remove).toBeDisabled();
  await expect(
    page.getByText("Used in 1 plan (Training day). Remove it there first."),
  ).toBeVisible();
  await remove.scrollIntoViewIfNeeded();
  await guide.shot("delete-guard", "Meal editor: the linked Training day plan blocks deletion");
  guide.step("Save the meal without changing its plan reference");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${mealPath}$`));
  await page.getByText("Rolled oats", { exact: true }).scrollIntoViewIfNeeded();
  await guide.shot("saved", "Meal detail: the saved ingredient portions and nutrition totals");
  const { meal } = await backend.query<{
    meal: { mealIngredients: { grams: number; food: { name: string } }[] };
  }>(CHECK_DOCUMENTS.meal, { id: ids.breakfast });
  expect(meal.mealIngredients).toHaveLength(3);
  expect(meal.mealIngredients.find((row) => row.food.name === "Rolled oats")?.grams).toBe(70);
  guide.check("The editor named the referencing plan and disabled Delete");
  guide.check("A fresh backend read confirms 70 g of oats and all three ingredients");
}

export async function captureProgressCalories(guide: GalleryDriver) {
  const { page } = guide;
  await guide.open("/progress", "Progress");
  await expect(page).toHaveURL(OVERVIEW_PATH);
  const seeEnergy = page.getByRole("link", { name: "See all energy", exact: true });
  await seeEnergy.scrollIntoViewIfNeeded();
  await guide.shot("overview-energy", "Progress Overview: Energy card and its See all link");
  guide.step("Follow See all energy to compare consumed and net calories");
  // Activate the link without leaving a pointer over a chart as Energy mounts.
  await seeEnergy.press("Enter");
  await expect(page).toHaveURL(ENERGY_PATH);
  const calories = page.getByRole("region", { name: "Calories", exact: true });
  const consumed = calories.getByLabel(CONSUMED_CHART);
  const net = calories.getByLabel(NET_CHART);
  await consumed.scrollIntoViewIfNeeded();
  await expect(net).toBeVisible();
  await expect(calories.locator(".recharts-tooltip-cursor")).toHaveCount(0);
  await guide.shot("consumed", "Calories: starting period and consumed calories so far");
  guide.step("Switch the Calories period to 90 days without changing the energy-out period");
  const period = calories.getByRole("group", { name: "Calories period" });
  await period.getByText("90 d", { exact: true }).click();
  await expect(page).toHaveURL(CALORIES_90_DAYS);
  await expect(period.getByRole("radio", { name: "90 d" })).toBeChecked();
  const energy = page.getByRole("region", { name: "Energy trend", exact: true });
  await expect(energy.getByRole("radio", { name: "30 d", exact: true })).toBeChecked();
  await net.scrollIntoViewIfNeeded();
  await guide.shot("net", "Calories: net calories and their 7-day average over the wider period");
  guide.check(
    "Progress lands on Overview and its Energy link opens both populated Calories charts",
  );
  guide.check("Changing Calories to 90 days left the energy-out trend on 30 days");
}

const JOURNAL_DETAIL = /\/me\/journal\/[0-9a-f-]{36}$/;

export async function captureJournal(guide: GalleryDriver, backend: CaptureBackend) {
  const { page } = guide;
  const title = "A small win";
  await guide.open("/me/journal/new", "New entry");
  await guide.shot("new", "Journal: blank create form");
  guide.step("Write a Markdown journal entry and save it");
  await page.getByLabel("Title", { exact: false }).fill(title);
  await page
    .getByLabel("Entry · Markdown", { exact: true })
    .fill(
      "## Today\nA controlled session and a good breakfast.\n\n- Stay consistent\n- Make time for recovery",
    );
  await guide.shot("filled", "Journal: completed Markdown form and responsive Save actions");
  await page.getByRole("button", { name: "Create entry", exact: true }).click();
  await expect(page).toHaveURL(JOURNAL_DETAIL);
  const id = page.url().split("/").at(-1);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await guide.shot("created", "Journal: saved entry with rendered Markdown");
  const created = await backend.query<{ journalEntry: { title: string } }>(
    CHECK_DOCUMENTS.journal,
    { id },
  );
  expect(created.journalEntry.title).toBe(title);
  guide.check(
    "The create form navigated to a detail route and a fresh backend read confirms its title",
  );
  guide.step("Edit the entry and save the changed title");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit entry", exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: false }).fill("A small win, remembered");
  await guide.shot("edit", "Journal: edit form");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A small win, remembered", exact: true }),
  ).toBeVisible();
  await guide.shot("updated", "Journal: updated entry");
  const updated = await backend.query<{ journalEntry: { title: string } }>(
    CHECK_DOCUMENTS.journal,
    { id },
  );
  expect(updated.journalEntry.title).toBe("A small win, remembered");
  guide.check("A fresh backend read confirms the edited title");
  guide.step("Open the editor, confirm Delete, and return to the journal list");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this entry?", exact: true });
  await expect(dialog).toBeVisible();
  await guide.shot("confirm", "Journal: destructive confirmation");
  await dialog.getByRole("button", { name: "Delete entry", exact: true }).click();
  await expect(page).not.toHaveURL(EDIT_PATH);
  await guide.settle();
  const deleted = await backend.query<{ journalEntry: null }>(CHECK_DOCUMENTS.journal, { id });
  expect(deleted.journalEntry).toBeNull();
  await expect(
    page.getByRole("heading", { name: "A small win, remembered", exact: true }),
  ).toHaveCount(0);
  await guide.shot("deleted", "Journal: returned to surviving entries after deletion");
  guide.check(
    "A fresh backend read confirms deletion and the deleted detail is no longer displayed",
  );
}

export async function captureAppearance(guide: GalleryDriver) {
  const { page } = guide;
  await guide.open("/me/account", "Me");
  guide.step("Select Light, inspect Today, then restore Dark");
  const appearance = page.getByRole("group", { name: "Appearance", exact: true });
  await appearance.getByText("Light", { exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(DARK_CLASS);
  await guide.shot("light", "Account: Light appearance selected");
  await guide.open("/today", "Today");
  await guide.shot("today", "Today: Light appearance persists across navigation");
  await guide.open("/me/account", "Me");
  await appearance.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveClass(DARK_CLASS);
  await guide.shot("dark", "Account: Dark appearance restored");
  guide.check(
    "The real theme control changed the document appearance and persisted across navigation",
  );
}
