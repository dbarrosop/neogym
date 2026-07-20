#!/usr/bin/env python3
"""Select, boot, resolve, and stop iPhone simulators for Make targets."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from typing import NamedTuple


class Simulator(NamedTuple):
    identifier: str
    name: str
    state: str
    runtime: tuple[int, ...]


def run(*arguments: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    for key in ("SDKROOT", "CC", "CXX", "LD", "AR", "LDFLAGS"):
        environment.pop(key, None)
    return subprocess.run(
        ["/usr/bin/xcrun", "simctl", *arguments],
        check=check,
        text=True,
        capture_output=True,
        env=environment,
    )


def runtime_version(identifier: str) -> tuple[int, ...]:
    match = re.search(r"\.iOS-(\d+(?:-\d+)*)$", identifier)
    if match is None:
        return ()
    try:
        return tuple(int(part) for part in match.group(1).split("-"))
    except ValueError as error:
        raise RuntimeError("simctl returned an invalid runtime version") from error


def iphone_simulators() -> list[Simulator]:
    try:
        payload = json.loads(run("list", "devices", "available", "-j").stdout)
    except (json.JSONDecodeError, subprocess.SubprocessError, OSError) as error:
        raise RuntimeError("failed to read the available simulator list") from error
    simulators: list[Simulator] = []
    for runtime_identifier, devices in payload.get("devices", {}).items():
        version = runtime_version(runtime_identifier)
        if not version:
            continue
        for device in devices:
            device_type = str(device.get("deviceTypeIdentifier", ""))
            name = str(device.get("name", ""))
            if ".iPhone-" not in device_type and not name.startswith("iPhone"):
                continue
            identifier = device.get("udid")
            if not isinstance(identifier, str) or not identifier:
                continue
            simulators.append(
                Simulator(
                    identifier=identifier,
                    name=name,
                    state=str(device.get("state", "")),
                    runtime=version,
                )
            )
    return simulators


def select_simulator(identifier: str | None, require_booted: bool) -> Simulator:
    simulators = iphone_simulators()
    if identifier:
        for simulator in simulators:
            if simulator.identifier == identifier:
                if require_booted and simulator.state != "Booted":
                    raise RuntimeError("the selected simulator is not booted")
                return simulator
        raise RuntimeError("SIMULATOR_ID is not an available iPhone simulator")

    booted = [simulator for simulator in simulators if simulator.state == "Booted"]
    if booted:
        return max(booted, key=lambda item: (item.runtime, item.name))
    if require_booted:
        raise RuntimeError("no iPhone simulator is booted; run make simulator-up")
    if not simulators:
        raise RuntimeError("no available iPhone simulator is installed")
    return max(simulators, key=lambda item: (item.runtime, item.name))


def boot(identifier: str | None) -> None:
    simulator = select_simulator(identifier, require_booted=False)
    if simulator.state != "Booted":
        result = run("boot", simulator.identifier, check=False)
        if result.returncode != 0:
            raise RuntimeError("failed to boot the selected simulator")
    subprocess.run(
        [
            "/usr/bin/open",
            "-a",
            "Simulator",
            "--args",
            "-CurrentDeviceUDID",
            simulator.identifier,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    run("bootstatus", simulator.identifier, "-b")
    print(simulator.identifier)


def shutdown(identifier: str | None) -> None:
    simulators = iphone_simulators()
    selected = (
        [select_simulator(identifier, require_booted=False)]
        if identifier
        else [simulator for simulator in simulators if simulator.state == "Booted"]
    )
    for simulator in selected:
        if simulator.state == "Booted":
            result = run("shutdown", simulator.identifier, check=False)
            if result.returncode != 0:
                raise RuntimeError("failed to shut down an iPhone simulator")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("up", "down", "resolve"))
    parser.add_argument("--id", dest="identifier")
    arguments = parser.parse_args()
    try:
        if arguments.action == "up":
            boot(arguments.identifier)
        elif arguments.action == "down":
            shutdown(arguments.identifier)
        else:
            print(
                select_simulator(arguments.identifier, require_booted=True).identifier
            )
    except (
        RuntimeError,
        OSError,
        subprocess.SubprocessError,
        json.JSONDecodeError,
    ) as error:
        print(f"simulator error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
