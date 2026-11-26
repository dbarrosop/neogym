import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type BrowserContext, expect, type Page, type Request } from "@playwright/test";
import { LOCAL_GRAPHQL } from "./backend";

export interface ScreenshotRecord {
  id: string;
  title: string;
  file: string;
  workflow: string;
  capturedAt: string;
  width: number;
  height: number;
  sha256: string;
  captureProfile: Record<string, unknown>;
  source: { revision: string; dirty: boolean };
}

export interface WorkflowRecord {
  id: string;
  title: string;
  status: "passed" | "failed";
  steps: string[];
  checks: string[];
  verifiedAt?: string;
  source?: ScreenshotRecord["source"];
}

export interface Manifest {
  schemaVersion: number;
  platform: string;
  lastRun?: {
    status: "passed" | "failed";
    group: string;
    profile: string;
    startedAt: string;
    finishedAt?: string;
  };
  captureProfile: Record<string, unknown>;
  screenshots: ScreenshotRecord[];
  workflows: WorkflowRecord[];
  knownIssues: { id: string; description: string; screenshots: string[] }[];
}

export function upsert<T extends { id: string }>(records: T[], record: T): void {
  const index = records.findIndex((item) => item.id === record.id);
  if (index < 0) {
    records.push(record);
  } else {
    records[index] = record;
  }
}

export async function saveManifest(output: string, manifest: Manifest): Promise<void> {
  const { rename } = await import("node:fs/promises");
  const path = resolve(output, "capture-manifest.json");
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  const existing = await readFile(path, "utf8").catch(() => null);
  if (existing !== content) {
    await writeFile(`${path}.tmp`, content);
    await rename(`${path}.tmp`, path);
  }
}

export async function guardNetwork(context: BrowserContext, origin: string): Promise<string[]> {
  const unexpected: string[] = [];
  const font = await readFile(
    new URL(
      "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      import.meta.url,
    ),
  );
  const css = `@font-face {font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2')}`;
  const allowed = new Set([
    origin,
    "https://local.auth.local.nhost.run",
    "https://local.graphql.local.nhost.run",
    "https://local.storage.local.nhost.run",
  ]);
  await context.route("**/*", async (route) => {
    let url: URL;
    try {
      url = new URL(route.request().url());
    } catch {
      unexpected.push("invalid request URL");
      await route.abort();
      return;
    }
    if (url.hostname === "fonts.googleapis.com") {
      await route.fulfill({ contentType: "text/css", body: css });
    } else if (allowed.has(url.origin)) {
      await route.continue();
    } else if (url.hostname === "gravatar.com" || url.hostname.endsWith(".gravatar.com")) {
      // The real UI's avatar fallback, not a substituted screenshot/avatar.
      await route.abort();
    } else {
      unexpected.push(url.origin); // Never retain query strings or request bodies.
      await route.abort();
    }
  });
  return unexpected;
}

const ERROR_ALERT = /failed|couldn't|error/i;
const PATH_UUID = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi;

export function recordedPath(path: string) {
  return path.replace(PATH_UUID, ":fixture-id");
}

function isGraphQL(url: string): boolean {
  return url === LOCAL_GRAPHQL || url === `${LOCAL_GRAPHQL}/graphql`;
}

export class GalleryDriver {
  private current: WorkflowRecord | undefined;
  private readonly pending = new Set<Request>();
  private readonly failures: string[] = [];

  constructor(
    readonly page: Page,
    readonly profile: string,
    private readonly origin: string,
    private readonly output: string,
    private readonly manifest: Manifest,
    private readonly source: ScreenshotRecord["source"],
    private readonly unexpected: string[],
  ) {
    page.on("pageerror", () => this.failures.push("Browser JavaScript error"));
    page.on("request", (request) => {
      if (isGraphQL(request.url())) {
        this.pending.add(request);
      }
    });
    page.on("requestfailed", (request) => {
      this.pending.delete(request);
      if (isGraphQL(request.url()) && request.failure()?.errorText !== "net::ERR_ABORTED") {
        this.failures.push("GraphQL transport failed");
      }
    });
    page.on("response", (response) => {
      if (!isGraphQL(response.url())) {
        return;
      }
      const request = response.request();
      void response
        .json()
        .then((body: { errors?: { message: string }[] }) => {
          if (!response.ok() || (body.errors?.length ?? 0) > 0) {
            this.failures.push(
              `GraphQL response failed: ${body.errors?.map((error) => error.message).join("; ") ?? response.status()}`,
            );
          }
        })
        .catch(() => this.failures.push("GraphQL response unreadable"))
        .finally(() => this.pending.delete(request));
    });
  }

