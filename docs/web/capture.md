# Capture and refresh the web gallery

[Guide and coverage](README.md) · [Gallery](gallery.html) · [Recorded walkthroughs](workflows.md)

Capture the normal app, review in scratch space, then publish the reviewed files.
Do not edit `gallery.html`, `workflows.md` or image provenance by hand.

## 1. Start local dependencies

Use the repository's Nix toolchain, including its `flake.lock`-pinned `python3`
for web gallery tooling and tests; these web commands need no host Python
installation. Native capture/release commands are unchanged. From the repository
root:

```sh
# If the local backend is not already running:
cd backend
nix develop .. --command make dev-env-up
```

This boots the local Nhost services and applies the normal local seeds. **Do not
run `dev-env-down` merely to refresh the gallery**: it removes database volumes.
The capture does not reset the database or modify public catalog data.

In a separate terminal, from `frontend/`:

```sh
nix develop .. --command bun install
nix develop .. --command bunx playwright install chromium   # once per pinned Playwright version
nix develop .. --command bun run gallery:serve
```

`gallery:serve` runs the normal development app, forces the local Nhost
subdomain/region and binds to `127.0.0.1:5173` with strict port checking. **Use
`http://localhost:5173` in the browser**: local Constellation's CORS configuration
allows that origin, not an arbitrary loopback hostname/port. Stop a conflicting
dev server yourself rather than killing an unknown listener. The gallery is not
part of the production build and this command does not publish anything.

On Linux, Playwright also needs Chromium's system libraries. In a configured Nix
browser environment, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select its Chromium
binary; a changed actual browser version requires a new reviewed baseline.
Do not install Bun or other toolchain packages outside Nix to work around setup.

## 2. Capture into a new scratch directory

From `frontend/`, while the local app and backend are running:

```sh
nix develop .. --command bun run gallery:capture \
  --output ../.nhost-code/tmp/web-gallery-baseline
```

The default is all groups in both layouts, serially. Each layout uses a fresh
browser context and resets **only the reserved fictional gallery account**
`alex.gallery@example.com` and its private data. Do not use that account for
anything you want to keep. The opt-in seed uses Postgres inside this checkout’s
local Nhost Docker container. It checks the Compose ownership label and refuses
an existing ID or email without the exact fixture identity and marker. It does
not run in migrations, normal seeds, or production. Other users, public data,
database volumes and MailHog messages are left alone.

The seed fixes the account ID, creation time and energy row timestamps. Playwright
then signs in via the real OTP flow and only reads mail that arrived for this
request. Training, nutrition, measurements and journal fixtures are inserted
through real user-role GraphQL, as are the subsequent app writes. The database
can allocate fresh row IDs; walkthroughs record route shapes rather than those
IDs, and the IDs aren’t rendered. No admin secret, production session or
persistent credential file is used. The last layout’s
fictional rows remain until the next capture. Do not run captures concurrently;
a workspace lock enforces this. If the process was forcibly killed, remove
`.nhost-code/tmp/web-gallery.lock` only after confirming it is no longer running.

Browser traffic is allowlisted to the local frontend/Auth/GraphQL/Storage origins.
Google Fonts CSS is replaced with the pinned local Inter font; Gravatar is
blocked so the real avatar fallback renders. Unexpected origins, browser errors,
GraphQL failures (including optional history reads), error alerts, missing frames
and incomplete workflows stop capture. Service workers and stored developer
sessions are not reused. TLS verification is relaxed only in the local tooling
contexts, whose network destinations are restricted.

[`profile.json`](../../frontend/scripts/gallery/profile.json) pins the fixture and
browser date at **15 January 2025, 09:41 UTC**. Playwright freezes JavaScript `Date`
in its capture page while timers and requests keep running; the rest walkthrough
explicitly advances the clock ten seconds. Nhost, MailHog, and capture provenance
still use real time. The profile uses full software rasterization to avoid
GPU or incremental-raster differences around rounded corners. Capture waits for
data, fonts, success toasts to dismiss, and consecutive matching rendered frames.
It records original viewport PNGs, without browser chrome, resizing or
compositing. Animations, accidental chart hover and carets are not recorded.

Local Auth rate limits still apply. Avoid rapid repeated full runs while debugging;
a 429 is a real setup failure, not a reason to disable backend rate limits. A
service restart, if appropriate for your own disposable development stack, is an
explicit operator action—not something the capture does automatically.

