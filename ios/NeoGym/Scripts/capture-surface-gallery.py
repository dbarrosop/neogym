#!/usr/bin/env python3
"""Capture the separate, inert Widgets & Watch visual catalog. No live app is launched."""

import argparse
import datetime
import hashlib
import html
import json
import os
import re
import runpy
import struct
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GALLERY = ROOT / "ios/NeoGym/Gallery"
SPEC = GALLERY / "scenes.json"
DEFAULT_OUTPUT = ROOT / "docs/ios/widgets-watch"
BUILD_ROOT = ROOT / ".nhost-code/tmp/widgets-watch-gallery"
PNG_TOOLS = runpy.run_path(str(Path(__file__).with_name("capture-demo-guide.py")))
DEVICES = {
    "phone": ("iPhone 17", "iOS 27.0", "iPhone-17", "iOS-27-0", (1206, 2622)),
    "watch": ("Apple Watch Series 12 (46mm)", "watchOS 27.0", "Apple-Watch-Series-12-46mm", "watchOS-27-0", (416, 496)),
}
LIMITS = [
    "Production SwiftUI views rendered in separate simulator fixture apps, not system-hosted widgets, watch faces or Live Activities.",
    "Fictional in-memory data; actions are inert. No authentication, Keychain, App Group snapshots, HealthKit or WatchConnectivity is used.",
    "Widget frame sizes and Dynamic Island region arrangements are fixture-host choices, not assertions about system geometry.",
    "Rest timers are frozen at 1:15 / 62.5% while running; these images do not validate timer cadence, intents, links, refresh or background delivery.",
    "Full-colour Dark and selected Light fixtures only; tinted/vibrant system rendering, accessibility interaction, signing and paired hardware remain unverified.",
]


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as error:
        raise ValueError("Could not read gallery JSON: " + str(path)) from error


def specification():
    spec = read_json(SPEC)
    ids = [scene["id"] for scene in spec["scenes"]]
    if len(set(ids)) != len(ids) or any(not re.fullmatch(r"[a-z0-9-]+", name) for name in ids):
        raise ValueError("Scene IDs must be unique safe filenames")
    if any(scene["platform"] not in DEVICES for scene in spec["scenes"]):
        raise ValueError("Unknown platform")
    return spec


def clean_environment():
    env = os.environ.copy()
    for key in ["SDKROOT", "DEVELOPER_DIR", "CC", "CXX", "LD", "AR", "LDFLAGS"]:
        env.pop(key, None)
    return env


def run(*args, **kwargs):
    try:
        return subprocess.run([str(arg) for arg in args], check=True, text=True,
                              capture_output=True, env=clean_environment(), **kwargs).stdout.strip()
    except subprocess.CalledProcessError as error:
        raise RuntimeError("Command failed: " + str(args[0]) + "\n" + error.stderr.strip()) from error


def simctl(*args):
    return run("/usr/bin/xcrun", "simctl", *args)


def source_inputs():
    # Include every shipping source compiled by either fixture app, not just the adapters.
    files = list(GALLERY.rglob("*.swift")) + [
        GALLERY / "project.yml", SPEC, Path(__file__),
        Path(__file__).with_name("capture-demo-guide.py"), Path(__file__).with_name("demo-guide-gallery.py"),
        ROOT / "ios/NeoGym/Package.swift", ROOT / "ios/NeoGym/App/LaunchScreen.storyboard"
    ]
    for directory in ["Widgets", "WidgetUI", "Shared", "Watch", "Sources/NeoGymKit"]:
        files.extend((ROOT / "ios/NeoGym" / directory).rglob("*.swift"))
    files.extend((ROOT / "ios/NeoGym/Widgets/Assets.xcassets").rglob("*.json"))
    return {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(set(files))}


def build(platform):
    target = "GalleryPhone" if platform == "phone" else "GalleryWatch"
    folder = BUILD_ROOT / ("build-Phone" if platform == "phone" else "build-Watch")
    destination = "generic/platform=" + ("iOS Simulator" if platform == "phone" else "watchOS Simulator")
    inputs = source_inputs()
    BUILD_ROOT.mkdir(parents=True, exist_ok=True)
    run("nix", "develop", "../../..", "--command", "xcodegen", "generate", cwd=GALLERY)
    log = BUILD_ROOT / (target + ".log")
    with log.open("w") as stream:
        result = subprocess.run([
            "/usr/bin/xcodebuild", "-project", str(GALLERY / "NeoGymGallery.xcodeproj"),
            "-scheme", target, "-destination", destination, "-derivedDataPath", str(folder),
            "build", "CODE_SIGNING_ALLOWED=NO"
        ], env=clean_environment(), stdout=stream, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError("Capture-host build failed; see " + str(log))
    if inputs != source_inputs():
        raise RuntimeError("Capture inputs changed during build; rebuild before capture")
    sdk = "iphonesimulator" if platform == "phone" else "watchsimulator"
    return folder / "Build/Products" / ("Debug-" + sdk) / (target + ".app"), inputs


def wait_for_scene(container, scene_id):
    receipt = container / "Library/Application Support/gallery-ready.json"
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            state = json.loads(receipt.read_text())
            if state.get("scene") == scene_id:
                if state.get("locale") != "en_US" or state.get("timeZoneOffsetSeconds") != 0:
                    raise RuntimeError("Fixture Foundation locale/time zone differs from the capture profile: " + str(state))
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.2)
    raise RuntimeError("Fixture did not become ready: " + scene_id)


