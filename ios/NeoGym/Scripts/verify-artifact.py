#!/usr/bin/env python3
"""Validate a NeoGym app, archive, or IPA without disclosing opaque values.

Extraction adapters are intentionally separate from the pure normalized validator.
Diagnostics identify only metadata keys/contracts, never expected or actual values.
"""

from __future__ import annotations

import argparse
import json
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any

VARIANT_FILES = {
    "development": "Development.xcconfig",
    "production": "Production.xcconfig",
}
UNRESOLVED = re.compile(r"\$\([^)]*\)|\$\{[^}]*\}")
RUNTIME_KEYS = {
    "NeoGymNhostSubdomain": "NEOGYM_NHOST_SUBDOMAIN",
    "NeoGymNhostRegion": "NEOGYM_NHOST_REGION",
    "NeoGymCallbackScheme": "NEOGYM_CALLBACK_SCHEME",
    "NeoGymAppGroupIdentifier": "NEOGYM_APP_GROUP_IDENTIFIER",
    "NeoGymSharedKeychainAccessGroupSuffix": "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX",
}


class ValidationFailure(RuntimeError):
    """A validation failure containing key-only safe diagnostics."""

    def __init__(self, issues: Sequence[str]):
        self.issues = tuple(dict.fromkeys(issues))
        super().__init__("artifact validation failed")


@dataclass(frozen=True)
class ExpectedVariant:
    variant: str
    app_bundle_id: str
    widget_bundle_id: str
    app_group: str
    keychain_suffix: str
    callback_scheme: str
    app_display_name: str
    widget_display_name: str
    icon_name: str
    nhost_subdomain: str
    nhost_region: str
    development_team: str
    minimum_os: str
    device_family: str


@dataclass(frozen=True)
class NormalizedBundle:
    info: Mapping[str, Any]
    entitlements: Mapping[str, Any] | None
    provisioning: Mapping[str, Any] | None
    entitlement_source: str = "signed"


@dataclass(frozen=True)
class NormalizedArtifact:
    app: NormalizedBundle
    widget: NormalizedBundle | None
    requires_signed_metadata: bool


def _expand(value: str, settings: Mapping[str, str]) -> str:
    current = value
    for _ in range(64):
        updated = UNRESOLVED.sub(
            lambda match: settings.get(match.group()[2:-1], match.group()), current
        )
        if updated == current:
            return current
        current = updated
    return current


def _read_xcconfig(path: Path, settings: dict[str, str], visited: set[Path]) -> None:
    resolved = path.resolve()
    if resolved in visited:
        return
    visited.add(resolved)
    if not path.is_file():
        raise ValidationFailure([f"configuration.{path.name}"])

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        include = re.fullmatch(r'#include\??\s+"([^"]+)"', line)
        if include:
            included = path.parent / include.group(1)
            if included.is_file() or not line.startswith("#include?"):
                _read_xcconfig(included, settings, visited)
            continue
        if not line or line.startswith(("//", "#")) or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        settings[key.strip()] = value.strip()


