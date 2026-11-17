#!/usr/bin/env python3
"""Client for the opt-in DemoGuideCaptureUITests simulator documentation driver.

Use a newly created simulator, never one containing a real account. See
../../../docs/ios/README.md for capture instructions and coverage boundaries.
Only Python's standard library and the host Xcode tools are required.
"""

import argparse
import ast
import hashlib
import html
import json
import os
import runpy
import struct
import subprocess
import time
import uuid
import zlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = REPO / "docs" / "ios"
GALLERY = runpy.run_path(str(Path(__file__).with_name("demo-guide-gallery.py")))


def xcrun(*args):
    environment = dict(os.environ)
    environment.pop("SDKROOT", None)
    environment.pop("DEVELOPER_DIR", None)
    return subprocess.check_output(
        ["/usr/bin/xcrun", *args], env=environment, text=True
    ).strip()


def read_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read JSON from {path}: {error}") from error


CAPTURE_PROFILE = read_json(REPO / "ios/NeoGym/Sources/NeoGymKit/Resources/gallery-capture.json")


def atomic_json(path, value):
    content = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text() == content:
        return
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content)
    temporary.replace(path)


def upsert_record(records, record):
    for index, previous in enumerate(records):
        if previous["id"] == record["id"]:
            records[index] = record
            return
    records.append(record)


def lossless_png(data):
    """Recompress IDAT without resizing, recolouring or changing a single filtered pixel byte."""
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected a PNG screenshot")
    chunks, position, stream = [], 8, bytearray()
    while position < len(data):
        length = int.from_bytes(data[position:position + 4], "big")
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + length]
        chunk = data[position:position + length + 12]
        chunks.append((kind, chunk))
        if kind == b"IDAT":
            stream.extend(payload)
        position += length + 12
    compressed = zlib.compress(zlib.decompress(bytes(stream)), 9)
    replacement = struct.pack(">I", len(compressed)) + b"IDAT" + compressed
    replacement += struct.pack(">I", zlib.crc32(b"IDAT" + compressed) & 0xffffffff)
    result, inserted = bytearray(data[:8]), False
    for kind, chunk in chunks:
        if kind == b"IDAT":
            if not inserted:
                result.extend(replacement)
                inserted = True
        elif kind != b"iDOT":
            # Apple's optional parallel-decode offsets describe the old IDAT layout.
            result.extend(chunk)
    return bytes(result) if len(result) < len(data) else data