### Targeted refreshes

```sh
# Example: rerun the session workflow in each layout
nix develop .. --command bun run gallery:capture \
  --output ../.nhost-code/tmp/web-gallery-baseline --group session

# Example: inspect just the mobile roots in a fresh diagnostic catalog
nix develop .. --command bun run gallery:capture \
  --output ../.nhost-code/tmp/web-gallery-mobile-check --profile mobile --group roots
```

Use `--help` for the registered groups and options. Profiles: `all`, `desktop`,
`mobile`. The `public-auth` group resets the reserved account and verifies sign-in
but skips the user-role fixture writes. `--origin` accepts only a bare local HTTP
origin; it does not change backend CORS or permit cloud capture.

An existing scratch catalog must have the same capture profile, including the
fixture version, fixed browser date, actual browser, origin, tool/font versions
and viewport settings. A profile change (including the move from real to fixed
clock capture) requires a **new full baseline**, not mixed old/new images. A new
calendar day no longer changes the profile, and the capture does not hash
fixture sources. When changing `frontend/scripts/gallery/fixtures.ts`, `seed.sql`,
or the `now`, `energyUpdatedTime`, or `account` fields in `profile.json`, bump
`fixtureVersion` in `profile.json` in the same change and capture a new full
baseline. Without the bump, old and new fixture data can be mixed in one catalog
and still validate. For an affected-group refresh on the same profile, copy the
published manifest and screenshots into scratch first,
then rerun the group. A targeted run starts from the seed and skips mutations
from preceding workflows; use a full run when those earlier writes are part of
the view you need (for example, exercise history after editing a set).
Byte-identical images retain their files and provenance;
fully unchanged passing runs also retain the manifest, including the earlier
recorded verification times. A subsequent failed run still marks scratch failed.

A partial fresh catalog is useful for diagnosis but intentionally fails the
publication gate. The latest capture attempt must pass, and every required
workflow/frame must exist with passing results. An older passing run cannot hide
a failed newer attempt. Failure screenshots go into the scratch output's sibling
`web-gallery-diagnostics/`, not the publication directory; keep diagnostics private,
especially if authentication setup failed.

### Check that a rerun is quiet

Run twice in the same scratch catalog under the same browser/host and capture
profile. After the first pass, save hashes and the manifest; after the second,
compare both. Run from `frontend/` and use the same argument set for both passes:

```sh
OUT=../.nhost-code/tmp/web-gallery-baseline
nix develop .. --command bun run gallery:capture --output "$OUT"
cp "$OUT/capture-manifest.json" "$OUT/first-pass.json"
find "$OUT/screenshots" -name '*.png' -exec shasum -a 256 {} \; | sort > "$OUT/first-pass.sha256"
nix develop .. --command bun run gallery:capture --output "$OUT"
cmp "$OUT/first-pass.json" "$OUT/capture-manifest.json"
find "$OUT/screenshots" -name '*.png' -exec shasum -a 256 {} \; | sort > "$OUT/second-pass.sha256"
cmp "$OUT/first-pass.sha256" "$OUT/second-pass.sha256"
```

Investigate an unexpected diff rather than accepting image churn. Different
browser builds, host rendering stacks or public catalog seeds can still change
pixels; the reproducibility check compares the same environment.

## 3. Validate, render and review

From the repository root:

```sh
OUT=.nhost-code/tmp/web-gallery-baseline
nix develop . --command python3 tools/web-gallery.py validate --output "$OUT"
nix develop . --command python3 tools/web-gallery.py render --output "$OUT"
```

Both commands require a complete catalog. Validation checks the canonical registry,
passing results with recorded checks, duplicate/missing IDs, frame ownership,
capture-profile consistency, timezone-qualified capture times, safe paths, PNG
headers/dimensions, SHA-256 hashes, known-issue references and orphan files. Every
capture must appear in the resolved gallery layout. Render writes `gallery.html`
and `workflows.md`; guide/capture links resolve after publication.

