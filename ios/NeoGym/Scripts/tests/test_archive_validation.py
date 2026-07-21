from __future__ import annotations

import importlib.util
import io
import plistlib
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from typing import Any
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_script("verify-archive.py")

APP_GROUP = "group.com.example.neogym"
KEYCHAIN_SUFFIX = "com.example.neogym.shared"
KEYCHAIN_GROUP = f"PREFIX.{KEYCHAIN_SUFFIX}"


def valid_info() -> dict[str, Any]:
    return {
        "CFBundleShortVersionString": "2.1",
        "CFBundleVersion": "42",
        "NeoGymAppGroupIdentifier": APP_GROUP,
        "NeoGymSharedKeychainAccessGroup": KEYCHAIN_GROUP,
        "NeoGymSharedKeychainAccessGroupSuffix": KEYCHAIN_SUFFIX,
    }


def valid_entitlements() -> dict[str, Any]:
    return {
        "com.apple.security.application-groups": [APP_GROUP],
        "keychain-access-groups": [KEYCHAIN_GROUP],
    }


def valid_metadata():
    return validator.ArchiveMetadata(
        app=validator.BundleMetadata(valid_info(), valid_entitlements()),
        widget=validator.BundleMetadata(valid_info(), valid_entitlements()),
    )


def mutable_metadata() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    app_info = valid_info()
    widget_info = valid_info()
    app_entitlements = valid_entitlements()
    widget_entitlements = valid_entitlements()
    return app_info, widget_info, app_entitlements, widget_entitlements


def metadata_from(values: tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]):
    app_info, widget_info, app_entitlements, widget_entitlements = values
    return validator.ArchiveMetadata(
        app=validator.BundleMetadata(app_info, app_entitlements),
        widget=validator.BundleMetadata(widget_info, widget_entitlements),
    )


class InvariantValidationTests(unittest.TestCase):
    def assert_issue(self, metadata, issue: str) -> None:
        with self.assertRaises(validator.ValidationFailure) as context:
            validator.validate_invariants(metadata)
        self.assertIn(issue, context.exception.issues)

    def test_positive_release_archive_metadata(self) -> None:
        validator.validate_invariants(valid_metadata())

    def test_rejects_unresolved_plist_and_entitlement_tokens_recursively(self) -> None:
        values = mutable_metadata()
        values[0]["nested"] = {"value": "${UNRESOLVED}"}
        values[3]["nested"] = ["$(UNRESOLVED)"]
        with self.assertRaises(validator.ValidationFailure) as context:
            validator.validate_invariants(metadata_from(values))
        self.assertIn("app.Info.unresolved-build-setting", context.exception.issues)
        self.assertIn(
            "widget.entitlements.unresolved-build-setting", context.exception.issues
        )

    def test_rejects_empty_and_mismatched_app_groups(self) -> None:
        values = mutable_metadata()
        values[2]["com.apple.security.application-groups"] = []
        self.assert_issue(
            metadata_from(values),
            "app.entitlements.com.apple.security.application-groups",
        )

        values = mutable_metadata()
        values[3]["com.apple.security.application-groups"] = ["group.example.other"]
        self.assert_issue(metadata_from(values), "archive.app-group-parity")

    def test_rejects_app_group_runtime_mismatch(self) -> None:
        values = mutable_metadata()
        values[1]["NeoGymAppGroupIdentifier"] = "group.example.other"
        self.assert_issue(
            metadata_from(values), "widget.Info.NeoGymAppGroupIdentifier"
        )

    def test_rejects_empty_and_mismatched_keychain_groups(self) -> None:
        values = mutable_metadata()
        values[2]["keychain-access-groups"] = []
        self.assert_issue(
            metadata_from(values), "app.entitlements.keychain-access-groups"
        )

        values = mutable_metadata()
        values[3]["keychain-access-groups"] = ["PREFIX.example.other.shared"]
        self.assert_issue(metadata_from(values), "archive.keychain-parity")

    def test_rejects_keychain_runtime_mismatch(self) -> None:
        values = mutable_metadata()
        values[0]["NeoGymSharedKeychainAccessGroup"] = "PREFIX.example.other.shared"
        self.assert_issue(
            metadata_from(values), "app.Info.NeoGymSharedKeychainAccessGroup"
        )

    def test_rejects_keychain_suffix_inconsistency_and_mismatch(self) -> None:
        values = mutable_metadata()
        values[1]["NeoGymSharedKeychainAccessGroupSuffix"] = "example.other.shared"
        with self.assertRaises(validator.ValidationFailure) as context:
            validator.validate_invariants(metadata_from(values))
        self.assertIn(
            "widget.Info.NeoGymSharedKeychainAccessGroupSuffix",
            context.exception.issues,
        )
        self.assertIn("archive.keychain-suffix-parity", context.exception.issues)

    def test_accepts_unprefixed_keychain_group_when_it_equals_suffix(self) -> None:
        values = mutable_metadata()
        for info in values[:2]:
            info["NeoGymSharedKeychainAccessGroup"] = KEYCHAIN_SUFFIX
        for entitlements in values[2:]:
            entitlements["keychain-access-groups"] = [KEYCHAIN_SUFFIX]
        validator.validate_invariants(metadata_from(values))

    def test_rejects_marketing_version_mismatch(self) -> None:
        values = mutable_metadata()
        values[1]["CFBundleShortVersionString"] = "2.2"
        self.assert_issue(
            metadata_from(values),
            "archive.version-parity.CFBundleShortVersionString",
        )

    def test_rejects_build_number_mismatch(self) -> None:
        values = mutable_metadata()
        values[1]["CFBundleVersion"] = "43"
        self.assert_issue(metadata_from(values), "archive.version-parity.CFBundleVersion")

    def test_rejects_empty_versions(self) -> None:
        values = mutable_metadata()
        values[0]["CFBundleVersion"] = ""
        self.assert_issue(metadata_from(values), "archive.version-parity.CFBundleVersion")


