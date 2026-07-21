#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077

unset SDKROOT CC CXX LD AR LDFLAGS

private_root="$(mktemp -d "${TMPDIR:-/tmp}/neogym-check.XXXXXX")"
chmod 700 "$private_root"
cleanup() {
	rm -rf "$private_root"
}
trap cleanup EXIT INT TERM

run_private() {
	local label="$1"
	shift
	local stdout_file="$private_root/${label}.stdout"
	local stderr_file="$private_root/${label}.stderr"
	if ! "$@" >"$stdout_file" 2>"$stderr_file"; then
		echo "check failed: $label" >&2
		return 1
	fi
	rm -f "$stdout_file" "$stderr_file"
}

select_developer_dir() {
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
}

DEVELOPER_DIR="$(select_developer_dir)" || {
	echo "check failed: compatible Xcode is unavailable" >&2
	exit 1
}
export DEVELOPER_DIR

# Host gates do not consume deployment dotenv values and can retain normal test output.
/usr/bin/xcrun swift build
/usr/bin/xcrun swift test
python3 -m unittest discover -s Scripts/tests -v

# Canonical generation owns materialization and XcodeGen invocation.
Scripts/generate-project.sh all
python3 Scripts/generate-dev-icon.py --check

shared_fields=(
	DEVELOPMENT_TEAM
	IPHONEOS_DEPLOYMENT_TARGET
	TARGETED_DEVICE_FAMILY
	NEOGYM_APP_GROUP_IDENTIFIER
	NEOGYM_CALLBACK_SCHEME
	NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX
	NEOGYM_NHOST_SUBDOMAIN
	NEOGYM_NHOST_REGION
	SUPPORTS_MACCATALYST
	SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD
	MARKETING_VERSION
	CURRENT_PROJECT_VERSION
	PRODUCT_BUNDLE_IDENTIFIER
)

inspect_target() {
	local scheme="$1"
	local configuration="$2"
	local target="$3"
	local output="$4"
	shift 4
	local arguments=(
		python3 Scripts/read-build-settings.py
		--project NeoGym.xcodeproj
		--configuration "$configuration"
		--target "$target"
		--output "$output"
	)
	if [[ -n "$scheme" ]]; then
		arguments+=(--scheme "$scheme")
	fi
	local field
	for field in "${shared_fields[@]}" "$@"; do
		arguments+=(--field "$field")
	done
	"${arguments[@]}"
}

check_variant() {
	local variant="$1"
	local scheme="$2"
	local configuration="$3"
	local derived_data="$ROOT/DerivedData/Checks/$variant"
	local app_settings="$private_root/$variant-app-settings.json"
	local widget_settings="$private_root/$variant-widget-settings.json"

	if ! inspect_target "$scheme" "$configuration" NeoGym "$app_settings" \
		ASSETCATALOG_COMPILER_APPICON_NAME; then
		echo "check failed: $variant app build settings" >&2
		return 1
	fi
	# Scheme inspection reports only the top-level app; inspect the embedded target
	# directly, then prove scheme/configuration containment through the built appex.
	if ! inspect_target "" "$configuration" NeoGymWidgets "$widget_settings"; then
		echo "check failed: $variant widget build settings" >&2
		return 1
	fi

	run_private "xcodebuild-$variant" env \
		DEVELOPER_DIR="$DEVELOPER_DIR" \
		/usr/bin/xcrun xcodebuild \
		-project NeoGym.xcodeproj \
		-scheme "$scheme" \
		-configuration "$configuration" \
		-destination "generic/platform=iOS Simulator" \
		-derivedDataPath "$derived_data" \
		CODE_SIGNING_ALLOWED=NO \
		COMPILER_INDEX_STORE_ENABLE=NO \
		build

	local app="$derived_data/Build/Products/${configuration}-iphonesimulator/NeoGym.app"
	if [[ ! -d "$app" ]]; then
		echo "check failed: $variant built app is absent" >&2
		return 1
	fi
	python3 Scripts/verify-artifact.py \
		--variant "$variant" \
		--app-build-settings "$app_settings" \
		--widget-build-settings "$widget_settings" \
		"$app"
}

check_variant development "NeoGym Dev" Debug-Development
check_variant production NeoGym Debug-Production

echo "NeoGym deterministic check passed"
