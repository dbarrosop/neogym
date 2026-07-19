from __future__ import annotations

import base64
import copy
import importlib.util
import json
import plistlib
import subprocess
import sys
import tempfile
import unittest
import zipfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, cast

SCRIPTS = Path(__file__).resolve().parents[1]
FIXTURE_PATH = Path(__file__).with_name("fixtures") / "normalized-artifacts.json"


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_script("verify-artifact.py")


def load_fixtures() -> dict[str, Any]:
    try:
        value = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("artifact fixture is unavailable") from error
    if not isinstance(value, dict):
        raise RuntimeError("artifact fixture root is invalid")
    return value


def expected_from_fixture(raw: Mapping[str, str]):
    return validator.ExpectedVariant(
        variant=raw["variant"],
        app_bundle_id=raw["appBundleID"],
        widget_bundle_id=raw["widgetBundleID"],
        app_group=raw["appGroup"],
        keychain_suffix=raw["keychainSuffix"],
        callback_scheme=raw["callbackScheme"],
        app_display_name=raw["appDisplayName"],
        widget_display_name=raw["widgetDisplayName"],
        icon_name=raw["iconName"],
        nhost_subdomain=raw["nhostSubdomain"],
        nhost_region=raw["nhostRegion"],
        development_team=raw["developmentTeam"],
        minimum_os=raw["minimumOS"],
        device_family=raw["deviceFamily"],
    )


def descend(mapping: dict[str, Any], dotted_path: str) -> tuple[dict[str, Any], str]:
    parts = dotted_path.split(".")
    current = mapping
    while len(parts) > 1:
        remainder = ".".join(parts)
        if remainder in current:
            return current, remainder
        key = parts.pop(0)
        child = current[key]
        if not isinstance(child, dict):
            raise TypeError(dotted_path)
        current = child
    return current, parts[0]