  step(text: string): void {
    this.current?.steps.push(text);
  }

  check(text: string): void {
    this.current?.checks.push(text);
  }

  async open(path: string, heading?: string): Promise<void> {
    this.step(`Open ${recordedPath(path)}`);
    await this.page.goto(`${this.origin}${path}`);
    if (heading) {
      await expect(
        this.page.getByRole("heading", { name: heading, exact: true }).first(),
      ).toBeVisible();
    }
    await this.settle();
  }

  async settle(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    if (this.failures.length > 0 || this.unexpected.length > 0) {
      throw new Error(
        `Capture stopped: ${this.failures.join("; ")}; blocked origins: ${this.unexpected.join(", ")}`,
      );
    }
    await expect(this.page.locator(".animate-pulse.bg-muted")).toHaveCount(0);
    await expect.poll(() => this.pending.size).toBe(0);
    await this.page.evaluate(() => document.fonts.ready);
    if (this.failures.length > 0 || this.unexpected.length > 0) {
      throw new Error("Capture stopped: browser, GraphQL or unexpected-network failure");
    }
    await expect(this.page.getByRole("alert").filter({ hasText: ERROR_ALERT })).toHaveCount(0);
  }

  async shot(name: string, title: string): Promise<void> {
    if (!this.current) {
      throw new Error("A screenshot requires a recorded workflow");
    }
    await this.settle();
    // Do not accidentally capture a chart hover or a network-timed success toast.
    await this.page.mouse.move(0, 0);
    await expect(this.page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 12_000 });
    // Wait for identical consecutive rendered frames, not a guessed render delay.
    let previous = "";
    let png: Buffer = Buffer.alloc(0);
    await expect
      .poll(
        async () => {
          png = await this.page.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
          const hash = createHash("sha256").update(png).digest("hex");
          const stable = hash === previous;
          previous = hash;
          return stable;
        },
        { timeout: 15_000, intervals: [150, 250, 500] },
      )
      .toBe(true);
    const id = `${this.current.id}-${name}`;
    const file = `screenshots/${id}.png`;
    const prior = this.manifest.screenshots.find((item) => item.id === id);
    const record: ScreenshotRecord = {
      id,
      title,
      file,
      workflow: this.current.id,
      capturedAt: new Date().toISOString(),
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
      sha256: previous,
      captureProfile: this.manifest.captureProfile,
      source: this.source,
    };
    if (
      prior?.sha256 === record.sha256 &&
      JSON.stringify(prior.captureProfile) === JSON.stringify(record.captureProfile)
    ) {
      record.capturedAt = prior.capturedAt;
      record.source = prior.source;
    }
    const destination = resolve(this.output, file);
    const saved = await readFile(destination).catch(() => null);
    if (!saved?.equals(png)) {
      await writeFile(destination, png);
    }
    upsert(this.manifest.screenshots, record);
    await saveManifest(this.output, this.manifest);
    process.stdout.write(`CAPTURED ${id}\n`);
  }

  async run<T>(id: string, title: string, action: () => Promise<T>): Promise<T> {
    this.current = {
      id: `${this.profile}-${id}`,
      title: `${title} · ${this.profile}`,
      status: "failed",
      steps: [],
      checks: [],
      source: this.source,
    };
    const workflowId = this.current.id;
    const prior = this.manifest.workflows.find((record) => record.id === workflowId);
    const frames = () =>
      JSON.stringify(this.manifest.screenshots.filter((frame) => frame.workflow === workflowId));
    const before = frames();
    upsert(this.manifest.workflows, this.current);
    await saveManifest(this.output, this.manifest);
    try {
      const result = await action();
      await this.settle();
      this.current.status = "passed";
      this.current.verifiedAt = new Date().toISOString();
      if (
        prior?.status === "passed" &&
        prior.title === this.current.title &&
        JSON.stringify(prior.steps) === JSON.stringify(this.current.steps) &&
        JSON.stringify(prior.checks) === JSON.stringify(this.current.checks) &&
        before === frames()
      ) {
        upsert(this.manifest.workflows, prior);
      }
      return result;
    } catch (error) {
      const diagnostics = resolve(this.output, "..", "web-gallery-diagnostics");
      await mkdir(diagnostics, { recursive: true });
      await this.page
        .screenshot({ path: resolve(diagnostics, `${this.current.id}.png`) })
        .catch(() => undefined);
      throw error;
    } finally {
      await saveManifest(this.output, this.manifest);
      this.current = undefined;
    }
  }
}
