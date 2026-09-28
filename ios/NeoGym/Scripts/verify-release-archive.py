#!/usr/bin/env python3
"""Fail-closed structure, signature, entitlement and binary checks for NeoGym releases."""

import argparse
import datetime
import plistlib
import re
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

TEAM = "C7HCKFA2LG"
PHONE = "io.nhost.dbarroso.neogym"
WATCH = PHONE + ".watchkitapp"
WIDGET = PHONE + ".widgets"
SHARED_GROUP = "group.io.nhost.dbarroso.neogym"
FORBIDDEN_FRAMEWORKS = ("HealthKit", "WidgetKit", "ActivityKit")


class InvalidArtifact(Exception):
    pass


def require(condition, message):
    if not condition:
        raise InvalidArtifact(message)


def command(*args):
    try:
        return subprocess.run(args, check=True, capture_output=True).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        raise InvalidArtifact(f"Command failed: {args[0]} ({error})") from error


def plist(path):
    try:
        value = plistlib.loads(path.read_bytes())
    except (OSError, ValueError, plistlib.InvalidFileException) as error:
        raise InvalidArtifact(f"Cannot read plist {path}: {error}") from error
    require(isinstance(value, dict), f"Not a plist dictionary: {path}")
    return value


def only_child(directory, suffix):
    require(directory.is_dir() and not directory.is_symlink(), f"Missing directory: {directory}")
    matches = list(directory.glob("*" + suffix))
    require(len(matches) == 1 and matches[0].is_dir() and not matches[0].is_symlink(),
            f"Expected exactly one {suffix} in {directory}")
    return matches[0]


def bundles(root, app):
    watch = only_child(app / "Watch", ".app")
    widget = only_child(app / "PlugIns", ".appex")
    actual = {app.resolve()} | {p.resolve() for p in root.rglob("*")
                                if p.suffix in (".app", ".appex") and p.is_dir()}
    require(actual == {app.resolve(), watch.resolve(), widget.resolve()},
            "Unexpected or missing app/extension bundles")
    return app, watch, widget


def verify_structure(root, app, platform):
    phone, watch, widget = bundles(root, app)
    infos = [plist(bundle / "Info.plist") for bundle in (phone, watch, widget)]
    ids = (PHONE, WATCH, WIDGET)
    for index, bundle in enumerate((phone, watch, widget)):
        info = infos[index]
        identifier = ids[index]
        os_name = platform[1] if index == 1 else platform[0]
        family = [4] if index == 1 else [1]
        require(info.get("CFBundleIdentifier") == identifier, f"Wrong bundle ID: {bundle}")
        require(info.get("CFBundlePackageType") == ("XPC!" if bundle == widget else "APPL"),
                f"Wrong bundle type: {bundle}")
        require(info.get("DTPlatformName", "").lower() == os_name, f"Wrong OS platform: {bundle}")
        require(info.get("MinimumOSVersion") == "27.0", f"Wrong minimum OS: {bundle}")
        require(info.get("UIDeviceFamily") == family, f"Wrong device family: {bundle}")
        for key in ("CFBundleShortVersionString", "CFBundleVersion", "CFBundleExecutable"):
            require(isinstance(info.get(key), str) and info[key] and "$" not in info[key],
                    f"Missing or unexpanded {key}: {bundle}")
        executable = bundle / info["CFBundleExecutable"]
        require(executable.is_file() and not executable.is_symlink(), f"Missing executable: {bundle}")
        require(info["CFBundleVersion"] == infos[0]["CFBundleVersion"] and
                info["CFBundleShortVersionString"] == infos[0]["CFBundleShortVersionString"],
                f"Versions disagree within artifact: {bundle}")
    require(isinstance(infos[1].get("WKApplication"), bool) and
            infos[1]["WKApplication"] and
            infos[1].get("WKCompanionAppBundleIdentifier") == PHONE and
            isinstance(infos[1].get("WKRunsIndependentlyOfCompanionApp"), bool) and
            not infos[1]["WKRunsIndependentlyOfCompanionApp"],
            "Watch companion metadata mismatch")
    icon = infos[1].get("CFBundleIcons", {}).get("CFBundlePrimaryIcon", {})
    require(icon.get("CFBundleIconName") == "AppIcon" and (watch / "Assets.car").is_file(),
            "Watch AppIcon or compiled asset catalog missing")
    require(infos[2].get("NSExtension", {}).get("NSExtensionPointIdentifier") ==
            "com.apple.widgetkit-extension", "Wrong widget extension point")
    binaries = [watch / infos[1]["CFBundleExecutable"]]
    # Xcode Debug builds can put the app's links in a dylib while the
    # CFBundleExecutable is only a stub. Inspect both when the dylib exists.
    debug_binary = watch / (infos[1]["CFBundleExecutable"] + ".debug.dylib")
    if debug_binary.exists() or debug_binary.is_symlink():
        require(debug_binary.is_file() and not debug_binary.is_symlink(),
                f"Invalid watch debug dylib: {debug_binary}")
        binaries.append(debug_binary)
    for binary in binaries:
        deps = command("/usr/bin/otool", "-L", str(binary))
        for framework in FORBIDDEN_FRAMEWORKS:
            require(not re.search(rb"/" + framework.encode() + rb"\.framework/", deps),
                    f"Watch links forbidden framework in {binary}: {framework}")
    return (phone, watch, widget), infos


