from __future__ import annotations

import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "simulator-control.py"
SPEC = importlib.util.spec_from_file_location("simulator_control", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load simulator-control.py")
simulator_control = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(simulator_control)


class SimulatorControlTests(unittest.TestCase):
    def test_available_list_keeps_only_iphone_runtimes(self) -> None:
        payload = {
            "devices": {
                "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
                    {
                        "name": "iPhone 17 Pro",
                        "udid": "IPHONE",
                        "state": "Shutdown",
                        "deviceTypeIdentifier": "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
                    }
                ],
                "com.apple.CoreSimulator.SimRuntime.watchOS-26-5": [
                    {
                        "name": "Apple Watch",
                        "udid": "WATCH",
                        "state": "Booted",
                        "deviceTypeIdentifier": "com.apple.CoreSimulator.SimDeviceType.Apple-Watch",
                    }
                ],
            }
        }
        result = subprocess.CompletedProcess(
            [], 0, stdout=json.dumps(payload), stderr=""
        )
        with patch.object(simulator_control, "run", return_value=result):
            simulators = simulator_control.iphone_simulators()

        self.assertEqual(len(simulators), 1)
        self.assertEqual(simulators[0].identifier, "IPHONE")
        self.assertEqual(simulators[0].runtime, (26, 5))

    def test_selection_reuses_booted_iphone_before_newest_shutdown(self) -> None:
        booted = simulator_control.Simulator("BOOTED", "iPhone 16", "Booted", (26, 5))
        newest = simulator_control.Simulator("NEWEST", "iPhone 17", "Shutdown", (27, 0))
        with patch.object(
            simulator_control, "iphone_simulators", return_value=[newest, booted]
        ):
            selected = simulator_control.select_simulator(None, require_booted=False)

        self.assertEqual(selected.identifier, "BOOTED")

    def test_selection_chooses_newest_runtime_when_none_is_booted(self) -> None:
        older = simulator_control.Simulator("OLDER", "iPhone 17", "Shutdown", (26, 5))
        newest = simulator_control.Simulator("NEWEST", "iPhone 17", "Shutdown", (27, 0))
        with patch.object(
            simulator_control, "iphone_simulators", return_value=[older, newest]
        ):
            selected = simulator_control.select_simulator(None, require_booted=False)

        self.assertEqual(selected.identifier, "NEWEST")

    def test_resolve_rejects_a_shutdown_simulator(self) -> None:
        selected = simulator_control.Simulator(
            "SHUTDOWN", "iPhone 17", "Shutdown", (27, 0)
        )
        with (
            patch.object(
                simulator_control, "iphone_simulators", return_value=[selected]
            ),
            self.assertRaisesRegex(RuntimeError, "not booted"),
        ):
            simulator_control.select_simulator("SHUTDOWN", require_booted=True)


if __name__ == "__main__":
    unittest.main()
