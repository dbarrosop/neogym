import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  type APIRequestContext,
  type Browser,
  chromium,
  expect,
  type Page,
  request,
} from "@playwright/test";
import packageJSON from "../../package.json";
import { CaptureBackend, captureOrigin, galleryMail, LOCAL_AUTH, readOTP } from "./backend";
import catalog from "./catalog.json";
import { GalleryDriver, guardNetwork, type Manifest, saveManifest } from "./driver";
import { seedFixtures } from "./fixtures";
import fixture from "./profile.json";
import { galleryDate, galleryPostgres, lockGallery, seedGalleryAccount } from "./seed";
import {
  captureAppearance,
  captureExerciseDetail,
  captureJournal,
  captureMealEdit,
  capturePlanEdit,
  capturePlanLog,
  captureProgressCalories,
  captureRoots,
  captureSession,
  captureTodaySummary,
} from "./workflows";

const REPO = resolve(import.meta.dir, "../../..");
export const VIEWPORTS = catalog.profiles;

const OPTIONS = {
  origin: { type: "string", default: "http://localhost:5173" },
  output: { type: "string", default: resolve(REPO, ".nhost-code/tmp/web-gallery") },
  group: { type: "string", default: "all" },
  profile: { type: "string", default: "all" },
  help: { type: "boolean", default: false },
} as const;

