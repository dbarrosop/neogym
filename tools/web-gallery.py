#!/usr/bin/env python3
"""Validate/render the browser catalog without a browser, backend or dependencies."""

import argparse
import hashlib
import html
import json
import re
import runpy
import struct
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO / "docs/web"
SHARED = runpy.run_path(str(Path(__file__).with_name("gallery.py")))
def read_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("Cannot read gallery JSON: " + str(path)) from error


REGISTRY = read_json(REPO / "frontend/scripts/gallery/catalog.json")
FIXTURE = read_json(REPO / "frontend/scripts/gallery/profile.json")
AREAS = [("getting-started", "Getting started"), ("today", "Today"), ("train", "Train"),
         ("nutrition", "Nutrition"), ("progress", "Progress"), ("me", "Me")]


def frame_names(workflow, profile):
    override = workflow.get("layoutOverrides", {}).get(profile, {})
    return override.get("frames", workflow["frames"])


def layout():
    sections = []
    for area, title in AREAS:
        rows = []
        for profile in REGISTRY["profiles"]:
            for root in REGISTRY["roots"]:
                if root["area"] == area:
                    source = profile + "-root-" + root["id"]
                    rows.append({"id": source, "source": source, "context": []})
            for workflow in REGISTRY["workflows"]:
                if workflow["area"] != area:
                    continue
                source = profile + "-" + workflow["id"]
                if workflow["id"] == "journal-crud":
                    for action, names in [
                        ("create", ["new", "filled", "created"]),
                        ("edit", ["created", "edit", "updated"]),
                        ("delete", ["updated", "confirm", "deleted"]),
                    ]:
                        rows.append({"id": profile + "-journal-" + action, "source": source,
                                     "title": action.capitalize() + " a journal entry · " + profile,
                                     "images": [source + "-" + name for name in names]})
                else:
                    override = workflow.get("layoutOverrides", {}).get(profile, {})
                    names = ([profile + "-" + frame for frame in override.get("context", [])]
                             + [source + "-" + frame for frame in frame_names(workflow, profile)])
                    rows.append({"id": source, "source": source, "images": names})
        sections.append((area, title, rows))
    return sections


def required_frames():
    result = {}
    for profile in REGISTRY["profiles"]:
        for root in REGISTRY["roots"]:
            source = profile + "-root-" + root["id"]
            result[source] = [source + "-root"]
        for workflow in REGISTRY["workflows"]:
            source = profile + "-" + workflow["id"]
            result[source] = [source + "-" + frame for frame in frame_names(workflow, profile)]
    return result