Open the scratch HTML directly in a browser. Review the actual PNGs, especially
mobile form actions, timer controls, scrolled content, chart labels and dialogs.
Test search, the no-results state, Screen size, navigation and original-image links.
Web frames reserve their intrinsic proportions through each image's `width` and
`height` attributes. Keep the shared renderer's web `image_ratio=None` opt-out:
author CSS `aspect-ratio: auto` overrides those hints and collapses unloaded lazy
images, shifting section and row navigation targets as images load.
Viewport screenshots are not full-page coverage; a passing file gate does not
prove the chosen scroll position is useful or the UI is accessible.

If the run uncovered a genuine app bug, fix and test the app rather than faking
its result in the capture driver. Update `catalog.json` and the workflow driver
in the same change. If a workflow changes the fixture data, bump `fixtureVersion`
and refresh the full baseline as described above. When retiring a superseded frame, remove it from the registry
and recapture into a fresh scratch catalog (or remove its manifest entry and PNG
from a same-profile scratch copy). Use a `layoutOverrides` entry to reuse a
context frame or omit a scrolled view when a wider layout already shows it.
Validation rejects unregistered workflows and frames so obsolete evidence cannot
linger. Do not remove a failing frame just to make publication pass.

## 4. Publish reviewed evidence

For the first baseline, with an empty `docs/web/screenshots/`:

```sh
OUT=.nhost-code/tmp/web-gallery-baseline
cp -R "$OUT/screenshots" docs/web/
cp "$OUT/capture-manifest.json" docs/web/
nix develop . --command python3 tools/web-gallery.py render
nix develop . --command python3 tools/web-gallery.py validate
```

For a later refresh, synchronize the **reviewed scratch screenshot set** and
manifest into `docs/web/` (including deliberate removal of any retired frames),
then render and validate. Do not leave orphan PNGs. Preserve existing guide files,
unchanged images, provenance and frame order. Review the Git diff before committing;
never publish browser storage, OTPs, tokens, traces, mailboxes or diagnostics.

If coverage changes, update the reported counts in the guide in the same change.
`docs/ios/` images and its manifest are independent and must not be refreshed as
a side effect.

## Checks

```sh
# Offline Python checks from the repository root; no browser/backend required
nix develop . --command python3 -m unittest discover -s tools -p 'test_web_gallery.py'
nix develop . --command python3 -m unittest discover -s ios/NeoGym/Scripts -p 'test_demo_guide.py'
nix develop . --command python3 tools/web-gallery.py validate

# Required frontend gate, from frontend/
nix develop .. --command bun run check
nix develop .. --command bun run build
```

The shared renderer and native scripts must also remain Python 3.9-compatible.
After shared-renderer or native-script changes, follow the additional
[macOS compatibility checks](../../CLAUDE.md#toolchain) outside the devshell:
`/usr/bin/python3` is an `xcrun` shim that can select Nix Python inside it, so
verify the actual 3.9 version before running the web and native suites. This is
not a macOS system-Python requirement on Linux.

`bun run check` includes the gallery registry/safety/schema-document tests and
shared/Python renderer regressions, but it does **not** launch a browser or create
local accounts. Capture commands are opt-in. Retained passing results are not a
fresh backend permission test, production deploy, native integration check or
cross-browser guarantee.

## File map

| File | Responsibility |
|---|---|
| `frontend/scripts/gallery/catalog.json` | Profiles, section roots and required canonical workflow frames |
| `frontend/scripts/gallery/capture.ts` | CLI, isolated Chromium contexts, local OTP setup and provenance |
| `frontend/scripts/gallery/profile.json` | Fixed browser time, raster settings, fixture version and reserved fictional account |
| `frontend/scripts/gallery/seed.ts`, `seed.sql` | Workspace-scoped reset, account and energy fixture |
| `frontend/scripts/gallery/backend.ts` | Fixed local endpoints, user GraphQL requests and fresh MailHog OTP |
| `frontend/scripts/gallery/fixtures.ts` | Private user-role fixture mutations and relative dates |
| `frontend/scripts/gallery/driver.ts` | Readiness/network checks, screenshots and manifest updates |
| `frontend/scripts/gallery/workflows.ts` | Real UI actions and fresh backend outcome checks |
| `tools/gallery.py` | Shared iOS/web HTML/CSS/JS renderer |
| `tools/web-gallery.py` | Web completeness/integrity gate, ordering and generated indexes |
| `docs/web/capture-manifest.json` | Retained workflow outcomes and screenshot provenance |
| `docs/web/gallery.html`, `docs/web/workflows.md` | Generated static documentation |
