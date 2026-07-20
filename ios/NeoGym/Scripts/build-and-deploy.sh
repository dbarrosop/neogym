#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077

mode="${1:-}"
variant="${2:-development}"
destination_id="${3:-}"

case "$mode" in
build | simulator | device) ;;
*)
	echo "deployment error: mode must be build, simulator, or device" >&2
	exit 2
	;;
esac

case "$variant" in
development)
	scheme="NeoGym Dev"
	configuration="Debug-Development"
	;;
production)
	scheme="NeoGym"
	configuration="Debug-Production"
	;;
*)
	echo "deployment error: VARIANT must be development or production" >&2
	exit 2
	;;
esac

if [[ "$mode" == "simulator" ]]; then
	destination_id="$(python3 Scripts/simulator-control.py resolve --id "$destination_id")" || exit 1
elif [[ "$mode" == "device" && -z "$destination_id" ]]; then
	echo "deployment error: DEVICE_ID is required; run: xcrun xctrace list devices" >&2
	exit 2
fi

provisioning_updates="${ALLOW_PROVISIONING_UPDATES:-0}"
if [[ "$provisioning_updates" != "0" && "$provisioning_updates" != "1" ]]; then
	echo "deployment error: ALLOW_PROVISIONING_UPDATES must be 0 or 1" >&2
	exit 2
fi

unset SDKROOT CC CXX LD AR LDFLAGS
DEVELOPER_DIR="$(
	python3 - "$ROOT/Scripts/read-build-settings.py" <<'PY'
import importlib.util
import os
import sys
from pathlib import Path

path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("neogym_read_build_settings", path)
if spec is None or spec.loader is None:
    raise SystemExit(1)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
try:
    print(module.select_developer_dir(os.environ.copy()))
except (OSError, RuntimeError):
    raise SystemExit(1)
PY
)" || {
	echo "deployment error: compatible Xcode is unavailable" >&2
	exit 1
}
export DEVELOPER_DIR

Scripts/generate-project.sh "$variant"

derived_data="$ROOT/DerivedData/Deploy/${variant}-${mode}"
rm -rf "$derived_data"

xcodebuild_arguments=(
	-project NeoGym.xcodeproj
	-scheme "$scheme"
	-configuration "$configuration"
	-derivedDataPath "$derived_data"
	COMPILER_INDEX_STORE_ENABLE=NO
)

case "$mode" in
build)
	xcodebuild_arguments+=(
		-destination "generic/platform=iOS Simulator"
		CODE_SIGNING_ALLOWED=NO
	)
	product_directory="${configuration}-iphonesimulator"
	;;
simulator)
	xcodebuild_arguments+=(
		-destination "id=$destination_id"
	)
	product_directory="${configuration}-iphonesimulator"
	;;
device)
	xcodebuild_arguments+=(
		-destination "id=$destination_id"
	)
	if [[ "$provisioning_updates" == "1" ]]; then
		xcodebuild_arguments+=(-allowProvisioningUpdates)
	fi
	product_directory="${configuration}-iphoneos"
	;;
esac

/usr/bin/xcrun xcodebuild "${xcodebuild_arguments[@]}" build

app_path="$derived_data/Build/Products/$product_directory/NeoGym.app"
if [[ ! -d "$app_path" ]]; then
	echo "deployment error: built application is unavailable" >&2
	exit 1
fi

validation_arguments=(--variant "$variant")
if [[ "$mode" == "simulator" ]]; then
	validation_arguments+=(--signed-simulator)
fi
python3 Scripts/verify-artifact.py "${validation_arguments[@]}" "$app_path"

if [[ "$mode" == "build" ]]; then
	echo "NeoGym build succeeded: $app_path"
	exit 0
fi

settings_file="$(mktemp "${TMPDIR:-/tmp}/neogym-deploy-settings.XXXXXX")"
chmod 600 "$settings_file"
cleanup() {
	rm -f "$settings_file"
}
trap cleanup EXIT INT TERM
python3 Scripts/read-build-settings.py \
	--project NeoGym.xcodeproj \
	--scheme "$scheme" \
	--configuration "$configuration" \
	--target NeoGym \
	--field PRODUCT_BUNDLE_IDENTIFIER \
	--output "$settings_file"
bundle_identifier="$(
	python3 - "$settings_file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        value = json.load(handle)["PRODUCT_BUNDLE_IDENTIFIER"]
except (OSError, KeyError, TypeError, json.JSONDecodeError):
    raise SystemExit(1)
if not isinstance(value, str) or not value:
    raise SystemExit(1)
print(value)
PY
)" || {
	echo "deployment error: bundle identifier resolution failed" >&2
	exit 1
}

if [[ "$mode" == "simulator" ]]; then
	/usr/bin/xcrun simctl install "$destination_id" "$app_path"
	/usr/bin/xcrun simctl launch --terminate-running-process "$destination_id" "$bundle_identifier"
	sleep 2
	launch_services="$(/usr/bin/xcrun simctl spawn "$destination_id" launchctl list)"
	if [[ "$launch_services" != *"UIKitApplication:${bundle_identifier}["* ]]; then
		echo "deployment error: application exited during simulator startup" >&2
		exit 1
	fi
else
	/usr/bin/xcrun devicectl device install app --device "$destination_id" "$app_path"
	/usr/bin/xcrun devicectl device process launch \
		--device "$destination_id" \
		--terminate-existing \
		"$bundle_identifier"
fi

echo "NeoGym deployed and launched: $bundle_identifier"
