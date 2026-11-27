"""Offline catalog/renderer regressions; no browser, simulator or backend needed."""

import hashlib
import json
import runpy
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

TOOLS = runpy.run_path(str(Path(__file__).with_name("web-gallery.py")))
REPO = Path(__file__).resolve().parents[1]


def png(width, height):
    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = zlib.compress((b"\0" + b"\0\0\0" * width) * height)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")


IMAGES = {name: png(size["width"], size["height"]) for name, size in TOOLS["REGISTRY"]["profiles"].items()}


class WebGalleryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name)
        (self.output / "screenshots").mkdir()
        fixture = TOOLS["FIXTURE"]
        profile = {"version": fixture["version"], "fixtureVersion": fixture["fixtureVersion"],
                   "fixedBrowserTime": fixture["now"], "fixtureDate": fixture["now"][:10],
                   "rasterArgs": fixture["rasterArgs"], "viewports": TOOLS["REGISTRY"]["profiles"]}
        self.manifest = {"schemaVersion": 1, "platform": "web", "captureProfile": profile,
                         "lastRun": {"status": "passed"},
                         "screenshots": [], "workflows": [], "knownIssues": []}
        for source, names in TOOLS["required_frames"]().items():
            self.manifest["workflows"].append({"id": source, "title": source, "status": "passed",
                                                "steps": ["Open real UI"], "checks": ["Verified outcome"]})
            for name in names:
                data = IMAGES[source.split("-", 1)[0]]
                image = {"id": name, "workflow": source, "title": name,
                         "file": "screenshots/" + name + ".png", "captureProfile": profile,
                         "width": struct.unpack(">I", data[16:20])[0], "height": struct.unpack(">I", data[20:24])[0],
                         "sha256": hashlib.sha256(data).hexdigest(), "capturedAt": "2026-11-17T12:00:00Z"}
                (self.output / image["file"]).write_bytes(data)
                self.manifest["screenshots"].append(image)
        self.save()

    def save(self):
        (self.output / "capture-manifest.json").write_text(json.dumps(self.manifest))

    def test_complete_catalog_and_separate_crud_rows(self):
        manifest, sections = TOOLS["validate_catalog"](self.output)
        rows = [row for section in sections for row in section["rows"]]
        self.assertEqual(len(manifest["workflows"]), 52)
        self.assertEqual(len(manifest["screenshots"]), 117)
        self.assertEqual(len(rows), 56)
        self.assertIn("mobile-root-overview", [row["id"] for row in rows])
        self.assertEqual([row["id"] for row in rows if row["id"].startswith("mobile-journal-")],
                         ["mobile-journal-create", "mobile-journal-edit", "mobile-journal-delete"])
        for profile in ("desktop", "mobile"):
            source = profile + "-progress-photos"
            photo_row = next(row for row in rows if row["id"] == source)
            self.assertEqual([image["id"] for image in photo_row["images"]], [
                source + "-" + frame for frame in
                ("empty", "prepared", "timeline", "viewer", "edit", "compare", "filtered", "confirm", "deleted")
            ])

    def test_desktop_today_summary_reuses_the_root_while_mobile_shows_both_cards(self):
        _, sections = TOOLS["validate_catalog"](self.output)
        rows = {row["id"]: row for _, _, section_rows in TOOLS["layout"]() for row in section_rows}
        self.assertEqual(rows["desktop-today-summary"]["images"], ["desktop-root-today-root"])
        self.assertEqual(rows["mobile-today-summary"]["images"],
                         ["mobile-today-summary-balance", "mobile-today-summary-body"])
        self.assertIn("desktop-today-summary", [row["id"] for section in sections for row in section["rows"]])
        TOOLS["render_workflows"](self.output, self.manifest)
        self.assertIn("(screenshots/desktop-root-today-root.png) (reused view)",
                      (self.output / "workflows.md").read_text())

    def test_renderer_uses_actual_web_dimensions_and_escapes_titles(self):
        self.manifest["screenshots"][0]["title"] = '<script>alert("bad")</script>'
        document = TOOLS["SHARED"]["render_gallery_html"](
            self.manifest, TOOLS["layout"](), TOOLS["PAGE"], frame_width=440, image_ratio=None)
        self.assertIn('width="1440" height="1000"', document)
        self.assertIn('width="390" height="844"', document)
        self.assertNotIn("aspect-ratio:", document)
        self.assertIn("&lt;script&gt;", document)
        self.assertNotIn('<script>alert("bad")</script>', document)
        self.assertEqual(document.count("<script>"), 1)
        self.assertIn("Reused view", document)

    def test_render_command_uses_intrinsic_image_ratios(self):
        with patch("sys.argv", ["web-gallery.py", "render", "--output", str(self.output)]):
            TOOLS["main"]()
        document = (self.output / "gallery.html").read_text()
        self.assertIn('width="1440" height="1000"', document)
        self.assertIn('width="390" height="844"', document)
        self.assertNotIn("aspect-ratio:", document)

    def test_missing_or_failed_workflow_is_not_publishable(self):
        self.manifest["workflows"][0]["status"] = "failed"
        self.save()
        with self.assertRaisesRegex(ValueError, "failed workflows"):
            TOOLS["validate_catalog"](self.output)

    def test_missing_required_frame_is_not_publishable(self):
        self.manifest["screenshots"].pop()
        self.save()
        with self.assertRaisesRegex(ValueError, "Missing or misassigned"):
            TOOLS["validate_catalog"](self.output)

    def test_retired_frame_cannot_remain_in_the_manifest(self):
        source = next(image for image in self.manifest["screenshots"]
                      if image["id"] == "mobile-session-edit")
        retired_id = "mobile-session-returned"
        retired = {**source, "id": retired_id, "file": "screenshots/" + retired_id + ".png"}
        (self.output / retired["file"]).write_bytes((self.output / source["file"]).read_bytes())
        self.manifest["screenshots"].append(retired)
        self.save()
        with self.assertRaisesRegex(ValueError, "Unregistered workflows or frames: " + retired_id):
            TOOLS["validate_catalog"](self.output)

    def test_failed_latest_attempt_cannot_reuse_old_passing_evidence(self):
        self.manifest["lastRun"]["status"] = "failed"
        self.save()
        with self.assertRaisesRegex(ValueError, "latest capture attempt"):
            TOOLS["validate_catalog"](self.output)

    def test_duplicate_ids_are_rejected(self):
        self.manifest["screenshots"].append(self.manifest["screenshots"][0])
        self.save()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            TOOLS["validate_catalog"](self.output)

    def test_hash_and_dimensions_are_verified(self):
        self.manifest["screenshots"][0]["sha256"] = "bad"
        self.save()
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            TOOLS["validate_catalog"](self.output)
        self.manifest["screenshots"][0]["width"] = 390
        self.save()
        with self.assertRaisesRegex(ValueError, "viewport mismatch"):
            TOOLS["validate_catalog"](self.output)

    def test_orphan_files_are_rejected(self):
        (self.output / "screenshots/orphan.png").write_bytes(IMAGES["mobile"])
        with self.assertRaisesRegex(ValueError, "Orphan"):
            TOOLS["validate_catalog"](self.output)

    def test_real_clock_baselines_cannot_be_relabeled_as_fixed(self):
        self.manifest["captureProfile"]["fixedBrowserTime"] = "2025-01-16T09:41:00.000Z"
        self.save()
        with self.assertRaisesRegex(ValueError, "Unknown fixed capture profile"):
            TOOLS["validate_catalog"](self.output)

    def test_mixed_profiles_are_rejected(self):
        self.manifest["screenshots"][0]["captureProfile"] = {"version": 99}
        self.save()
        with self.assertRaisesRegex(ValueError, "Mixed capture profiles"):
            TOOLS["validate_catalog"](self.output)

    def test_path_traversal_and_symlinks_are_rejected(self):
        image = self.manifest["screenshots"][0]
        original = image["file"]
        image["file"] = "../outside.png"
        self.save()
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            TOOLS["validate_catalog"](self.output)
        image["file"] = original
        self.save()
        path = self.output / original
        path.unlink()
        path.symlink_to(self.output / self.manifest["screenshots"][1]["file"])
        with self.assertRaisesRegex(ValueError, "ordinary catalog file"):
            TOOLS["validate_catalog"](self.output)

    def test_missing_issue_evidence_is_rejected(self):
        self.manifest["knownIssues"] = [{"id": "issue", "screenshots": ["missing"]}]
        self.save()
        with self.assertRaisesRegex(ValueError, "missing evidence"):
            TOOLS["validate_catalog"](self.output)

    def test_ios_output_is_unchanged_by_shared_renderer(self):
        renderer = runpy.run_path(str(REPO / "ios/NeoGym/Scripts/demo-guide-gallery.py"))
        manifest = json.loads((REPO / "docs/ios/capture-manifest.json").read_text())
        self.assertEqual(renderer["render_gallery_html"](manifest), (REPO / "docs/ios/gallery.html").read_text())


if __name__ == "__main__":
    unittest.main()
