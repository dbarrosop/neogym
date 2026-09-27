#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ "${NEOGYM_ALLOW_TESTFLIGHT_UPLOAD:-}" != "YES" ]]; then
  echo "Refusing upload: set NEOGYM_ALLOW_TESTFLIGHT_UPLOAD=YES for this run only." >&2
  exit 1
fi
# Phase 3 must install both the executable verifier and non-upload export
# options. Checking presence alone is not sufficient: every artifact must pass
# the verifier before the upload export is permitted.
verifier=Scripts/verify-release-archive.sh
local_options=Scripts/LocalExportOptions.plist
if [[ ! -x "$verifier" || ! -f "$local_options" ]]; then
  echo "Refusing watch-bearing upload until Phase 3 archive/IPA verification is installed." >&2
  exit 1
fi
# The preflight export must not itself upload before the IPA can be checked.
if [[ "$(/usr/bin/plutil -extract destination raw -o - "$local_options" 2>/dev/null)" != export ]]; then
  echo "Refusing upload: local export options must specify destination=export." >&2
  exit 1
fi
mkdir -p .build/testflight
run_dir=$(mktemp -d "$PWD/.build/testflight/NeoGym-XXXXXXXX")
archive_path="$run_dir/NeoGym.xcarchive"

# Avoid inherited Nix compiler/SDK overrides when invoking the selected Xcode.
xcodebuild_clean() {
  env -u DEVELOPER_DIR -u SDKROOT -u CC -u CXX -u LD -u AR -u LDFLAGS xcodebuild "$@"
}

echo "Archiving NeoGym to $archive_path"
xcodebuild_clean \
  -project NeoGym.xcodeproj \
  -scheme NeoGym \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" \
  -allowProvisioningUpdates \
  archive

# Verifier interface for Phase 3: --archive PATH validates the signed archive;
# --archive PATH --ipa PATH additionally validates the locally exported IPA.
# A nonzero exit at either point prevents the upload export (set -e).
"$verifier" --archive "$archive_path"
echo "Exporting locally for pre-upload IPA verification"
xcodebuild_clean \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$run_dir/local-export" \
  -exportOptionsPlist "$local_options" \
  -allowProvisioningUpdates

shopt -s nullglob
ipas=("$run_dir"/local-export/*.ipa)
if (( ${#ipas[@]} != 1 )); then
  echo "Refusing upload: expected exactly one locally exported IPA." >&2
  exit 1
fi
"$verifier" --archive "$archive_path" --ipa "${ipas[0]}"

echo "Uploading verified archive to App Store Connect for TestFlight"
xcodebuild_clean \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$run_dir/export" \
  -exportOptionsPlist Scripts/TestFlightExportOptions.plist \
  -allowProvisioningUpdates

echo "Upload complete. Archive retained at $archive_path"
echo "Check App Store Connect for processing and TestFlight tester availability."
