#!/usr/bin/env python3
"""Safely extract an allowlisted subset of Xcode build settings.

Raw `xcodebuild -showBuildSettings` output can contain opaque deployment input.
It is therefore captured only in private temporary files, never inherited by
stdout/stderr, and deleted before this command exits.
"""

from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

ALLOWLIST = {
    "APPLICATION_EXTENSION_API_ONLY",
    "ASSETCATALOG_COMPILER_APPICON_NAME",
    "CODE_SIGN_ENTITLEMENTS",
    "CURRENT_PROJECT_VERSION",
    "DEVELOPMENT_TEAM",
    "INFOPLIST_FILE",
    "IPHONEOS_DEPLOYMENT_TARGET",
    "MARKETING_VERSION",
    "NEOGYM_APP_GROUP_IDENTIFIER",
    "NEOGYM_CALLBACK_SCHEME",
    "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX",
    "NEOGYM_NHOST_REGION",
    "NEOGYM_NHOST_SUBDOMAIN",
    "PRODUCT_BUNDLE_IDENTIFIER",
    "PRODUCT_NAME",
    "SUPPORTS_MACCATALYST",
    "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD",
    "TARGETED_DEVICE_FAMILY",
}
SANITIZED_ENVIRONMENT_KEYS = ("SDKROOT", "CC", "CXX", "LD", "AR", "LDFLAGS")


def private_temp() -> tuple[int, Path]:
    descriptor, name = tempfile.mkstemp(prefix="neogym-build-settings-")
    os.fchmod(descriptor, stat.S_IRUSR | stat.S_IWUSR)
    return descriptor, Path(name)


def atomic_private_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    finally:
        temporary.unlink(missing_ok=True)


def select_developer_dir(environment: dict[str, str]) -> str:
    candidates: list[Path] = []
    configured = Path(environment.get("DEVELOPER_DIR", ""))
    if configured.is_dir():
        candidates.append(configured)
    selection_environment = environment.copy()
    selection_environment.pop("DEVELOPER_DIR", None)
    selected = subprocess.run(
        ["/usr/bin/xcode-select", "-p"],
        check=True,
        text=True,
        capture_output=True,
        env=selection_environment,
    )
    candidates.append(Path(selected.stdout.strip()))
    candidates.extend(
        path / "Contents/Developer" for path in Path("/Applications").glob("Xcode*.app")
    )

    compatible: list[tuple[tuple[int, int], str]] = []
    for candidate in dict.fromkeys(candidates):
        if not (candidate / "usr/bin/xcodebuild").is_file():
            continue
        candidate_environment = environment.copy()
        candidate_environment["DEVELOPER_DIR"] = str(candidate)
        version = subprocess.run(
            ["/usr/bin/xcrun", "--sdk", "iphonesimulator", "--show-sdk-version"],
            check=False,
            text=True,
            capture_output=True,
            env=candidate_environment,
        )
        try:
            parsed = [int(part) for part in version.stdout.strip().split(".")[:2]]
        except ValueError:
            continue
        if len(parsed) != 2:
            continue
        parts = (parsed[0], parsed[1])
        if version.returncode == 0 and parts >= (26, 6):
            compatible.append((parts, str(candidate)))
    if not compatible:
        raise RuntimeError("compatible Xcode is unavailable")
    return max(compatible)[1]


def read_settings(
    project: Path,
    scheme: str | None,
    configuration: str,
    target: str,
    fields: list[str],
) -> dict[str, str]:
    unknown = sorted(set(fields) - ALLOWLIST)
    if unknown:
        raise RuntimeError("requested build-setting field is not allowlisted")

    stdout_fd, stdout_path = private_temp()
    stderr_fd, stderr_path = private_temp()
    environment = os.environ.copy()
    for key in SANITIZED_ENVIRONMENT_KEYS:
        environment.pop(key, None)
    environment["DEVELOPER_DIR"] = select_developer_dir(environment)

    try:
        selection = ["-scheme", scheme] if scheme else ["-target", target]
        command = [
            environment.get("NEOGYM_XCRUN", "/usr/bin/xcrun"),
            "xcodebuild",
            "-project",
            str(project),
            *selection,
            "-configuration",
            configuration,
            "-showBuildSettings",
            "-json",
        ]
        with (
            os.fdopen(stdout_fd, "wb") as stdout_handle,
            os.fdopen(stderr_fd, "wb") as stderr_handle,
        ):
            result = subprocess.run(
                command,
                check=False,
                env=environment,
                stdout=stdout_handle,
                stderr=stderr_handle,
            )
        if result.returncode != 0:
            raise RuntimeError("xcodebuild build-setting inspection failed")

        payload = json.loads(stdout_path.read_text(encoding="utf-8"))
        matches = [entry for entry in payload if entry.get("target") == target]
        if len(matches) != 1:
            raise RuntimeError(
                "requested build-setting target was not resolved uniquely"
            )
        settings = matches[0].get("buildSettings", {})
        missing = [key for key in fields if key not in settings]
        if missing:
            raise RuntimeError("requested build-setting field is absent")
        return {key: str(settings[key]) for key in fields}
    finally:
        stdout_path.unlink(missing_ok=True)
        stderr_path.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path("NeoGym.xcodeproj"))
    parser.add_argument("--scheme")
    parser.add_argument("--configuration", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--field", action="append", dest="fields", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    args.output.unlink(missing_ok=True)

    try:
        settings = read_settings(
            args.project, args.scheme, args.configuration, args.target, args.fields
        )
        atomic_private_json(args.output, settings)
    except (
        OSError,
        ValueError,
        json.JSONDecodeError,
        RuntimeError,
        subprocess.SubprocessError,
    ):
        print("build-setting inspection failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
