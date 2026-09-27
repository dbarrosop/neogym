#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
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

echo "Uploading archive to App Store Connect for TestFlight"
xcodebuild_clean \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$run_dir/export" \
  -exportOptionsPlist Scripts/TestFlightExportOptions.plist \
  -allowProvisioningUpdates

echo "Upload complete. Archive retained at $archive_path"
echo "Check App Store Connect for processing and TestFlight tester availability."
