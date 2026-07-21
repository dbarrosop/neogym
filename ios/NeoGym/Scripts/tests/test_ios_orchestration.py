from __future__ import annotations

import os
import plistlib
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCRIPT = SOURCE_ROOT / "Scripts" / "ios.sh"


class IOSWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        base = Path(self.temporary.name)
        self.root = base / "one" / "two" / "three" / "four" / "NeoGym"
        scripts = self.root / "Scripts"
        configuration = self.root / "Configuration"
        scripts.mkdir(parents=True)
        configuration.mkdir()
        shutil.copy2(SOURCE_SCRIPT, scripts / "ios.sh")
        shutil.copy2(
            SOURCE_ROOT / "Configuration" / "TestFlightExportOptions.plist",
            configuration / "TestFlightExportOptions.plist",
        )
        (scripts / "materialize-config.py").touch()
        (scripts / "verify-archive.py").touch()
        (scripts / "tests").mkdir()
        (self.root / "project.yml").touch()

        sdk_package = (
            self.root
            / "../../../../../nhost/nhost/swift/packages/nhost-swift/Package.swift"
        ).resolve()
        sdk_package.parent.mkdir(parents=True)
        sdk_package.touch()

        self.developer_dir = base / "Xcode.app" / "Contents" / "Developer"
        (self.developer_dir / "usr" / "bin").mkdir(parents=True)
        xcodebuild = self.developer_dir / "usr" / "bin" / "xcodebuild"
        xcodebuild.touch()
        xcodebuild.chmod(0o755)

        self.bin = base / "bin"
        self.bin.mkdir()
        self.log = base / "commands.log"
        self._write_shim(
            "python3",
            """printf 'python3' >> "$NEOGYM_TEST_LOG"
printf ' %s' "$@" >> "$NEOGYM_TEST_LOG"
printf '\n' >> "$NEOGYM_TEST_LOG"
exit 0
""",
        )
        self._write_shim(
            "xcodegen",
            """printf 'xcodegen' >> "$NEOGYM_TEST_LOG"
printf ' %s' "$@" >> "$NEOGYM_TEST_LOG"
printf '\n' >> "$NEOGYM_TEST_LOG"
mkdir -p NeoGym.xcodeproj
""",
        )
        self._write_shim(
            "plutil",
            """printf 'plutil' >> "$NEOGYM_TEST_LOG"
printf ' %s' "$@" >> "$NEOGYM_TEST_LOG"
printf '\n' >> "$NEOGYM_TEST_LOG"
printf '%s\n' 'com.example.neogym.development'
""",
        )
        self._write_shim(
            "xcrun",
            """printf 'xcrun' >> "$NEOGYM_TEST_LOG"
printf ' %s' "$@" >> "$NEOGYM_TEST_LOG"
printf '\n' >> "$NEOGYM_TEST_LOG"
for variable in SDKROOT CC CXX LD AR LDFLAGS; do
  if [[ -n "${!variable+x}" ]]; then
    printf 'leaked %s\n' "$variable" >> "$NEOGYM_TEST_LOG"
  fi
done
if [[ "$*" == *'--show-sdk-version'* ]]; then
  printf '%s\n' '26.6'
  exit 0
fi
if [[ "$*" == *'--show-sdk-path'* ]]; then
  printf '%s\n' '/synthetic/iPhoneSimulator.sdk'
  exit 0
fi
if [[ "${1:-}" == 'xcodebuild' ]]; then
  derived=''
  configuration=''
  archive=''
  previous=''
  for argument in "$@"; do
    case "$previous" in
      -derivedDataPath) derived="$argument" ;;
      -configuration) configuration="$argument" ;;
      -archivePath) archive="$argument" ;;
    esac
    previous="$argument"
  done
  if [[ -n "$archive" && "$*" == *' archive'* ]]; then
    mkdir -p "$archive"
  fi
  if [[ -n "$derived" && "$configuration" == 'Debug-Development' && "$*" == *'id='* ]]; then
    app="$derived/Build/Products/Debug-Development-iphoneos/NeoGym.app"
    mkdir -p "$app"
    : > "$app/Info.plist"
  fi
fi
exit 0
""",
        )

        self.environment = os.environ.copy()
        self.environment.update(
            {
                "PATH": f"{self.bin}:{self.environment['PATH']}",
                "DEVELOPER_DIR": str(self.developer_dir),
                "NEOGYM_TEST_LOG": str(self.log),
                "NEOGYM_XCRUN": str(self.bin / "xcrun"),
                "NEOGYM_PLUTIL": str(self.bin / "plutil"),
                "SDKROOT": "/nix/store/apple-sdk",
                "CC": "nix-cc",
                "CXX": "nix-cxx",
                "LD": "nix-ld",
                "AR": "nix-ar",
                "LDFLAGS": "private-flags",
            }
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_shim(self, name: str, body: str) -> None:
        path = self.bin / name
        path.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\n{body}", encoding="utf-8")
        path.chmod(0o755)

    def run_workflow(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(self.root / "Scripts" / "ios.sh"), *arguments],
            cwd=self.root,
            env=self.environment,
            text=True,
            capture_output=True,
            check=False,
        )

    def log_lines(self) -> list[str]:
        if not self.log.exists():
            return []
        return self.log.read_text(encoding="utf-8").splitlines()

    def assert_common_check_shape(self, lines: list[str]) -> None:
        self.assertEqual(
            sum("materialize-config.py development" in line for line in lines), 1
        )
        self.assertEqual(
            sum("materialize-config.py production" in line for line in lines), 1
        )
        self.assertEqual(sum(line.startswith("xcodegen generate") for line in lines), 1)
        self.assertFalse(any(line.startswith("leaked ") for line in lines))
        self.assertTrue(any("swift build" in line for line in lines))
        self.assertTrue(any("swift test" in line for line in lines))
        self.assertTrue(
            any(
                "xcodebuild" in line
                and "NeoGym Dev" in line
                and "Debug-Development" in line
                and "CODE_SIGNING_ALLOWED=NO" in line
                for line in lines
            )
        )
        self.assertTrue(
            any(
                "xcodebuild" in line
                and "NeoGym" in line
                and "Debug-Production" in line
                and "CODE_SIGNING_ALLOWED=NO" in line
                for line in lines
            )
        )

    def test_missing_device_and_invalid_version_fail_before_tool_calls(self) -> None:
        missing_device = self.run_workflow("deploy-device")
        self.assertEqual(missing_device.returncode, 2)
        self.assertIn("DEVICE_ID is required", missing_device.stderr)
        self.assertEqual(self.log_lines(), [])

        for version in ("", "v1", "1.2.3.4", "1..2", "1-beta"):
            with self.subTest(version=version):
                self.log.unlink(missing_ok=True)
                result = self.run_workflow("upload-testflight", version)
                self.assertEqual(result.returncode, 2)
                self.assertIn("one to three decimal components", result.stderr)
                self.assertEqual(self.log_lines(), [])

    def test_check_materializes_each_environment_and_generates_once(self) -> None:
        result = self.run_workflow("check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_common_check_shape(self.log_lines())

    def test_device_uses_development_signing_then_installs_and_launches(self) -> None:
        result = self.run_workflow("deploy-device", "DEVICE-123")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = self.log_lines()
        self.assert_common_check_shape(lines)
        signed_build = next(
            line
            for line in lines
            if "xcodebuild" in line
            and "id=DEVICE-123" in line
            and "CODE_SIGN_STYLE=Automatic" in line
        )
        self.assertIn("NeoGym Dev", signed_build)
        self.assertIn("Debug-Development", signed_build)
        self.assertIn("-allowProvisioningUpdates", signed_build)
        install = next(line for line in lines if "devicectl device install app" in line)
        launch = next(line for line in lines if "devicectl device process launch" in line)
        self.assertIn("DEVICE-123", install)
        self.assertIn("DEVICE-123", launch)
        self.assertLess(lines.index(install), lines.index(launch))
        self.assertTrue(any(line.startswith("plutil -extract CFBundleIdentifier") for line in lines))

    def test_upload_validates_once_before_export_and_reuses_archive_path(self) -> None:
        result = self.run_workflow("upload-testflight", "3.2.1")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = self.log_lines()
        self.assert_common_check_shape(lines)
        archive_line = next(
            line
            for line in lines
            if "xcodebuild" in line and "Release-Production" in line
        )
        self.assertIn("MARKETING_VERSION=3.2.1", archive_line)
        self.assertIn("-allowProvisioningUpdates", archive_line)
        verification_lines = [
            line for line in lines if "Scripts/verify-archive.py" in line
        ]
        self.assertEqual(len(verification_lines), 1)
        export_line = next(
            line for line in lines if "xcodebuild -exportArchive" in line
        )
        archive_path = str(
            self.root / "Artifacts" / "TestFlight" / "NeoGym-3.2.1.xcarchive"
        )
        self.assertIn(archive_path, archive_line)
        self.assertIn(archive_path, verification_lines[0])
        self.assertIn(archive_path, export_line)
        self.assertLess(lines.index(archive_line), lines.index(verification_lines[0]))
        self.assertLess(lines.index(verification_lines[0]), lines.index(export_line))


class ExportOptionsTests(unittest.TestCase):
    def test_export_options_have_exact_keys_and_types(self) -> None:
        path = SOURCE_ROOT / "Configuration" / "TestFlightExportOptions.plist"
        with path.open("rb") as handle:
            options = plistlib.load(handle)
        self.assertEqual(
            options,
            {
                "destination": "upload",
                "method": "app-store-connect",
                "signingStyle": "automatic",
                "manageAppVersionAndBuildNumber": True,
                "uploadSymbols": True,
            },
        )
        self.assertIs(type(options["manageAppVersionAndBuildNumber"]), bool)
        self.assertIs(type(options["uploadSymbols"]), bool)
        for key in ("destination", "method", "signingStyle"):
            self.assertIs(type(options[key]), str)


if __name__ == "__main__":
    unittest.main()
