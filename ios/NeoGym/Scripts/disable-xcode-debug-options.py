#!/usr/bin/env python3
"""Keep generated Xcode schemes from re-enabling costly debug helpers.

XcodeGen exposes some diagnostics directly, but not Queue Debugging/backtrace
recording or View Debugging. This post-generation patch keeps those defaults in
source control through project.yml instead of relying on local Xcode UI state.
"""

from __future__ import annotations

import re
from pathlib import Path

SCHEME_PATH = Path("NeoGym.xcodeproj/xcshareddata/xcschemes/NeoGym.xcscheme")

# Values match Xcode's .xcscheme spelling/casing.
LAUNCH_ACTION_ATTRIBUTES = {
    # Run > Options
    "debugXPCServices": "NO",
    "debugServiceExtension": "none",
    # Xcode 26 reads queueDebuggingEnabled; older Xcodes used enableQueueDebugging.
    "queueDebuggingEnabled": "No",
    "enableQueueDebugging": "NO",
    "viewDebuggingEnabled": "No",
    # Run > Diagnostics / modern Xcode spelling for Thread Performance Checker.
    "enableThreadPerformanceChecker": "NO",
}


def set_launch_action_attributes(scheme_xml: str) -> str:
    match = re.search(r"(<LaunchAction\b[^>]*)(>)", scheme_xml, flags=re.DOTALL)
    if not match:
        raise RuntimeError(f"LaunchAction not found in {SCHEME_PATH}")

    launch_action = match.group(1)
    for key, value in LAUNCH_ACTION_ATTRIBUTES.items():
        attribute_pattern = re.compile(rf'(\s+{re.escape(key)}\s=\s")[^"]*(")')
        replacement = rf"\g<1>{value}\2"
        if attribute_pattern.search(launch_action):
            launch_action = attribute_pattern.sub(replacement, launch_action)
        else:
            launch_action += f'\n      {key} = "{value}"'

    return scheme_xml[: match.start(1)] + launch_action + scheme_xml[match.end(1) :]


def main() -> None:
    scheme_xml = SCHEME_PATH.read_text(encoding="utf-8")
    patched_xml = set_launch_action_attributes(scheme_xml)
    if patched_xml != scheme_xml:
        SCHEME_PATH.write_text(patched_xml, encoding="utf-8")


if __name__ == "__main__":
    main()
