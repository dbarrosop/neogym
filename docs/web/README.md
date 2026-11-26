# NeoGym web app guide

[Open the visual gallery](gallery.html) · [Recorded walkthroughs](workflows.md) ·
[Capture and refresh instructions](capture.md) · [Capture manifest](capture-manifest.json)

The gallery shows the **real frontend running in Chromium against local Nhost**,
with fictional private data. It is static documentation, separate from the deployed
app: open `gallery.html` directly in a browser, keeping `screenshots/` beside it.
Viewing needs no backend, dev server, Playwright or internet connection.

The initial catalog contains **66 original viewport screenshots**, **38 recorded
walkthroughs** and **42 visual rows**. Journal create/edit/delete rows reuse their
original context frames rather than copying or recreating screenshots. Each row
reads left to right; search filters by words, and Screen size changes presentation
size without changing the original PNGs.

## Layouts and capture conditions

| Profile | Viewport | What it shows |
|---|---|---|
| Desktop | 1440 × 1000, scale 1 | Sidebar, split lists/details and nutrition side panels |
| Mobile | 390 × 844, scale 1, touch/mobile emulation | Bottom tabs, full-page details and sticky form actions |

These are separate runs through real controls, **not resized copies**. Mobile
means Chromium viewport emulation, not an iPhone/Safari or physical-device test.
Both start in Dark appearance, use en-US/UTC and reduced motion, and load pinned
Inter locally. The Appearance walkthrough also captures Light.

The manifest records browser/tool/font versions, viewport settings, fixture date,
per-image capture time/hash and source Git revision/dirty state. Application,
Auth and server clocks remain real. History is relative to the fixture date;
this is not a frozen-date or bit-for-bit reproducibility claim. A dirty source
revision identifies a capture from an uncommitted worktree, not a released build.

## Coverage

Every implemented web section root appears in both layouts:

| Area | Sections |
|---|---|
| Today | Today |
| Train | Sessions, Workouts, Exercises |
| Nutrition | Log, Plans, Foods, Meals |
| Progress | Muscles, Strength, Body, Energy |
| Me | Journal, Account |

The following representative workflows add intermediate states and assertions:

- **Public authentication screens:** sign-in and sign-up. Setup then creates a
  disposable account through the real email OTP UI and local MailHog; screenshots
  do not expose the OTP or session credentials.
- **Strength logging and rest:** log a prefilled second set, extend rest, switch
  to Today, return through the timer link and Skip. A fresh backend read confirms
  two sets; UI assertions check timer continuity/navigation.
- **Planned nutrition logging:** an occupied breakfast slot asks before appending
  its planned meal. Backend reads verify three new food snapshots and one meal
  group, and the planned slot remains available.
- **Journal create/edit/delete:** save Markdown, edit the title, confirm deletion
  and return to the list. Fresh backend reads confirm each outcome.
- **Appearance:** select Light, navigate to Today, then restore Dark.

A section-root screenshot is a visible-viewport overview, not proof of every
control or everything below the fold. Recorded checks prove only their stated
outcomes. File validation verifies retained evidence; it does not rerun workflows.

## Boundaries

This first catalog does **not** cover exhaustive CRUD, cardio entry, every
empty/loading/error state, tablet breakpoints, all themes, keyboard/screen-reader
behavior, production deployment or cross-browser compatibility. It does not
exercise PKCE email changes or claim cloud email delivery. Progress Overview is
not implemented on the web.

Apple Health tags come from fictional fixture notes and demonstrate read-only
presentation. The web cannot import Apple Health or connect an Apple Watch;
native integration workflows belong in the [iPhone guide](../ios/README.md).
The browser runs do not replace backend permission/integrity tests.

## How it is built

```text
Normal local frontend + local Nhost
    ↓ Playwright signs up, seeds private fixtures and drives actual controls
PNG files + capture-manifest.json
    ↓ Python validates coverage, results, profiles, hashes and dimensions
Offline gallery.html + workflows.md
```

[`frontend/scripts/gallery/catalog.json`](../../frontend/scripts/gallery/catalog.json)
is the canonical web coverage/frame registry. Browser workflows and fixture
mutations live beside it. [`tools/gallery.py`](../../tools/gallery.py) provides the
shared renderer also used by iOS; [`tools/web-gallery.py`](../../tools/web-gallery.py)
adds web ordering, validation and page copy. Neither gallery requires a React
route or any production demo/authentication bypass.
