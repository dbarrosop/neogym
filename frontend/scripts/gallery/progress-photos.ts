import { expect, type Locator, type Page } from "@playwright/test";
import type { CaptureBackend } from "./backend";
import type { GalleryDriver } from "./driver";
import { dateBefore } from "./fixtures";

const GALLERY = "/progress/body/photos";
const FRONT_PHOTO = /^Front A progress photo,/;
const BACK_PHOTO = /^Back B progress photo,/;
export const CHECK_PHOTOS = `query GalleryCheckProgressPhotos {
  progressPhotos(order_by: [{takenOn: desc}, {createdAt: desc}, {id: desc}]) {
    id takenOn labelValue file { id isUploaded }
  }
}`;

type Photo = {
  id: string;
  takenOn: string;
  labelValue: string;
  file: { id: string; isUploaded: boolean } | null;
};

async function photos(backend: CaptureBackend): Promise<Photo[]> {
  return (await backend.query<{ progressPhotos: Photo[] }>(CHECK_PHOTOS)).progressPhotos;
}

// Deliberately illustrated: no photo of a person, remote asset, or local file is read.
async function illustration(page: Page, alternate: boolean) {
  const colors = alternate ? ["#d5ae7c", "#57443a", "#dbaf8b"] : ["#9abfd5", "#263e53", "#c58262"];
  const png = await page.evaluate(async ([wall, top, skin]) => {
    const art = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600">
      <rect width="480" height="600" fill="${wall}"/>
      <path fill="#f3e9db" opacity=".6" d="M24 30h158v312H24z"/>
      <path fill="none" stroke="${wall}" stroke-width="6" d="M104 30v312M24 132h158m-158 108h158"/>
      <path fill="#273344" opacity=".24" d="M0 471h480v129H0z"/>
      <path fill="none" stroke="#f5e9db" opacity=".62" stroke-width="3" d="M0 515h480M0 556h480"/>
      <rect x="352" y="100" width="80" height="98" rx="4" fill="#f3e9db" stroke="#273344" stroke-width="4"/>
      <circle cx="400" cy="127" r="12" fill="${wall}"/>
      <path d="m359 184 28-44 35 44Z" fill="${top}" opacity=".76"/>
      <ellipse cx="247" cy="560" rx="105" ry="13" fill="#273344" opacity=".16"/>
      <path fill="none" stroke="${skin}" stroke-linecap="round" stroke-width="25" d="M199 219q-22 55-30 119m116-119q22 55 30 119M215 392l-8 128m59-128 12 128"/>
      <path fill="${skin}" d="M222 163h36v49h-36z"/>
      <ellipse cx="240" cy="138" rx="35" ry="43" fill="${skin}"/>
      <path fill="#302933" d="M205 140c-9-32 15-51 35-49 25 0 42 14 35 46l-12-25-48 7Z"/>
      <path fill="${top}" d="M207 188q33 16 67 0l29 30-28 18-3 82h-65l-2-82-28-18Z"/>
      <path fill="#273344" d="M206 313h68l18 94h-43l-9-39-9 39h-43Z"/>
      <path fill="#f5e9db" d="M192 514h28v23h-28zm72 0h29v23h-29z"/>
      <path fill="#273344" d="M190 533h32v23h-57c-4-13 7-16 25-23zm74 0h31c18 7 30 10 26 23h-57z"/>
    </svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(art)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not draw the synthetic photo input");
    }
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, colors);
  return {
    name: alternate ? "illustration-2.png" : "illustration-1.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  };
}

async function decoded(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
}

async function upload(guide: GalleryDriver, date: string, alternate = false) {
  const { page } = guide;
  await page.getByRole("link", { name: "Add photo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add progress photo", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Photo file", { exact: true })
    .setInputFiles(await illustration(page, alternate));
  await page.getByLabel("Label", { exact: true }).selectOption("front_a");
  const dateInput = page.getByLabel("Date taken", { exact: true });
  await dateInput.fill(date);
  await dateInput.blur();
  const preview = page.getByRole("img", { name: "Preview for upload" });
  await decoded(preview);
  if (!alternate) {
    await guide.shot(
      "prepared",
      "Add photo: preview a generated illustration and choose an earlier date",
    );
  }
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Progress photo", exact: true })).toBeVisible();
  await decoded(page.getByRole("img", { name: FRONT_PHOTO }));
  const id = page.url().split("/").at(-1);
  if (!id) {
    throw new Error("Photo viewer did not open an uploaded photo");
  }
  return id;
}

function cards(page: Page) {
  return page.getByRole("list", { name: "Progress photos", exact: true }).getByRole("link");
}

export async function captureProgressPhotos(
  guide: GalleryDriver,
  backend: CaptureBackend,
  today: string,
) {
  // The driver already confirmed the reserved account identity at sign-in. If it is
  // not empty, do not treat any prior photo as ours to display, edit, or delete.
  expect(await photos(backend)).toEqual([]);
  try {
    await walkthrough(guide, backend, today);
  } finally {
    // Delete only file IDs from this workflow's previously empty owner scope. An
    // upload that never initialized its file is left to normal reservation expiry.
    const remaining = await photos(backend);
    await Promise.all(
      remaining.flatMap(({ file }) => (file ? [backend.removeFixturePhoto(file.id)] : [])),
    );
    expect((await photos(backend)).filter(({ file }) => file !== null)).toEqual([]);
  }
  guide.check("The runner removed the remaining synthetic upload through Storage after capture");
}

async function walkthrough(guide: GalleryDriver, backend: CaptureBackend, today: string) {
  const { page } = guide;
  const originalDate = dateBefore(today, 7);
  const editedDate = dateBefore(today, 3);
  const gallery = page.getByRole("heading", { name: "Progress photos", exact: true });
  const filter = page.getByLabel("Filter by label", { exact: true });
  await guide.open("/progress/body", "Progress");
  guide.step("Open the photo summary card on Body and go to the empty history");
  const summary = page.getByRole("region", { name: "Progress photos", exact: true });
  await expect(summary.getByText("No photos yet", { exact: true })).toBeVisible();
  await summary.getByRole("link", { name: "View progress photos" }).click();
  await expect(gallery).toBeVisible();
  await expect(page.getByText("No progress photos yet", { exact: true })).toBeVisible();
  await guide.shot("empty", "Progress photos: empty private history and the Add photo action");

  guide.step("Choose a synthetic PNG, select Front A, backdate it and upload");
  const first = await upload(guide, originalDate);
  expect(first).toBeTruthy();
  await guide.shot(
    "viewer",
    "Photo viewer: the uploaded illustration with its label and date taken",
  );
  await page.goBack();
  await expect(gallery).toBeVisible();
  guide.step(
    "Upload a second illustration with the same date and label, then return to the gallery",
  );
  const second = await upload(guide, originalDate, true);
  expect(second).toBeTruthy();
  expect(second).not.toBe(first);
  await page.goBack();
  await expect(gallery).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await decoded(cards(page).nth(0).locator("img"));
  await decoded(cards(page).nth(1).locator("img"));
  const timeline = page.getByRole("list", { name: "Progress photos", exact: true });
  await expect(timeline.locator("h2 time")).toHaveCount(1);
  await guide.shot("duplicates", "Timeline: two distinct uploads on a single date row");
  expect(await photos(backend)).toEqual(
    [second, first].map((id) => ({
      id,
      takenOn: originalDate,
      labelValue: "front_a",
      file: { id, isUploaded: true },
    })),
  );
  guide.check(
    "A fresh backend read contains two distinct ready files with the same backdated Front A label; Back returns to the gallery, not the spent upload form",
  );

  guide.step("Open the newer photo; edit its date and label without choosing a new image");
  await cards(page).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `${GALLERY}/${second}`);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).selectOption("back_b");
  const dateInput = page.getByLabel("Date taken", { exact: true });
  await dateInput.fill(editedDate);
  await dateInput.blur();
  await guide.shot("edit", "Edit photo: correct the date and label without replacing the image");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await decoded(page.getByRole("img", { name: BACK_PHOTO }));
  expect((await photos(backend))[0]).toEqual({
    id: second,
    takenOn: editedDate,
    labelValue: "back_b",
    file: { id: second, isUploaded: true },
  });

  guide.step("Check that the edited photo moves to the newest date row, then filter by Back B");
  await page.goBack();
  await expect(gallery).toBeVisible();
  const dates = timeline.locator("h2 time");
  await expect(dates).toHaveCount(2);
  await expect(dates.nth(0)).toHaveAttribute("datetime", editedDate);
  await expect(dates.nth(1)).toHaveAttribute("datetime", originalDate);
  await decoded(cards(page).nth(0).locator("img"));
  await decoded(cards(page).nth(1).locator("img"));
  await guide.shot("timeline", "Timeline: newest date first, with one row per photo date");
  await filter.selectOption("back_b");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute("href", `${GALLERY}/${second}`);
  await decoded(cards(page).first().locator("img"));
  await guide.shot("filtered", "Gallery: the Back B filter shows only the corrected photo");
  guide.check(
    "The edit changed only the date and label, retaining the same file ID; the Back B filter shows only that photo",
  );

  guide.step("Open the filtered photo, edit it, and confirm Delete photo");
  await cards(page).first().click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Delete photo", exact: true }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this progress photo?",
    exact: true,
  });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await guide.shot(
    "confirm",
    "Delete photo: explicit confirmation before removing the selected image",
  );
  await dialog.getByRole("button", { name: "Delete photo", exact: true }).click();
  await expect(gallery).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute("href", `${GALLERY}/${first}`);
  await decoded(cards(page).first().locator("img"));
  await guide.shot("deleted", "Gallery: the other Front A photo remains after deletion");
  expect((await photos(backend)).map(({ id }) => id)).toEqual([first]);
  guide.step("Return to Body and confirm its photo count and latest date");
  await guide.open("/progress/body", "Progress");
  await expect(summary.getByText("1 photo", { exact: true })).toBeVisible();
  await expect(summary.locator("time")).toHaveAttribute("datetime", originalDate);
  guide.check("Body shows one ready photo and its date after the deletion");
  guide.check(
    "A fresh backend read confirms that the deleted photo is inaccessible and the other photo remains",
  );
}
