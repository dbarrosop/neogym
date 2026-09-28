#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
verifier=Scripts/verify-release-archive.sh
local_options=Scripts/LocalExportOptions.plist
if [[ ! -x "$verifier" || ! -f "$local_options" ]] ||
  [[ "$(/usr/bin/plutil -extract destination raw -o - "$local_options" 2>/dev/null)" != export ]] ||
  [[ "$(/usr/bin/plutil -extract method raw -o - "$local_options" 2>/dev/null)" != app-store-connect ]]; then
  echo 'Refusing release: local verifier or non-upload export options unavailable.' >&2
  exit 1
fi
# Provisioning is independently authorized on each run; cached profiles can
# still work with no opt-in, but Xcode may not register/update App IDs.
provisioning=
if [[ "${NEOGYM_ALLOW_PROVISIONING_UPDATES:-}" == YES ]]; then
  provisioning=-allowProvisioningUpdates
fi
mkdir -p .build/testflight
run_dir=${1:-$(mktemp -d "$PWD/.build/testflight/NeoGym-XXXXXXXX")}
if [[ $# -gt 1 || ! -d "$run_dir" || -e "$run_dir/NeoGym.xcarchive" || -e "$run_dir/local-export" ]]; then
  echo 'Refusing release: expected one fresh output directory.' >&2
  exit 1
fi
archive_path="$run_dir/NeoGym.xcarchive"

xcodebuild_clean() {
  env -u DEVELOPER_DIR -u SDKROOT -u CC -u CXX -u LD -u AR -u LDFLAGS xcodebuild "$@"
}

echo "Archiving NeoGym to $archive_path"
xcodebuild_clean -project NeoGym.xcodeproj -scheme NeoGym -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive_path" \
  ${provisioning:+"$provisioning"} archive
"$verifier" --archive "$archive_path"
echo 'Exporting locally without uploading'
xcodebuild_clean -exportArchive -archivePath "$archive_path" \
  -exportPath "$run_dir/local-export" -exportOptionsPlist "$local_options" \
  ${provisioning:+"$provisioning"}
shopt -s nullglob
ipas=("$run_dir"/local-export/*.ipa)
if (( ${#ipas[@]} != 1 )); then
  echo 'Refusing release: expected exactly one locally exported IPA.' >&2
  exit 1
fi
"$verifier" --archive "$archive_path" --ipa "${ipas[0]}"
echo "Verified non-upload release in $run_dir"
