#!/usr/bin/env python3
"""Validate NeoGym-specific invariants in one production Xcode archive.

The validator deliberately delegates signing validity to Xcode. It uses codesign only
as an injectable reader for the entitlements embedded in the archive, and diagnostics
name contracts rather than configured values.
"""

from __future__ import annotations

import argparse
import plistlib
import re
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

UNRESOLVED = re.compile(r"\$\([^)]*\)|\$\{[^}]*\}")
APP_GROUP_KEY = "com.apple.security.application-groups"
KEYCHAIN_KEY = "keychain-access-groups"
RUNTIME_APP_GROUP_KEY = "NeoGymAppGroupIdentifier"
RUNTIME_KEYCHAIN_KEY = "NeoGymSharedKeychainAccessGroup"
RUNTIME_KEYCHAIN_SUFFIX_KEY = "NeoGymSharedKeychainAccessGroupSuffix"


class ValidationFailure(RuntimeError):
    """A validation failure containing only key-safe diagnostics."""

    def __init__(self, issues: Sequence[str]):
        self.issues = tuple(dict.fromkeys(issues))
        super().__init__("archive validation failed")


@dataclass(frozen=True)
class BundleMetadata:
    info: Mapping[str, Any]
    entitlements: Mapping[str, Any]


@dataclass(frozen=True)
class ArchiveMetadata:
    app: BundleMetadata
    widget: BundleMetadata


EntitlementReader = Callable[[Path, str], Mapping[str, Any]]


def _contains_unresolved(value: Any) -> bool:
    if isinstance(value, str):
        return bool(UNRESOLVED.search(value))
    if isinstance(value, Mapping):
        return any(
            _contains_unresolved(key) or _contains_unresolved(item)
            for key, item in value.items()
        )
    if isinstance(value, (list, tuple)):
        return any(_contains_unresolved(item) for item in value)
    return False


def _nonempty_string(mapping: Mapping[str, Any], key: str) -> str | None:
    value = mapping.get(key)
    return value if isinstance(value, str) and value != "" else None


def _single_nonempty_group(
    mapping: Mapping[str, Any], key: str
) -> list[str] | None:
    value = mapping.get(key)
    if (
        not isinstance(value, list)
        or len(value) != 1
        or not isinstance(value[0], str)
        or value[0] == ""
    ):
        return None
    return value


def _has_consistent_suffix(full_group: str, suffix: str) -> bool:
    return full_group == suffix or (
        full_group.endswith(f".{suffix}") and len(full_group) > len(suffix) + 1
    )


def validate_invariants(metadata: ArchiveMetadata) -> None:
    """Validate product-specific invariants without reading files or running tools."""

    issues: list[str] = []
    app = metadata.app
    widget = metadata.widget

    for label, bundle in (("app", app), ("widget", widget)):
        if _contains_unresolved(bundle.info):
            issues.append(f"{label}.Info.unresolved-build-setting")
        if _contains_unresolved(bundle.entitlements):
            issues.append(f"{label}.entitlements.unresolved-build-setting")

    app_groups = _single_nonempty_group(app.entitlements, APP_GROUP_KEY)
    widget_groups = _single_nonempty_group(widget.entitlements, APP_GROUP_KEY)
    if app_groups is None:
        issues.append(f"app.entitlements.{APP_GROUP_KEY}")
    if widget_groups is None:
        issues.append(f"widget.entitlements.{APP_GROUP_KEY}")
    if app_groups is not None and widget_groups is not None:
        if app_groups != widget_groups:
            issues.append("archive.app-group-parity")
        app_runtime_group = _nonempty_string(app.info, RUNTIME_APP_GROUP_KEY)
        widget_runtime_group = _nonempty_string(widget.info, RUNTIME_APP_GROUP_KEY)
        if app_runtime_group is None or app_groups != [app_runtime_group]:
            issues.append(f"app.Info.{RUNTIME_APP_GROUP_KEY}")
        if widget_runtime_group is None or widget_groups != [widget_runtime_group]:
            issues.append(f"widget.Info.{RUNTIME_APP_GROUP_KEY}")

    app_keychains = _single_nonempty_group(app.entitlements, KEYCHAIN_KEY)
    widget_keychains = _single_nonempty_group(widget.entitlements, KEYCHAIN_KEY)
    if app_keychains is None:
        issues.append(f"app.entitlements.{KEYCHAIN_KEY}")
    if widget_keychains is None:
        issues.append(f"widget.entitlements.{KEYCHAIN_KEY}")
    if app_keychains is not None and widget_keychains is not None:
        if app_keychains != widget_keychains:
            issues.append("archive.keychain-parity")
        app_suffix = _nonempty_string(app.info, RUNTIME_KEYCHAIN_SUFFIX_KEY)
        widget_suffix = _nonempty_string(widget.info, RUNTIME_KEYCHAIN_SUFFIX_KEY)
        if (
            app_suffix is not None
            and widget_suffix is not None
            and app_suffix != widget_suffix
        ):
            issues.append("archive.keychain-suffix-parity")
        for label, bundle, groups, suffix in (
            ("app", app, app_keychains, app_suffix),
            ("widget", widget, widget_keychains, widget_suffix),
        ):
            runtime_group = _nonempty_string(bundle.info, RUNTIME_KEYCHAIN_KEY)
            if runtime_group is None or groups != [runtime_group]:
                issues.append(f"{label}.Info.{RUNTIME_KEYCHAIN_KEY}")
            if (
                suffix is None
                or runtime_group is None
                or not _has_consistent_suffix(runtime_group, suffix)
            ):
                issues.append(f"{label}.Info.{RUNTIME_KEYCHAIN_SUFFIX_KEY}")

    for key in ("CFBundleShortVersionString", "CFBundleVersion"):
        app_value = _nonempty_string(app.info, key)
        widget_value = _nonempty_string(widget.info, key)
        if app_value is None or widget_value is None or app_value != widget_value:
            issues.append(f"archive.version-parity.{key}")

    if issues:
        raise ValidationFailure(issues)


