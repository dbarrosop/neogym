SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.NOTPARALLEL:

.PHONY: check deploy-device upload-testflight

check:
	cd ../.. && nix flake check
	nix develop ../.. --command Scripts/ios.sh check

deploy-device:
	if test -z "$(DEVICE_ID)"; then echo "deployment error: DEVICE_ID is required" >&2; exit 2; fi
	cd ../.. && nix flake check
	nix develop ../.. --command Scripts/ios.sh deploy-device "$(DEVICE_ID)"

upload-testflight:
	if ! [[ "$(VERSION)" =~ ^[0-9]+(\.[0-9]+){0,2}$$ ]]; then echo "release error: VERSION must contain one to three decimal components" >&2; exit 2; fi
	cd ../.. && nix flake check
	nix develop ../.. --command Scripts/ios.sh upload-testflight "$(VERSION)"