def validate_catalog(output):
    output = Path(output)
    manifest = read_json(output / "capture-manifest.json")
    if manifest.get("schemaVersion") != 1 or manifest.get("platform") != "web":
        raise ValueError("Expected a version 1 web capture manifest")
    if manifest.get("lastRun", {}).get("status") != "passed":
        raise ValueError("The latest capture attempt did not finish successfully")
    profile = manifest.get("captureProfile", {})
    if (profile.get("version") != FIXTURE["version"]
            or profile.get("fixtureVersion") != FIXTURE["fixtureVersion"]
            or profile.get("fixtureDate") != FIXTURE["now"][:10]
            or profile.get("fixedBrowserTime") != FIXTURE["now"]
            or profile.get("rasterArgs") != FIXTURE["rasterArgs"]
            or profile.get("viewports") != REGISTRY["profiles"]):
        raise ValueError("Unknown fixed capture profile or viewport dimensions")
    workflows = {row["id"]: row for row in manifest["workflows"]}
    images = {row["id"]: row for row in manifest["screenshots"]}
    if len(workflows) != len(manifest["workflows"]) or len(images) != len(manifest["screenshots"]):
        raise ValueError("Duplicate workflow or screenshot IDs")
    required = required_frames()
    failed = [name for name in required if workflows.get(name, {}).get("status") != "passed"]
    failed += [name for name, row in workflows.items() if row.get("status") != "passed"]
    if failed:
        raise ValueError("Missing or failed workflows: " + ", ".join(sorted(set(failed))))
    for source, names in required.items():
        if not workflows[source].get("checks"):
            raise ValueError("Workflow has no recorded checks: " + source)
        for name in names:
            if name not in images or images[name]["workflow"] != source:
                raise ValueError("Missing or misassigned screenshot: " + name)
    extra_workflows = workflows.keys() - required.keys()
    extra_frames = images.keys() - {name for names in required.values() for name in names}
    if extra_workflows or extra_frames:
        raise ValueError("Unregistered workflows or frames: " + ", ".join(sorted(extra_workflows | extra_frames)))
    files = set()
    for name, image in images.items():
        if not re.fullmatch(r"[a-z0-9-]+", name) or image["file"] != "screenshots/" + name + ".png":
            raise ValueError("Unsafe screenshot ID or path")
        path = output / image["file"]
        if path.is_symlink() or path.resolve().parent != (output / "screenshots").resolve():
            raise ValueError("Screenshot must be an ordinary catalog file")
        if image["captureProfile"] != profile:
            raise ValueError("Mixed capture profiles; review a complete new baseline")
        source = image["workflow"]
        if source not in workflows:
            raise ValueError("Screenshot references unknown workflow: " + name)
        viewport = REGISTRY["profiles"].get(source.split("-", 1)[0])
        dimensions = (image["width"], image["height"])
        if not viewport or dimensions != (viewport["width"], viewport["height"]):
            raise ValueError("Screenshot viewport mismatch: " + name)
        timestamp = datetime.fromisoformat(image["capturedAt"].replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            raise ValueError("Capture time must include its timezone")
        data = path.read_bytes()
        if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 33:
            raise ValueError("Not a PNG: " + name)
        if struct.unpack(">II", data[16:24]) != dimensions:
            raise ValueError("PNG dimensions do not match metadata: " + name)
        if hashlib.sha256(data).hexdigest() != image["sha256"]:
            raise ValueError("Screenshot hash mismatch: " + name)
        files.add(image["file"])
    actual = {str(path.relative_to(output)) for path in (output / "screenshots").rglob("*.png")}
    if files != actual or len(files) != len(images):
        raise ValueError("Orphan or duplicate screenshot files")
    for issue in manifest.get("knownIssues", []):
        if not set(issue["screenshots"]) <= images.keys():
            raise ValueError("Known issue references missing evidence")
    sections = SHARED["build_sections"](manifest, layout())
    displayed = {image["id"] for section in sections for row in section["rows"] for image in row["images"]}
    if displayed != images.keys():
        raise ValueError("Not every capture appears in the gallery")
    return manifest, sections


PAGE = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NeoGym Web — visual workflows</title>
<style>
$style
</style>
</head>
<body>
<header id="top">
<p class="eyebrow">NeoGym · Web app guide</p>
<h1>Every captured workflow, screen by screen.</h1>
<p class="stats">$row_count visual workflow rows · $image_count original screenshots · $workflow_count source walkthroughs</p>
<p>Real browser captures of the frontend, grouped by app area. Each row reads <strong>left to right</strong>.
Desktop (1440 × 1000) and mobile (390 × 844) are separate walkthroughs, not resized versions of one image.</p>
<p class="muted">Scroll each strip sideways. Click a frame for its original PNG. Shared context frames retain
their original provenance and are marked “Reused view”. Browser viewport captures omit browser chrome.</p>
<details><summary>Scope, evidence and limitations</summary>
<p>The real frontend talks to local Nhost. Each layout resets only its reserved fictional gallery account and
private fixtures. No production sessions, shared-data writes or database resets are used. Fonts, the browser's
application date and the seeded history are pinned; Auth, database and provenance clocks remain real.</p>
<p>The catalog covers every web section root and representative OTP verification, Today summaries, session logging
and editing, exercise details, nutrition logging and editing, progress charts, progress photos with synthetic illustrations,
journal CRUD and appearance workflows. It is not exhaustive CRUD, state, tablet or browser compatibility coverage.
Health/Watch actions remain native-only.</p>
<p>“Apple Health” markers are fictional fixture notes demonstrating read-only source presentation, not evidence of an import.
Recorded backend checks do not replace the backend permission/integrity suite. Offline validation verifies retained
evidence and file integrity; it does not rerun browser workflows.</p>
<p><a href="README.md">Guide and coverage</a> · <a href="workflows.md">Recorded action log</a> ·
<a href="capture-manifest.json">Capture provenance</a> · <a href="capture.md">Refresh instructions</a></p>
</details>
</header>
<div class="toolbar"><div class="toolbar-inner">
<nav aria-label="Workflow sections">$navigation</nav>
<div class="controls">
<label>Find workflow <input id="workflow-search" type="search" placeholder="e.g. journal mobile" autocomplete="off"></label>
<label>Screen size <select id="screen-size"><option value="300">Small</option><option value="440" selected>Medium</option><option value="680">Large</option></select></label>
</div>
<p id="result-count" role="status" aria-live="polite">Showing all $row_count workflows</p>
</div></div>
<main id="workflows">$content<p id="no-results" hidden>No workflows match. Try a different search.</p></main>
<footer><p>Dependency-free HTML with adjacent <code>screenshots/</code>. Viewing needs no browser driver or backend.</p>
<p><a href="#top">Back to top</a></p></footer>
<script>
$script
</script>
</body>
</html>
'''


def render_workflows(output, manifest):
    lines = ["# Recorded web walkthroughs", "", "Generated from `capture-manifest.json`; do not edit by hand.", "",
             "[Gallery](gallery.html) · [Capture instructions](capture.md)", "",
             "These are retained results, not a new run of the browser workflows."]
    row_frames = {}
    for _, _, rows in layout():
        for row in rows:
            row_frames.setdefault(row["source"], set()).update(row.get("images", []))
    for workflow in manifest["workflows"]:
        identifier = workflow["id"]
        lines += ["", '<a id="' + html.escape(identifier, quote=True) + '"></a>', "",
                  "## " + workflow["title"], "", "**Status:** " + workflow["status"], ""]
        lines += [str(index) + ". " + step for index, step in enumerate(workflow["steps"], 1)]
        lines += ["", "**Verified outcomes**", ""] + ["- " + check for check in workflow["checks"]]
        lines += ["", "**Screenshots**", ""] + [
            "- [" + image["title"] + "](" + image["file"] + ")"
            + (" (reused view)" if image["workflow"] != identifier else "")
            for image in manifest["screenshots"]
            if image["workflow"] == identifier or image["id"] in row_frames[identifier]]
    (Path(output) / "workflows.md").write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["validate", "render"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    manifest, sections = validate_catalog(args.output)
    rows = sum(len(section["rows"]) for section in sections)
    if args.action == "render":
        document = SHARED["render_gallery_html"](manifest, layout(), PAGE, frame_width=440, image_ratio=None)
        (args.output / "gallery.html").write_text(document)
        render_workflows(args.output, manifest)
    print("Validated {} PNGs, {} passing walkthroughs, {} visual rows; {} roots × {} layouts.".format(
        len(manifest["screenshots"]), len(manifest["workflows"]), rows,
        len(REGISTRY["roots"]), len(REGISTRY["profiles"])))


if __name__ == "__main__":
    main()