def load_expected(project_root: Path, variant: str) -> ExpectedVariant:
    filename = VARIANT_FILES[variant]
    settings: dict[str, str] = {}
    _read_xcconfig(project_root / "Configuration" / filename, settings, set())
    expanded = {key: _expand(value, settings) for key, value in settings.items()}
    required = {
        "NEOGYM_APP_BUNDLE_IDENTIFIER",
        "NEOGYM_WIDGET_BUNDLE_IDENTIFIER",
        "NEOGYM_APP_GROUP_IDENTIFIER",
        "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX",
        "NEOGYM_CALLBACK_SCHEME",
        "NEOGYM_DISPLAY_NAME",
        "NEOGYM_WIDGET_DISPLAY_NAME",
        "NEOGYM_APP_ICON_NAME",
        "NEOGYM_NHOST_SUBDOMAIN",
        "NEOGYM_NHOST_REGION",
        "DEVELOPMENT_TEAM",
        "IPHONEOS_DEPLOYMENT_TARGET",
        "TARGETED_DEVICE_FAMILY",
    }
    issues = [f"configuration.{key}" for key in sorted(required) if key not in expanded]
    issues.extend(
        f"configuration.{key}"
        for key in sorted(required)
        if key in expanded and (expanded[key] == "" or UNRESOLVED.search(expanded[key]))
    )
    if issues:
        raise ValidationFailure(issues)
    return ExpectedVariant(
        variant=variant,
        app_bundle_id=expanded["NEOGYM_APP_BUNDLE_IDENTIFIER"],
        widget_bundle_id=expanded["NEOGYM_WIDGET_BUNDLE_IDENTIFIER"],
        app_group=expanded["NEOGYM_APP_GROUP_IDENTIFIER"],
        keychain_suffix=expanded["NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX"],
        callback_scheme=expanded["NEOGYM_CALLBACK_SCHEME"],
        app_display_name=expanded["NEOGYM_DISPLAY_NAME"],
        widget_display_name=expanded["NEOGYM_WIDGET_DISPLAY_NAME"],
        icon_name=expanded["NEOGYM_APP_ICON_NAME"],
        nhost_subdomain=expanded["NEOGYM_NHOST_SUBDOMAIN"],
        nhost_region=expanded["NEOGYM_NHOST_REGION"],
        development_team=expanded["DEVELOPMENT_TEAM"],
        minimum_os=expanded["IPHONEOS_DEPLOYMENT_TARGET"],
        device_family=expanded["TARGETED_DEVICE_FAMILY"],
    )


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


def _value(mapping: Mapping[str, Any], key: str) -> Any:
    return mapping.get(key)


def _expect_equal(issues: list[str], actual: Any, expected: Any, key: str) -> None:
    if actual != expected:
        issues.append(key)


def _url_schemes(info: Mapping[str, Any]) -> list[str]:
    result: list[str] = []
    for registration in info.get("CFBundleURLTypes", []):
        if isinstance(registration, Mapping):
            schemes = registration.get("CFBundleURLSchemes", [])
            if isinstance(schemes, list):
                result.extend(item for item in schemes if isinstance(item, str))
    return result


def _compiled_icon_name(info: Mapping[str, Any]) -> str | None:
    icons = info.get("CFBundleIcons")
    primary = icons.get("CFBundlePrimaryIcon") if isinstance(icons, Mapping) else None
    icon_name = (
        primary.get("CFBundleIconName") if isinstance(primary, Mapping) else None
    )
    return icon_name if isinstance(icon_name, str) else None


def _signed_prefix(
    bundle_id: str, entitlements: Mapping[str, Any], key: str, issues: list[str]
) -> str | None:
    application_identifier = entitlements.get("application-identifier")
    suffix = f".{bundle_id}"
    if not isinstance(
        application_identifier, str
    ) or not application_identifier.endswith(suffix):
        issues.append(key)
        return None
    prefix = application_identifier[: -len(bundle_id)]
    if prefix == "" or not prefix.endswith("."):
        issues.append(key)
        return None
    return prefix


def _profile_allows_keychains(signed: Any, allowed: Any) -> bool:
    if not isinstance(signed, list) or not isinstance(allowed, list):
        return False
    return all(
        isinstance(group, str)
        and any(
            isinstance(candidate, str)
            and (
                candidate == group
                or (candidate.endswith("*") and group.startswith(candidate[:-1]))
            )
            for candidate in allowed
        )
        for group in signed
    )


def _validate_profile(
    issues: list[str],
    label: str,
    bundle_id: str,
    bundle: NormalizedBundle,
    expected: ExpectedVariant,
    prefix: str | None,
    healthkit: bool,
) -> None:
    profile = bundle.provisioning
    entitlements = bundle.entitlements
    if profile is None:
        issues.append(f"{label}.embedded.mobileprovision")
        return
    profile_entitlements = profile.get("Entitlements")
    if not isinstance(profile_entitlements, Mapping):
        issues.append(f"{label}.provisioning.Entitlements")
        return
    if prefix is not None:
        _expect_equal(
            issues,
            profile_entitlements.get("application-identifier"),
            f"{prefix}{bundle_id}",
            f"{label}.provisioning.application-identifier",
        )
        prefixes = profile.get("ApplicationIdentifierPrefix")
        if not isinstance(prefixes, list) or prefix.removesuffix(".") not in prefixes:
            issues.append(f"{label}.provisioning.ApplicationIdentifierPrefix")
    teams = profile.get("TeamIdentifier")
    if not isinstance(teams, list) or expected.development_team not in teams:
        issues.append(f"{label}.provisioning.TeamIdentifier")
    _expect_equal(
        issues,
        profile_entitlements.get("com.apple.developer.team-identifier"),
        expected.development_team,
        f"{label}.provisioning.com.apple.developer.team-identifier",
    )
    if entitlements is not None:
        _expect_equal(
            issues,
            profile_entitlements.get("com.apple.security.application-groups"),
            entitlements.get("com.apple.security.application-groups"),
            f"{label}.provisioning.com.apple.security.application-groups",
        )
        signed_keychains = entitlements.get("keychain-access-groups")
        profile_keychains = profile_entitlements.get("keychain-access-groups")
        if not _profile_allows_keychains(signed_keychains, profile_keychains):
            issues.append(f"{label}.provisioning.keychain-access-groups")
    if healthkit:
        _expect_equal(
            issues,
            profile_entitlements.get("com.apple.developer.healthkit"),
            True,
            f"{label}.provisioning.com.apple.developer.healthkit",
        )


