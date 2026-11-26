# Capture and refresh the web gallery

[Guide and coverage](README.md) · [Gallery](gallery.html) · [Recorded walkthroughs](workflows.md)

Capture the normal app, review in scratch space, then publish the reviewed files.
Do not edit `gallery.html`, `workflows.md` or image provenance by hand.

## 1. Start local dependencies

Use the repository's Nix toolchain. From the repository root:

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

The default is all groups in both profiles, serially. Each profile uses a fresh
browser context and a **new disposable local app account** named Alex Morgan -
Gallery, with an address of the form `gallery-<random UUID>@example.com`. Signup
and OTP verification use the real UI and MailHog. Only that user's private
fixtures are inserted, using the ordinary user bearer; no admin secret, production
session, real personal data or persistent credential file is used.

Private fixtures cover strength exercises with their required sidecars, a workout,
sessions, foods/meals/a plan and logs, measurements, energy and journal entries.
They remain in the local database after capture. There is no automatic account,
mailbox, shared-data or database cleanup. Normal `dev-env-down` removes them only
when an operator intentionally wants a destructive local reset.

Browser traffic is allowlisted to the local frontend/Auth/GraphQL/Storage origins.
Google Fonts CSS is replaced with the pinned local Inter font; Gravatar is
blocked so the real avatar fallback renders. Unexpected origins, browser errors,
GraphQL failures (including optional history reads), error alerts, missing frames
and incomplete workflows stop capture. Service workers and stored developer
sessions are not reused. TLS verification is relaxed only in the local tooling
contexts, whose network destinations are restricted.

Capture waits for data, fonts and consecutive matching rendered frames. It records
original viewport PNGs, without browser chrome, resizing or compositing. Screenshot
animations/carets are disabled, but **Date/Auth/server clocks are not frozen**.
The manifest's UTC fixture date controls only seeded relative history; timers,
current-time labels and source data can still change pixels.

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

Groups: `all`, `roots`, `public-auth`, `session`, `plan-log`, `journal-crud`,
`appearance`. Profiles: `all`, `desktop`, `mobile`. Use `--help` for options.
`--origin` accepts only a bare local HTTP origin; it does not change backend CORS
or permit cloud capture.

An existing scratch catalog must have the same capture profile, including fixture
date, actual browser, origin, tool/font versions and viewport settings. A new day
or profile change requires a **new full baseline**, not mixed old/new images. For
an affected-group refresh on the same profile/date, copy the published manifest
and screenshots into scratch first, then rerun that group. Byte-identical images
retain their original file and capture provenance; replacements update in place,
preserving registry order. Unchanged walkthroughs retain their earlier checks.

A partial fresh catalog is useful for diagnosis but intentionally fails the
publication gate. The latest capture attempt must pass, and every required
workflow/frame must exist with passing results. An older passing run cannot hide
a failed newer attempt. Failure screenshots go into the scratch output's sibling
`web-gallery-diagnostics/`, not the publication directory; keep diagnostics private,
especially if authentication setup failed.

## 3. Validate, render and review

From the repository root:

```sh
OUT=.nhost-code/tmp/web-gallery-baseline
python3 tools/web-gallery.py validate --output "$OUT"
python3 tools/web-gallery.py render --output "$OUT"
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
Viewport screenshots are not full-page coverage; a passing file gate does not
prove the chosen scroll position is useful or the UI is accessible.

If the run uncovered a genuine app bug, fix and test the app rather than faking
its result in the capture driver. Add a workflow/frame in `catalog.json` and its
implementation in `workflows.ts` together. Do not silently remove a failing frame
or weaken the required registry to make publication pass.

## 4. Publish reviewed evidence

For the first baseline, with an empty `docs/web/screenshots/`:

```sh
OUT=.nhost-code/tmp/web-gallery-baseline
cp -R "$OUT/screenshots" docs/web/
cp "$OUT/capture-manifest.json" docs/web/
python3 tools/web-gallery.py render
python3 tools/web-gallery.py validate
```

For a later refresh, synchronize the **reviewed scratch screenshot set** and
manifest into `docs/web/` (including deliberate removal of any retired frames),
then render and validate. Do not leave orphan PNGs. Preserve existing guide files,
unchanged images, provenance and frame order. Review the Git diff before committing;
never publish browser storage, OTPs, tokens, traces, mailboxes or diagnostics.

The initial baseline has 66 PNGs, 38 source walkthroughs and 42 visual rows.
Changing coverage may legitimately change these counts, but update the guide in
the same change. `docs/ios/` images and its manifest are independent and must not
be refreshed as a side effect.

## Checks

```sh
# Offline Python checks; no browser/backend required
python3 -m unittest discover -s tools -p 'test_web_gallery.py'
python3 -m unittest discover -s ios/NeoGym/Scripts -p 'test_demo_guide.py'
python3 tools/web-gallery.py validate

# Required frontend gate, from frontend/
nix develop .. --command bun run check
nix develop .. --command bun run build
```

`bun run check` includes the gallery registry/safety/schema-document tests and
shared/Python renderer regressions, but it does **not** launch a browser or create
local accounts. Capture commands are opt-in. Retained passing results are not a
fresh backend permission test, production deploy, native integration check or
cross-browser guarantee.

## File map

| File | Responsibility |
|---|---|
| `frontend/scripts/gallery/catalog.json` | Profiles, 14 roots and required canonical workflow frames |
| `frontend/scripts/gallery/capture.ts` | CLI, isolated Chromium contexts, local OTP setup and provenance |
| `frontend/scripts/gallery/backend.ts` | Fixed local endpoints, user GraphQL requests and MailHog OTP parsing |
| `frontend/scripts/gallery/fixtures.ts` | Private user-role fixture mutations and relative dates |
| `frontend/scripts/gallery/driver.ts` | Readiness/network checks, screenshots and manifest updates |
| `frontend/scripts/gallery/workflows.ts` | Real UI actions and fresh backend outcome checks |
| `tools/gallery.py` | Shared iOS/web HTML/CSS/JS renderer |
| `tools/web-gallery.py` | Web completeness/integrity gate, ordering and generated indexes |
| `docs/web/capture-manifest.json` | Retained workflow outcomes and screenshot provenance |
| `docs/web/gallery.html`, `docs/web/workflows.md` | Generated static documentation |
