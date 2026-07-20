SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.NOTPARALLEL:

VARIANT ?= development
SIMULATOR_ID ?=
DEVICE_ID ?=
ALLOW_PROVISIONING_UPDATES ?= 0
VERSION ?=

export VARIANT SIMULATOR_ID DEVICE_ID ALLOW_PROVISIONING_UPDATES VERSION

.PHONY: simulator-up simulator-down deploy-simulator deploy-device deploy-testflight build check

# Boot SIMULATOR_ID, or the newest available iPhone simulator when omitted.
simulator-up:
	nix develop ../.. --command python3 Scripts/simulator-control.py up --id "$(SIMULATOR_ID)"

# Shut down SIMULATOR_ID, or every booted iPhone simulator when omitted.
simulator-down:
	nix develop ../.. --command python3 Scripts/simulator-control.py down --id "$(SIMULATOR_ID)"

# Run the full gate, locally sign/install the selected variant, and confirm startup.
deploy-simulator: simulator-up check
	nix develop ../.. --command Scripts/build-and-deploy.sh simulator "$(VARIANT)" "$(SIMULATOR_ID)"

# Run the full gate, create a signed build, install it, and launch it on DEVICE_ID.
deploy-device: check
	nix develop ../.. --command Scripts/build-and-deploy.sh device "$(VARIANT)" "$(DEVICE_ID)"

# Run the full gate, validate a production archive, and let Xcode upload it.
deploy-testflight: check
	nix develop ../.. --command Scripts/deploy-testflight.sh

# Compile and validate one unsigned generic-simulator variant without running tests.
build:
	nix develop ../.. --command Scripts/build-and-deploy.sh build "$(VARIANT)"

# Run Nix checks, Xcode-release tests, Swift tests, tooling tests, both builds, and artifact validation.
check:
	cd ../.. && nix flake check
	nix develop ../.. --command fastlane check --env production