def _validate_bundle(
    issues: list[str],
    label: str,
    bundle: NormalizedBundle,
    bundle_id: str,
    display_name: str,
    expected: ExpectedVariant,
    *,
    app: bool,
) -> str | None:
    info = bundle.info
    _expect_equal(
        issues,
        _value(info, "CFBundleIdentifier"),
        bundle_id,
        f"{label}.Info.CFBundleIdentifier",
    )
    _expect_equal(
        issues,
        _value(info, "CFBundleDisplayName"),
        display_name,
        f"{label}.Info.CFBundleDisplayName",
    )
    _expect_equal(
        issues,
        _value(info, "MinimumOSVersion"),
        expected.minimum_os,
        f"{label}.Info.MinimumOSVersion",
    )
    try:
        expected_device_family = [int(expected.device_family)]
    except ValueError:
        issues.append("configuration.TARGETED_DEVICE_FAMILY")
        expected_device_family = []
    _expect_equal(
        issues,
        _value(info, "UIDeviceFamily"),
        expected_device_family,
        f"{label}.Info.UIDeviceFamily",
    )
    _expect_equal(
        issues,
        _value(info, "CFBundlePackageType"),
        "APPL" if app else "XPC!",
        f"{label}.Info.CFBundlePackageType",
    )
    if info.get("CFBundleSupportedPlatforms") not in (
        ["iPhoneOS"],
        ["iPhoneSimulator"],
    ):
        issues.append(f"{label}.Info.CFBundleSupportedPlatforms")
    if info.get("DTPlatformName") not in ("iphoneos", "iphonesimulator"):
        issues.append(f"{label}.Info.DTPlatformName")
    for plist_key, setting_key in RUNTIME_KEYS.items():
        expected_value = {
            "NEOGYM_NHOST_SUBDOMAIN": expected.nhost_subdomain,
            "NEOGYM_NHOST_REGION": expected.nhost_region,
            "NEOGYM_CALLBACK_SCHEME": expected.callback_scheme,
            "NEOGYM_APP_GROUP_IDENTIFIER": expected.app_group,
            "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX": expected.keychain_suffix,
        }[setting_key]
        _expect_equal(
            issues, info.get(plist_key), expected_value, f"{label}.Info.{plist_key}"
        )
    if app:
        _expect_equal(
            issues,
            _url_schemes(info),
            [expected.callback_scheme],
            f"{label}.Info.CFBundleURLSchemes",
        )
        _expect_equal(
            issues,
            _compiled_icon_name(info),
            expected.icon_name,
            f"{label}.Info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconName",
        )
        if (
            not isinstance(info.get("NSHealthShareUsageDescription"), str)
            or info.get("NSHealthShareUsageDescription") == ""
        ):
            issues.append(f"{label}.Info.NSHealthShareUsageDescription")
        if (
            not isinstance(info.get("NSHealthUpdateUsageDescription"), str)
            or info.get("NSHealthUpdateUsageDescription") == ""
        ):
            issues.append(f"{label}.Info.NSHealthUpdateUsageDescription")
        _expect_equal(
            issues,
            info.get("UISupportedInterfaceOrientations"),
            ["UIInterfaceOrientationPortrait"],
            f"{label}.Info.UISupportedInterfaceOrientations",
        )
        _expect_equal(
            issues,
            info.get("UILaunchStoryboardName"),
            "LaunchScreen",
            f"{label}.Info.UILaunchStoryboardName",
        )
        _expect_equal(
            issues,
            info.get("ITSAppUsesNonExemptEncryption"),
            False,
            f"{label}.Info.ITSAppUsesNonExemptEncryption",
        )
    else:
        if (
            "NSHealthShareUsageDescription" in info
            or "NSHealthUpdateUsageDescription" in info
        ):
            issues.append(f"{label}.Info.HealthKitUsageDescription")
        extension = info.get("NSExtension")
        extension_point = (
            extension.get("NSExtensionPointIdentifier")
            if isinstance(extension, Mapping)
            else None
        )
        _expect_equal(
            issues,
            extension_point,
            "com.apple.widgetkit-extension",
            f"{label}.Info.NSExtensionPointIdentifier",
        )

    if _contains_unresolved(info):
        issues.append(f"{label}.Info.unresolved-build-setting")

    entitlements = bundle.entitlements
    if entitlements is None:
        issues.append(f"{label}.entitlements")
        return None
    _expect_equal(
        issues,
        entitlements.get("com.apple.security.application-groups"),
        [expected.app_group],
        f"{label}.entitlements.com.apple.security.application-groups",
    )
    if app:
        _expect_equal(
            issues,
            entitlements.get("com.apple.developer.healthkit"),
            True,
            f"{label}.entitlements.com.apple.developer.healthkit",
        )
    elif "com.apple.developer.healthkit" in entitlements:
        issues.append(f"{label}.entitlements.com.apple.developer.healthkit")

    prefix: str | None = None
    if bundle.entitlement_source == "signed":
        prefix = _signed_prefix(
            bundle_id,
            entitlements,
            f"{label}.entitlements.application-identifier",
            issues,
        )
        _expect_equal(
            issues,
            entitlements.get("com.apple.developer.team-identifier"),
            expected.development_team,
            f"{label}.entitlements.com.apple.developer.team-identifier",
        )
        expected_keychain = (
            [f"{prefix}{expected.keychain_suffix}"] if prefix is not None else None
        )
    elif bundle.entitlement_source == "simulator-signed-template":
        prefix = f"{expected.development_team}."
        expected_keychain = [f"{prefix}{expected.keychain_suffix}"]
    else:
        expected_keychain = [expected.keychain_suffix]
    if expected_keychain is not None:
        _expect_equal(
            issues,
            entitlements.get("keychain-access-groups"),
            expected_keychain,
            f"{label}.entitlements.keychain-access-groups",
        )
        _expect_equal(
            issues,
            info.get("NeoGymSharedKeychainAccessGroup"),
            expected_keychain[0],
            f"{label}.Info.NeoGymSharedKeychainAccessGroup",
        )
    if _contains_unresolved(entitlements):
        issues.append(f"{label}.entitlements.unresolved-build-setting")
    return prefix


