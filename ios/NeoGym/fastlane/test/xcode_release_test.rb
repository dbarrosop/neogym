# frozen_string_literal: true

require "minitest/autorun"
require "rexml/document"
require_relative "../lib/xcode_release"

class XcodeReleaseTest < Minitest::Test
  def test_uses_tracked_marketing_version_without_override
    assert_equal "1.0", NeoGym::XcodeRelease.marketing_version(tracked: "1.0")
  end

  def test_accepts_decimal_component_override
    assert_equal "2.3.1", NeoGym::XcodeRelease.marketing_version(
      tracked: "1.0",
      override: "2.3.1"
    )
  end

  def test_rejects_malformed_marketing_versions
    ["1.", ".1", "1.0-beta", "1.2.3.4", " 1.0", "1.0 "].each do |value|
      assert_raises(NeoGym::XcodeRelease::InvalidMarketingVersion) do
        NeoGym::XcodeRelease.marketing_version(tracked: "1.0", override: value)
      end
    end
  end

  def test_archive_arguments_target_a_clean_production_device_archive
    arguments = NeoGym::XcodeRelease.archive_arguments(
      project: "/tmp/NeoGym.xcodeproj",
      scheme: "NeoGym",
      configuration: "Release-Production",
      archive_path: "/tmp/NeoGym.xcarchive",
      marketing_version: "2.1",
      allow_provisioning_updates: true
    )

    assert_equal [
      "-project", "/tmp/NeoGym.xcodeproj",
      "-scheme", "NeoGym",
      "-configuration", "Release-Production",
      "-destination", "generic/platform=iOS",
      "-archivePath", "/tmp/NeoGym.xcarchive",
      "-allowProvisioningUpdates",
      "MARKETING_VERSION=2.1",
      "clean", "archive"
    ], arguments
  end

  def test_upload_arguments_export_the_validated_archive_directly
    arguments = NeoGym::XcodeRelease.upload_arguments(
      archive_path: "/tmp/NeoGym.xcarchive",
      export_path: "/tmp/upload",
      export_options_path: "/tmp/options.plist",
      allow_provisioning_updates: false
    )

    assert_equal [
      "-exportArchive",
      "-archivePath", "/tmp/NeoGym.xcarchive",
      "-exportPath", "/tmp/upload",
      "-exportOptionsPlist", "/tmp/options.plist"
    ], arguments
  end

  def test_upload_options_delegate_upload_and_build_number_to_xcode
    plist = NeoGym::XcodeRelease.upload_export_options_plist
    refute_match(/api.?key|authenticationKey/i, plist)
    document = REXML::Document.new(plist)
    values = {}
    elements = document.elements.to_a("plist/dict/*")
    elements.each_slice(2) do |key, value|
      values[key.text] = value.name == "true" ? true : value.text
    end

    assert_equal "upload", values["destination"]
    assert_equal "app-store-connect", values["method"]
    assert_equal "automatic", values["signingStyle"]
    assert_equal true, values["manageAppVersionAndBuildNumber"]
    assert_equal true, values["uploadSymbols"]
  end
end