class Guide:
    def __init__(self, device, output=DEFAULT_OUTPUT, root=None):
        self.device = device
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        (self.output / "screenshots").mkdir(exist_ok=True)
        self.root = Path(root) if root else Path(xcrun(
            "simctl", "get_app_container", device,
            "io.nhost.dbarroso.neogym.uitests.xctrunner", "data"
        )) / "Documents" / "NeoGymGuide"
        if not (self.root / "ready.json").exists():
            raise RuntimeError("Capture test is not ready; wait for NEOGYM_GUIDE_READY.")
        self.path = self.output / "capture-manifest.json"
        self.manifest = read_json(self.path) if self.path.exists() else {
            "schemaVersion": 1,
            "sourceRevision": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=REPO, text=True
            ).strip(),
            "device": "iPhone 17",
            "runtime": "iOS 27.0",
            "locale": "en_US",
            "appearance": "Dark unless the screenshot explicitly demonstrates Light/System",
            "statusBar": "9:41, full signal and battery (cosmetic simulator override)",
            "data": "Fictional populated demo; versioned capture clock/profile recorded per image",
            "screenshots": [],
            "workflows": [],
        }
        self.workflow = None
        self.steps = []
        self.checks = []
        self.prepare_device()

    def prepare_device(self):
        xcrun("simctl", "ui", self.device, "appearance", "dark")
        xcrun("simctl", "ui", self.device, "content_size", CAPTURE_PROFILE["contentSize"])
        flags = [value for key, item in CAPTURE_PROFILE["statusBar"].items()
                 for value in ("--" + key, str(item))]
        xcrun("simctl", "status_bar", self.device, "override", *flags)

    def call(self, action, **values):
        if action == "launch":
            values["environment"] = {**values.get("environment", {}),
                                     "NEOGYM_DEMO_CAPTURE": "1", "TZ": CAPTURE_PROFILE["timeZone"]}
        request = {"id": str(uuid.uuid4()), "action": action, **values}
        atomic_json(self.root / "request.json", request)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            try:
                response = json.loads((self.root / "response.json").read_text())
            except (FileNotFoundError, json.JSONDecodeError):
                response = {}
            if response.get("id") == request["id"]:
                if not response.get("ok"):
                    error_tree = self.root / "last-error-tree.txt"
                    error_tree.write_text(response.get("tree", ""))
                    raise RuntimeError(response.get("error", "Unknown driver error"))
                return response["result"]
            time.sleep(0.05)
        raise TimeoutError("Simulator driver did not answer " + action)

    @staticmethod
    def element(label=None, kind="button", **values):
        return {"type": kind, **({"label": label} if label is not None else {}), **values}

    def tap(self, label, kind="button", **values):
        visible = self.exists(label, kind, timeout=0.2, **values)
        if visible["exists"] and not visible["hittable"]:
            self.reveal(label, kind=kind, attempts=5, **values)
        return self.call("tap", element=self.element(label, kind, **values))

    def type(self, label, text, kind="textField", replace=True, selection=None, tap_x=None, **values):
        self.reveal(label, kind=kind, attempts=5, **values)
        return self.call("type", element=self.element(label, kind, **values),
                         text=text, replace=replace, selection=selection, tapX=tap_x)

    def query(self, label=None, kind="button", **values):
        return self.call("query", element=self.element(label, kind, **values))["elements"]

    def exists(self, label, kind="button", timeout=1.0, **values):
        return self.call("exists", element=self.element(label, kind, **values), timeout=timeout,
                         **({"presenceOnly": True} if kind == "keyboard" else {}))

    def expect(self, label, kind="text", **values):
        result = self.exists(label, kind, timeout=12, **values)
        if not result["exists"]:
            raise AssertionError("Expected UI element: " + label)
        return result

    def launch(self, screen="today", reset=True, **values):
        self.call("launch", screen=screen, reset=reset, **values)
        self.expect("demo.banner", kind="any")

    def scroll(self, direction="up", count=1):
        for _ in range(count):
            # Begin above the software keyboard; a full-app swipe can hit its keys instead.
            start, end = (0.55, 0.27) if direction == "up" else (0.30, 0.62)
            # Left card padding avoids both chart drags and the right-hand scroll indicator.
            self.call("drag", x=0.06, y=start, toX=0.06, toY=end)

    def reveal(self, label, kind="button", direction="up", attempts=10, **values):
        for _ in range(attempts + 1):
            result = self.exists(label, kind, timeout=0.2, **values)
            if result["hittable"]:
                return
            self.scroll(direction)
        raise AssertionError("Could not reveal: " + label)

    def back(self):
        buttons = self.query(kind="button", scope=self.element(kind="navigationBar"))
        candidates = [button for button in buttons if button["hittable"]]
        if not candidates:
            raise AssertionError("No native Back button")
        self.tap(candidates[0]["label"], scope=self.element(kind="navigationBar"))

    def state_path(self):
        container = Path(xcrun("simctl", "get_app_container", self.device,
                               "io.nhost.dbarroso.neogym", "data"))
        return container / "Library" / "Application Support" / "NeoGymDemo" / "state-v1.json"

    def state(self):
        return read_json(self.state_path())

    def rows(self, table):
        return list(self.state()["tables"].get(table, {}).values())

    def require(self, description, condition):
        if not condition:
            raise AssertionError(description)
        self.checks.append(description)

    def note_issue(self, identifier, description, screenshot):
        issues = self.manifest.setdefault("knownIssues", [])
        issue = next((item for item in issues if item["id"] == identifier), None)
        if issue is None:
            issue = {"id": identifier, "description": description, "screenshots": []}
            issues.append(issue)
        issue["description"] = description
        if screenshot not in issue["screenshots"]:
            issue["screenshots"].append(screenshot)
        self.save()

    def step(self, description):
        print("STEP " + description, flush=True)
        self.steps.append(description)

    def position(self, label, kind="text", anchor=None, **values):
        """Drag from headings, not interactive plots, to frame a complete chart."""
        index = values.pop("index", 0)
        previous = None
        for _ in range(12):
            matches = self.call("query", element=self.element(label, kind, **values))["elements"]
            item = matches[index] if len(matches) > index else None
            top = item["frame"][1] if item else 1000
            if item and item["hittable"] and (190 <= top <= 360 or top == previous):
                return
            previous = top
            delta = top - 275
            start_item = item if item and item["hittable"] else None
            if start_item is None and anchor:
                candidates = self.call("query", element=anchor)["elements"]
                start_item = next((row for row in candidates if row["hittable"]), None)
            if start_item is None:
                self.scroll("up" if delta > 0 else "down")
                continue
            x, y, width, height = start_item["frame"]
            start = (y + height / 2) / 874
            distance = max(48, min(abs(delta), 300)) / 874
            end = start - distance if delta > 0 else start + distance
            end = max(0.21, min(end, 0.89))
            x = (x + width / 2) / 402
            self.call("drag", x=x, y=start, toX=x, toY=end)
        raise AssertionError("Could not position section: " + label)

    def shot(self, name, title):
        result = self.call("screenshot", name=name)
        captured = Path(result["path"]).read_bytes()
        data = lossless_png(captured)
        width, height = struct.unpack(">II", data[16:24])
        destination = self.output / "screenshots" / (name + ".png")
        if not destination.exists() or destination.read_bytes() != data:
            destination.write_bytes(data)
        previous = next((item for item in self.manifest["screenshots"] if item["id"] == name), None)
        record = {
            "id": name, "title": title, "file": str(destination.relative_to(self.output)),
            "capturedSha256": hashlib.sha256(captured).hexdigest(),
            "workflow": self.workflow, "capturedAt": result["capturedAt"],
            "width": width, "height": height, "sha256": hashlib.sha256(data).hexdigest(),
            "steps": list(self.steps), "captureProfile": CAPTURE_PROFILE,
        }
        # Keep the first identical capture's provenance; wall-clock timestamps and
        # different PNG chunk/compression layouts are not a new visual baseline.
        if previous and previous["sha256"] == record["sha256"] and previous.get("captureProfile") == CAPTURE_PROFILE:
            record["capturedAt"] = previous["capturedAt"]
            record["capturedSha256"] = previous["capturedSha256"]
        trees = REPO / ".nhost-code" / "tmp" / "demo-guide" / "trees"
        trees.mkdir(parents=True, exist_ok=True)
        (trees / (name + ".txt")).write_text(result["tree"])
        upsert_record(self.manifest["screenshots"], record)
        self.save()
        print("CAPTURED " + name, flush=True)
        return result["tree"]

    def save(self):
        atomic_json(self.path, self.manifest)

    def run_workflow(self, name, title, function):
        self.workflow = name
        self.steps = []
        self.checks = []
        record = {"id": name, "title": title, "status": "in_progress"}
        upsert_record(self.manifest["workflows"], record)
        self.save()
        print("WORKFLOW " + name, flush=True)
        try:
            function(self)
        except Exception as error:
            record.update(status="failed", error=str(error), steps=list(self.steps), checks=list(self.checks))
            try:
                failure = self.call("screenshot", name="failure-" + name)
                directory = REPO / ".nhost-code" / "tmp" / "demo-guide" / "failures"
                directory.mkdir(parents=True, exist_ok=True)
                (directory / (name + ".png")).write_bytes(Path(failure["path"]).read_bytes())
                (directory / (name + ".txt")).write_text(failure["tree"])
            except Exception as diagnostic_error:
                record["diagnosticError"] = str(diagnostic_error)
            self.save()
            raise
        record.update(status="passed", steps=list(self.steps), checks=list(self.checks))
        self.save()
        print("PASSED " + name, flush=True)


