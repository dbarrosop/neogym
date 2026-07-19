#!/usr/bin/env python3
"""Verify the operator attestation for production Nhost callback deployment.

This gate proves only that an operator recorded verification against the exact
tracked overlay bytes. It does not inspect or independently prove cloud state.
Diagnostics deliberately expose field names only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

IOS_ROOT = Path(__file__).resolve().parent.parent
REPOSITORY_ROOT = IOS_ROOT.parents[1]
DEFAULT_RECEIPT = IOS_ROOT / "fastlane/cloud-callback-receipt.production.json"
DEFAULT_OVERLAY = (
    REPOSITORY_ROOT
    / "backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json"
)
EXPECTED_SCHEMA = "./cloud-callback-receipt.production.schema.json"
EXPECTED_PROJECT_ID = "spmqtxqkdoxvtrkrfnnl"
EXPECTED_CALLBACK_URLS = ("neogym://verify", "neogym-dev://verify")
EXPECTED_FIELDS = {
    "$schema",
    "projectId",
    "overlaySha256",
    "verifiedAt",
    "verifiedBy",
    "callbackUrls",
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
UTC_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


class ReceiptError(RuntimeError):
    """A key-only receipt failure that is safe to expose in release logs."""

    def __init__(self, fields: list[str] | tuple[str, ...]) -> None:
        unique_fields = tuple(dict.fromkeys(fields))
        super().__init__(", ".join(unique_fields))
        self.fields = unique_fields


def _read_receipt(path: Path) -> dict[str, Any]:
    try:
        source = path.read_text(encoding="utf-8")
        parsed: Any = json.loads(source)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ReceiptError(("receipt",)) from error
    if not isinstance(parsed, dict):
        raise ReceiptError(("receipt",))
    return parsed


def _is_utc_timestamp(value: Any) -> bool:
    if not isinstance(value, str) or UTC_TIMESTAMP_PATTERN.fullmatch(value) is None:
        return False
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return False
    return True


def overlay_sha256(path: Path) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as error:
        raise ReceiptError(("overlay",)) from error


def verify_receipt(receipt_path: Path, overlay_path: Path) -> None:
    receipt = _read_receipt(receipt_path)
    failures: list[str] = []

    if set(receipt) != EXPECTED_FIELDS:
        failures.append("receipt")
    if receipt.get("$schema") != EXPECTED_SCHEMA:
        failures.append("$schema")
    if receipt.get("projectId") != EXPECTED_PROJECT_ID:
        failures.append("projectId")

    recorded_hash = receipt.get("overlaySha256")
    if (
        not isinstance(recorded_hash, str)
        or SHA256_PATTERN.fullmatch(recorded_hash) is None
        or recorded_hash != overlay_sha256(overlay_path)
    ):
        failures.append("overlaySha256")

    if not _is_utc_timestamp(receipt.get("verifiedAt")):
        failures.append("verifiedAt")

    verifier = receipt.get("verifiedBy")
    if not isinstance(verifier, str) or verifier.strip() == "":
        failures.append("verifiedBy")

    callback_urls = receipt.get("callbackUrls")
    if (
        not isinstance(callback_urls, list)
        or len(callback_urls) != len(EXPECTED_CALLBACK_URLS)
        or not all(isinstance(value, str) for value in callback_urls)
        or set(callback_urls) != set(EXPECTED_CALLBACK_URLS)
    ):
        failures.append("callbackUrls")

    if failures:
        raise ReceiptError(failures)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the production Nhost cloud-callback operator receipt."
    )
    parser.add_argument("--receipt", type=Path, default=DEFAULT_RECEIPT)
    parser.add_argument("--overlay", type=Path, default=DEFAULT_OVERLAY)
    args = parser.parse_args(argv)

    try:
        verify_receipt(args.receipt, args.overlay)
    except ReceiptError as error:
        print(
            "cloud callback receipt verification failed: "
            + ", ".join(error.fields),
            file=sys.stderr,
        )
        return 1
    print("cloud callback receipt verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
