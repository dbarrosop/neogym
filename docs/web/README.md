# NeoGym web app guide

[Open the visual gallery](gallery.html) · [Recorded walkthroughs](workflows.md) ·
[Capture and refresh instructions](capture.md) · [Capture manifest](capture-manifest.json)

The gallery shows the **real frontend running in Chromium against local Nhost**,
with fictional private data. It is static documentation, separate from the deployed
app: open `gallery.html` directly in a browser, keeping `screenshots/` beside it.
Viewing needs no backend, dev server, Playwright or internet connection.

The catalog contains **117 original viewport screenshots**, **52 recorded
walkthroughs** and **56 visual rows**. The desktop Today summary and Journal
create/edit/delete rows reuse context frames rather than duplicating screenshots. Each row
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

The capture profile fixes the browser date at **15 January 2025, 09:41 UTC** and
resets the same reserved fictional account and private history before each layout.
Auth and the database still use real time. The manifest records the fixed profile,
browser/tool/font versions, viewport settings, and each image’s actual capture
time, hash, and Git source. Identical reruns on the same render environment leave
the published evidence unchanged. A dirty source identifies an uncommitted
worktree, not a released build.

## Coverage

Every implemented web section root appears in both layouts:

| Area | Sections |
|---|---|
| Today | Today |
| Train | Sessions, Workouts, Exercises |
| Nutrition | Log, Plans, Foods, Meals |
| Progress | Overview, Muscles, Strength, Body, Energy |
| Me | Journal, Account |

The following representative workflows add intermediate states and assertions:

- **Email verification:** browse sign-in and sign-up, then request a code for the
  seeded account on Sign in. Inspect the empty code step (Change, Verify and the
  resend countdown), then enter the fresh local MailHog code and verify automatic
  navigation to Today. No screenshot shows a code or session credentials.
- **Today: Balance and Body:** distinguish recorded energy from the end-of-day
  estimate, inspect weight and body-fat trends, and follow Trend to Progress.
- **Strength logging and rest:** log a prefilled second set, extend rest, switch
  to Today, then return through the timer link and Skip. Open the saved row,
  edit its reps, and verify the two sets and updated count on the backend.
- **Exercise details:** inspect recent sets, open the exercise from its session
  Options menu, and read its strength chart. Mobile checks that instructions
  come before Progress.
- **Planned nutrition logging:** an occupied breakfast slot asks before appending
  its planned meal. Backend reads verify three new food snapshots and one meal
  group, and the planned slot remains available.
- **Nutrition editors:** move a food into an existing plan slot and verify both
  items' saved time and position. Change an ingredient in a meal, inspect live
  totals, and check that the plan reference prevents deletion.
- **Progress Overview and Calories:** follow the Energy shortcut, inspect the
  Consumed and Net charts, and change only the Calories period.
- **Private progress photos:** open the gallery from the Body summary card,
  preview and upload a generated illustration with an earlier date, and keep a
  second upload in the same date row. Edit its date and label, check its new
  timeline row, filter by label, and confirm deletion. Fresh owner-role reads
  verify which file was kept and Body shows its count and date. All pictured
  images are synthetic, not photos of real people.
- **Journal create/edit/delete:** save Markdown, edit the title, confirm deletion
  and return to the list. Fresh backend reads confirm each outcome.
- **Appearance:** select Light, navigate to Today, then restore Dark.

A section-root screenshot is a visible-viewport overview, not proof of every
control or everything below the fold. Recorded checks prove only their stated
outcomes. File validation verifies retained evidence; it does not rerun workflows.

## Boundaries

This catalog does **not** cover exhaustive CRUD, cardio entry, every
empty/loading/error state, tablet breakpoints, all themes, keyboard/screen-reader
behavior, production deployment or cross-browser compatibility. It does not
exercise account creation, OTP resend, or PKCE email changes, or claim cloud
email delivery. Retained frames show the captured revision: mobile auth
field sizing and the open session card header may differ from the current app
until those frames are refreshed.

Apple Health tags come from fictional fixture notes and demonstrate read-only
presentation. The web cannot import Apple Health or connect an Apple Watch;
native integration workflows belong in the [iPhone guide](../ios/README.md).
The browser runs do not replace backend permission/integrity tests.

## How it is built

```text
Normal local frontend + local Nhost
    ↓ Reset the gallery fixture; Playwright signs in and drives actual controls
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