def optimize_screenshots(output):
    output = Path(output)
    manifest = read_json(output / "capture-manifest.json")
    for record in manifest["screenshots"]:
        path = output / record["file"]
        original = path.read_bytes()
        optimized = lossless_png(original)
        record.setdefault("capturedSha256", hashlib.sha256(original).hexdigest())
        record["sha256"] = hashlib.sha256(optimized).hexdigest()
        if optimized != original:
            path.write_bytes(optimized)
    manifest["pngStorage"] = "Original resolution; lossless IDAT recompression only"
    atomic_json(output / "capture-manifest.json", manifest)


def validate_catalog(output):
    output = Path(output)
    manifest = read_json(output / "capture-manifest.json")
    source = ast.parse(Path(__file__).with_name("demo-guide-workflows.py").read_text())
    assignments = {node.targets[0].id: node.value for node in source.body
                   if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)}
    roots = ast.literal_eval(assignments["ROOTS"])
    group_node = assignments["GROUPS"]
    if not isinstance(group_node, ast.Dict):
        raise ValueError("Workflow registry must be a dictionary")
    groups = {str(key.value) for key in group_node.keys if isinstance(key, ast.Constant)}
    required_workflows = {"root-" + row[0].replace("/", "-") for row in roots} | (groups - {"roots"})
    workflows = {row["id"]: row for row in manifest["workflows"]}
    if len(workflows) != len(manifest["workflows"]):
        raise ValueError("Duplicate workflow IDs")
    failures = sorted({name for name in required_workflows
                       if workflows.get(name, {}).get("status") != "passed"}
                      | {row["id"] for row in workflows.values() if row["status"] != "passed"})
    if failures:
        raise ValueError("Missing or failed workflows: " + ", ".join(failures))
    required_images = {str(node.args[0].value) for node in ast.walk(source)
                       if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                       and isinstance(node.func.value, ast.Name) and node.func.value.id == "guide"
                       and node.func.attr == "shot" and node.args
                       and isinstance(node.args[0], ast.Constant)} | {row[3] for row in roots}
    screenshots = {row["id"]: row for row in manifest["screenshots"]}
    if len(screenshots) != len(manifest["screenshots"]):
        raise ValueError("Duplicate screenshot IDs")
    if len({row["file"] for row in screenshots.values()}) != len(screenshots):
        raise ValueError("Screenshots must have distinct files")
    profiles = {}
    for row in screenshots.values():
        profile = json.dumps(row.get("captureProfile"), sort_keys=True)
        profiles.setdefault(profile, []).append(row["id"])
    if len(profiles) > 1:
        details = "\n".join(profile + ": " + ", ".join(sorted(identifiers))
                            for profile, identifiers in sorted(profiles.items()))
        raise ValueError("Mixed capture profiles: publish only a complete, reviewed baseline (--group all). "
                         "If that run has already completed, review obsolete conditional issue evidence "
                         "per docs/ios/capture.md; never relabel old captures.\n"
                         "Screenshot IDs by captureProfile (null = legacy):\n" + details)
    missing = required_images - screenshots.keys()
    if missing:
        raise ValueError("Missing screenshots: " + ", ".join(sorted(missing)))
    for issue in manifest.get("knownIssues", []):
        if not set(issue["screenshots"]) <= screenshots.keys():
            raise ValueError("Known issue references a missing screenshot: " + issue["id"])
    for record in screenshots.values():
        data = (output / record["file"]).read_bytes()
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Not a PNG: " + record["file"])
        if hashlib.sha256(data).hexdigest() != record["sha256"]:
            raise ValueError("Screenshot hash mismatch: " + record["file"])
        if struct.unpack(">II", data[16:24]) != (record["width"], record["height"]):
            raise ValueError("Screenshot size mismatch: " + record["file"])
        if (record["width"], record["height"]) != (1206, 2622):
            raise ValueError("Unexpected iPhone 17 screenshot dimensions: " + record["file"])
    files = {str(path.relative_to(output)) for path in (output / "screenshots").glob("*.png")}
    if files != {row["file"] for row in screenshots.values()}:
        raise ValueError("Screenshot directory and manifest do not match")
    sections = GALLERY["build_sections"](manifest)
    gallery_rows = [row for section in sections for row in section["rows"]]
    displayed = {item["id"] for row in gallery_rows for item in row["images"]}
    if displayed != screenshots.keys():
        raise ValueError("Gallery does not include every screenshot")
    print(f"Validated {len(screenshots)} PNG images, all {len(roots)} roots and {len(required_workflows)} workflows; "
          f"{len(gallery_rows)} visual workflow rows.")


