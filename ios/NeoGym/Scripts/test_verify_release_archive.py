#!/usr/bin/env python3
"""Offline verifier regression tests; no developer account or signing required."""

import datetime
import importlib.util
import plistlib
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("verify-release-archive.py")
spec = importlib.util.spec_from_file_location("release_verifier", SCRIPT)
assert spec is not None and spec.loader is not None
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ReleaseVerifierTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / "Fixture.xcarchive"
        self.app = self.archive / "Products/Applications/NeoGym.app"
        self.watch = self.app / "Watch/NeoGymWatch.app"
        self.widget = self.app / "PlugIns/NeoGymWidgets.appex"
        for bundle, identifier, os_name, family, executable in (
            (self.app, verifier.PHONE, "iphoneos", [1], "NeoGym"),
            (self.watch, verifier.WATCH, "watchos", [4], "NeoGymWatch"),
            (self.widget, verifier.WIDGET, "iphoneos", [1], "NeoGymWidgets"),
        ):
            bundle.mkdir(parents=True)
            info = {
                "CFBundleIdentifier": identifier,
                "CFBundlePackageType": "XPC!" if bundle == self.widget else "APPL",
                "DTPlatformName": os_name,
                "MinimumOSVersion": "27.0",
                "UIDeviceFamily": family,
                "CFBundleShortVersionString": "1.0",
                "CFBundleVersion": "6",
                "CFBundleExecutable": executable,
            }
            if bundle == self.watch:
                info.update(WKApplication=True, WKCompanionAppBundleIdentifier=verifier.PHONE,
                            WKRunsIndependentlyOfCompanionApp=False,
                            CFBundleIcons={"CFBundlePrimaryIcon": {"CFBundleIconName": "AppIcon"}})
                (bundle / "Assets.car").touch()
            if bundle == self.widget:
                info["NSExtension"] = {"NSExtensionPointIdentifier": "com.apple.widgetkit-extension"}
            self.set_info(bundle, info)
            (bundle / executable).touch()

    def info(self, bundle):
        return plistlib.loads((bundle / "Info.plist").read_bytes())

    def set_info(self, bundle, value):
        (bundle / "Info.plist").write_bytes(plistlib.dumps(value))

    def test_valid_structure_then_rejects_unsigned_fixture(self):
        with patch.object(verifier, "command", return_value=b"no forbidden frameworks"):
            bundles, _ = verifier.verify_structure(self.archive / "Products/Applications",
                                                    self.app, ("iphoneos", "watchos"))
        self.assertEqual(bundles, (self.app, self.watch, self.widget))
        proc = subprocess.run((str(SCRIPT.with_suffix(".sh")), "--archive", str(self.archive)),
                              capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("Verification failed", proc.stderr)

    def test_version_and_watch_metadata_are_fail_closed(self):
        info = self.info(self.watch)
        info["CFBundleVersion"] = "7"
        self.set_info(self.watch, info)
        with patch.object(verifier, "command", return_value=b"ok"), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Versions disagree"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphoneos", "watchos"))
        info["CFBundleVersion"] = "6"
        info["WKCompanionAppBundleIdentifier"] = "wrong"
        self.set_info(self.watch, info)
        with patch.object(verifier, "command", return_value=b"ok"), self.assertRaisesRegex(
            verifier.InvalidArtifact, "companion metadata"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphoneos", "watchos"))

    def test_rejects_extra_bundles_and_forbidden_watch_link(self):
        (self.app / "Watch/Extra.app").mkdir()
        with self.assertRaises(verifier.InvalidArtifact):
            verifier.bundles(self.archive / "Products/Applications", self.app)
        (self.app / "Watch/Extra.app").rmdir()
        with patch.object(verifier, "command", return_value=b"/System/Library/Frameworks/HealthKit.framework/HealthKit"), self.assertRaisesRegex(
            verifier.InvalidArtifact, "forbidden framework"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphoneos", "watchos"))

    def test_rejects_forbidden_link_in_watch_debug_dylib(self):
        for bundle in (self.app, self.watch, self.widget):
            info = self.info(bundle)
            info["DTPlatformName"] = "watchsimulator" if bundle == self.watch else "iphonesimulator"
            self.set_info(bundle, info)
        debug_binary = self.watch / "NeoGymWatch.debug.dylib"
        debug_binary.touch()
        inspected = []

        def fake_otool(*args):
            inspected.append(args[-1])
            if args[-1] == str(debug_binary):
                return b"/System/Library/Frameworks/WidgetKit.framework/WidgetKit"
            return b"/usr/lib/libSystem.B.dylib"

        with patch.object(verifier, "command", side_effect=fake_otool), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Watch links forbidden framework"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphonesimulator", "watchsimulator"))
        self.assertEqual(inspected, [str(self.watch / "NeoGymWatch"), str(debug_binary)])
        debug_binary.unlink()
        debug_binary.symlink_to("missing.debug.dylib")
        with patch.object(verifier, "command", return_value=b"ok"), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Invalid watch debug dylib"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphonesimulator", "watchsimulator"))

    def test_rejects_shared_watch_entitlement_and_changed_phone_groups(self):
        prefix = "C7HCKFA2LG"
        base = {"keychain-access-groups": [prefix + ".io.nhost.neogym.shared"],
                "com.apple.security.application-groups": [verifier.SHARED_GROUP]}
        phone: dict[str, object] = dict(base, **{"com.apple.developer.healthkit": True})
        widget = dict(base)
        watch = {"keychain-access-groups": [prefix + "." + verifier.WATCH]}
        with patch.object(verifier, "signed_entitlements",
                          side_effect=[(phone, prefix), (watch, prefix), (widget, prefix)]):
            verifier.verify_signatures((self.app, self.watch, self.widget), True)
        watch["keychain-access-groups"] = base["keychain-access-groups"]
        with patch.object(verifier, "signed_entitlements",
                          side_effect=[(phone, prefix), (watch, prefix), (widget, prefix)]), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Watch has"
        ):
            verifier.verify_signatures((self.app, self.watch, self.widget), True)
        watch["keychain-access-groups"] = [prefix + "." + verifier.WATCH]
        phone["com.apple.security.application-groups"] = []
        with patch.object(verifier, "signed_entitlements",
                          side_effect=[(phone, prefix), (watch, prefix), (widget, prefix)]), self.assertRaisesRegex(
            verifier.InvalidArtifact, "phone App Group"
        ):
            verifier.verify_signatures((self.app, self.watch, self.widget), True)

    def test_archive_provisioning_opt_in_under_system_bash(self):
        # Isolate the release script: fake Xcode, and force verification to fail
        # before any export. No Apple account, device, or upload is touched.
        fixture = self.root / "isolated/NeoGym"
        scripts = fixture / "Scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(SCRIPT.with_name("archive-release.sh"), scripts / "archive-release.sh")
        shutil.copy2(SCRIPT.with_name("LocalExportOptions.plist"),
                     scripts / "LocalExportOptions.plist")
        verifier_stub = scripts / "verify-release-archive.sh"
        verifier_stub.write_text("#!/bin/sh\necho verifier-reached >&2\nexit 71\n")
        verifier_stub.chmod(0o755)
        bin_dir = self.root / "stub-bin"
        bin_dir.mkdir()
        xcode_stub = bin_dir / "xcodebuild"
        xcode_stub.write_text("#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$NEOGYM_FIXTURE_LOG\"\n")
        xcode_stub.chmod(0o755)
        log = self.root / "xcodebuild.log"
        run_dir = self.root / "release-output"
        run_dir.mkdir()
        env = {"PATH": str(bin_dir) + ":/usr/bin:/bin", "NEOGYM_FIXTURE_LOG": str(log)}
        for approved in (False, True):
            with self.subTest(provisioning_approved=approved):
                log.unlink(missing_ok=True)
                case_env = dict(env)
                if approved:
                    case_env["NEOGYM_ALLOW_PROVISIONING_UPDATES"] = "YES"
                result = subprocess.run(("/bin/bash", str(scripts / "archive-release.sh"),
                                         str(run_dir)), env=case_env, capture_output=True,
                                        text=True)
                self.assertEqual(result.returncode, 71, result.stderr)
                self.assertIn("verifier-reached", result.stderr)
                arguments = log.read_text().splitlines()
                self.assertEqual(len(arguments), 1)
                self.assertIn(" archive", arguments[0])
                self.assertEqual("-allowProvisioningUpdates" in arguments[0], approved)

    def test_upload_requires_a_separate_per_run_opt_in(self):
        script = SCRIPT.with_name("deploy-testflight.sh")
        result = subprocess.run(("/bin/bash", str(script)), capture_output=True, text=True,
                                env={"PATH": "/usr/bin:/bin"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("NEOGYM_ALLOW_TESTFLIGHT_UPLOAD=YES", result.stderr)

    def test_profile_app_id_coverage_for_concrete_watch_signature(self):
        (self.watch / "embedded.mobileprovision").touch()
        app_id = verifier.TEAM + "." + verifier.WATCH
        ent = {
            "application-identifier": app_id,
            "com.apple.developer.team-identifier": verifier.TEAM,
            "get-task-allow": True,
            "keychain-access-groups": [app_id],
        }
        profile = {
            "TeamIdentifier": [verifier.TEAM],
            "ExpirationDate": datetime.datetime(2099, 1, 1),
            "Entitlements": {
                "application-identifier": verifier.TEAM + ".*",
                "get-task-allow": True,
                "keychain-access-groups": [verifier.TEAM + ".*"],
            },
        }
        details = subprocess.CompletedProcess([], 0, b"",
                                             ("Identifier=" + verifier.WATCH + "\nAuthority=Apple Development\n"
                                              "TeamIdentifier=" + verifier.TEAM).encode())

        def fake_command(*args):
            if args[0] == "/usr/bin/security":
                return plistlib.dumps(profile)
            if "--entitlements" in args:
                return plistlib.dumps(ent)
            return b""

        with patch.object(verifier, "command", side_effect=fake_command), patch.object(
            verifier.subprocess, "run", return_value=details
        ):
            allowed = profile["Entitlements"]
            for profile_id in (app_id, verifier.TEAM + ".*",
                               verifier.TEAM + ".io.nhost.dbarroso.*"):
                with self.subTest(profile_id=profile_id):
                    allowed["application-identifier"] = profile_id
                    self.assertEqual(verifier.signed_entitlements(self.watch, verifier.WATCH, False),
                                     (ent, verifier.TEAM))

            for profile_id in ("DIFFERENTTEAM.*", verifier.TEAM + ".wrong.*",
                               verifier.TEAM + ".io.nhost.dbarroso.neogym.sibling",
                               verifier.TEAM + ".io.nhost.dbarroso.neogym.watchkitapp*",
                               verifier.TEAM + ".io.nhost.dbarroso.neogym.sibling.*"):
                with self.subTest(rejected_profile_id=profile_id):
                    allowed["application-identifier"] = profile_id
                    with self.assertRaisesRegex(verifier.InvalidArtifact, "does not cover signing identity"):
                        verifier.signed_entitlements(self.watch, verifier.WATCH, False)

            allowed["application-identifier"] = verifier.TEAM + ".*"
            profile["TeamIdentifier"] = ["DIFFERENTTEAM"]
            with self.assertRaisesRegex(verifier.InvalidArtifact, "wrong-team provisioning"):
                verifier.signed_entitlements(self.watch, verifier.WATCH, False)
            profile["TeamIdentifier"] = [verifier.TEAM]
            allowed["get-task-allow"] = False
            with self.assertRaisesRegex(verifier.InvalidArtifact, "does not cover signing identity"):
                verifier.signed_entitlements(self.watch, verifier.WATCH, False)
            allowed["get-task-allow"] = True
            ent["application-identifier"] = "DIFFERENTTEAM." + verifier.WATCH
            with self.assertRaisesRegex(verifier.InvalidArtifact, "Wrong signing team"):
                verifier.signed_entitlements(self.watch, verifier.WATCH, False)

    def test_distribution_rejects_development_entitlement(self):
        (self.app / "embedded.mobileprovision").touch()
        prefix = "C7HCKFA2LG"
        ent = {
            "application-identifier": prefix + "." + verifier.PHONE,
            "com.apple.developer.team-identifier": verifier.TEAM,
            "get-task-allow": True,
        }
        details = subprocess.CompletedProcess([], 0, b"",
                                             ("Identifier=" + verifier.PHONE + "\nAuthority=Apple Development\n"
                                              "TeamIdentifier=" + verifier.TEAM).encode())

        def fake_command(*args):
            if "--entitlements" in args:
                return plistlib.dumps(ent)
            return b""

        with patch.object(verifier, "command", side_effect=fake_command), patch.object(
            verifier.subprocess, "run", return_value=details
        ), self.assertRaisesRegex(verifier.InvalidArtifact, "development signed"):
            verifier.signed_entitlements(self.app, verifier.PHONE, True)

    def test_rejects_unsafe_ipa_entry(self):
        ipa = self.root / "malicious.ipa"
        with zipfile.ZipFile(ipa, "w") as archive:
            archive.writestr("../outside", "bad")
        with self.assertRaisesRegex(verifier.InvalidArtifact, "Unsafe IPA entry"):
            verifier.extract_ipa(ipa, self.root / "extract")


if __name__ == "__main__":
    unittest.main()
