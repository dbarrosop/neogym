# Reproduce the iPhone demo catalog

[Guide](README.md) · [Recorded walkthroughs](workflows.md) · [Gallery](gallery.html)

## Safety and prerequisites

Use a **new, dedicated iPhone 17 / iOS 27.0 simulator**. Never point this capture at
a developer's real session, a physical device or an existing simulator with useful
demo edits. Walkthroughs repeatedly reset demo data/preferences, create/delete
records and intentionally corrupt the isolated demo JSON during recovery testing.
Exit also deliberately enters normal authentication/session restoration.

Required: host Xcode with that simulator runtime, the repository's normal Nix
shell/XcodeGen setup, the local Nhost Swift SDK checkout, and `/usr/bin/python3`.
There are no third-party Python dependencies. No backend, Docker, OTP inbox,
production account, Apple signing account or Health permissions are needed.

The capture uses a public-XCTest, **opt-in test-only driver**, not an application
network server. Host commands and responses go through the test runner's private
simulator container. Only one host requester may drive a simulator at a time.
Ordinary test runs skip this long-lived driver.

The scripts' framing and coordinate fallbacks target this specific 402 × 874 pt
phone. Use another device only after adapting the framing, validation dimensions
and metadata. Do not relabel another device's images as iPhone 17 captures.

## 1. Generate and start the driver — Terminal A

From the repository root:

```sh
cd ios/NeoGym
nix develop ../.. --command xcodegen generate

# Check installed identifiers if this runtime/device type is unavailable.
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl list runtimes
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl list devicetypes

UDID=$(env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl create \
  'NeoGym Documentation' \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-27-0)
printf 'Capture simulator UDID: %s\n' "$UDID"

env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl boot "$UDID"
env -u SDKROOT -u DEVELOPER_DIR /usr/bin/xcrun simctl bootstatus "$UDID" -b
# Terminal B applies the versioned font/appearance/status-bar profile automatically.

RESULT=/tmp/neogym-guide-$(date +%Y%m%d-%H%M%S).xcresult

env -u SDKROOT -u DEVELOPER_DIR -u CC -u CXX -u LD -u AR -u LDFLAGS \
  TEST_RUNNER_NEOGYM_CAPTURE_GUIDE=1 \
  /usr/bin/xcodebuild -project NeoGym.xcodeproj -scheme NeoGym \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath /tmp/neogym-demo-guide-derived \
  -resultBundlePath "$RESULT" \
  -parallel-testing-enabled NO -test-timeouts-enabled NO \
  -only-testing:NeoGymUITests/DemoGuideCaptureUITests \
  test CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-
```

Wait for **`NEOGYM_GUIDE_READY`**. The test remains active while Terminal B drives
it. Wait for XcodeGen to finish before starting Xcodebuild. Keep simulator ad-hoc
signing enabled: the public-entry/Exit walkthrough intentionally constructs normal
mode, whose shared-container configuration is not optional.

Agents should start Xcodebuild with their managed background-process tool and a
readiness watch, not with shell `&`/polling. The test driver has a bounded two-hour
session; restart it if that expires or XCTest itself fails.

## 2. Capture — Terminal B

From the repository root, copy the UDID printed above. Write a preview outside the
published catalog first:

```sh
UDID='COPY-THE-NEW-SIMULATOR-UDID'
OUT="$PWD/.nhost-code/tmp/demo-guide-refresh"

/usr/bin/python3 ios/NeoGym/Scripts/demo-guide-workflows.py \
  --device "$UDID" --output "$OUT" --group all
```

`all` runs the 15 roots and every registered canonical workflow sequentially.
Each workflow starts from an appropriate reset fixture unless it is explicitly
testing persistence. It stops on failure; do not publish a partial catalog.

Rerun a single group after diagnosing a failed locator or UI change:

```sh
/usr/bin/python3 ios/NeoGym/Scripts/demo-guide-workflows.py \
  --device "$UDID" --output "$OUT" --group progress-charts

# List the available groups, including roots, plan-crud, log-child and account.
/usr/bin/python3 ios/NeoGym/Scripts/demo-guide-workflows.py --help
```

Group reruns update their named screenshots and latest workflow result. Run only
affected groups, not `all`, for normal feature work.

### Fixed capture profile and quiet reruns

