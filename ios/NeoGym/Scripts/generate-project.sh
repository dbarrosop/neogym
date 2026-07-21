#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
variant="${1:-all}"

# The Nix shell supplies userland tools but its apple-sdk stubs cannot build iOS.
# Select an installed Xcode whose SDK supports the pinned deployment floor.
unset SDKROOT CC CXX LD AR LDFLAGS
XCRUN=/usr/bin/xcrun
selected_developer_dir=""
candidates=("${DEVELOPER_DIR:-}" "$(env -u DEVELOPER_DIR /usr/bin/xcode-select -p)")
for application in /Applications/Xcode*.app; do
	candidates+=("$application/Contents/Developer")
done
for candidate in "${candidates[@]}"; do
	[[ -n "$candidate" && -d "$candidate" ]] || continue
	[[ -x "$candidate/usr/bin/xcodebuild" ]] || continue
	candidate_version="$(env DEVELOPER_DIR="$candidate" "$XCRUN" --sdk iphonesimulator --show-sdk-version 2>/dev/null || true)"
	if /usr/bin/python3 - "$candidate_version" <<'PY'; then
import sys
try:
    parts = tuple(int(part) for part in sys.argv[1].split(".")[:2])
except ValueError:
    raise SystemExit(1)
raise SystemExit(0 if parts >= (26, 6) else 1)
PY
		selected_developer_dir="$candidate"
		break
	fi
done
if [[ -z "$selected_developer_dir" ]]; then
	echo "toolchain error: Xcode SDK does not support iOS 26.6" >&2
	exit 1
fi
DEVELOPER_DIR="$selected_developer_dir"
export DEVELOPER_DIR

case "$variant" in
development | production | all) ;;
*)
	echo "configuration error: unsupported variant" >&2
	exit 2
	;;
esac

if ! "$XCRUN" --sdk iphonesimulator --show-sdk-path >/dev/null 2>&1; then
	echo "toolchain error: Xcode iOS Simulator SDK is unavailable" >&2
	exit 1
fi

sdk_checkout="../../../../../nhost/nhost/swift/packages/nhost-swift/Package.swift"
if [[ ! -f "$sdk_checkout" ]]; then
	echo "toolchain error: adjacent Nhost Swift SDK checkout is unavailable" >&2
	exit 1
fi

python3 Scripts/materialize-config.py "$variant"
if [[ "$variant" == "all" || "$variant" == "development" ]]; then
	python3 Scripts/validate-build-config.py --configuration Debug-Development
fi
if [[ "$variant" == "all" || "$variant" == "production" ]]; then
	python3 Scripts/validate-build-config.py --configuration Debug-Production
fi

# project.yml's postGenCommand is the sole scheme-patching owner.
xcodegen generate --spec project.yml --project . >/dev/null