class SyntheticArchiveExtractionTests(unittest.TestCase):
    def write_archive(self, root: Path) -> tuple[Path, Path, Path]:
        archive = root / "NeoGym.xcarchive"
        app = archive / "Products" / "Applications" / "NeoGym.app"
        widget = app / "PlugIns" / "NeoGymWidgets.appex"
        widget.mkdir(parents=True)
        (app / "Info.plist").write_bytes(plistlib.dumps(valid_info()))
        (widget / "Info.plist").write_bytes(plistlib.dumps(valid_info()))
        return archive, app, widget

    @staticmethod
    def entitlement_reader(_bundle: Path, _label: str):
        return valid_entitlements()

    def test_extracts_and_validates_synthetic_archive_layout(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, _, _ = self.write_archive(Path(temporary))
            metadata = validator.extract_archive(archive, self.entitlement_reader)
            validator.validate_invariants(metadata)

    def test_requires_exactly_one_application(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, _, _ = self.write_archive(root)
            duplicate = archive / "Products" / "Applications" / "Other.app"
            duplicate.mkdir()
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, self.entitlement_reader)
            self.assertEqual(context.exception.issues, ("archive.Products.Applications",))

    def test_rejects_missing_application(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "NeoGym.xcarchive"
            archive.mkdir()
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, self.entitlement_reader)
            self.assertEqual(context.exception.issues, ("archive.Products.Applications",))

    def test_rejects_missing_and_duplicate_widget_extensions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, _, widget = self.write_archive(Path(temporary))
            (widget / "Info.plist").unlink()
            widget.rmdir()
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, self.entitlement_reader)
            self.assertEqual(
                context.exception.issues, ("app.PlugIns.NeoGymWidgets.appex",)
            )

        with tempfile.TemporaryDirectory() as temporary:
            archive, app, _ = self.write_archive(Path(temporary))
            (app / "PlugIns" / "Duplicate" / "NeoGymWidgets.appex").mkdir(
                parents=True
            )
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, self.entitlement_reader)
            self.assertEqual(
                context.exception.issues, ("app.PlugIns.NeoGymWidgets.appex",)
            )

    def test_rejects_malformed_or_missing_metadata(self) -> None:
        cases = (
            (
                "app.Info.plist",
                Path("Products/Applications/NeoGym.app/Info.plist"),
            ),
            (
                "widget.Info.plist",
                Path(
                    "Products/Applications/NeoGym.app/PlugIns/NeoGymWidgets.appex/Info.plist"
                ),
            ),
        )
        for label, relative in cases:
            for malformed in (False, True):
                with (
                    self.subTest(label=label, malformed=malformed),
                    tempfile.TemporaryDirectory() as temporary,
                ):
                    archive, _, _ = self.write_archive(Path(temporary))
                    path = archive / relative
                    if malformed:
                        path.write_bytes(b"not a plist")
                    else:
                        path.unlink()
                    with self.assertRaises(validator.ValidationFailure) as context:
                        validator.extract_archive(archive, self.entitlement_reader)
                    self.assertEqual(context.exception.issues, (label,))

    def test_rejects_failed_or_non_dictionary_entitlement_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, _, _ = self.write_archive(Path(temporary))

            def failed_reader(_bundle: Path, label: str):
                raise validator.ValidationFailure([f"{label}.signed-entitlements"])

            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, failed_reader)
            self.assertEqual(context.exception.issues, ("app.signed-entitlements",))

            with self.assertRaises(validator.ValidationFailure) as context:
                validator.extract_archive(archive, lambda _bundle, _label: [])
            self.assertEqual(context.exception.issues, ("app.signed-entitlements",))