def render_workflows(output, manifest):
    images = manifest["screenshots"]
    workflows = sorted(manifest.get("workflows", []), key=lambda row: min(
        (item["id"] for item in images if item.get("workflow") == row["id"]), default=row["id"]))
    lines = ["# Recorded iPhone walkthroughs", "",
             "Generated from [`capture-manifest.json`](capture-manifest.json). Do not edit this file by hand.", "",
             "See [the guide](README.md) for scope, limitations and the simulator setup. "
             "A passed workflow may include an explicitly documented navigation workaround; "
             "see its known-issue evidence below.", "", "## Contents", ""]
    for workflow in workflows:
        lines.append(f'- [{workflow["title"]}](#{workflow["id"]})')
    for workflow in workflows:
        identifier = workflow["id"]
        lines.extend(["", f'<a id="{html.escape(identifier, quote=True)}"></a>', "",
                      "## " + workflow["title"], "", f'**Workflow:** `{identifier}` · **Status:** {workflow["status"]}', ""])
        if workflow.get("error"):
            lines.extend(["```text", workflow["error"], "```", ""])
        lines.extend(f"{index}. {step}" for index, step in enumerate(workflow.get("steps", []), 1))
        if workflow.get("checks"):
            lines.extend(["", "**Verified outcomes**", ""])
            lines.extend("- " + check for check in workflow["checks"])
        current = sorted((row for row in images if row.get("workflow") == identifier), key=lambda row: row["id"])
        if current:
            lines.extend(["", "**Screenshots**", "", "| Capture | Screen / state |", "|---|---|"])
            lines.extend(f'| [`{row["id"]}`]({row["file"]}) | {row["title"].replace("|", "/")} |' for row in current)
        current_ids = {row["id"] for row in current}
        for issue in manifest.get("knownIssues", []):
            evidence = current_ids & set(issue["screenshots"])
            if evidence:
                lines.extend(["", "**Observed issue:** " + issue["description"], ""])
                lines.extend(f'- [Evidence: `{name}`](screenshots/{name}.png)' for name in sorted(evidence))
    (Path(output) / "workflows.md").write_text("\n".join(lines) + "\n")


def render_gallery(output):
    output = Path(output)
    manifest = read_json(output / "capture-manifest.json")
    (output / "gallery.html").write_text(GALLERY["render_gallery_html"](manifest))
    render_workflows(output, manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device")
    parser.add_argument("--root")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("action", choices=["command", "render", "optimize", "validate"])
    parser.add_argument("payload", nargs="?", default="{}")
    arguments = parser.parse_args()
    actions = {"render": render_gallery, "optimize": optimize_screenshots, "validate": validate_catalog}
    if arguments.action in actions:
        actions[arguments.action](arguments.output)
        return
    if not arguments.device:
        parser.error("--device is required; use a fresh dedicated simulator")
    guide = Guide(arguments.device, arguments.output, arguments.root)
    try:
        command = json.loads(arguments.payload)
    except json.JSONDecodeError as error:
        parser.error(f"Invalid command JSON: {error}")
    result = guide.call(command.pop("action"), **command)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
