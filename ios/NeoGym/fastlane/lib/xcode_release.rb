# frozen_string_literal: true

module NeoGym
  module XcodeRelease
    class InvalidMarketingVersion < StandardError; end

    module_function

    def marketing_version(tracked:, override: nil)
      value = override.nil? || override.empty? ? tracked : override
      unless /\A[0-9]+(?:\.[0-9]+)*\z/.match?(value)
        raise InvalidMarketingVersion, "marketing version must contain decimal components only"
      end
      value
    end

    def archive_arguments(
      project:,
      scheme:,
      configuration:,
      archive_path:,
      marketing_version:,
      allow_provisioning_updates:
    )
      arguments = [
        "-project", project,
        "-scheme", scheme,
        "-configuration", configuration,
        "-destination", "generic/platform=iOS",
        "-archivePath", archive_path
      ]
      arguments << "-allowProvisioningUpdates" if allow_provisioning_updates
      arguments.concat(["MARKETING_VERSION=#{marketing_version}", "clean", "archive"])
    end

    def upload_arguments(
      archive_path:,
      export_path:,
      export_options_path:,
      allow_provisioning_updates:
    )
      arguments = [
        "-exportArchive",
        "-archivePath", archive_path,
        "-exportPath", export_path,
        "-exportOptionsPlist", export_options_path
      ]
      arguments << "-allowProvisioningUpdates" if allow_provisioning_updates
      arguments
    end

    def upload_export_options_plist
      <<~PLIST
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>destination</key>
          <string>upload</string>
          <key>manageAppVersionAndBuildNumber</key>
          <true/>
          <key>method</key>
          <string>app-store-connect</string>
          <key>signingStyle</key>
          <string>automatic</string>
          <key>uploadSymbols</key>
          <true/>
        </dict>
        </plist>
      PLIST
    end
  end
end
