import { expect } from "@playwright/test";
import type { CaptureBackend } from "./backend";
import catalog from "./catalog.json";
import type { GalleryDriver } from "./driver";
import type { FixtureIDs } from "./fixtures";

const SKIP_REST = /^Skip/;
const OCCUPIED_SLOT = /Food is already logged at 7:15 AM/;
const EDIT_PATH = /\/edit$/;
const DARK_CLASS = /dark/;

export const CHECK_DOCUMENTS = {
  sets: `query GalleryCheckSets($id: uuid!) { workoutSession(id: $id) {
    workoutSessionExercises { exercise { name } workoutSessionStrengthSets { setNumber } }
  } }`,
  logs: `query GalleryCheckLog($id: uuid!) { nutritionDay(id: $id) {
    nutritionLogEntries { id } nutritionLogMeals { id }
  } }`,
  journal: `query GalleryCheckJournal($id: uuid!) { journalEntry(id: $id) { title body } }`,
};

export async function captureRoots(guide: GalleryDriver): Promise<void> {
  await catalog.roots.reduce(async (previous, root) => {
    await previous;
    await guide.run(`root-${root.id}`, root.title, async () => {
      await guide.open(root.path, root.heading);
      // Skeletons and GraphQL errors are checked by the driver, including the
      // optional report/history reads that otherwise leave browsing usable.
      await guide.shot("root", `${root.title}: ${guide.profile} section root`);
      guide.check("The real route and its data requests settled without browser or GraphQL errors");
    });
  }, Promise.resolve());
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
  guide.step("Extend rest, switch to Today, and return using the timer link");
  await timer.getByRole("button", { name: "+30 s", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(timer).toBeVisible();
  await guide.shot("today", "Today: the session's rest timer remains available");
  await timer.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/train/sessions/${ids.session}$`));
  await timer.getByRole("button", { name: SKIP_REST }).click();
  await expect(timer).toHaveCount(0);
  await guide.shot("returned", "Session: returned from Today and skipped the rest");
  const saved = await backend.query<{
    workoutSession: {
      workoutSessionExercises: {
        exercise: { name: string };
        workoutSessionStrengthSets: { setNumber: number }[];
      }[];
    };
  }>(CHECK_DOCUMENTS.sets, { id: ids.session });
  expect(
    saved.workoutSession.workoutSessionExercises.find((row) => row.exercise.name === "Bench press")
      ?.workoutSessionStrengthSets,
  ).toHaveLength(2);
  guide.check("A fresh backend read contains exactly two Bench press sets");
  guide.check(
    "The timer survived area navigation, linked to the originating session, and cleared on Skip",
  );
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
  const dialog = page.getByRole("dialog");
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
  await guide.shot(
    "logged",
    "Nutrition: appended breakfast, with its planned slot still available",
  );
  guide.check(
    "A fresh backend read contains three additional food snapshots and one additional logged meal",
  );
  await expect(planned.getByRole("button", { name: "Log slot", exact: true })).toBeVisible();
  guide.check("The planned slot remains visible and can be logged again");
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
    .getByLabel("Entry", { exact: true })
    .fill(
      "## Today\nA controlled session and a good breakfast.\n\n- Stay consistent\n- Make time for recovery",
    );
  await guide.shot("filled", "Journal: completed Markdown form and responsive Save actions");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
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
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
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
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Delete this entry?", exact: true }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(DARK_CLASS);
  await guide.shot("light", "Account: Light appearance selected");
  await guide.open("/today", "Today");
  await guide.shot("today", "Today: Light appearance persists across navigation");
  await guide.open("/me/account", "Me");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(DARK_CLASS);
  await guide.shot("dark", "Account: Dark appearance restored");
  guide.check(
    "The real theme control changed the document appearance and persisted across navigation",
  );
}