def validate_normalized(
    expected: ExpectedVariant, artifact: NormalizedArtifact
) -> None:
    issues: list[str] = []
    if artifact.widget is None:
        raise ValidationFailure(["artifact.PlugIns.NeoGymWidgets.appex"])

    app_prefix = _validate_bundle(
        issues,
        "app",
        artifact.app,
        expected.app_bundle_id,
        expected.app_display_name,
        expected,
        app=True,
    )
    widget_prefix = _validate_bundle(
        issues,
        "widget",
        artifact.widget,
        expected.widget_bundle_id,
        expected.widget_display_name,
        expected,
        app=False,
    )
    app_info = artifact.app.info
    widget_info = artifact.widget.info
    for key in ("CFBundleShortVersionString", "CFBundleVersion"):
        app_value = app_info.get(key)
        widget_value = widget_info.get(key)
        if (
            not isinstance(app_value, str)
            or app_value == ""
            or app_value != widget_value
        ):
            issues.append(f"artifact.version-parity.{key}")
    if app_info.get("CFBundleSupportedPlatforms") != widget_info.get(
        "CFBundleSupportedPlatforms"
    ):
        issues.append("artifact.platform-parity.CFBundleSupportedPlatforms")
    if artifact.requires_signed_metadata:
        if artifact.app.entitlement_source != "signed":
            issues.append("app.signed-entitlements")
        if artifact.widget.entitlement_source != "signed":
            issues.append("widget.signed-entitlements")
        _validate_profile(
            issues,
            "app",
            expected.app_bundle_id,
            artifact.app,
            expected,
            app_prefix,
            True,
        )
        _validate_profile(
            issues,
            "widget",
            expected.widget_bundle_id,
            artifact.widget,
            expected,
            widget_prefix,
            False,
        )
        if (
            app_prefix is not None
            and widget_prefix is not None
            and app_prefix != widget_prefix
        ):
            issues.append("artifact.application-identifier-prefix-parity")
    if issues:
        raise ValidationFailure(issues)