def apply_case(base: dict[str, Any], case: Mapping[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(base)
    replacements = case.get("set", {})
    deletions = case.get("delete", [])
    if not isinstance(replacements, Mapping) or not isinstance(deletions, Sequence):
        raise TypeError("invalid negative artifact fixture")
    for path, value in replacements.items():
        if not isinstance(path, str):
            raise TypeError("invalid negative artifact fixture path")
        parent, key = descend(result, path)
        parent[key] = value
    for path in deletions:
        if not isinstance(path, str):
            raise TypeError("invalid negative artifact fixture path")
        parent, key = descend(result, path)
        del parent[key]
    return result


class NormalizedArtifactFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fixtures = load_fixtures()
        cls.expected = expected_from_fixture(cast(Mapping[str, str], cls.fixtures["expected"]))

    def test_positive_signed_normalized_fixture(self) -> None:
        artifact = validator.normalized_from_mapping(self.fixtures["positive"])
        validator.validate_normalized(self.expected, artifact)

    def test_all_negative_normalized_fixtures_fail_the_named_contract(self) -> None:
        for name, case in self.fixtures["negative"].items():
            with self.subTest(name=name):
                mutated = apply_case(self.fixtures["positive"], case)
                artifact = validator.normalized_from_mapping(mutated)
                with self.assertRaises(validator.ValidationFailure) as context:
                    validator.validate_normalized(self.expected, artifact)
                self.assertIn(case["issue"], context.exception.issues)

    def test_provisioning_keychain_wildcard_can_cover_exact_signed_group(self) -> None:
        fixture = copy.deepcopy(self.fixtures["positive"])
        fixture["app"]["provisioning"]["Entitlements"]["keychain-access-groups"] = ["PREFIX.*"]
        fixture["widget"]["provisioning"]["Entitlements"]["keychain-access-groups"] = ["PREFIX.*"]
        validator.validate_normalized(self.expected, validator.normalized_from_mapping(fixture))

    def test_build_settings_match_exact_opaque_values_and_variant_metadata(self) -> None:
        shared = {
            "DEVELOPMENT_TEAM": self.expected.development_team,
            "IPHONEOS_DEPLOYMENT_TARGET": self.expected.minimum_os,
            "TARGETED_DEVICE_FAMILY": self.expected.device_family,
            "NEOGYM_APP_GROUP_IDENTIFIER": self.expected.app_group,
            "NEOGYM_CALLBACK_SCHEME": self.expected.callback_scheme,
            "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX": self.expected.keychain_suffix,
            "NEOGYM_NHOST_SUBDOMAIN": self.expected.nhost_subdomain,
            "NEOGYM_NHOST_REGION": self.expected.nhost_region,
            "SUPPORTS_MACCATALYST": "NO",
            "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD": "NO",
            "MARKETING_VERSION": "1.0",
            "CURRENT_PROJECT_VERSION": "17",
        }
        app = {
            **shared,
            "PRODUCT_BUNDLE_IDENTIFIER": self.expected.app_bundle_id,
            "ASSETCATALOG_COMPILER_APPICON_NAME": self.expected.icon_name,
        }
        widget = {**shared, "PRODUCT_BUNDLE_IDENTIFIER": self.expected.widget_bundle_id}
        validator.validate_build_settings(self.expected, app, widget)
        app["NEOGYM_NHOST_REGION"] = "different opaque region"
        with self.assertRaises(validator.ValidationFailure) as context:
            validator.validate_build_settings(self.expected, app, widget)
        self.assertEqual(context.exception.issues, ("build-settings.app.NEOGYM_NHOST_REGION",))


class ExtractionAdapterTests(unittest.TestCase):
    def make_stub(self, root: Path, name: str, value: Mapping[str, object]) -> Path:
        encoded = base64.b64encode(plistlib.dumps(dict(value))).decode("ascii")
        path = root / name
        path.write_text(
            "#!/usr/bin/env python3\n"
            "import base64, sys\n"
            f"sys.stdout.buffer.write(base64.b64decode({encoded!r}))\n",
            encoding="utf-8",
        )
        path.chmod(0o755)
        return path

    def test_codesign_and_cms_adapters_are_command_stub_testable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            entitlements = {"application-identifier": "PREFIX.example.app"}
            provisioning = {"ApplicationIdentifierPrefix": ["PREFIX"]}
            codesign = self.make_stub(root, "codesign", entitlements)
            security = self.make_stub(root, "security", provisioning)
            adapters = validator.CommandAdapters(str(codesign), str(security))
            self.assertEqual(adapters.signed_entitlements(root, "app"), entitlements)
            self.assertEqual(adapters.provisioning(root, "app"), provisioning)

    def test_app_archive_and_ipa_layouts_resolve_without_simulator_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            app = root / "NeoGym.app"
            app.mkdir()
            with validator.artifact_workspace(app) as (resolved, signed):
                self.assertEqual(resolved, app)
                self.assertFalse(signed)

            archive_app = root / "NeoGym.xcarchive" / "Products" / "Applications" / "NeoGym.app"
            archive_app.mkdir(parents=True)
            with validator.artifact_workspace(root / "NeoGym.xcarchive") as (resolved, signed):
                self.assertEqual(resolved, archive_app)
                self.assertTrue(signed)

            ipa = root / "NeoGym.ipa"
            with zipfile.ZipFile(ipa, "w") as output:
                output.writestr("Payload/NeoGym.app/Info.plist", b"fixture")
            with validator.artifact_workspace(ipa) as (resolved, signed):
                self.assertEqual(resolved.name, "NeoGym.app")
                self.assertTrue(signed)
                extracted_root = resolved.parents[1]
                self.assertTrue(extracted_root.exists())
            self.assertFalse(extracted_root.exists())


class ArtifactCLIPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        fixtures = load_fixtures()
        cls.fixture = cast(dict[str, Any], fixtures["positive"])
        cls.expected = cast(dict[str, str], fixtures["expected"])

    def write_project_configuration(self, root: Path, subdomain: str, region: str) -> None:
        configuration = root / "Configuration"
        generated = configuration / "Generated"
        generated.mkdir(parents=True)
        (configuration / "Development.xcconfig").write_text(
            "\n".join(
                [
                    '#include "Generated/Development.xcconfig"',
                    f"NEOGYM_APP_BUNDLE_IDENTIFIER = {self.expected['appBundleID']}",
                    f"NEOGYM_WIDGET_BUNDLE_IDENTIFIER = {self.expected['widgetBundleID']}",
                    f"NEOGYM_APP_GROUP_IDENTIFIER = {self.expected['appGroup']}",
                    f"NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX = {self.expected['keychainSuffix']}",
                    f"NEOGYM_CALLBACK_SCHEME = {self.expected['callbackScheme']}",
                    f"NEOGYM_DISPLAY_NAME = {self.expected['appDisplayName']}",
                    f"NEOGYM_WIDGET_DISPLAY_NAME = {self.expected['widgetDisplayName']}",
                    f"NEOGYM_APP_ICON_NAME = {self.expected['iconName']}",
                    f"IPHONEOS_DEPLOYMENT_TARGET = {self.expected['minimumOS']}",
                    f"TARGETED_DEVICE_FAMILY = {self.expected['deviceFamily']}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        (generated / "Development.xcconfig").write_text(
            "NEOGYM_XCCONFIG_EMPTY =\n"
            f"DEVELOPMENT_TEAM = $(NEOGYM_XCCONFIG_EMPTY){self.expected['developmentTeam']}$(NEOGYM_XCCONFIG_EMPTY)\n"
            f"NEOGYM_NHOST_SUBDOMAIN = $(NEOGYM_XCCONFIG_EMPTY){subdomain}$(NEOGYM_XCCONFIG_EMPTY)\n"
            f"NEOGYM_NHOST_REGION = $(NEOGYM_XCCONFIG_EMPTY){region}$(NEOGYM_XCCONFIG_EMPTY)\n",
            encoding="utf-8",
        )
        app_entitlements = {
            "com.apple.developer.healthkit": True,
            "com.apple.security.application-groups": [
                "$(NEOGYM_APP_GROUP_IDENTIFIER)"
            ],
            "keychain-access-groups": [
                "$(AppIdentifierPrefix)$(NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX)"
            ],
        }
        widget_entitlements = {
            "com.apple.security.application-groups": [
                "$(NEOGYM_APP_GROUP_IDENTIFIER)"
            ],
            "keychain-access-groups": [
                "$(AppIdentifierPrefix)$(NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX)"
            ],
        }
        (root / "App").mkdir()
        (root / "Widgets").mkdir()
        (root / "App" / "NeoGym.entitlements").write_bytes(
            plistlib.dumps(app_entitlements)
        )
        (root / "Widgets" / "NeoGymWidgets.entitlements").write_bytes(
            plistlib.dumps(widget_entitlements)
        )

    def write_unsigned_app(self, root: Path, subdomain: str, region: str) -> Path:
        app = root / "NeoGym.app"
        widget = app / "PlugIns" / "NeoGymWidgets.appex"
        widget.mkdir(parents=True)
        app_info = copy.deepcopy(self.fixture["app"]["info"])
        widget_info = copy.deepcopy(self.fixture["widget"]["info"])
        for info in (app_info, widget_info):
            info["NeoGymNhostSubdomain"] = subdomain
            info["NeoGymNhostRegion"] = region
            info["NeoGymSharedKeychainAccessGroup"] = self.expected["keychainSuffix"]
        (app / "Info.plist").write_bytes(plistlib.dumps(app_info))
        (app / "Assets.car").write_bytes(b"synthetic compiled asset fixture")
        (widget / "Info.plist").write_bytes(plistlib.dumps(widget_info))
        return app

    def test_unsigned_product_passes_and_mismatch_never_discloses_values(self) -> None:
        expected_subdomain = "EXPECTED_OPAQUE_SENTINEL"
        actual_subdomain = "ACTUAL_OPAQUE_SENTINEL"
        region = "opaque-region"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.write_project_configuration(root, expected_subdomain, region)
            app = self.write_unsigned_app(root, expected_subdomain, region)
            command = [
                sys.executable,
                str(SCRIPTS / "verify-artifact.py"),
                "--variant",
                "development",
                "--project-root",
                str(root),
                str(app),
            ]
            passed = subprocess.run(command, text=True, capture_output=True, check=False)
            self.assertEqual(passed.returncode, 0, passed.stderr)

            app_info = plistlib.loads((app / "Info.plist").read_bytes())
            app_info["NeoGymNhostSubdomain"] = actual_subdomain
            (app / "Info.plist").write_bytes(plistlib.dumps(app_info))
            failed = subprocess.run(command, text=True, capture_output=True, check=False)
            self.assertEqual(failed.returncode, 1)
            combined = failed.stdout + failed.stderr
            self.assertIn("app.Info.NeoGymNhostSubdomain", combined)
            self.assertNotIn(expected_subdomain, combined)
            self.assertNotIn(actual_subdomain, combined)


if __name__ == "__main__":
    unittest.main()
