#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ "$(/usr/bin/plutil -extract destination raw -o - Scripts/TestFlightExportOptions.plist 2>/dev/null)" != upload ]] ||
   [[ "$(/usr/bin/plutil -extract method raw -o - Scripts/TestFlightExportOptions.plist 2>/dev/null)" != app-store-connect ]]; then
  echo 'Refusing upload: TestFlight options must specify app-store-connect upload.' >&2
  exit 1
fi
# The non-upload release path verifies the archive and separately checks its
# exported IPA. Invoking deploy-testflight is the upload decision; provisioning
# updates remain a separate opt-in.
mkdir -p .build/testflight
run_dir=$(mktemp -d "$PWD/.build/testflight/NeoGym-XXXXXXXX")
bash Scripts/archive-release.sh "$run_dir"
archive_path="$run_dir/NeoGym.xcarchive"
echo 'Uploading verified archive to App Store Connect for TestFlight'
provisioning=
if [[ "${NEOGYM_ALLOW_PROVISIONING_UPDATES:-}" == YES ]]; then
  provisioning=-allowProvisioningUpdates
fi
env -u DEVELOPER_DIR -u SDKROOT -u CC -u CXX -u LD -u AR -u LDFLAGS \
  xcodebuild -exportArchive -archivePath "$archive_path" \
    -exportPath "$run_dir/upload" \
    -exportOptionsPlist Scripts/TestFlightExportOptions.plist \
    ${provisioning:+"$provisioning"}
echo "Upload complete. Archive retained at $archive_path"
echo 'Check App Store Connect for processing and TestFlight tester availability.'
