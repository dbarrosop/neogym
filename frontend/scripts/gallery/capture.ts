import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
import { CaptureBackend, captureOrigin, LOCAL_AUTH, readOTP } from "./backend";
import catalog from "./catalog.json";
import { GalleryDriver, guardNetwork, type Manifest, saveManifest } from "./driver";
import { seedFixtures } from "./fixtures";
import {
  captureAppearance,
  captureJournal,
  capturePlanLog,
  captureRoots,
  captureSession,
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

async function authenticate(page: Page, localRequest: APIRequestContext): Promise<string> {
  // New disposable account on every profile run; never reuse a developer session.
  const email = `gallery-${randomUUID()}@example.com`;
  await page.getByLabel("Display name").fill("Alex Morgan - Gallery");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const sending = page.waitForResponse(`${LOCAL_AUTH}/signup/otp/email`);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  const sent = await sending;
  if (!sent.ok()) {
    throw new Error(`Local OTP signup returned HTTP ${sent.status()}`);
  }
  await expect(page.getByRole("heading", { name: "Enter your code", exact: true })).toBeVisible();
  const code = await readOTP(localRequest, email);
  const verification = page.waitForResponse((response) =>
    response.url().startsWith(`${LOCAL_AUTH}/signin/otp/email/verify`),
  );
  await page.locator("input[autocomplete='one-time-code']").fill(code);
  const response = await verification;
  if (!response.ok()) {
    throw new Error(`Local OTP verification returned HTTP ${response.status()}`);
  }
  const body = (await response.json()) as { session?: { accessToken: string } };
  if (!body.session?.accessToken) {
    throw new Error("Local OTP verification returned no session");
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
) {
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
    if (options.group === "all" || options.group === "public-auth") {
      await guide.run("public-auth", "Inspect public sign-in and sign-up", async () => {
        await guide.open("/signin", "Welcome back");
        await guide.shot("signin", "Public sign-in: email OTP request");
        await page.getByRole("link", { name: "Create an account", exact: true }).click();
        await expect(page.getByLabel("Display name")).toBeVisible();
        await guide.shot("signup", "Public sign-up: display name and email");
        guide.check(
          "Public authentication screens render; screenshots contain no OTP or credentials",
        );
      });
    } else {
      await guide.open("/signup");
    }
    // Authentication is real, but not recorded as proof of cloud/email delivery.
    const token = await authenticate(page, localRequest);
    const backend = new CaptureBackend(localRequest, token);
    const ids = await seedFixtures(backend, String(manifest.captureProfile["fixtureDate"]));
    if (options.group === "all" || options.group === "roots") {
      await captureRoots(guide);
    }
    const actions: Record<string, () => Promise<void>> = {
      session: () => captureSession(guide, backend, ids),
      "plan-log": () => capturePlanLog(guide, backend, ids),
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
      "gallery:capture [--origin http://localhost:5173] [--output DIR] [--profile all|desktop|mobile] [--group all|roots|public-auth|session|plan-log|journal-crud|appearance]\n",
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
  const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  // TLS bypass is confined to a tooling request context with hard-coded local
  // backend URLs. Browser requests are separately allowlisted before navigation.
  const localRequest = await request.newContext({ ignoreHTTPSErrors: true, timeout: 30_000 });
  try {
    const manifest = await loadManifest(options.output, {
      version: 1,
      fixtureVersion: 1,
      fixtureDate: new Date().toISOString().slice(0, 10),
      clock: "Real browser/Auth/server clocks; fictional history is relative to fixtureDate",
      browser: browser.version(),
      origin: options.origin,
      playwright: packageJSON.devDependencies["@playwright/test"],
      platform: process.platform,
      font: `@fontsource-variable/inter@${packageJSON.devDependencies["@fontsource-variable/inter"]}`,
      locale: "en-US",
      timeZone: "UTC",
      deviceScaleFactor: 1,
      viewports: VIEWPORTS,
    });
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
        await captureProfile(browser, localRequest, options, profile, manifest);
      }, Promise.resolve());
    manifest.lastRun.status = "passed";
    manifest.lastRun.finishedAt = new Date().toISOString();
    await saveManifest(options.output, manifest);
    process.stdout.write(
      `CAPTURE COMPLETE ${options.output}; validate and render before publishing\n`,
    );
  } finally {
    await localRequest.dispose();
    await browser.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Gallery capture failed");
    process.exitCode = 1;
  });
}