def signed_entitlements(bundle, identifier, distribution):
    command("/usr/bin/codesign", "--verify", "--strict", "--verbose=2", str(bundle))
    details = subprocess.run(("/usr/bin/codesign", "-dv", "--verbose=4", str(bundle)),
                             capture_output=True, check=False)
    require(details.returncode == 0, f"Cannot inspect signature: {bundle}")
    detail = details.stderr.decode("utf-8", errors="replace")
    require("Signature=adhoc" not in detail and "Authority=" in detail and
            f"TeamIdentifier={TEAM}" in detail and f"Identifier={identifier}" in detail,
            f"Wrong or ad-hoc signing identity: {bundle}")
    data = command("/usr/bin/codesign", "-d", "--entitlements", ":-", str(bundle))
    try:
        ent = plistlib.loads(data)
    except (ValueError, plistlib.InvalidFileException) as error:
        raise InvalidArtifact(f"Missing signed entitlements: {bundle}") from error
    require(isinstance(ent, dict), f"Invalid signed entitlements: {bundle}")
    app_id = ent.get("application-identifier")
    require(isinstance(app_id, str) and app_id.endswith("." + identifier),
            f"Wrong application identifier: {bundle}")
    prefix = app_id[:-(len(identifier) + 1)]
    require(prefix == TEAM and ent.get("com.apple.developer.team-identifier") == TEAM,
            f"Wrong signing team: {bundle}")
    if distribution:
        require(isinstance(ent.get("get-task-allow"), bool) and not ent["get-task-allow"],
                f"Export is development signed: {bundle}")
    else:
        require(isinstance(ent.get("get-task-allow"), bool),
                f"Archive missing signing type: {bundle}")
    profile_path = bundle / "embedded.mobileprovision"
    require(profile_path.is_file(), f"Missing provisioning profile: {bundle}")
    try:
        profile = plistlib.loads(command("/usr/bin/security", "cms", "-D", "-i", str(profile_path)))
    except (ValueError, plistlib.InvalidFileException) as error:
        raise InvalidArtifact(f"Invalid provisioning profile: {bundle}") from error
    require(TEAM in profile.get("TeamIdentifier", []) and
            profile.get("ExpirationDate", datetime.datetime.min) > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
            f"Expired or wrong-team provisioning profile: {bundle}")
    allowed = profile.get("Entitlements", {})
    allowed_id = allowed.get("application-identifier")
    # A development profile may use a trailing, component-bounded wildcard
    # (e.g. TEAM.*) while Xcode signs the watch with its concrete App ID.
    wildcard_scope = allowed_id[:-1] if isinstance(allowed_id, str) and allowed_id.endswith(".*") else None
    covers_id = allowed_id == app_id or (wildcard_scope is not None and
                                           wildcard_scope.startswith(TEAM + ".") and
                                           app_id.startswith(wildcard_scope))
    require(covers_id and allowed.get("get-task-allow") == ent["get-task-allow"],
            f"Provisioning profile does not cover signing identity/type: {bundle}")
    groups = ent.get("keychain-access-groups", [])
    allowed_groups = allowed.get("keychain-access-groups", [])
    require(all(group in allowed_groups or prefix + ".*" in allowed_groups for group in groups),
            f"Provisioning profile does not permit Keychain groups: {bundle}")
    require(all(group in allowed.get("com.apple.security.application-groups", [])
                for group in ent.get("com.apple.security.application-groups", [])),
            f"Provisioning profile does not permit App Groups: {bundle}")
    if ent.get("com.apple.developer.healthkit"):
        require(allowed.get("com.apple.developer.healthkit") == ent["com.apple.developer.healthkit"],
                f"Provisioning profile does not permit HealthKit: {bundle}")
    return ent, prefix


