#!/usr/bin/env python3
"""Host-only checks; no simulator, backend or third-party Python packages required."""

import ast
import contextlib
import hashlib
import io
import json
import runpy
import struct
import tempfile
import unittest
import zlib
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

TOOLS = runpy.run_path(str(Path(__file__).with_name("capture-demo-guide.py")))
WORKFLOWS = runpy.run_path(str(Path(__file__).with_name("demo-guide-workflows.py")))


def chunk(kind, payload):
    return (struct.pack(">I", len(payload)) + kind + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff))


def png(width=2, height=2, level=0, apple_offsets=False):
    raw = (b"\0" + b"\x10\x20\x30" * width) * height
    compressed = zlib.compress(raw, level)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    midpoint = len(compressed) // 2
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"sRGB", b"\0")
    if apple_offsets:
        data += chunk(b"iDOT", b"obsolete IDAT offsets")
    data += chunk(b"IDAT", compressed[:midpoint]) + chunk(b"IDAT", compressed[midpoint:])
    return data + chunk(b"IEND", b""), raw


def chunks(data):
    result, position = [], 8
    while position < len(data):
        length = struct.unpack(">I", data[position:position + 4])[0]
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + length]
        crc = struct.unpack(">I", data[position + 8 + length:position + 12 + length])[0]
        assert crc == zlib.crc32(kind + payload) & 0xffffffff
        result.append((kind, payload))
        position += length + 12
    return result