def save_capture(output, scene, data, source, previous=None):
    optimized = PNG_TOOLS["lossless_png"](data)
    relative = "screenshots/" + scene["id"] + ".png"
    path = output / relative
    digest = hashlib.sha256(optimized).hexdigest()
    if (previous and previous.get("sha256") == digest and path.exists()
            and path.read_bytes() == optimized):
        return previous  # Preserve the first identical capture's provenance.
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(optimized)
    width, height = struct.unpack(">II", optimized[16:24])
    device, runtime, _, _, _ = DEVICES[scene["platform"]]
    frame = {key: scene[key] for key in ["width", "height"] if key in scene}
    return dict(scene, framePoints=frame, file=relative, width=width, height=height, sha256=digest,
                capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                device=device, runtime=runtime, source=source)


def capture(output, platform):
    spec = specification()
    output.mkdir(parents=True, exist_ok=True)
    path = output / "capture-manifest.json"
    manifest = read_json(path) if path.exists() else {
        "schemaVersion": 1, "evidence": "production-view-fixtures", "profile": spec["profile"],
        "limits": LIMITS, "sourceInputs": {}, "screenshots": []
    }
    if manifest["profile"] != spec["profile"]:
        raise ValueError("Profile changed: capture a new complete companion baseline")
    records = {row["id"]: row for row in manifest["screenshots"]}
    for current in (DEVICES if platform == "all" else [platform]):
        app, inputs = build(current)
        source_hash = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()
        manifest["sourceInputs"][source_hash] = inputs
        source = {"revision": run("git", "rev-parse", "HEAD", cwd=ROOT),
                  "workingTreeDirty": bool(run("git", "status", "--porcelain", cwd=ROOT)),
                  "inputsSha256": source_hash}
        _, _, device_type, runtime, _ = DEVICES[current]
        device = simctl("create", "NeoGym Visual Fixtures " + str(uuid.uuid4())[:8],
                        "com.apple.CoreSimulator.SimDeviceType." + device_type,
                        "com.apple.CoreSimulator.SimRuntime." + runtime)
        bundle = "io.nhost.neogym.gallery." + current
        try:
            simctl("boot", device)
            simctl("bootstatus", device, "-b")
            simctl("install", device, app)
            container = Path(simctl("get_app_container", device, bundle, "data"))
            if current == "phone":
                simctl("status_bar", device, "override", "--time", "9:41", "--batteryLevel", "100")
                simctl("ui", device, "content_size", "large")
            # watchOS rejects simctl status_bar overrides. Its system clock is
            # deliberately left real; only the app's display inputs are frozen.
            for scene in spec["scenes"]:
                if scene["platform"] != current:
                    continue
                if current == "phone":
                    simctl("ui", device, "appearance", scene["appearance"])
                receipt = container / "Library/Application Support/gallery-ready.json"
                if receipt.exists():
                    receipt.unlink()
                env = clean_environment()
                env["SIMCTL_CHILD_TZ"] = "UTC"
                subprocess.run(["/usr/bin/xcrun", "simctl", "launch", "--terminate-running-process",
                                device, bundle, "--scene", scene["id"], "-AppleLanguages", "(en)",
                                "-AppleLocale", "en_US"], check=True, env=env)
                wait_for_scene(container, scene["id"])
                raw = output / "capture-in-progress.png"
                simctl("io", device, "screenshot", raw)
                records[scene["id"]] = save_capture(output, scene, raw.read_bytes(), source, records.get(scene["id"]))
                raw.unlink()
                manifest["screenshots"] = [records[item["id"]] for item in spec["scenes"] if item["id"] in records]
                PNG_TOOLS["atomic_json"](path, manifest)
                print("CAPTURED " + scene["id"], flush=True)
            if inputs != source_inputs():
                raise RuntimeError("Capture inputs changed; do not publish this partial run")
        finally:
            # Only the simulator created by this invocation is ever removed.
            subprocess.run(["/usr/bin/xcrun", "simctl", "shutdown", device], env=clean_environment(), capture_output=True)
            simctl("delete", device)
    render(output)