def normalized_from_mapping(value: Mapping[str, Any]) -> NormalizedArtifact:
    """Decode a synthetic normalized fixture without invoking platform tools."""

    def bundle(key: str) -> NormalizedBundle | None:
        raw = value.get(key)
        if raw is None:
            return None
        if not isinstance(raw, Mapping):
            raise ValidationFailure([f"fixture.{key}"])
        info = raw.get("info")
        entitlements = raw.get("entitlements")
        provisioning = raw.get("provisioning")
        source = raw.get("entitlementSource", "signed")
        if not isinstance(info, Mapping):
            raise ValidationFailure([f"fixture.{key}.info"])
        if entitlements is not None and not isinstance(entitlements, Mapping):
            raise ValidationFailure([f"fixture.{key}.entitlements"])
        if provisioning is not None and not isinstance(provisioning, Mapping):
            raise ValidationFailure([f"fixture.{key}.provisioning"])
        if not isinstance(source, str):
            raise ValidationFailure([f"fixture.{key}.entitlementSource"])
        return NormalizedBundle(info, entitlements, provisioning, source)

    app = bundle("app")
    if app is None:
        raise ValidationFailure(["fixture.app"])
    requires_signed = value.get("requiresSignedMetadata")
    if not isinstance(requires_signed, bool):
        raise ValidationFailure(["fixture.requiresSignedMetadata"])
    return NormalizedArtifact(app, bundle("widget"), requires_signed)


def validate_build_settings(
    expected: ExpectedVariant,
    app_settings: Mapping[str, Any],
    widget_settings: Mapping[str, Any],
) -> None:
    issues: list[str] = []
    shared = {
        "DEVELOPMENT_TEAM": expected.development_team,
        "IPHONEOS_DEPLOYMENT_TARGET": expected.minimum_os,
        "TARGETED_DEVICE_FAMILY": expected.device_family,
        "NEOGYM_APP_GROUP_IDENTIFIER": expected.app_group,
        "NEOGYM_CALLBACK_SCHEME": expected.callback_scheme,
        "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX": expected.keychain_suffix,
        "NEOGYM_NHOST_SUBDOMAIN": expected.nhost_subdomain,
        "NEOGYM_NHOST_REGION": expected.nhost_region,
        "SUPPORTS_MACCATALYST": "NO",
        "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD": "NO",
    }
    for label, settings in (("app", app_settings), ("widget", widget_settings)):
        for key, expected_value in shared.items():
            _expect_equal(
                issues,
                settings.get(key),
                expected_value,
                f"build-settings.{label}.{key}",
            )
        if _contains_unresolved(settings):
            issues.append(f"build-settings.{label}.unresolved-build-setting")
    _expect_equal(
        issues,
        app_settings.get("PRODUCT_BUNDLE_IDENTIFIER"),
        expected.app_bundle_id,
        "build-settings.app.PRODUCT_BUNDLE_IDENTIFIER",
    )
    _expect_equal(
        issues,
        widget_settings.get("PRODUCT_BUNDLE_IDENTIFIER"),
        expected.widget_bundle_id,
        "build-settings.widget.PRODUCT_BUNDLE_IDENTIFIER",
    )
    _expect_equal(
        issues,
        app_settings.get("ASSETCATALOG_COMPILER_APPICON_NAME"),
        expected.icon_name,
        "build-settings.app.ASSETCATALOG_COMPILER_APPICON_NAME",
    )
    for key in ("MARKETING_VERSION", "CURRENT_PROJECT_VERSION"):
        if app_settings.get(key) != widget_settings.get(key):
            issues.append(f"build-settings.version-parity.{key}")
    if issues:
        raise ValidationFailure(issues)