class CaptureToolTests(unittest.TestCase):
    def test_lossless_recompression_preserves_pixels_and_color_metadata(self):
        original, raw = png(apple_offsets=True)
        optimized = TOOLS["lossless_png"](original)
        parts = chunks(optimized)
        self.assertEqual(zlib.decompress(b"".join(data for kind, data in parts if kind == b"IDAT")), raw)
        self.assertEqual([part for part in parts if part[0] == b"sRGB"], [(b"sRGB", b"\0")])
        self.assertNotIn(b"iDOT", [kind for kind, _ in parts])
        self.assertLess(len(optimized), len(original))
        self.assertEqual(TOOLS["lossless_png"](optimized), optimized)

    def test_saved_numeric_values_fail_with_a_clear_assertion_when_malformed(self):
        self.assertEqual(WORKFLOWS["persisted_number"]("180"), 180)
        for value in [None, "not numeric"]:
            with self.assertRaisesRegex(AssertionError, "saved demo value was not numeric"):
                WORKFLOWS["persisted_number"](value)

    def test_rejects_non_png_input(self):
        with self.assertRaisesRegex(ValueError, "Expected a PNG"):
            TOOLS["lossless_png"](b"not an image")

    def test_optimization_preserves_capture_hash_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "screenshots").mkdir()
            original, _ = png(apple_offsets=True)
            image = output / "screenshots" / "sample.png"
            image.write_bytes(original)
            digest = hashlib.sha256(original).hexdigest()
            manifest = {"screenshots": [{"file": "screenshots/sample.png", "sha256": digest}]}
            (output / "capture-manifest.json").write_text(json.dumps(manifest))
            TOOLS["optimize_screenshots"](output)
            first = image.read_bytes()
            TOOLS["optimize_screenshots"](output)
            record = json.loads((output / "capture-manifest.json").read_text())["screenshots"][0]
            self.assertEqual(image.read_bytes(), first)
            self.assertEqual(record["capturedSha256"], digest)
            self.assertEqual(record["sha256"], hashlib.sha256(first).hexdigest())

    def test_gallery_escapes_titles(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            manifest = {"screenshots": [{"id": "sample", "file": "screenshots/sample.png",
                                          "title": '<script>alert("unsafe")</script>'}]}
            (output / "capture-manifest.json").write_text(json.dumps(manifest))
            TOOLS["render_gallery"](output)
            document = (output / "gallery.html").read_text()
            self.assertNotIn('<script>alert("unsafe")</script>', document)
            self.assertEqual(document.count("<script>"), 1)  # Only the static page controls.
            self.assertIn("&lt;script&gt;", document)


    def test_walkthrough_links_actions_checks_and_issue_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            manifest = {
                "workflows": [{"id": "sample", "title": "Sample", "status": "passed",
                               "steps": ["Open the editor"], "checks": ["Saved locally"]}],
                "screenshots": [{"id": "sample-image", "file": "screenshots/sample-image.png",
                                 "title": "Saved screen", "workflow": "sample"}],
                "knownIssues": [{"id": "example", "description": "Use Back after deletion.",
                                 "screenshots": ["sample-image"]}],
            }
            TOOLS["render_workflows"](output, manifest)
            document = (output / "workflows.md").read_text()
            self.assertIn('<a id="sample"></a>', document)
            self.assertIn("1. Open the editor", document)
            self.assertIn("- Saved locally", document)
            self.assertIn("screenshots/sample-image.png", document)
            self.assertIn("Use Back after deletion.", document)


class GalleryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.fragments, self.rows, self.scripts = [], [], {}, 0
        self.current_row = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "id" in attributes:
            self.ids.append(attributes["id"])
        href = attributes.get("href") or ""
        if tag == "a" and href.startswith("#"):
            self.fragments.append(href[1:])
        if tag == "article":
            self.current_row = attributes["id"]
            self.rows[self.current_row] = []
        if tag == "img":
            self.rows[self.current_row].append(attributes["src"])
        if tag == "script":
            self.scripts += 1


class WorkflowGalleryTests(unittest.TestCase):
    def setUp(self):
        names = ["22-foods", "22-food-create", "22-food-create-filled", "22-food-created", "22-food-edit",
                 "22-food-updated", "22-food-delete-confirmation", "22-food-deleted-detail-issue", "22-food-deleted"]
        self.manifest = {
            "workflows": [
                {"id": "root-nutrition-foods", "title": "Browse foods", "status": "passed", "steps": ["Open Foods"]},
                {"id": "food-crud", "title": "Food CRUD", "status": "passed", "steps": ["Create, edit and delete"],
                 "checks": ["Changes are local"]},
            ],
            "screenshots": [{"id": name, "title": "Screen " + name, "file": "screenshots/" + name + ".png",
                             "workflow": "root-nutrition-foods" if name == "22-foods" else "food-crud"}
                            for name in names],
            "knownIssues": [{"id": "delete-navigation", "description": "Use Back after deletion.",
                             "screenshots": ["22-food-deleted-detail-issue"]}],
        }

    def rows(self):
        return [row for section in TOOLS["GALLERY"]["build_sections"](self.manifest) for row in section["rows"]]

    def test_splits_create_edit_and_delete_with_ordered_shared_context(self):
        rows = {row["id"]: [item["id"] for item in row["images"]] for row in self.rows()}
        self.assertEqual(rows["create-food"], ["22-foods", "22-food-create", "22-food-create-filled", "22-food-created"])
        self.assertEqual(rows["edit-food"], ["22-food-created", "22-food-edit", "22-food-updated"])
        self.assertEqual(rows["delete-food"], ["22-food-updated", "22-food-edit", "22-food-delete-confirmation",
                                              "22-food-deleted-detail-issue", "22-food-deleted"])

    def test_single_page_links_reuse_original_images_and_include_issue_evidence(self):
        document = TOOLS["GALLERY"]["render_gallery_html"](self.manifest)
        parser = GalleryParser()
        parser.feed(document)
        self.assertEqual(len(parser.ids), len(set(parser.ids)))
        self.assertTrue(set(parser.fragments) <= set(parser.ids))
        self.assertEqual(parser.rows["edit-food"][0], "screenshots/22-food-created.png")
        self.assertEqual(parser.rows["create-food"][-1], parser.rows["edit-food"][0])
        self.assertIn("Reused view", document)
        self.assertIn("Use Back after deletion.", document)
        self.assertIn("Changes are local", document)
        self.assertIn('tabindex="0"', document)
        self.assertEqual(parser.scripts, 1)

    def test_missing_curated_image_fails_instead_of_emitting_a_broken_link(self):
        self.manifest["screenshots"] = [image for image in self.manifest["screenshots"] if image["id"] != "22-food-edit"]
        with self.assertRaisesRegex(ValueError, "Missing gallery frames: 22-food-edit"):
            self.rows()

    def test_new_workflows_and_additional_images_remain_visible(self):
        self.manifest["workflows"].append({"id": "new-workflow", "title": "Future workflow", "status": "passed"})
        for identifier, source in [("extra-food", "food-crud"), ("future", "new-workflow"), ("orphan", None)]:
            self.manifest["screenshots"].append({"id": identifier, "title": identifier,
                                                 "file": "screenshots/" + identifier + ".png", "workflow": source})
        rows = self.rows()
        self.assertTrue({"additional-food-crud", "additional-new-workflow", "additional-screens"}
                        <= {row["id"] for row in rows})
        self.assertEqual({item["id"] for row in rows for item in row["images"]},
                         {item["id"] for item in self.manifest["screenshots"]})

    def test_escapes_workflow_titles_actions_checks_errors_and_issue_notes(self):
        attack = '<img src=x onerror="alert(1)">'
        for workflow in self.manifest["workflows"]:
            workflow.update(title=attack, steps=[attack], checks=[attack], error=attack)
        self.manifest["knownIssues"][0]["description"] = attack
        document = TOOLS["GALLERY"]["render_gallery_html"](self.manifest)
        self.assertNotIn(attack, document)
        self.assertIn("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;", document)
        parser = GalleryParser()
        parser.feed(document)
        self.assertEqual(parser.scripts, 1)

    def test_published_catalog_covers_all_captures_without_fallback_rows(self):
        manifest = json.loads((TOOLS["DEFAULT_OUTPUT"] / "capture-manifest.json").read_text())
        sections = TOOLS["GALLERY"]["build_sections"](manifest)
        self.assertEqual([section["id"] for section in sections], ["demo", "today", "train", "nutrition", "progress", "me"])
        rows = [row for section in sections for row in section["rows"]]
        self.assertEqual({item["id"] for row in rows for item in row["images"]},
                         {item["id"] for item in manifest["screenshots"]})
        self.assertEqual({row["source"] for row in rows}, {workflow["id"] for workflow in manifest["workflows"]})
        self.assertGreater(len(rows), len(manifest["workflows"]))


class CatalogValidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name)
        (self.output / "screenshots").mkdir()
        data, _ = png(1206, 2622, level=9)
        self.manifest = {"screenshots": [], "workflows": [
            {"id": "root-today", "status": "passed"}, {"id": "sample", "status": "passed"}
        ]}
        for identifier in ["01-today", "sample"]:
            file = "screenshots/" + identifier + ".png"
            (self.output / file).write_bytes(data)
            self.manifest["screenshots"].append({"id": identifier, "file": file, "width": 1206,
                                                  "height": 2622, "sha256": hashlib.sha256(data).hexdigest()})
        self.source = ast.parse("ROOTS = [('today', 'Today', None, '01-today', 'Today')]\n"
                                "GROUPS = {'roots': roots, 'sample': sample}\n"
                                "def sample(guide):\n    guide.shot('sample', 'Sample')\n")

    def validate(self):
        (self.output / "capture-manifest.json").write_text(json.dumps(self.manifest))
        with patch.object(TOOLS["ast"], "parse", return_value=self.source), contextlib.redirect_stdout(io.StringIO()):
            TOOLS["validate_catalog"](self.output)

    def test_accepts_a_complete_catalog(self):
        self.validate()

    def test_rejects_failed_workflows(self):
        self.manifest["workflows"][1]["status"] = "failed"
        with self.assertRaisesRegex(ValueError, "Missing or failed workflows: sample"):
            self.validate()

    def test_requires_dynamically_named_root_screenshots(self):
        self.manifest["screenshots"] = self.manifest["screenshots"][1:]
        with self.assertRaisesRegex(ValueError, "Missing screenshots: 01-today"):
            self.validate()

    def test_rejects_duplicate_screenshot_ids(self):
        self.manifest["screenshots"].append(self.manifest["screenshots"][0].copy())
        with self.assertRaisesRegex(ValueError, "Duplicate screenshot IDs"):
            self.validate()

    def test_rejects_changed_image_bytes(self):
        image = self.output / "screenshots" / "sample.png"
        image.write_bytes(image.read_bytes()[:-1] + b"X")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            self.validate()

    def test_rejects_orphan_images(self):
        (self.output / "screenshots" / "orphan.png").write_bytes(b"not catalogued")
        with self.assertRaisesRegex(ValueError, "directory and manifest do not match"):
            self.validate()

    def test_rejects_missing_issue_evidence(self):
        self.manifest["knownIssues"] = [{"id": "example", "screenshots": ["missing"]}]
        with self.assertRaisesRegex(ValueError, "Known issue references a missing screenshot"):
            self.validate()


if __name__ == "__main__":
    unittest.main()