class CodesignReaderAndDiagnosticsTests(unittest.TestCase):
    def test_codesign_is_only_an_entitlement_reader(self) -> None:
        payload = plistlib.dumps(valid_entitlements())
        completed = subprocess.CompletedProcess([], 0, payload, b"")
        with mock.patch.object(validator.subprocess, "run", return_value=completed) as run:
            self.assertEqual(
                validator.read_signed_entitlements(Path("Synthetic.app"), "app"),
                valid_entitlements(),
            )
        command = run.call_args.args[0]
        self.assertEqual(command[0], "/usr/bin/codesign")
        self.assertIn("--entitlements", command)
        self.assertNotIn("--verify", command)

    def test_codesign_failure_and_non_dictionary_output_fail_safely(self) -> None:
        failed = subprocess.CompletedProcess([], 1, b"", b"opaque failure")
        with mock.patch.object(validator.subprocess, "run", return_value=failed):
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.read_signed_entitlements(Path("Synthetic.app"), "widget")
        self.assertEqual(context.exception.issues, ("widget.signed-entitlements",))

        non_dictionary = subprocess.CompletedProcess(
            [], 0, plistlib.dumps(["not", "a", "dictionary"]), b""
        )
        with mock.patch.object(validator.subprocess, "run", return_value=non_dictionary):
            with self.assertRaises(validator.ValidationFailure) as context:
                validator.read_signed_entitlements(Path("Synthetic.app"), "widget")
        self.assertEqual(context.exception.issues, ("widget.signed-entitlements",))

    def test_cli_diagnostics_never_disclose_mismatched_values(self) -> None:
        expected_sentinel = "EXPECTED_OPAQUE_SENTINEL"
        actual_sentinel = "ACTUAL_OPAQUE_SENTINEL"
        metadata = valid_metadata()
        app_info = dict(metadata.app.info)
        widget_info = dict(metadata.widget.info)
        app_entitlements = dict(metadata.app.entitlements)
        widget_entitlements = dict(metadata.widget.entitlements)
        app_info["NeoGymAppGroupIdentifier"] = expected_sentinel
        widget_entitlements["com.apple.security.application-groups"] = [
            actual_sentinel
        ]
        mismatched = validator.ArchiveMetadata(
            validator.BundleMetadata(app_info, app_entitlements),
            validator.BundleMetadata(widget_info, widget_entitlements),
        )
        stderr = io.StringIO()
        with mock.patch.object(validator, "extract_archive", return_value=mismatched):
            with redirect_stderr(stderr):
                result = validator.main(["Synthetic.xcarchive"])
        output = stderr.getvalue()
        self.assertEqual(result, 1)
        self.assertIn("archive validation error:", output)
        self.assertNotIn(expected_sentinel, output)
        self.assertNotIn(actual_sentinel, output)


if __name__ == "__main__":
    unittest.main()