def validate(output, spec=None):
    spec = spec or specification()
    manifest = read_json(output / "capture-manifest.json")
    if (manifest.get("schemaVersion") != 1 or manifest.get("evidence") != "production-view-fixtures"
            or manifest.get("profile") != spec["profile"] or manifest.get("limits") != LIMITS):
        raise ValueError("Invalid evidence type, profile or disclosure")
    expected = {row["id"]: row for row in spec["scenes"]}
    rows = manifest["screenshots"]
    if len({row["id"] for row in rows}) != len(rows) or {row["id"] for row in rows} != expected.keys():
        raise ValueError("Missing or duplicate fixture captures")
    for row in rows:
        scene = expected[row["id"]]
        for key, value in scene.items():
            if key not in ["width", "height"] and row.get(key) != value:
                raise ValueError("Scene metadata mismatch: " + row["id"])
        frame = {key: scene[key] for key in ["width", "height"] if key in scene}
        if row.get("framePoints") != frame:
            raise ValueError("Fixture frame mismatch: " + row["id"])
        if row["file"] != "screenshots/" + row["id"] + ".png":
            raise ValueError("Invalid fixture image path")
        data = (output / row["file"]).read_bytes()
        if not data.startswith(b"\x89PNG\r\n\x1a\n") or hashlib.sha256(data).hexdigest() != row["sha256"]:
            raise ValueError("PNG hash mismatch: " + row["id"])
        size = struct.unpack(">II", data[16:24])
        if size != (row["width"], row["height"]) or size != DEVICES[row["platform"]][4]:
            raise ValueError("Screenshot dimensions mismatch: " + row["id"])
        if (row["device"], row["runtime"]) != DEVICES[row["platform"]][:2]:
            raise ValueError("Device metadata mismatch: " + row["id"])
        source = row["source"]
        inputs = manifest["sourceInputs"][source["inputsSha256"]]
        if hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest() != source["inputsSha256"]:
            raise ValueError("Source input digest mismatch")
        if not source.get("revision") or not row.get("capturedAt"):
            raise ValueError("Missing provenance")
    files = {str(path.relative_to(output)) for path in (output / "screenshots").glob("*.png")}
    if files != {row["file"] for row in rows}:
        raise ValueError("Orphan fixture images")
    print("Validated " + str(len(rows)) + " production-view fixtures (not integration tests).")
    return manifest


def render(output):
    manifest = read_json(output / "capture-manifest.json")
    groups = [("balance", "iPhone Balance widgets"), ("rest", "Live Activity & Dynamic Island regions"),
              ("watch-page", "Apple Watch app"), ("complication", "Watch complications")]
    sections = []
    for kind, title in groups:
        images = []
        for row in manifest["screenshots"]:
            if row["kind"] != kind:
                continue
            caption = html.escape(row["title"])
            images.append('<figure id="' + row["id"] + '"><a href="' + row["file"] + '">'
                          + '<img loading="lazy" src="' + row["file"] + '" width="' + str(row["width"])
                          + '" height="' + str(row["height"]) + '" alt="' + caption + '"></a><figcaption>'
                          + caption + '<small>' + html.escape(row["device"] + ' · ' + row["runtime"])
                          + '<br>Visual fixture · ' + html.escape(row["variant"]) + '</small></figcaption></figure>')
        sections.append('<section id="' + kind + '"><h2>' + title + '</h2><div class="frames">'
                        + ''.join(images) + '</div></section>')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>NeoGym · Widgets & Watch visual fixtures</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#09090b;color:#fafafa;font:16px/1.5 system-ui}
main{max-width:1600px;margin:auto;padding:24px}a{color:#9bb5ff}a:focus-visible{outline:3px solid #9bb5ff;outline-offset:4px}
nav{display:flex;gap:16px;flex-wrap:wrap}nav a{padding:10px 0}p,li{max-width:1000px}.frames{display:flex;gap:24px;flex-wrap:wrap;align-items:start}
figure{width:min(240px,100%);margin:0 0 28px}img{display:block;width:100%;height:auto;border:1px solid #3f3f46;border-radius:12px}
figcaption{margin-top:8px}small{display:block;color:#a1a1aa}section{margin-top:48px;scroll-margin-top:16px}h2{border-bottom:1px solid #2e2e33;padding-bottom:12px}</style>
<main><p><a href="../gallery.html">← iPhone walkthrough gallery</a> · <a href="README.md">Scope & reproduction</a> ·
<a href="capture-manifest.json">Per-image provenance</a></p><h1>Widgets & Watch · visual fixtures</h1>
<p>Production SwiftUI views, fictional data, inert controls. These are actual captures of separate simulator fixture apps,
<strong>not system-hosted widgets, watch faces or Live Activities, and not verified user workflows.</strong></p>'''
    page += '<p>' + str(len(manifest["screenshots"])) + ' fixture captures · fixed inputs at 15 Jan 2025, 13:40 UTC</p>'
    page += '<p>Phone status bar: 9:41 override. Watch system clock: actual simulator time; watchOS does not support status-bar overrides.</p>'
    page += '<nav>' + ''.join('<a href="#' + kind + '">' + title + '</a>' for kind, title in groups) + '</nav>'
    page += '<details><summary>What these images do not prove</summary><ul>'
    page += ''.join('<li>' + html.escape(limit) + '</li>' for limit in manifest["limits"]) + '</ul></details>'
    (output / "gallery.html").write_text(page + ''.join(sections) + '</main></html>\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["capture", "validate", "render"])
    parser.add_argument("--platform", choices=["all", "phone", "watch"], default="all")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.action == "capture":
        capture(args.output, args.platform)
    elif args.action == "validate":
        validate(args.output)
    else:
        render(args.output)


if __name__ == "__main__":
    main()
