# Widgets & Watch — production-view visual fixtures

[Open the 45-image gallery](gallery.html) · [Per-image provenance](capture-manifest.json) ·
[iPhone walkthrough gallery](../gallery.html) · [iPhone guide](../README.md)

This companion catalog adds the surfaces redesigned on the `watch-widgets` branch.
**These are actual screenshots of isolated simulator fixture apps rendering the
production SwiftUI views. They are not screenshots of system-hosted widgets, a
watch face, a real Live Activity, or verified interactive workflows.**

The existing iPhone catalog remains separate: its 255 legacy captures, timestamps,
hashes and 46 recorded walkthroughs are not replaced, re-dated or counted as using
this fixture profile. The companion has its own versioned registry and manifest.

## Coverage

| Surface | Captures | Included |
|---|---:|---|
| iPhone Balance widget views | 13 | Small/medium Home Screen; inline/rectangular/circular Lock Screen; small/medium Light and signed-out states; missing energy, prior-day inline/circular data, intake without a plan |
| Rest Live Activity regions | 8 | Lock Screen, expanded, compact and minimal regions; each running and Rest over |
| Watch app pages | 15 | Today, End of day, Account, Account debug controls, Health access, Connect, reauthentication, Auth error, phone signed-out, clearing, local-session error, Diagnostics, empty Today, provisional Health estimate and retained-data refresh failure |
| Watch complication views | 9 | Rectangular/circular with fresh, prior-day and not-connected data; stale rectangular, missing-energy rectangular and circular without a plan |

Click any thumbnail to inspect the original full-resolution PNG. Phone captures
include the fixture name, chosen content-frame size and an explicit non-system
host label. Watch complication captures say **Visual fixture / Not a watch face**.
The watch page images themselves use the production page content; their fixture
identity and caveats are attached in the gallery and manifest.

### Deliberate boundaries

- The capture apps are **separate bundle IDs**: `io.nhost.neogym.gallery.phone` and
  `io.nhost.neogym.gallery.watch`. `Gallery/project.yml` is not the production
  XcodeGen spec, and neither app is embedded in a shipping target.
- No entitlements, App Group, shared Keychain, live client, AuthStore,
  WatchEnergyRuntime, HealthKit or WatchConnectivity object is instantiated.
  NeoGymKit is linked for the real display models, not for authentication.
- All data is fictional and in memory. The profile uses **15 Jan 2025, 13:40 UTC**,
  `en_US`, Gregorian/UTC, Large Dynamic Type and Dark unless explicitly Light.
  Watch pages receive a frozen display date through a narrow page-model boundary;
  the live runtime still supplies `Date()` and the same refresh operations.
  Launch arguments also pin Foundation's `AppleLanguages`/`AppleLocale` (not just
  SwiftUI's environment), and the readiness receipt verifies `en_US` and UTC.
  The phone status bar is cosmetically set to 9:41. **watchOS does not support
  `simctl status_bar` overrides**: its top-right system clock remains the actual
  simulator time at capture, not the frozen app-data time. Watch recaptures may
  therefore differ even with identical fixture inputs.
- Rest views share the production rendering input/region views, but a
  **capture-target-only `NEOGYM_GALLERY` compilation condition** freezes the running
  text at `1:15` and progress at 62.5%. Production still uses timer intervals.
  Capture-only App Intents return without effects, and host views disable hit
  testing. Links, Refresh, +30 s, Skip, sign-in and sign-out are **not exercised**.
- Provider/timeline methods are not called. The Diagnostics events are fictional;
  they are not receipts of a real sync or WidgetKit reload.
- Frame sizes/region arrangements are chosen by the fixture host. They do not
  prove actual WidgetKit margins, Dynamic Island layout or watch-face placement.
- Captures show current view behavior, including prior-day inline/circular intake
  and message-layout error states. The in-memory adapters do not validate state
  transitions or prove every input combination is reachable through live flows.
  Their presence does **not** resolve review findings.

