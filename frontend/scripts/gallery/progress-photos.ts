import { expect, type Locator, type Page } from "@playwright/test";
import type { CaptureBackend } from "./backend";
import type { GalleryDriver } from "./driver";
import { dateBefore } from "./fixtures";

const GALLERY = "/progress/body/photos";
const FRONT_PHOTO = /^Front A progress photo,/;
// Sheet and filtered tiles are named "<label>, <date>"; Add slots "Add <label> photo for …".
const FRONT_TILE = /^Front A, /;
const BACK_TILE = /^Back A, /;
const ADD_BACK_SLOT = /^Add Back A photo for /;
const ADD_FRONT_SLOT = /^Add Front A photo for /;
const A_TILE = /^(Front|Back) A, /;
const OLDER = /^Older/;
const NEWER = /^Newer/;
const FRONT_BEFORE = /^Front A before, /;
const FRONT_AFTER = /^Front A after, /;
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

/** Add photos on one date, one generated illustration per label, from the gallery. */
async function checkIn(
  guide: GalleryDriver,
  date: string,
  slots: [label: string, alternate: boolean][],
  shot = false,
) {
  const { page } = guide;
  await page.getByRole("link", { name: "Add photos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add progress photos", exact: true }),
  ).toBeVisible();
  const dateInput = page.getByLabel("Date taken", { exact: true });
  await dateInput.fill(date);
  await dateInput.blur();
  for (const [label, alternate] of slots) {
    // biome-ignore lint/performance/noAwaitInLoops: each slot prepares its own photo.
    await page
      .getByLabel(`${label} photo`, { exact: true })
      .setInputFiles(await illustration(page, alternate));
  }
  const previews = page.locator("form label img");
  await expect(previews).toHaveCount(slots.length);
  for (const index of slots.keys()) {
    // biome-ignore lint/performance/noAwaitInLoops: wait for every preview to decode.
    await decoded(previews.nth(index));
  }
  if (shot) {
    await guide.shot(
      "prepared",
      "Add photos: one date, with a generated illustration in the Front A and Back A slots",
    );
  }
  const submit = slots.length === 1 ? "Upload photo" : `Upload ${slots.length} photos`;
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Progress photos", exact: true })).toBeVisible();
}

