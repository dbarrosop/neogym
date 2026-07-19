from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
IOS_ROOT = SCRIPTS.parent
REPOSITORY_ROOT = IOS_ROOT.parents[1]
OVERLAY = (
    REPOSITORY_ROOT
    / "backend/nhost/overlays/spmqtxqkdoxvtrkrfnnl.json"
)
EXAMPLE = IOS_ROOT / "fastlane/cloud-callback-receipt.production.example.json"
SCHEMA = IOS_ROOT / "fastlane/cloud-callback-receipt.production.schema.json"


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


receipt_gate = load_script("verify-cloud-callback-receipt.py")


class CloudCallbackReceiptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.overlay = self.root / "production-overlay.json"
        self.overlay.write_bytes(b'{"exact":"overlay bytes"}\n')

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def valid_receipt(self) -> dict[str, object]:
        return {
            "$schema": "./cloud-callback-receipt.production.schema.json",
            "projectId": "spmqtxqkdoxvtrkrfnnl",
            "overlaySha256": hashlib.sha256(self.overlay.read_bytes()).hexdigest(),
            "verifiedAt": "2026-07-19T12:34:56Z",
            "verifiedBy": "release-operator@example.com",
            "callbackUrls": ["neogym://verify", "neogym-dev://verify"],
        }

    def write_receipt(self, receipt: dict[str, object]) -> Path:
        path = self.root / "receipt.json"
        path.write_text(json.dumps(receipt), encoding="utf-8")
        return path

    def assert_failure_field(
        self, receipt: dict[str, object], expected_field: str
    ) -> None:
        with self.assertRaises(receipt_gate.ReceiptError) as context:
            receipt_gate.verify_receipt(self.write_receipt(receipt), self.overlay)
        self.assertIn(expected_field, context.exception.fields)

    def test_valid_operator_attestation_passes(self) -> None:
        receipt_gate.verify_receipt(
            self.write_receipt(self.valid_receipt()), self.overlay
        )

    def test_stale_overlay_hash_fails(self) -> None:
        receipt = self.valid_receipt()
        receipt["overlaySha256"] = "0" * 64
        self.assert_failure_field(receipt, "overlaySha256")

    def test_wrong_project_fails(self) -> None:
        receipt = self.valid_receipt()
        receipt["projectId"] = "wrong-project"
        self.assert_failure_field(receipt, "projectId")

    def test_missing_callback_fails(self) -> None:
        receipt = self.valid_receipt()
        receipt["callbackUrls"] = ["neogym://verify"]
        self.assert_failure_field(receipt, "callbackUrls")

    def test_malformed_callback_value_fails_by_field_name(self) -> None:
        receipt = self.valid_receipt()
        receipt["callbackUrls"] = ["neogym://verify", {"secret": "value"}]
        self.assert_failure_field(receipt, "callbackUrls")

    def test_malformed_receipt_fails(self) -> None:
        receipt = self.root / "receipt.json"
        receipt.write_text("{not-json", encoding="utf-8")
        with self.assertRaises(receipt_gate.ReceiptError) as context:
            receipt_gate.verify_receipt(receipt, self.overlay)
        self.assertEqual(context.exception.fields, ("receipt",))

    def test_missing_receipt_hard_fails(self) -> None:
        with self.assertRaises(receipt_gate.ReceiptError) as context:
            receipt_gate.verify_receipt(self.root / "missing.json", self.overlay)
        self.assertEqual(context.exception.fields, ("receipt",))

    def test_cli_diagnostics_do_not_expose_attestation_values(self) -> None:
        receipt = self.valid_receipt()
        secret_identity = "private-operator-identity"
        receipt["verifiedBy"] = secret_identity
        receipt["projectId"] = "private-wrong-project"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "verify-cloud-callback-receipt.py"),
                "--receipt",
                str(self.write_receipt(receipt)),
                "--overlay",
                str(self.overlay),
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("projectId", result.stderr)
        self.assertNotIn(secret_identity, result.stdout + result.stderr)
        self.assertNotIn("private-wrong-project", result.stdout + result.stderr)

    def test_tracked_example_matches_current_overlay_and_schema_contract(self) -> None:
        try:
            example = json.loads(EXAMPLE.read_text(encoding="utf-8"))
            schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            self.fail(f"tracked receipt fixture is unreadable: {error}")

        self.assertEqual(
            example["overlaySha256"], hashlib.sha256(OVERLAY.read_bytes()).hexdigest()
        )
        self.assertEqual(example["projectId"], receipt_gate.EXPECTED_PROJECT_ID)
        self.assertEqual(
            set(example["callbackUrls"]), set(receipt_gate.EXPECTED_CALLBACK_URLS)
        )
        self.assertEqual(set(schema["required"]), receipt_gate.EXPECTED_FIELDS)
        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(example["verifiedAt"], "")
        self.assertEqual(example["verifiedBy"], "")


if __name__ == "__main__":
    unittest.main()
