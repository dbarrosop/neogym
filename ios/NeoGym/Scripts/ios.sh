#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/NeoGym.xcodeproj"
SDK_PACKAGE="$ROOT/../../../../../nhost/nhost/swift/packages/nhost-swift/Package.swift"
EXPORT_OPTIONS="$ROOT/Configuration/TestFlightExportOptions.plist"
ARTIFACTS="$ROOT/Artifacts"
umask 077

usage() {
	cat >&2 <<'EOF'
usage: Scripts/ios.sh check
       Scripts/ios.sh deploy-device DEVICE_ID
       Scripts/ios.sh upload-testflight VERSION
EOF
	exit 2
}

command_name="${1:-}"
case "$command_name" in
check)
	[[ $# -eq 1 ]] || usage
	;;
deploy-device)
	[[ $# -le 2 ]] || usage
	device_id="${2:-}"
	if [[ -z "$device_id" ]]; then
		echo "deployment error: DEVICE_ID is required" >&2
		exit 2
	fi
	;;
upload-testflight)
	[[ $# -le 2 ]] || usage
	version="${2:-}"
	if [[ ! "$version" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]]; then
		echo "release error: VERSION must contain one to three decimal components" >&2
		exit 2
	fi
	;;
*) usage ;;
esac

# Nix can inject Apple SDK and linker settings that are incompatible with Xcode.
configured_developer_dir="${DEVELOPER_DIR:-}"
unset SDKROOT CC CXX LD AR LDFLAGS

# Absolute Apple tools avoid Nix wrappers. Tests may substitute command shims.
XCRUN="${NEOGYM_XCRUN:-/usr/bin/xcrun}"
PLUTIL="${NEOGYM_PLUTIL:-/usr/bin/plutil}"
if [[ ! -x "$XCRUN" ]]; then
	echo "toolchain error: xcrun is unavailable" >&2
	exit 1
fi
if [[ ! -x "$PLUTIL" ]]; then
	echo "toolchain error: plutil is unavailable" >&2
	exit 1
fi

sdk_is_compatible() {
	local version="$1"
	local major minor
	IFS=. read -r major minor _ <<<"$version"
	[[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || return 1
	((major > 26 || (major == 26 && minor >= 6)))
}

candidate_sdk_version() {
	local candidate="$1"
	env DEVELOPER_DIR="$candidate" "$XCRUN" --sdk iphonesimulator --show-sdk-version 2>/dev/null
}

candidate_is_compatible() {
	local candidate="$1"
	local version
	[[ -d "$candidate" && -x "$candidate/usr/bin/xcodebuild" ]] || return 1
	version="$(candidate_sdk_version "$candidate")" || return 1
	sdk_is_compatible "$version"
}

select_developer_dir() {
	local candidate version
	local best=""
	local best_major=-1
	local best_minor=-1
	local major minor
	local -a candidates=()

	if [[ -n "$configured_developer_dir" ]] && candidate_is_compatible "$configured_developer_dir"; then
		printf '%s\n' "$configured_developer_dir"
		return
	fi

	candidate="$(env -u DEVELOPER_DIR /usr/bin/xcode-select -p 2>/dev/null || true)"
	[[ -n "$candidate" ]] && candidates+=("$candidate")
	shopt -s nullglob
	for candidate in /Applications/Xcode*.app/Contents/Developer; do
		candidates+=("$candidate")
	done
	shopt -u nullglob

	for candidate in "${candidates[@]}"; do
		candidate_is_compatible "$candidate" || continue
		version="$(candidate_sdk_version "$candidate")"
		IFS=. read -r major minor _ <<<"$version"
		if ((major > best_major || (major == best_major && minor > best_minor))); then
			best="$candidate"
			best_major=$major
			best_minor=$minor
		fi
	done
	if [[ -z "$best" ]]; then
		echo "toolchain error: an Xcode supporting iOS 26.6 is unavailable" >&2
		return 1
	fi
	printf '%s\n' "$best"
}

DEVELOPER_DIR="$(select_developer_dir)" || exit 1
export DEVELOPER_DIR

ensure_prerequisites() {
	if ! "$XCRUN" --sdk iphonesimulator --show-sdk-path >/dev/null 2>&1; then
		echo "toolchain error: the selected Xcode has no iOS Simulator SDK" >&2
		exit 1
	fi
	if ! command -v xcodegen >/dev/null 2>&1; then
		echo "toolchain error: XcodeGen is unavailable" >&2
		exit 1
	fi
	if ! command -v python3 >/dev/null 2>&1; then
		echo "toolchain error: python3 is unavailable" >&2
		exit 1
	fi
	if [[ ! -f "$SDK_PACKAGE" ]]; then
		echo "toolchain error: adjacent Nhost Swift SDK checkout is unavailable" >&2
		exit 1
	fi
}

run_private() {
	local label="$1"
	shift
	local directory stdout_file stderr_file
	directory="$(mktemp -d "${TMPDIR:-/tmp}/neogym-${label}.XXXXXX")"
	stdout_file="$directory/stdout"
	stderr_file="$directory/stderr"
	if ! "$@" >"$stdout_file" 2>"$stderr_file"; then
		echo "check failed: $label" >&2
		rm -rf "$directory"
		return 1
	fi
	rm -rf "$directory"
}

build_simulator_variant() {
	local variant="$1"
	local scheme="$2"
	local configuration="$3"
	local derived_data="$ROOT/DerivedData/Checks/$variant"

	run_private "xcodebuild-$variant" "$XCRUN" xcodebuild \
		-project "$PROJECT" \
		-scheme "$scheme" \
		-configuration "$configuration" \
		-destination "generic/platform=iOS Simulator" \
		-derivedDataPath "$derived_data" \
		CODE_SIGNING_ALLOWED=NO \
		COMPILER_INDEX_STORE_ENABLE=NO \
		build
}

common_check() {
	ensure_prerequisites
	cd "$ROOT"
	"$XCRUN" swift build
	"$XCRUN" swift test
	bash -n Scripts/ios.sh
	python3 -m unittest discover -s Scripts/tests -v

	# Each private environment is materialized once; XcodeGen then creates both schemes once.
	python3 Scripts/materialize-config.py development
	python3 Scripts/materialize-config.py production
	xcodegen generate --spec project.yml --project . >/dev/null

	build_simulator_variant development "NeoGym Dev" Debug-Development
	build_simulator_variant production NeoGym Debug-Production
}

deploy_device() {
	common_check
	local derived_data="$ROOT/DerivedData/Deploy/development-device"
	local app_path="$derived_data/Build/Products/Debug-Development-iphoneos/NeoGym.app"
	local bundle_identifier

	rm -rf "$derived_data"
	"$XCRUN" xcodebuild \
		-project "$PROJECT" \
		-scheme "NeoGym Dev" \
		-configuration Debug-Development \
		-destination "id=$device_id" \
		-derivedDataPath "$derived_data" \
		-allowProvisioningUpdates \
		CODE_SIGN_STYLE=Automatic \
		COMPILER_INDEX_STORE_ENABLE=NO \
		build
	if [[ ! -d "$app_path" || ! -f "$app_path/Info.plist" ]]; then
		echo "deployment error: development application was not produced" >&2
		exit 1
	fi
	bundle_identifier="$("$PLUTIL" -extract CFBundleIdentifier raw -o - "$app_path/Info.plist" 2>/dev/null)" || {
		echo "deployment error: built bundle identifier is unavailable" >&2
		exit 1
	}
	if [[ -z "$bundle_identifier" || "$bundle_identifier" == *'$('* || "$bundle_identifier" == *'${'* ]]; then
		echo "deployment error: built bundle identifier is unresolved" >&2
		exit 1
	fi
	"$XCRUN" devicectl device install app --device "$device_id" "$app_path"
	"$XCRUN" devicectl device process launch --device "$device_id" --terminate-existing "$bundle_identifier"
	echo "NeoGym development build installed and launched"
}

upload_testflight() {
	common_check
	local release_directory="$ARTIFACTS/TestFlight"
	local archive_path="$release_directory/NeoGym-$version.xcarchive"
	local export_path="$release_directory/Export"
	local derived_data="$ROOT/DerivedData/Archive/production"

	mkdir -p "$release_directory"
	rm -rf "$archive_path" "$export_path" "$derived_data"
	"$XCRUN" xcodebuild \
		-project "$PROJECT" \
		-scheme NeoGym \
		-configuration Release-Production \
		-destination "generic/platform=iOS" \
		-derivedDataPath "$derived_data" \
		-archivePath "$archive_path" \
		-allowProvisioningUpdates \
		CODE_SIGN_STYLE=Automatic \
		"MARKETING_VERSION=$version" \
		clean archive
	if [[ ! -d "$archive_path" ]]; then
		echo "release error: Xcode did not produce the requested archive" >&2
		exit 1
	fi

	python3 Scripts/verify-archive.py "$archive_path"
	"$XCRUN" xcodebuild \
		-exportArchive \
		-archivePath "$archive_path" \
		-exportPath "$export_path" \
		-exportOptionsPlist "$EXPORT_OPTIONS" \
		-allowProvisioningUpdates
	echo "NeoGym production archive uploaded to TestFlight"
}

case "$command_name" in
check)
	common_check
	echo "NeoGym deterministic check passed"
	;;
deploy-device) deploy_device ;;
upload-testflight) upload_testflight ;;
esac
