#!/usr/bin/env python3
"""Key-only preflight for generated per-variant build configuration."""

from __future__ import annotations

import argparse
import importlib.util
import os
import re
import sys
from pathlib import Path

CONFIGURATIONS = {
    "Debug-Development": "Development.xcconfig",
    "Release-Development": "Development.xcconfig",
    "Debug-Production": "Production.xcconfig",
    "Release-Production": "Production.xcconfig",
}
REQUIRED_SETTINGS = (
    "DEVELOPMENT_TEAM",
    "NEOGYM_NHOST_SUBDOMAIN",
    "NEOGYM_NHOST_REGION",
)
UNEXPANDED = re.compile(r"\$\([^)]*\)|\$\{[^}]*\}")


def materializer_module():
    path = Path(__file__).with_name("materialize-config.py")
    spec = importlib.util.spec_from_file_location("neogym_materializer", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("materializer module unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def values_from_xcconfig(path: Path) -> dict[str, str]:
    module = materializer_module()
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith(("//", "#")):
            continue
        key, encoded = line.split("=", 1)
        key = key.strip()
        if key in REQUIRED_SETTINGS:
            try:
                values[key] = module.unescape_xcconfig(encoded.strip())
            except ValueError:
                values[key] = ""
    return values


def validate(
    configuration: str, generated_dir: Path, check_environment: bool
) -> list[str]:
    expected_file = CONFIGURATIONS.get(configuration)
    if expected_file is None:
        return ["CONFIGURATION"]
    path = generated_dir / expected_file
    if not path.is_file():
        return [f"generated file {expected_file}"]

    failures: list[str] = []
    source_values = values_from_xcconfig(path)
    for key in REQUIRED_SETTINGS:
        value = source_values.get(key)
        if value is None or value == "" or UNEXPANDED.search(value):
            failures.append(key)

    if check_environment:
        for key in REQUIRED_SETTINGS:
            value = os.environ.get(key)
            if (
                value is None or value == "" or UNEXPANDED.search(value)
            ) and key not in failures:
                failures.append(key)
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", required=True)
    parser.add_argument(
        "--generated-dir", type=Path, default=Path("Configuration/Generated")
    )
    parser.add_argument("--check-environment", action="store_true")
    args = parser.parse_args(argv)

    failures = validate(args.configuration, args.generated_dir, args.check_environment)
    if failures:
        for key in failures:
            print(f"configuration error: unresolved or missing {key}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
