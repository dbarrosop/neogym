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
        self.watch_widget = self.watch / "PlugIns/NeoGymWatchWidgets.appex"
        for bundle, identifier, os_name, family, executable in (
            (self.app, verifier.PHONE, "iphoneos", [1], "NeoGym"),
            (self.watch, verifier.WATCH, "watchos", [4], "NeoGymWatch"),
            (self.widget, verifier.WIDGET, "iphoneos", [1], "NeoGymWidgets"),
            (self.watch_widget, verifier.WATCH_WIDGET, "watchos", [4], "NeoGymWatchWidgets"),
        ):
            bundle.mkdir(parents=True)
            info = {
                "CFBundleIdentifier": identifier,
                "CFBundlePackageType": "XPC!" if bundle in (self.widget, self.watch_widget) else "APPL",
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
            if bundle in (self.widget, self.watch_widget):
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
        self.assertEqual(bundles, (self.app, self.watch, self.widget, self.watch_widget))
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
        missing_widget = self.root / "missing-widget"
        self.watch_widget.rename(missing_widget)
        with self.assertRaisesRegex(verifier.InvalidArtifact, "Expected exactly one .appex"):
            verifier.bundles(self.archive / "Products/Applications", self.app)
        missing_widget.rename(self.watch_widget)
        with patch.object(verifier, "command", return_value=b"/System/Library/Frameworks/ActivityKit.framework/ActivityKit"), self.assertRaisesRegex(
            verifier.InvalidArtifact, "forbidden framework"
        ):
            verifier.verify_structure(self.archive / "Products/Applications", self.app,
                                      ("iphoneos", "watchos"))

    def test_rejects_forbidden_link_in_watch_debug_dylib(self):
        for bundle in (self.app, self.watch, self.widget, self.watch_widget):
            info = self.info(bundle)
            info["DTPlatformName"] = "watchsimulator" if bundle in (self.watch, self.watch_widget) else "iphonesimulator"
            self.set_info(bundle, info)
        debug_binary = self.watch / "NeoGymWatch.debug.dylib"
        debug_binary.touch()
        inspected = []

        def fake_otool(*args):
            inspected.append(args[-1])
            if args[-1] == str(debug_binary):
                return b"/System/Library/Frameworks/ActivityKit.framework/ActivityKit"
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
        watch = {"keychain-access-groups": [prefix + "." + verifier.WATCH],
                 "com.apple.security.application-groups": [verifier.SHARED_GROUP],
                 "com.apple.developer.healthkit": True,
                 "com.apple.developer.healthkit.background-delivery": True}
        watch_widget: dict[str, object] = {"com.apple.security.application-groups": [verifier.SHARED_GROUP]}
        def entitlements():
            return [(phone, prefix), (watch, prefix), (widget, prefix), (watch_widget, prefix)]
        bundles = (self.app, self.watch, self.widget, self.watch_widget)
        with patch.object(verifier, "signed_entitlements", side_effect=entitlements()):
            verifier.verify_signatures(bundles, True)
        watch["keychain-access-groups"] = base["keychain-access-groups"]
        with patch.object(verifier, "signed_entitlements",
                          side_effect=entitlements()), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Watch has"
        ):
            verifier.verify_signatures(bundles, True)
        watch["keychain-access-groups"] = [prefix + "." + verifier.WATCH]
        watch_widget["com.apple.developer.healthkit"] = True
        with patch.object(verifier, "signed_entitlements",
                          side_effect=entitlements()), self.assertRaisesRegex(
            verifier.InvalidArtifact, "Watch widget has"
        ):
            verifier.verify_signatures(bundles, True)
        del watch_widget["com.apple.developer.healthkit"]
        phone["com.apple.security.application-groups"] = []
        with patch.object(verifier, "signed_entitlements",
                          side_effect=entitlements()), self.assertRaisesRegex(
            verifier.InvalidArtifact, "phone App Group"
        ):
            verifier.verify_signatures(bundles, True)

    def test_archive_provisioning_opt_in_under_system_bash(self):
        # Both verification outcomes run against fake Xcode; successful export
        # creates only a dummy IPA. No Apple account, device, or upload is touched.
        fixture = self.root / "isolated/NeoGym"
        scripts = fixture / "Scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(SCRIPT.with_name("archive-release.sh"), scripts / "archive-release.sh")
        shutil.copy2(SCRIPT.with_name("LocalExportOptions.plist"),
                     scripts / "LocalExportOptions.plist")
        verifier_stub = scripts / "verify-release-archive.sh"
        verifier_stub.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$NEOGYM_FIXTURE_VERIFY_LOG\"\n"
            "exit \"$NEOGYM_FIXTURE_VERIFY_EXIT\"\n"
        )
        verifier_stub.chmod(0o755)
        bin_dir = self.root / "stub-bin"
        bin_dir.mkdir()
        xcode_stub = bin_dir / "xcodebuild"
        xcode_stub.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$NEOGYM_FIXTURE_LOG\"\n"
            "while [ \"$#\" -gt 0 ]; do\n"
            "  if [ \"$1\" = -exportPath ]; then\n"
            "    shift\n    mkdir -p \"$1\"\n    touch \"$1/NeoGym.ipa\"\n"
            "  fi\n  shift\ndone\n"
        )
        xcode_stub.chmod(0o755)
        log = self.root / "xcodebuild.log"
        verify_log = self.root / "verifier.log"
        env = {"PATH": str(bin_dir) + ":/usr/bin:/bin", "NEOGYM_FIXTURE_LOG": str(log),
               "NEOGYM_FIXTURE_VERIFY_LOG": str(verify_log)}
        for verified in (False, True):
            for approved in (False, True):
                with self.subTest(archive_verified=verified, provisioning_approved=approved):
                    log.unlink(missing_ok=True)
                    verify_log.unlink(missing_ok=True)
                    run_dir = self.root / f"release-output-{verified}-{approved}"
                    run_dir.mkdir()
                    case_env = dict(env, NEOGYM_FIXTURE_VERIFY_EXIT="0" if verified else "71")
                    if approved:
                        case_env["NEOGYM_ALLOW_PROVISIONING_UPDATES"] = "YES"
                    result = subprocess.run(("/bin/bash", str(scripts / "archive-release.sh"),
                                             str(run_dir)), env=case_env, capture_output=True,
                                            text=True)
                    self.assertEqual(result.returncode, 0 if verified else 71, result.stderr)
                    arguments = log.read_text().splitlines()
                    self.assertEqual(len(arguments), 2 if verified else 1)
                    self.assertIn(" archive", arguments[0])
                    if verified:
                        self.assertIn("-exportArchive", arguments[1])
                        self.assertIn("-exportOptionsPlist Scripts/LocalExportOptions.plist",
                                      arguments[1])
                    for call in arguments:
                        self.assertEqual(call.split().count("-allowProvisioningUpdates"),
                                         int(approved))
                    archive_path = run_dir / "NeoGym.xcarchive"
                    expected_verification = [f"--archive {archive_path}"]
                    if verified:
                        expected_verification.append(
                            f"--archive {archive_path} --ipa {run_dir / 'local-export/NeoGym.ipa'}"
                        )
                    self.assertEqual(verify_log.read_text().splitlines(), expected_verification)

    def test_deploy_without_upload_flag_still_requires_verified_release(self):
        # Run a copy with a failing archive preflight and a fake Xcode binary.
        # The real upload command must never be reachable from this fixture.
        fixture = self.root / "deploy-fixture/NeoGym"
        scripts = fixture / "Scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(SCRIPT.with_name("deploy-testflight.sh"), scripts / "deploy-testflight.sh")
        shutil.copy2(SCRIPT.with_name("TestFlightExportOptions.plist"),
                     scripts / "TestFlightExportOptions.plist")
        preflight = scripts / "archive-release.sh"
        preflight.write_text("#!/bin/sh\necho preflight-reached >&2\nexit 71\n")
        bin_dir = self.root / "deploy-stub-bin"
        bin_dir.mkdir()
        marker = self.root / "unexpected-upload"
        xcode_stub = bin_dir / "xcodebuild"
        xcode_stub.write_text("#!/bin/sh\nprintf upload > \"$NEOGYM_FIXTURE_MARKER\"\n")
        xcode_stub.chmod(0o755)
        result = subprocess.run(
            ("/bin/bash", str(scripts / "deploy-testflight.sh")),
            capture_output=True, text=True,
            env={"PATH": str(bin_dir) + ":/usr/bin:/bin",
                 "NEOGYM_FIXTURE_MARKER": str(marker)},
        )
        self.assertEqual(result.returncode, 71, result.stderr)
        self.assertIn("preflight-reached", result.stderr)
        self.assertFalse(marker.exists(), "Upload must not start after preflight fails")

    def test_deploy_upload_provisioning_opt_in_under_system_bash(self):
        # Stub the verified non-upload path and Xcode; even the upload branch
        # reaches only a local logger, never a real upload or provisioning call.
        fixture = self.root / "deploy-opt-in-fixture/NeoGym"
        scripts = fixture / "Scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(SCRIPT.with_name("deploy-testflight.sh"), scripts / "deploy-testflight.sh")
        shutil.copy2(SCRIPT.with_name("TestFlightExportOptions.plist"),
                     scripts / "TestFlightExportOptions.plist")
        preflight = scripts / "archive-release.sh"
        preflight.write_text("#!/bin/sh\necho preflight-reached >&2\nexit 0\n")
        bin_dir = self.root / "deploy-opt-in-stub-bin"
        bin_dir.mkdir()
        log = self.root / "upload-xcodebuild.log"
        xcode_stub = bin_dir / "xcodebuild"
        xcode_stub.write_text("#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$NEOGYM_FIXTURE_LOG\"\n")
        xcode_stub.chmod(0o755)
        for approved in (False, True):
            with self.subTest(provisioning_approved=approved):
                log.unlink(missing_ok=True)
                env = {"PATH": str(bin_dir) + ":/usr/bin:/bin", "NEOGYM_FIXTURE_LOG": str(log)}
                if approved:
                    env["NEOGYM_ALLOW_PROVISIONING_UPDATES"] = "YES"
                result = subprocess.run(("/bin/bash", str(scripts / "deploy-testflight.sh")),
                                        env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("preflight-reached", result.stderr)
                arguments = log.read_text().splitlines()
                self.assertEqual(len(arguments), 1)
                self.assertIn("-exportArchive", arguments[0])
                self.assertIn("-exportOptionsPlist Scripts/TestFlightExportOptions.plist",
                              arguments[0])
                self.assertEqual(arguments[0].split().count("-allowProvisioningUpdates"),
                                 int(approved))

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