function sheet(page: Page) {
  return page.getByRole("list", { name: "Progress photos", exact: true });
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
  const firstDate = dateBefore(today, 7);
  const secondDate = dateBefore(today, 3);
  const correctedDate = dateBefore(today, 2);
  const gallery = page.getByRole("heading", { name: "Progress photos", exact: true });
  await guide.open("/progress/body", "Progress");
  guide.step("Open the photo card on Body and go to the empty history");
  const summary = page.getByRole("region", { name: "Progress photos", exact: true });
  await expect(summary.getByText("No photos yet", { exact: true })).toBeVisible();
  await summary.getByRole("link", { name: "View all progress photos", exact: true }).click();
  await expect(gallery).toBeVisible();
  await expect(page.getByText("No progress photos yet", { exact: true })).toBeVisible();
  await guide.shot("empty", "Progress photos: empty private history and the Add photos action");

  guide.step("Check in Front A and Back A illustrations on one earlier date");
  await checkIn(
    guide,
    firstDate,
    [
      ["Front A", false],
      ["Back A", true],
    ],
    true,
  );
  await expect(sheet(page).getByRole("link", { name: FRONT_TILE })).toHaveCount(1);
  await expect(sheet(page).getByRole("link", { name: BACK_TILE })).toHaveCount(1);
  guide.step("Check in a later Front A only");
  await checkIn(guide, secondDate, [["Front A", true]]);
  await expect(sheet(page).locator("h2 time")).toHaveCount(2);
  await expect(sheet(page).getByRole("link", { name: ADD_BACK_SLOT })).toHaveCount(1);
  const tiles = sheet(page).getByRole("link", { name: A_TILE });
  await expect(tiles).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    // biome-ignore lint/performance/noAwaitInLoops: every tile must be decoded before capture.
    await decoded(tiles.nth(index).locator("img"));
  }
  await guide.shot(
    "timeline",
    "Contact sheet: a row per date, labels in columns, and an Add slot for the missing Back A",
  );
  const uploaded = await photos(backend);
  const byKey = (label: string, date: string) =>
    uploaded.find((row) => row.labelValue === label && row.takenOn === date)?.id ?? "";
  const [newerFront, olderFront, back] = [
    byKey("front_a", secondDate),
    byKey("front_a", firstDate),
    byKey("back_a", firstDate),
  ];
  expect(uploaded).toHaveLength(3);
  expect(uploaded.every((row) => row.file?.isUploaded === true && row.file.id === row.id)).toBe(
    true,
  );
  expect([newerFront, olderFront, back].every(Boolean)).toBe(true);
  guide.check(
    "A fresh backend read has three ready files: Front A and Back A on the first date, Front A on the later one",
  );

  guide.step("Open the newer Front A, step to the older one and back");
  await sheet(page).getByRole("link", { name: FRONT_TILE }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `${GALLERY}/${newerFront}`);
  await expect(page.getByRole("heading", { name: "Front A", exact: true, level: 1 })).toBeVisible();
  await decoded(page.getByRole("img", { name: FRONT_PHOTO }));
  await expect(page.getByText("2 of 2", { exact: true })).toBeVisible();
  await guide.shot(
    "viewer",
    "Photo viewer: the label as title, then older and newer Front A photos",
  );
  await page.getByRole("link", { name: OLDER }).click();
  await expect(page).toHaveURL((url) => url.pathname === `${GALLERY}/${olderFront}`);
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: NEWER }).click();
  await expect(page).toHaveURL((url) => url.pathname === `${GALLERY}/${newerFront}`);

  guide.step("Correct the newer photo's date in the edit dialog");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit photo details", exact: true });
  const dialogDate = dialog.getByLabel("Date taken", { exact: true });
  await dialogDate.fill(correctedDate);
  await dialogDate.blur();
  await decoded(dialog.locator("img"));
  await guide.shot("edit", "Edit details: correct the date without replacing the image");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("header time").first()).toHaveAttribute("datetime", correctedDate);
  expect((await photos(backend)).find((row) => row.id === newerFront)).toEqual({
    id: newerFront,
    takenOn: correctedDate,
    labelValue: "front_a",
    file: { id: newerFront, isUploaded: true },
  });
  guide.check("The edit changed only the date, keeping the same file ID and label");

  guide.step("Compare the older and newer Front A photos");
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare photos", exact: true })).toBeVisible();
  await expect(page.getByLabel("Before", { exact: true })).toHaveValue(olderFront);
  await expect(page.getByLabel("After", { exact: true })).toHaveValue(newerFront);
  await decoded(page.getByRole("img", { name: FRONT_BEFORE }));
  await decoded(page.getByRole("img", { name: FRONT_AFTER }));
  await expect(page.getByText("Time between", { exact: true })).toBeVisible();
  await guide.shot(
    "compare",
    "Compare: older and newer Front A, with the time between and the body-weight change",
  );

  guide.step("Filter the gallery to Front A");
  await guide.open(GALLERY, "Progress photos");
  await page.getByRole("button", { name: "Front A", exact: true }).click();
  const frontOnly = page.getByRole("list", { name: "Front A photos", exact: true });
  await expect(frontOnly.getByRole("link")).toHaveCount(2);
  await decoded(frontOnly.getByRole("link").nth(0).locator("img"));
  await decoded(frontOnly.getByRole("link").nth(1).locator("img"));
  await guide.shot("filtered", "Gallery: the Front A filter shows that label over time");

  guide.step("Open the older Front A and confirm Delete photo");
  await frontOnly.getByRole("link").last().click();
  await expect(page).toHaveURL((url) => url.pathname === `${GALLERY}/${olderFront}`);
  // Let the viewer settle (its label history moves the layout) before opening the dialog.
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await decoded(page.getByRole("img", { name: FRONT_PHOTO }));
  await guide.settle();
  await page.getByRole("button", { name: "Delete photo", exact: true }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Delete this progress photo?",
    exact: true,
  });
  await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await guide.shot("confirm", "Delete photo: explicit confirmation before removing the image");
  await confirm.getByRole("button", { name: "Delete photo", exact: true }).click();
  await expect(gallery).toBeVisible();
  await expect(sheet(page).locator("h2 time")).toHaveCount(2);
  await expect(sheet(page).getByRole("link", { name: ADD_FRONT_SLOT })).toHaveCount(1);
  const remaining = sheet(page).getByRole("link", { name: A_TILE });
  await expect(remaining).toHaveCount(2);
  await decoded(remaining.nth(0).locator("img"));
  await decoded(remaining.nth(1).locator("img"));
  await guide.shot(
    "deleted",
    "Gallery: the first date keeps its Back A, with an Add slot where Front A was",
  );
  expect((await photos(backend)).map(({ id }) => id).sort()).toEqual([back, newerFront].sort());

  guide.step("Return to Body and check its photo card");
  await guide.open("/progress/body", "Progress");
  await expect(summary.getByText("2 photos", { exact: true })).toBeVisible();
  await expect(summary.locator("time")).toHaveAttribute("datetime", correctedDate);
  await decoded(summary.locator("img").first());
  guide.check("Body shows two ready photos, the latest date and that date's photo");
  guide.check(
    "A fresh backend read confirms that the deleted photo is inaccessible and the other two remain",
  );
}
