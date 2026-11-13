import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageJson from "../package.json";
import wrangler from "../wrangler.json";

describe("Cloudflare deployment", () => {
  test("uses the Nix-provided Wrangler, not a frontend package dependency", () => {
    expect(packageJson.dependencies).not.toHaveProperty("wrangler");
    expect(packageJson.devDependencies).not.toHaveProperty("wrangler");
  });

  test("publishes the unsuffixed neogym Worker through the existing dispatch namespace", () => {
    expect(wrangler.name).toBe("neogym");
    expect(packageJson.scripts.deploy).toBe("wrangler deploy --dispatch-namespace nhost-app");
    expect(wrangler.workers_dev).toBe(false);
    expect(wrangler.preview_urls).toBe(false);
    // Terraform owns DNS and the dispatcher route, not the user Worker deployment.
    expect(wrangler).not.toHaveProperty("route");
    expect(wrangler).not.toHaveProperty("routes");
  });

  test("builds and serves the existing static SPA, including deep links", () => {
    expect(wrangler.build.command).toBe(
      'rm -f .output/public/index.html .output/public/sw.js && bun run build && test -s .output/public/index.html && test -s .output/public/sw.js && bun build .output/public/sw.js --outfile /dev/null && grep -Eq \'(^|[,{])[[:space:]]*(url|"url")[[:space:]]*:[[:space:]]*"index\\.html"[[:space:]]*[,}]\' .output/public/sw.js',
    );
    expect(wrangler.assets.directory).toBe("./.output/public");
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
    // The Nitro Node server is not a Cloudflare Worker entry point.
    expect(wrangler).not.toHaveProperty("main");
  });

  test("offers a dry run of the same deployment without publishing", () => {
    expect(packageJson.scripts["deploy:dry-run"]).toBe(`${packageJson.scripts.deploy} --dry-run`);
  });

  test.each([
    { outcome: "complete-minified", accepted: true, shell: true, worker: true },
    { outcome: "complete-quoted", accepted: true, shell: true, worker: true },
    { outcome: "complete-formatted", accepted: true, shell: true, worker: true },
    { outcome: "missing", accepted: false, shell: false, worker: false },
    { outcome: "empty-shell", accepted: false, shell: true, worker: true },
    { outcome: "missing-shell", accepted: false, shell: false, worker: true },
    { outcome: "missing-sw", accepted: false, shell: true, worker: false },
    { outcome: "empty-sw", accepted: false, shell: true, worker: true },
    { outcome: "stale-sw", accepted: false, shell: true, worker: true },
    { outcome: "malformed-sw", accepted: false, shell: true, worker: true },
    { outcome: "wrong-shell-url", accepted: false, shell: true, worker: true },
    { outcome: "wrong-key", accepted: false, shell: true, worker: true },
    { outcome: "failed", accepted: false, shell: false, worker: false },
  ])("checks fresh deployment artifacts: $outcome", ({ outcome, accepted, shell, worker }) => {
    const root = mkdtempSync(join(tmpdir(), "neogym-cloudflare-"));
    try {
      mkdirSync(join(root, "bin"));
      mkdirSync(join(root, ".output/public"), { recursive: true });
      // Neither artifact from a previous successful build may hide a failed build.
      writeFileSync(join(root, ".output/public/index.html"), "stale shell");
      writeFileSync(
        join(root, ".output/public/sw.js"),
        'self.__WB_MANIFEST = [{url:"index.html",revision:"old"}];',
      );
      writeFileSync(
        join(root, "bin/bun"),
        `#!/bin/sh
set -eu
# Fake only the app build; use the real Bun CLI to syntax-check the worker.
if [ "$1" != run ]; then exec "$REAL_BUN" "$@"; fi
case "$BUILD_OUTCOME" in
  missing) exit 0 ;;
  failed) exit 7 ;;
  empty-shell) : > .output/public/index.html ;;
  missing-shell) ;;
  *) printf 'fresh shell' > .output/public/index.html ;;
esac
case "$BUILD_OUTCOME" in
  complete-quoted) printf 'self.__WB_MANIFEST = [{"url":"index.html","revision":"new"}];' > .output/public/sw.js ;;
  complete-formatted) printf 'self.__WB_MANIFEST = [{\n  "url" : "index.html",\n  "revision" : "new"\n}];' > .output/public/sw.js ;;
  missing-sw) ;;
  empty-sw) : > .output/public/sw.js ;;
  stale-sw) printf 'self.__WB_MANIFEST = [{url:"assets/app.js",revision:null}];' > .output/public/sw.js ;;
  malformed-sw) printf 'self.__WB_MANIFEST = [{url:"index.html",revision:"new"}]; broken (' > .output/public/sw.js ;;
  wrong-shell-url) printf 'self.__WB_MANIFEST = [{url:"index.html.bak",revision:"new"}];' > .output/public/sw.js ;;
  wrong-key) printf 'self.__WB_MANIFEST = [{otherurl:"index.html",revision:"new"}];' > .output/public/sw.js ;;
  *) printf 'self.__WB_MANIFEST = [{url:"index.html",revision:"new"}];' > .output/public/sw.js ;;
esac
`,
        { mode: 0o755 },
      );
      const result = Bun.spawnSync(["sh", "-c", wrangler.build.command], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${join(root, "bin")}:${process.env["PATH"]}`,
          REAL_BUN: process.execPath,
          BUILD_OUTCOME: outcome,
        },
      });
      expect(result.exitCode === 0).toBe(accepted);
      expect(existsSync(join(root, ".output/public/index.html"))).toBe(shell);
      expect(existsSync(join(root, ".output/public/sw.js"))).toBe(worker);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