def _load_plist(path: Path, issue: str) -> Mapping[str, Any]:
    try:
        value = plistlib.loads(path.read_bytes())
    except (OSError, plistlib.InvalidFileException, ValueError, TypeError):
        raise ValidationFailure([issue]) from None
    if not isinstance(value, Mapping):
        raise ValidationFailure([issue])
    return value


def read_signed_entitlements(bundle: Path, label: str) -> Mapping[str, Any]:
    """Read signed entitlements with codesign without verifying the signature."""

    try:
        result = subprocess.run(
            [
                "/usr/bin/codesign",
                "--display",
                "--entitlements",
                ":-",
                "--xml",
                str(bundle),
            ],
            check=False,
            capture_output=True,
        )
    except OSError:
        raise ValidationFailure([f"{label}.signed-entitlements"]) from None
    if result.returncode != 0:
        raise ValidationFailure([f"{label}.signed-entitlements"])

    payload = result.stdout
    if b"<?xml" not in payload and b"<?xml" in result.stderr:
        payload = result.stderr[result.stderr.index(b"<?xml") :]
    try:
        value = plistlib.loads(payload)
    except (plistlib.InvalidFileException, ValueError, TypeError):
        raise ValidationFailure([f"{label}.signed-entitlements"]) from None
    if not isinstance(value, Mapping):
        raise ValidationFailure([f"{label}.signed-entitlements"])
    return value


def extract_archive(
    archive: Path, entitlement_reader: EntitlementReader = read_signed_entitlements
) -> ArchiveMetadata:
    """Extract the one app and one embedded NeoGymWidgets extension."""

    if archive.suffix != ".xcarchive" or not archive.is_dir():
        raise ValidationFailure(["archive.path"])

    applications = archive / "Products" / "Applications"
    apps = [path for path in applications.glob("*.app") if path.is_dir()]
    if len(apps) != 1:
        raise ValidationFailure(["archive.Products.Applications"])
    app_path = apps[0]

    plugins = app_path / "PlugIns"
    widgets = [
        path for path in plugins.rglob("NeoGymWidgets.appex") if path.is_dir()
    ]
    if len(widgets) != 1 or widgets[0].parent != plugins:
        raise ValidationFailure(["app.PlugIns.NeoGymWidgets.appex"])
    widget_path = widgets[0]

    app_info = _load_plist(app_path / "Info.plist", "app.Info.plist")
    widget_info = _load_plist(widget_path / "Info.plist", "widget.Info.plist")
    app_entitlements = entitlement_reader(app_path, "app")
    widget_entitlements = entitlement_reader(widget_path, "widget")
    if not isinstance(app_entitlements, Mapping):
        raise ValidationFailure(["app.signed-entitlements"])
    if not isinstance(widget_entitlements, Mapping):
        raise ValidationFailure(["widget.signed-entitlements"])

    return ArchiveMetadata(
        app=BundleMetadata(app_info, app_entitlements),
        widget=BundleMetadata(widget_info, widget_entitlements),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate NeoGym invariants in a production .xcarchive"
    )
    parser.add_argument("archive", type=Path)
    args = parser.parse_args(argv)

    try:
        validate_invariants(extract_archive(args.archive))
    except ValidationFailure as error:
        for issue in error.issues:
            sys.stderr.write(f"archive validation error: {issue}\n")
        return 1
    sys.stdout.write("archive validation passed\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