The single source of truth is
`ios/NeoGym/Sources/NeoGymKit/Resources/gallery-capture.json`, shared by the app
bundle and host script. Version 1 pins **15 Jan 2025, 09:41 UTC**, `en_US`, a
Gregorian calendar, Large text and initial Dark appearance. Every host-driven app
launch receives `NEOGYM_DEMO_CAPTURE=1` and `TZ=UTC`, including launches through
Sign in → Try demo. The application/domain clock is fixed only while that demo
is active; ordinary demo/live use and SDK/Auth/network/XCTest clocks stay real.
Fixture dates, query windows, chart periods, default log times, mutation timestamps
and rest displays use the same clock. Capture record IDs use a persisted sequence
instead of random UUID tie-breaking. Choosing a historical month also keeps the
native calendar's real-today highlight out of the visible capture month.

Each new host Guide applies the profile's font size, appearance and explicit
Wi-Fi, cellular-mode/**cellular-bars**, battery and clock overrides. The old
status-bar command omitted cellular state, which caused otherwise identical
screens to change. Locale/time zone and profile are not device-wide preferences
for normal app use. Appearance walkthroughs can deliberately change theme within
their own run.

A same-profile, identical-image recapture keeps its PNG, `capturedAt`, original
capture hash and manifest position. Workflow positions also remain stable. A
real image/profile change still records fresh provenance; capture timestamps are
actual capture times, not fabricated historical dates. PNG recompression is
lossless and unchanged files are not rewritten.

Legacy published images have no `captureProfile` field. Do not label them frozen
by editing timestamps or rerendering: the first adoption of this profile needs a
**one-time reviewed baseline refresh**, ideally a separate catalog-only change.
This implementation does not automatically replace the legacy catalog. Profile,
Xcode/runtime/device or font changes can require another explicit baseline;
system rendering/animation can still cause differences and must be reviewed.

Check a selected workflow twice in a scratch catalog before publishing:

```sh
/usr/bin/python3 ios/NeoGym/Scripts/demo-guide-workflows.py \
  --device "$UDID" --output "$OUT" --group log-food
cp "$OUT/capture-manifest.json" "$OUT/first-pass.json"
find "$OUT/screenshots" -name '*.png' -exec shasum -a 256 {} \\; | sort > "$OUT/first-pass.sha256"

/usr/bin/python3 ios/NeoGym/Scripts/demo-guide-workflows.py \
  --device "$UDID" --output "$OUT" --group log-food
cmp "$OUT/first-pass.json" "$OUT/capture-manifest.json"
find "$OUT/screenshots" -name '*.png' -exec shasum -a 256 {} \\; | sort > "$OUT/second-pass.sha256"
cmp "$OUT/first-pass.sha256" "$OUT/second-pass.sha256"
```

These comparisons must be clean; investigate a mismatch rather than replacing
unrelated screenshots. A scratch catalog containing only one workflow is not a
complete publishable catalog and will intentionally fail the full coverage gate.

The host script drives actual controls and reads `NeoGymDemo/state-v1.json` only
to verify persisted outcomes. The recovery group is the explicit exception: it
writes invalid data to that **demo-only** file, then exercises the app's recovery
UI. It does not tamper with SDK credentials, live caches or a backend.

## 3. Validate and render

```sh
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py --output "$OUT" optimize
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py --output "$OUT" validate
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py --output "$OUT" render
open "$OUT/gallery.html"
```

- `optimize` losslessly recompresses PNG IDAT data. It never resizes or changes
  pixels/color profiles; obsolete optional Apple IDAT-layout offsets are removed.
- `validate` requires every registered walkthrough to pass, every root and literal
  screenshot to exist, unique IDs/files, matching dimensions and SHA-256 hashes,
  valid known-issue image references, and no uncatalogued PNGs. It also resolves
  the visual gallery layout, checks its frame references and requires all captures
  to appear in at least one row.
- `render` builds `gallery.html` and `workflows.md` from the manifest. Do not edit
  those generated files by hand. Preview-folder README links resolve after publication.

The HTML gallery is one page grouped by app area, with one horizontal screenshot
strip per visual workflow. Bundled CRUD capture runs become separate create,
edit and delete rows, and starting list/detail/editor views can be reused without
copying their PNG files. These are curated visual sequences, not new continuous
recordings or additional independently verified capture runs. Original source
actions/checks and known-issue evidence remain on the page.

Edit `LAYOUT` in `ios/NeoGym/Scripts/demo-guide-gallery.py` to change the sections,
workflow titles or frame order. Explicit frame IDs preserve the intended order;
never sort them alphabetically. Missing referenced frames fail validation. Newly
captured workflows or unplaced screenshots are retained under **Additional recorded
workflows** until curated, rather than silently omitted. The published catalog's
test requires all current captures to have a curated home. After changing the
layout, run `render`, the Python tests and `validate` again. The HTML has inline
CSS/JavaScript, works via `file://` and needs its adjacent `screenshots/` folder.

Review the images, not just the gate: charts own drag gestures and an otherwise
successful screenshot can show the wrong scroll position. The tooling uses
heading/row anchors to frame long charts and a left-padding drag fallback. Numeric
wells and the legacy Custom intake grid also require deliberate selection/ordinal
fallbacks; requested input is checked against the field's read-back value.
Native Log amount and custom-nutrient fields use standard text selection and
keyboard Done; coordinate double-taps can lose focus when the toolbar moves the
sheet. Keyboard visibility probes read presence only, not transient properties.
Run XCTest smoke tests and this capture serially, even on different simulators.

After visual review, replace the published `docs/ios/screenshots/` directory and
its manifest/gallery/generated walkthroughs with the reviewed output, removing
superseded PNGs. Keep `README.md` and this file; update their counts/scope if
coverage changes. Re-run validation on `docs/ios` and check Markdown image links.
Screenshots are original-resolution PNGs, not composited mockups.

## 4. Finish the driver

```sh
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py \
  --device "$UDID" --output "$OUT" command '{"action":"finish"}'
```

Wait for Terminal A's XCTest result. A finished capture command is not by itself
proof that the XCTest driver exited successfully. Leave the dedicated simulator
available for inspection, or shut down/delete **only that newly created device**.

## Tooling checks

From the repository root:

```sh
/usr/bin/python3 -m unittest discover -s ios/NeoGym/Scripts -p 'test_demo_guide.py' -v
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py validate
```

The Python suite checks lossless pixels/PNG CRCs and color metadata, optimization
idempotency, HTML escaping, complete root coverage, workflow failure detection,
image hashes, duplicates/orphans and missing known-issue evidence. Gallery tests
also check separate CRUD rows, frame order, reused image paths, section/row links,
issue notes, missing-frame failures and retention of future captures. These tests
need neither a simulator nor the backend.

The regular `DemoModeUITests` and host package suite remain separate regression
gates; see [developer validation](../developers/ios-demo.md#validation). Run the
repository's frontend `bun run check` after code changes as usual. Nothing in this
catalog substitutes for signed archives, physical integrations or App Review access.

## File map

| File | Purpose |
|---|---|
| `ios/NeoGym/UITests/DemoGuideCaptureUITests.swift` | Opt-in XCTest UI driver and original screenshot writer |
| `ios/NeoGym/Scripts/capture-demo-guide.py` | Host command bridge, state checks, PNG storage, completeness gate and rendering |
| `ios/NeoGym/Scripts/demo-guide-workflows.py` | Explicit UI paths and canonical workflow registry |
| `ios/NeoGym/Scripts/demo-guide-gallery.py` | Curated section/row/frame layout and single-page HTML renderer |
| `ios/NeoGym/Scripts/test_demo_guide.py` | Host-only tooling and no-op recapture tests |
| `ios/NeoGym/Sources/NeoGymKit/Resources/gallery-capture.json` | Versioned clock/locale/timezone/font/status-bar profile |
| `ios/NeoGym/Sources/NeoGymKit/AppClock.swift` | Capture-only domain clock and profile loading |
| `docs/ios/capture-manifest.json` | Latest per-workflow result and per-image provenance |
| `docs/ios/workflows.md`, `docs/ios/gallery.html` | Generated human-readable indexes |
| `docs/ios/screenshots/*.png` | Full-resolution actual app captures |

UI accessibility trees and failed-run diagnostics are local scratch artifacts
under `.nhost-code/tmp/demo-guide/`; they are not part of the published catalog.