class CommandAdapters:
    """Command-backed extraction boundary, injectable for deterministic tests."""

    def __init__(
        self, codesign: str = "/usr/bin/codesign", security: str = "/usr/bin/security"
    ) -> None:
        self.codesign = codesign
        self.security = security

    @staticmethod
    def _plist_output(command: Sequence[str], key: str) -> Mapping[str, Any]:
        result = subprocess.run(command, check=False, capture_output=True)
        if result.returncode != 0:
            raise ValidationFailure([key])
        payload = result.stdout
        if b"<?xml" not in payload and b"<?xml" in result.stderr:
            payload = result.stderr[result.stderr.index(b"<?xml") :]
        try:
            value = plistlib.loads(payload)
        except (plistlib.InvalidFileException, ValueError):
            raise ValidationFailure([key]) from None
        if not isinstance(value, Mapping):
            raise ValidationFailure([key])
        return value

    def signed_entitlements(self, bundle: Path, label: str) -> Mapping[str, Any]:
        return self._plist_output(
            [self.codesign, "--display", "--entitlements", ":-", "--xml", str(bundle)],
            f"{label}.signed-entitlements",
        )

    def provisioning(self, bundle: Path, label: str) -> Mapping[str, Any]:
        return self._plist_output(
            [
                self.security,
                "cms",
                "-D",
                "-i",
                str(bundle / "embedded.mobileprovision"),
            ],
            f"{label}.embedded.mobileprovision",
        )

    def verify_signature(self, bundle: Path, label: str) -> None:
        result = subprocess.run(
            [self.codesign, "--verify", "--strict", str(bundle)],
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            raise ValidationFailure([f"{label}.signature"])


def _load_plist(path: Path, key: str) -> Mapping[str, Any]:
    try:
        value = plistlib.loads(path.read_bytes())
    except (OSError, plistlib.InvalidFileException, ValueError):
        raise ValidationFailure([key]) from None
    if not isinstance(value, Mapping):
        raise ValidationFailure([key])
    return value


def _expand_entitlement_value(value: Any, settings: Mapping[str, str]) -> Any:
    if isinstance(value, str):
        return _expand(value, settings)
    if isinstance(value, list):
        return [_expand_entitlement_value(item, settings) for item in value]
    if isinstance(value, Mapping):
        return {
            key: _expand_entitlement_value(item, settings)
            for key, item in value.items()
        }
    return value


def _unsigned_entitlements(
    project_root: Path,
    expected: ExpectedVariant,
    app: bool,
    app_identifier_prefix: str = "",
) -> Mapping[str, Any]:
    relative_path = (
        Path("App/NeoGym.entitlements")
        if app
        else Path("Widgets/NeoGymWidgets.entitlements")
    )
    template = _load_plist(
        project_root / relative_path,
        "app.source-entitlements" if app else "widget.source-entitlements",
    )
    expanded = _expand_entitlement_value(
        template,
        {
            "AppIdentifierPrefix": app_identifier_prefix,
            "NEOGYM_APP_GROUP_IDENTIFIER": expected.app_group,
            "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX": expected.keychain_suffix,
        },
    )
    if not isinstance(expanded, Mapping):
        raise ValidationFailure(
            ["app.source-entitlements" if app else "widget.source-entitlements"]
        )
    return expanded


def _extract_bundle(
    path: Path,
    label: str,
    project_root: Path,
    expected: ExpectedVariant,
    adapters: CommandAdapters,
    require_signed: bool,
    simulator_signed: bool,
    app: bool,
) -> NormalizedBundle:
    info = _load_plist(path / "Info.plist", f"{label}.Info.plist")
    provisioned = (path / "embedded.mobileprovision").is_file()
    if require_signed or provisioned:
        entitlements = adapters.signed_entitlements(path, label)
        provisioning = adapters.provisioning(path, label)
        source = "signed"
    elif simulator_signed:
        adapters.verify_signature(path, label)
        entitlements = _unsigned_entitlements(
            project_root,
            expected,
            app,
            app_identifier_prefix=f"{expected.development_team}.",
        )
        provisioning = None
        source = "simulator-signed-template"
    else:
        entitlements = _unsigned_entitlements(project_root, expected, app)
        provisioning = None
        source = "unsigned-template"
    return NormalizedBundle(info, entitlements, provisioning, source)


def extract_normalized(
    app_path: Path,
    project_root: Path,
    expected: ExpectedVariant,
    adapters: CommandAdapters,
    require_signed: bool,
    simulator_signed: bool = False,
) -> NormalizedArtifact:
    if not (app_path / "Assets.car").is_file():
        raise ValidationFailure(["app.Assets.car"])
    widget_path = app_path / "PlugIns" / "NeoGymWidgets.appex"
    app = _extract_bundle(
        app_path,
        "app",
        project_root,
        expected,
        adapters,
        require_signed,
        simulator_signed,
        True,
    )
    widget = None
    if widget_path.is_dir():
        widget = _extract_bundle(
            widget_path,
            "widget",
            project_root,
            expected,
            adapters,
            require_signed,
            simulator_signed,
            False,
        )
    return NormalizedArtifact(app, widget, require_signed)


@contextmanager
def artifact_workspace(path: Path) -> Iterator[tuple[Path, bool]]:
    temporary: Path | None = None
    try:
        if path.suffix == ".app" and path.is_dir():
            yield path, False
            return
        if path.suffix == ".xcarchive" and path.is_dir():
            apps = list((path / "Products" / "Applications").glob("*.app"))
            if len(apps) != 1:
                raise ValidationFailure(["archive.Products.Applications"])
            yield apps[0], True
            return
        if path.suffix == ".ipa" and path.is_file():
            # tempfile.mkdtemp creates a private mode-0700 directory atomically.
            temporary = Path(tempfile.mkdtemp(prefix="neogym-ipa-"))
            with zipfile.ZipFile(path) as archive:
                root = temporary.resolve()
                for member in archive.infolist():
                    destination = (temporary / member.filename).resolve()
                    if destination != root and root not in destination.parents:
                        raise ValidationFailure(["ipa.archive-path"])
                archive.extractall(temporary)
            apps = list((temporary / "Payload").glob("*.app"))
            if len(apps) != 1:
                raise ValidationFailure(["ipa.Payload.app"])
            yield apps[0], True
            return
        raise ValidationFailure(["artifact.path"])
    finally:
        if temporary is not None:
            with suppress(OSError):
                shutil.rmtree(temporary)


def _load_json_mapping(path: Path, key: str) -> Mapping[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise ValidationFailure([key]) from None
    if not isinstance(value, Mapping):
        raise ValidationFailure([key])
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate a NeoGym built artifact")
    parser.add_argument("--variant", required=True, choices=tuple(VARIANT_FILES))
    parser.add_argument("artifact", type=Path)
    parser.add_argument(
        "--project-root", type=Path, default=Path(__file__).resolve().parents[1]
    )
    parser.add_argument("--app-build-settings", type=Path)
    parser.add_argument("--widget-build-settings", type=Path)
    parser.add_argument(
        "--signed-simulator",
        action="store_true",
        help="require a locally signed simulator app and validate its simulated entitlements",
    )
    args = parser.parse_args(argv)

    try:
        expected = load_expected(args.project_root, args.variant)
        if (args.app_build_settings is None) != (args.widget_build_settings is None):
            raise ValidationFailure(["build-settings.arguments"])
        if (
            args.app_build_settings is not None
            and args.widget_build_settings is not None
        ):
            validate_build_settings(
                expected,
                _load_json_mapping(args.app_build_settings, "build-settings.app"),
                _load_json_mapping(args.widget_build_settings, "build-settings.widget"),
            )
        with artifact_workspace(args.artifact) as (app_path, require_signed):
            if args.signed_simulator and require_signed:
                raise ValidationFailure(["arguments.signed-simulator"])
            artifact = extract_normalized(
                app_path,
                args.project_root,
                expected,
                CommandAdapters(),
                require_signed,
                simulator_signed=args.signed_simulator,
            )
            validate_normalized(expected, artifact)
    except ValidationFailure as error:
        for issue in error.issues:
            print(f"artifact validation error: {issue}", file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError, zipfile.BadZipFile):
        print("artifact validation error: extraction", file=sys.stderr)
        return 1
    print(f"artifact validation passed: {args.variant}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