def verify_signatures(bundles_by_role, distribution):
    app, watch, widget = bundles_by_role
    phone_ent, prefix = signed_entitlements(app, PHONE, distribution)
    watch_ent, watch_prefix = signed_entitlements(watch, WATCH, distribution)
    widget_ent, widget_prefix = signed_entitlements(widget, WIDGET, distribution)
    require(prefix == watch_prefix == widget_prefix, "App ID prefixes disagree")
    shared = prefix + ".io.nhost.neogym.shared"
    for role, ent in (("phone", phone_ent), ("widget", widget_ent)):
        require(ent.get("keychain-access-groups") == [shared], f"{role} shared Keychain group changed")
        require(ent.get("com.apple.security.application-groups") == [SHARED_GROUP],
                f"{role} App Group changed")
    require(isinstance(phone_ent.get("com.apple.developer.healthkit"), bool) and
            phone_ent["com.apple.developer.healthkit"],
            "Phone HealthKit entitlement missing")
    require("com.apple.developer.healthkit" not in widget_ent,
            "Widget has HealthKit entitlement")
    require(watch_ent.get("keychain-access-groups", []) in ([], [prefix + "." + WATCH]) and
            "com.apple.security.application-groups" not in watch_ent and
            "com.apple.developer.healthkit" not in watch_ent,
            "Watch has a shared or forbidden entitlement")


def extract_ipa(ipa, output):
    require(ipa.is_file(), f"Missing IPA: {ipa}")
    try:
        with zipfile.ZipFile(ipa) as archive:
            names = archive.namelist()
            require(len(names) == len(set(names)), "Duplicate IPA entries")
            for entry in archive.infolist():
                path = Path(entry.filename)
                require(not path.is_absolute() and ".." not in path.parts and
                        entry.external_attr >> 16 & 0o170000 != stat.S_IFLNK,
                        "Unsafe IPA entry")
            archive.extractall(output)
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        raise InvalidArtifact(f"Cannot extract IPA: {error}") from error


def inspect(root, kind):
    location = root / "Products/Applications" if kind == "archive" else root / "Payload" if kind == "ipa" else root.parent
    app = root if kind == "simulator" else only_child(location, ".app")
    if kind == "ipa":
        require({p.name for p in root.iterdir()} == {"Payload", "Symbols"} or
                {p.name for p in root.iterdir()} == {"Payload"},
                "Unexpected IPA root contents")
    role_bundles, _ = verify_structure(app, app,
                                       ("iphonesimulator", "watchsimulator") if kind == "simulator"
                                       else ("iphoneos", "watchos"))
    if kind != "simulator":
        verify_signatures(role_bundles, kind == "ipa")
    print(f"Verified {kind}: {app}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--ipa", type=Path)
    parser.add_argument("--simulator", type=Path, help="Path to built iOS simulator .app")
    args = parser.parse_args()
    require(args.archive or args.simulator, "Pass --archive and/or --simulator")
    require(not args.ipa or args.archive, "--ipa requires --archive")
    if args.simulator:
        require(args.simulator.is_dir() and args.simulator.suffix == ".app", "Invalid simulator app")
        inspect(args.simulator, "simulator")
    if args.archive:
        require(args.archive.is_dir() and args.archive.suffix == ".xcarchive", "Invalid archive")
        inspect(args.archive, "archive")
    if args.ipa:
        with tempfile.TemporaryDirectory(prefix="neogym-ipa-") as extracted:
            extract_ipa(args.ipa, Path(extracted))
            inspect(Path(extracted), "ipa")


if __name__ == "__main__":
    try:
        main()
    except InvalidArtifact as error:
        print(f"Verification failed: {error}", file=sys.stderr)
        sys.exit(1)