No claims are made about tinted/vibrant system rendering, permission dialogs,
VoiceOver interaction, Dynamic Type beyond Large, Reduce Motion/Transparency,
WidgetKit scheduling, Live Activity intents, refresh, notifications, background
execution, real authentication, physical paired hardware, provisioning or release
signing. Those require separate integration/device acceptance. A view fixture is
not a replacement for those tests.

## Reproduce safely

Requirements: the repository's normal Nix/XcodeGen toolchain, host Xcode, local
Nhost Swift SDK checkout, `/usr/bin/python3`, **iOS 27.0** and **watchOS 27.0**
simulator runtimes, iPhone 17 and Apple Watch Series 12 (46 mm) device types. No
backend, account, OTP, PAT, Health permission, signing account or paired phone is
needed. These scripts use only Python's standard library.

From the repository root, capture into a scratch directory first:

```sh
/usr/bin/python3 ios/NeoGym/Scripts/capture-surface-gallery.py capture \
  --output .nhost-code/tmp/widgets-watch-gallery/catalog

/usr/bin/python3 ios/NeoGym/Scripts/capture-surface-gallery.py validate \
  --output .nhost-code/tmp/widgets-watch-gallery/catalog
open .nhost-code/tmp/widgets-watch-gallery/catalog/gallery.html
```

The command generates **`ios/NeoGym/Gallery/NeoGymGallery.xcodeproj`**, builds each
capture app, creates/boots a **new disposable simulator for each platform**, installs
only the corresponding fixture app, requests each scene by launch argument, waits
for its app-private readiness receipt, and takes a `simctl` screenshot. It deletes
only the simulators it created, in `finally` cleanup. It never selects an existing
simulator or accepts a developer device ID. Build logs/products stay ignored under
`.nhost-code/tmp/widgets-watch-gallery/`. The generated project is also ignored.

Use `--platform phone` or `--platform watch` to rerun one group. The completeness
gate still requires all 45 scenes. A failed run can leave a partial scratch
catalog; do not publish it. After an interrupted/killed process, inspect and remove
only its specifically named `NeoGym Visual Fixtures …` simulator, never a global
simulator erase or a real session's simulator.

Review the images, then publish the complete companion directory. To refresh an
already published catalog directly **after** reviewing the scratch run:

```sh
/usr/bin/python3 ios/NeoGym/Scripts/capture-surface-gallery.py capture
/usr/bin/python3 ios/NeoGym/Scripts/capture-surface-gallery.py validate
/usr/bin/python3 ios/NeoGym/Scripts/capture-surface-gallery.py render
```

PNG recompression is lossless; no resizing, cropping or pixel editing is applied.
Per-image metadata records the actual device/runtime, dimensions, hash, timestamp,
source revision, dirty-tree flag and a digest of the source inputs at build time.
The corresponding input-file hashes are stored in the manifest. Builds/captures
fail if those inputs change mid-run. Identical images retain their original bytes,
timestamp and source provenance; a rerun does not pretend an unchanged image was
newly captured. Simulator/system rasterization can still change pixels between
runs; the no-op guarantee applies to **identical PNG bytes**, not every rerun.

The gate rejects missing/duplicate/orphan captures, incorrect dimensions, changed
hashes, unsafe paths, mismatched scene/profile metadata and altered source-input
maps. It is an artifact-integrity gate, not a semantic UI or integration test.

```sh
/usr/bin/python3 -m unittest discover -s ios/NeoGym/Scripts -p 'test_*.py'
# Regenerate only the existing iPhone HTML navigation; no iPhone images/manifest change:
/usr/bin/python3 ios/NeoGym/Scripts/capture-demo-guide.py render
```

Registry: [`ios/NeoGym/Gallery/scenes.json`](../../../ios/NeoGym/Gallery/scenes.json).
The registry, capture hosts, renderer and disclosures must change together when
adding a scene or changing the profile. Never silently label these fixtures as
system-hosted captures, or mix their counts into the iPhone walkthrough totals.