async function authenticate(
  page: Page,
  localRequest: APIRequestContext,
  record?: GalleryDriver,
): Promise<string> {
  const { email } = fixture.account;
  const previous = new Set((await galleryMail(localRequest, email)).map((message) => message.ID));
  await page.getByLabel("Email", { exact: true }).fill(email);
  const sending = page.waitForResponse(`${LOCAL_AUTH}/signin/otp/email`);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  const sent = await sending;
  if (!sent.ok()) {
    throw new Error(`Local OTP sign-in returned HTTP ${sent.status()}`);
  }
  const input = page.getByRole("textbox", { name: "Verification code", exact: true });
  await expect(input).toHaveValue("");
  if (record) {
    record.step("Return to sign-in and request a code for the seeded local account");
    await expect(page.getByRole("button", { name: "Change email", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeDisabled();
    await expect(page.getByText("Resend in", { exact: false })).toBeVisible();
    await record.shot("code", "Sign-in: empty verification code with Change and resend countdown");
    record.step("Enter the code from local MailHog; the last digit submits automatically");
  }
  const code = await readOTP(localRequest, email, previous);
  const verification = page.waitForResponse((response) =>
    response.url().startsWith(`${LOCAL_AUTH}/signin/otp/email/verify`),
  );
  await input.fill(code);
  const response = await verification;
  if (!response.ok()) {
    throw new Error(`Local OTP verification returned HTTP ${response.status()}`);
  }
  const body = (await response.json()) as {
    session?: { accessToken: string; user?: { id: string } };
  };
  if (!body.session?.accessToken || body.session.user?.id !== fixture.account.id) {
    throw new Error("Local OTP verification did not return the reserved fixture session");
  }
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  return body.session.accessToken;
}

async function loadManifest(
  output: string,
  captureProfile: Manifest["captureProfile"],
): Promise<Manifest> {
  await mkdir(resolve(output, "screenshots"), { recursive: true });
  let existing: string;
  try {
    existing = await readFile(resolve(output, "capture-manifest.json"), "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
    return {
      schemaVersion: 1,
      platform: "web",
      captureProfile,
      screenshots: [],
      workflows: [],
      knownIssues: [],
    };
  }
  let manifest: Manifest;
  try {
    manifest = JSON.parse(existing) as Manifest;
  } catch {
    throw new Error("The scratch gallery manifest is invalid JSON; use a new output directory");
  }
  if (
    manifest.platform !== "web" ||
    JSON.stringify(manifest.captureProfile) !== JSON.stringify(captureProfile)
  ) {
    throw new Error(
      "Capture profile changed. Use a new scratch output and review a complete baseline; do not mix catalogs.",
    );
  }
  return manifest;
}

function sourceState() {
  return {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim(),
    dirty:
      execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).trim() !== "",
  };
}

interface RunOptions {
  origin: string;
  output: string;
  group: string;
  profile: string;
}

async function captureProfile(
  browser: Browser,
  localRequest: APIRequestContext,
  options: RunOptions,
  profile: keyof typeof VIEWPORTS,
  manifest: Manifest,
  database: string,
) {
  seedGalleryAccount(database);
  const context = await browser.newContext({
    viewport: VIEWPORTS[profile],
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    ignoreHTTPSErrors: true,
    isMobile: profile === "mobile",
    hasTouch: profile === "mobile",
  });
  try {
    const unexpected = await guardNetwork(context, options.origin);
    const page = await context.newPage();
    // Freeze Date, but keep timers, animation frames and requests running. Auth,
    // MailHog, and PostgreSQL still see real time outside this browser context.
    await page.clock.setFixedTime(new Date(fixture.now));
    page.setDefaultTimeout(20_000);
    const guide = new GalleryDriver(
      page,
      profile,
      options.origin,
      options.output,
      manifest,
      sourceState(),
      unexpected,
    );
    let token: string;
    if (options.group === "all" || options.group === "public-auth") {
      const auth = catalog.workflows.find(({ id }) => id === "public-auth");
      if (!auth) {
        throw new Error("Missing public authentication workflow");
      }
      token = await guide.run(auth.id, auth.title, async () => {
        await guide.open("/signin", "Welcome back");
        await guide.shot("signin", "Public sign-in: email OTP request");
        await page.getByRole("link", { name: "Create an account", exact: true }).click();
        await expect(page.getByLabel("Display name")).toBeVisible();
        await guide.shot("signup", "Public sign-up: display name and email");
        await page.getByRole("link", { name: "Sign in", exact: true }).click();
        const accessToken = await authenticate(page, localRequest, guide);
        guide.check("The empty code step showed Change, disabled Verify and a resend countdown");
        guide.check(
          "Local verification succeeded and the app opened Today without pressing Verify",
        );
        return accessToken;
      });
      if (options.group === "public-auth") {
        return;
      }
    } else {
      await guide.open("/signin", "Welcome back");
      token = await authenticate(page, localRequest);
    }
    const backend = new CaptureBackend(localRequest, token);
    const ids = await seedFixtures(backend, galleryDate);
    if (options.group === "all" || options.group === "roots") {
      await captureRoots(guide);
    }
    const actions: Record<string, () => Promise<void>> = {
      "today-summary": () => captureTodaySummary(guide),
      session: () => captureSession(guide, backend, ids),
      "exercise-detail": () => captureExerciseDetail(guide, ids),
      "plan-log": () => capturePlanLog(guide, backend, ids),
      "plan-edit": () => capturePlanEdit(guide, backend, ids),
      "meal-edit": () => captureMealEdit(guide, backend, ids),
      "progress-calories": () => captureProgressCalories(guide),
      "journal-crud": () => captureJournal(guide, backend),
      appearance: () => captureAppearance(guide),
    };
    await catalog.workflows
      .filter(
        (workflow) =>
          workflow.id in actions && (options.group === "all" || options.group === workflow.id),
      )
      .reduce(async (previous, workflow) => {
        await previous;
        const action = actions[workflow.id];
        if (action) {
          await guide.run(workflow.id, workflow.title, action);
        }
      }, Promise.resolve());
  } finally {
    await context.close();
  }
}

export async function main() {
  const { values } = parseArgs({ options: OPTIONS, strict: true });
  if (values.help) {
    process.stdout.write(
      `gallery:capture [--origin http://localhost:5173] [--output DIR] [--profile all|desktop|mobile] [--group all|roots|${catalog.workflows.map(({ id }) => id).join("|")}]\n`,
    );
    return;
  }
  const options: RunOptions = {
    origin: captureOrigin(values.origin),
    output: resolve(values.output),
    group: values.group,
    profile: values.profile,
  };
  const groups = new Set(["all", "roots", ...catalog.workflows.map((workflow) => workflow.id)]);
  if (!groups.has(options.group) || !["all", ...Object.keys(VIEWPORTS)].includes(options.profile)) {
    throw new Error("Unknown gallery group or profile; use --help");
  }
  const unlock = await lockGallery(REPO);
  try {
    await runCapture(options, galleryPostgres(REPO));
  } finally {
    await unlock();
  }
}

async function runCapture(options: RunOptions, database: string) {
  const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
  // Full software raster avoids incremental/GPU antialiasing differences at card corners.
  const browser = await chromium.launch({
    args: fixture.rasterArgs,
    ...(executablePath ? { executablePath } : {}),
  });
  // TLS bypass is confined to a tooling request context with hard-coded local
  // backend URLs. Browser requests are separately allowlisted before navigation.
  const localRequest = await request.newContext({ ignoreHTTPSErrors: true, timeout: 30_000 });
  try {
    const manifest = await loadManifest(options.output, {
      version: fixture.version,
      fixtureVersion: fixture.fixtureVersion,
      fixtureDate: galleryDate,
      fixedBrowserTime: fixture.now,
      clock: "Fixed browser Date; real Auth, database, timers, and capture provenance clocks",
      browser: browser.version(),
      rasterArgs: fixture.rasterArgs,
      origin: options.origin,
      playwright: packageJSON.devDependencies["@playwright/test"],
      platform: process.platform,
      font: `@fontsource-variable/inter@${packageJSON.devDependencies["@fontsource-variable/inter"]}`,
      locale: "en-US",
      timeZone: "UTC",
      deviceScaleFactor: 1,
      viewports: VIEWPORTS,
    });
    const previousRun = manifest.lastRun;
    const previousEvidence = evidence(manifest);
    manifest.lastRun = {
      status: "failed",
      group: options.group,
      profile: options.profile,
      startedAt: new Date().toISOString(),
    };
    await saveManifest(options.output, manifest);
    await (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[])
      .filter((profile) => options.profile === "all" || options.profile === profile)
      .reduce(async (previous, profile) => {
        await previous;
        await captureProfile(browser, localRequest, options, profile, manifest, database);
      }, Promise.resolve());
    if (previousRun?.status === "passed" && previousEvidence === evidence(manifest)) {
      manifest.lastRun = previousRun;
    } else {
      manifest.lastRun.status = "passed";
      manifest.lastRun.finishedAt = new Date().toISOString();
    }
    await saveManifest(options.output, manifest);
    process.stdout.write(
      `CAPTURE COMPLETE ${options.output}; validate and render before publishing\n`,
    );
  } finally {
    await localRequest.dispose();
    await browser.close();
  }
}

function evidence(manifest: Manifest) {
  return JSON.stringify([manifest.screenshots, manifest.workflows, manifest.knownIssues]);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Gallery capture failed");
    process.exitCode = 1;
  });
}
