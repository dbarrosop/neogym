#!/usr/bin/env python3
"""Offline checks for the separately versioned Widgets & Watch fixture catalog."""

import copy
import hashlib
import json
import runpy
import tempfile
import unittest
from pathlib import Path

TOOLS = runpy.run_path(str(Path(__file__).with_name("capture-surface-gallery.py")))
PNG = runpy.run_path(str(Path(__file__).with_name("test_demo_guide.py")))["png"]
ROOT = TOOLS["ROOT"]


class SurfaceGalleryTests(unittest.TestCase):
    def make_catalog(self, directory):
        spec = TOOLS["specification"]()
        scene = spec["scenes"][0]
        spec = dict(spec, scenes=[scene])
        inputs = {"fixture.swift": "a" * 64}
        digest = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()
        source = {"revision": "test-revision", "workingTreeDirty": True, "inputsSha256": digest}
        image, _ = PNG(1206, 2622)
        record = TOOLS["save_capture"](directory, scene, image, source)
        manifest = {"schemaVersion": 1, "evidence": "production-view-fixtures", "profile": spec["profile"],
                    "limits": TOOLS["LIMITS"], "sourceInputs": {digest: inputs}, "screenshots": [record]}
        self.save(directory, manifest)
        return spec, manifest, image

    @staticmethod
    def save(directory, manifest):
        (directory / "capture-manifest.json").write_text(json.dumps(manifest))

    def test_registry_covers_shipping_families_and_explicit_states(self):
        scenes = TOOLS["specification"]()["scenes"]
        self.assertEqual(len(scenes), 45)
        self.assertEqual({row["family"] for row in scenes if row["kind"] == "balance"},
                         {"small", "medium", "inline", "rectangular", "circular"})
        self.assertEqual({(row["region"], row["variant"]) for row in scenes if row["kind"] == "rest"},
                         {(region, state) for region in ["lock-screen", "expanded", "compact", "minimal"]
                          for state in ["running", "over"]})
        pages = {row["page"] for row in scenes if row["kind"] == "watch-page"}
        self.assertTrue({"today", "end-of-day", "account", "health", "connect", "reauthenticate",
                         "auth-error", "phone-signed-out", "clearing", "error", "diagnostics"} <= pages)
        self.assertEqual({row["family"] for row in scenes if row["kind"] == "complication"},
                         {"rectangular", "circular"})

    def test_health_scene_keeps_normal_first_run_content_and_enabled_allow(self):
        scene = next(row for row in TOOLS["specification"]()["scenes"] if row["id"] == "watch-health")
        self.assertEqual((scene["title"], scene["page"], scene["variant"]),
                         ("Allow Health access", "health", "populated"))
        models = (ROOT / "ios/NeoGym/Gallery/Watch/GalleryWatchModels.swift").read_text()
        for gate in ["let contextReady = true", "let profileError: String? = nil", "let isReadingProfile = false"]:
            self.assertIn(gate, models)
        app = (ROOT / "ios/NeoGym/Gallery/Watch/GalleryWatchApp.swift").read_text()
        health_page = app.split('case "health":', 1)[1].split('case "diagnostics":', 1)[0]
        self.assertIn("WatchHealthAccessPage(runtime: runtime, account: account)", health_page)
        self.assertNotIn(".defaultScrollAnchor", health_page)

    def test_no_production_runtime_or_entitlements_in_capture_targets(self):
        spec = (ROOT / "ios/NeoGym/Gallery/project.yml").read_text()
        for forbidden in ["NeoGym.entitlements", "NeoGymWatch.entitlements", "WatchEnergyRuntime.swift",
                          "NeoGymWatchApp.swift", "NeoGymApp.swift", "RestTimerIntents.swift",
                          "RefreshEnergyBalanceIntent.swift", "- path: ../Watch\n", "- target:"]:
            self.assertNotIn(forbidden, spec)
        for path in (ROOT / "ios/NeoGym/Gallery").rglob("*.swift"):
            text = path.read_text()
            for forbidden in ["NhostClientFactory.", "AuthStore(", "WCSession.", "HKHealthStore(",
                              "WatchEnergyRuntime(", "WatchPATKeychainStore(", "EnergyBalanceWidgetSnapshotStore."]:
                self.assertNotIn(forbidden, text, str(path))
        for platform in ["Phone", "Watch"]:
            app = (ROOT / "ios/NeoGym/Gallery" / platform / ("Gallery" + platform + "App.swift")).read_text()
            self.assertIn(".allowsHitTesting(false)", app)
        self.assertIn("func perform() async throws -> some IntentResult { .result() }",
                      (ROOT / "ios/NeoGym/Gallery/Phone/GalleryPhoneApp.swift").read_text())

    def test_shipping_targets_do_not_compile_gallery_and_use_real_clock(self):
        self.assertNotIn("Gallery", (ROOT / "ios/NeoGym/project.yml").read_text())
        runtime = (ROOT / "ios/NeoGym/Watch/WatchEnergyRuntime.swift").read_text()
        self.assertIn("var displayDate: Date { Date() }", runtime)
        self.assertIn("func refreshFromPage() async { await refresh(trigger: .manual) }", runtime)
        pages = (ROOT / "ios/NeoGym/Watch/WatchTodayPages.swift").read_text()
        self.assertIn("at: runtime.displayDate", pages)
        self.assertNotIn("GalleryFixtures", pages)

    def test_readiness_checks_foundation_locale_and_timezone(self):
        for locale, offset, valid in [("en_US", 0, True), ("en_001", 0, False), ("en_US", 3600, False)]:
            with self.subTest(locale=locale, offset=offset), tempfile.TemporaryDirectory() as folder:
                directory = Path(folder)
                receipt = directory / "Library/Application Support/gallery-ready.json"
                receipt.parent.mkdir(parents=True)
                receipt.write_text(json.dumps({"scene": "test", "locale": locale, "timeZoneOffsetSeconds": offset}))
                if valid:
                    TOOLS["wait_for_scene"](directory, "test")
                else:
                    with self.assertRaisesRegex(RuntimeError, "locale/time zone"):
                        TOOLS["wait_for_scene"](directory, "test")

    def test_identical_capture_preserves_pixels_timestamp_and_source(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            spec, manifest, image = self.make_catalog(directory)
            first = manifest["screenshots"][0]
            before = (directory / first["file"]).read_bytes()
            second = TOOLS["save_capture"](directory, spec["scenes"][0], image, {"new": "source"}, first)
            self.assertEqual(first, second)
            self.assertEqual(before, (directory / first["file"]).read_bytes())
            TOOLS["validate"](directory, spec)

    def test_missing_and_duplicate_captures_fail(self):
        for mutation in [lambda rows: [], lambda rows: rows + rows]:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as folder:
                directory = Path(folder)
                spec, manifest, _ = self.make_catalog(directory)
                manifest["screenshots"] = mutation(manifest["screenshots"])
                self.save(directory, manifest)
                with self.assertRaisesRegex(ValueError, "Missing or duplicate"):
                    TOOLS["validate"](directory, spec)

    def test_false_evidence_profile_hash_dimensions_and_orphans_fail(self):
        for change in ["evidence", "profile", "hash", "dimensions", "frame", "source", "orphan", "path"]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                directory = Path(folder)
                spec, manifest, _ = self.make_catalog(directory)
                row = manifest["screenshots"][0]
                if change == "evidence":
                    manifest["evidence"] = "system-hosted-workflows"
                elif change == "profile":
                    manifest["profile"] = copy.deepcopy(manifest["profile"])
                    manifest["profile"]["referenceDate"] = "2026-01-01T00:00:00Z"
                elif change == "hash":
                    row["sha256"] = "invalid"
                elif change == "dimensions":
                    row["width"] = 99
                elif change == "frame":
                    row["framePoints"]["width"] = 99
                elif change == "source":
                    manifest["sourceInputs"][row["source"]["inputsSha256"]]["fixture.swift"] = "changed"
                elif change == "path":
                    row["file"] = "../outside.png"
                else:
                    (directory / "screenshots/orphan.png").write_bytes(b"orphan")
                self.save(directory, manifest)
                with self.assertRaises(ValueError):
                    TOOLS["validate"](directory, spec)

    def test_published_companion_is_complete_and_linked_without_mixing_counts(self):
        output = TOOLS["DEFAULT_OUTPUT"]
        manifest = TOOLS["validate"](output)
        page = (output / "gallery.html").read_text()
        for row in manifest["screenshots"]:
            self.assertIn('id="' + row["id"] + '"', page)
            self.assertIn('src="' + row["file"] + '"', page)
        main_page = (ROOT / "docs/ios/gallery.html").read_text()
        self.assertIn('href="widgets-watch/gallery.html"', main_page)
        self.assertIn("255 original screenshots", main_page)
        self.assertIn("46 source walkthroughs", main_page)
        main_manifest = TOOLS["read_json"](ROOT / "docs/ios/capture-manifest.json")
        self.assertEqual(len(main_manifest["screenshots"]), 255)
        self.assertFalse({row["id"] for row in manifest["screenshots"]}
                         & {row["id"] for row in main_manifest["screenshots"]})

    def test_renderer_uses_actual_dimensions_and_discloses_fixture_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            _, manifest, _ = self.make_catalog(directory)
            TOOLS["render"](directory)
            page = (directory / "gallery.html").read_text()
            self.assertIn('width="1206" height="2622"', page)
            self.assertIn('id="' + manifest["screenshots"][0]["id"] + '"', page)
            self.assertIn("not system-hosted", page)
            self.assertIn("not verified user workflows", page)
            self.assertIn("../gallery.html", page)


if __name__ == "__main__":
    unittest.main()
