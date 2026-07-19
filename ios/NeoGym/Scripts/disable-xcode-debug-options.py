#!/usr/bin/env python3
"""Keep every generated shared scheme's costly debug helpers disabled."""

from __future__ import annotations

import re
from pathlib import Path

SCHEME_NAMES = ("NeoGym Dev", "NeoGym")
SCHEME_DIRECTORY = Path("NeoGym.xcodeproj/xcshareddata/xcschemes")

# Values match Xcode's .xcscheme spelling/casing.
LAUNCH_ACTION_ATTRIBUTES = {
    "debugXPCServices": "NO",
    "debugServiceExtension": "none",
    "queueDebuggingEnabled": "No",
    "enableQueueDebugging": "NO",
    "viewDebuggingEnabled": "No",
    "enableThreadPerformanceChecker": "NO",
}


def set_launch_action_attributes(scheme_xml: str, scheme_path: Path) -> str:
    match = re.search(r"(<LaunchAction\b[^>]*)(>)", scheme_xml, flags=re.DOTALL)
    if not match:
        raise RuntimeError(f"LaunchAction not found in {scheme_path.name}")

    launch_action = match.group(1)
    for key, value in LAUNCH_ACTION_ATTRIBUTES.items():
        attribute_pattern = re.compile(rf'(\s+{re.escape(key)}\s=\s")[^"]*(")')
        replacement = rf"\g<1>{value}\2"
        if attribute_pattern.search(launch_action):
            launch_action = attribute_pattern.sub(replacement, launch_action)
        else:
            launch_action += f'\n      {key} = "{value}"'

    return scheme_xml[: match.start(1)] + launch_action + scheme_xml[match.end(1) :]


def patch_scheme(path: Path) -> None:
    scheme_xml = path.read_text(encoding="utf-8")
    patched_xml = set_launch_action_attributes(scheme_xml, path)
    if patched_xml != scheme_xml:
        path.write_text(patched_xml, encoding="utf-8")


def main() -> None:
    for name in SCHEME_NAMES:
        path = SCHEME_DIRECTORY / f"{name}.xcscheme"
        if not path.is_file():
            raise RuntimeError(f"Expected shared scheme is missing: {name}")
        patch_scheme(path)


if __name__ == "__main__":
    main()
