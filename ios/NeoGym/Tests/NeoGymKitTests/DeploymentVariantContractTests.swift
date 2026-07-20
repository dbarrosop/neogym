import Foundation
import XCTest
@testable import NeoGymKit

final class DeploymentVariantContractTests: XCTestCase {
    private var packageRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    func testVariantXCConfigsOwnExactStaticIdentities() throws {
        let development = try xcconfig("Configuration/Development.xcconfig")
        let production = try xcconfig("Configuration/Production.xcconfig")

        XCTAssertEqual(development["NEOGYM_APP_BUNDLE_IDENTIFIER"], "io.nhost.dbarroso.neogym.dev")
        XCTAssertEqual(development["NEOGYM_WIDGET_BUNDLE_IDENTIFIER"], "io.nhost.dbarroso.neogym.dev.widgets")
        XCTAssertEqual(development["NEOGYM_APP_GROUP_IDENTIFIER"], "group.io.nhost.dbarroso.neogym.dev")
        XCTAssertEqual(development["NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX"], "io.nhost.dbarroso.neogym.dev.shared")
        XCTAssertEqual(development["NEOGYM_CALLBACK_SCHEME"], "neogym-dev")
        XCTAssertEqual(development["NEOGYM_DISPLAY_NAME"], "NeoGym Dev")
        XCTAssertEqual(development["NEOGYM_APP_ICON_NAME"], "AppIconDev")

        XCTAssertEqual(production["NEOGYM_APP_BUNDLE_IDENTIFIER"], "io.nhost.dbarroso.neogym")
        XCTAssertEqual(production["NEOGYM_WIDGET_BUNDLE_IDENTIFIER"], "io.nhost.dbarroso.neogym.widgets")
        XCTAssertEqual(production["NEOGYM_APP_GROUP_IDENTIFIER"], "group.io.nhost.dbarroso.neogym")
        XCTAssertEqual(production["NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX"], "io.nhost.dbarroso.neogym.shared")
        XCTAssertEqual(production["NEOGYM_CALLBACK_SCHEME"], "neogym")
        XCTAssertEqual(production["NEOGYM_DISPLAY_NAME"], "NeoGym")
        XCTAssertEqual(production["NEOGYM_APP_ICON_NAME"], "AppIcon")

        for key in [
            "NEOGYM_APP_BUNDLE_IDENTIFIER",
            "NEOGYM_WIDGET_BUNDLE_IDENTIFIER",
            "NEOGYM_APP_GROUP_IDENTIFIER",
            "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX",
            "NEOGYM_CALLBACK_SCHEME",
            "NEOGYM_DISPLAY_NAME",
            "NEOGYM_APP_ICON_NAME"
        ] {
            XCTAssertNotEqual(development[key], production[key], key)
        }
        for configuration in [development, production] {
            XCTAssertNil(configuration["NHOST_SUBDOMAIN"])
            XCTAssertNil(configuration["NHOST_REGION"])
            XCTAssertNil(configuration["DEVELOPMENT_TEAM"])
        }
    }

    func testCommonSettingsPinPlatformDeviceAndVersions() throws {
        let common = try xcconfig("Configuration/Common.xcconfig")
        XCTAssertEqual(common["IPHONEOS_DEPLOYMENT_TARGET"], "26.6")
        XCTAssertEqual(common["TARGETED_DEVICE_FAMILY"], "1")
        XCTAssertEqual(common["SUPPORTS_MACCATALYST"], "NO")
        XCTAssertEqual(common["SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD"], "NO")
        XCTAssertEqual(common["CODE_SIGN_STYLE"], "Automatic")
        XCTAssertEqual(common["MARKETING_VERSION"], "1.0")
        XCTAssertEqual(common["CURRENT_PROJECT_VERSION"], "1")

        let package = try source("Package.swift")
        XCTAssertTrue(package.contains(".iOS(\"26.6\")"))
        XCTAssertTrue(package.contains(".macOS(.v12)"))
    }

    func testProjectHasFourConfigurationsTwoExplicitSchemesAndBothGuards() throws {
        let project = try source("project.yml")
        for configuration in [
            "Debug-Development", "Release-Development",
            "Debug-Production", "Release-Production"
        ] {
            XCTAssertTrue(project.contains("\(configuration):"), configuration)
        }
        XCTAssertTrue(project.contains("NeoGym Dev:"))
        XCTAssertTrue(project.contains("config: Debug-Development"))
        XCTAssertTrue(project.contains("config: Release-Development"))
        XCTAssertTrue(project.contains("config: Debug-Production"))
        XCTAssertTrue(project.contains("config: Release-Production"))
        XCTAssertEqual(
            project.components(separatedBy: "Validate deployment configuration").count - 1,
            2
        )
        XCTAssertEqual(project.components(separatedBy: "deploymentTarget: \"26.6\"").count - 1, 2)
        XCTAssertFalse(project.contains("DEVELOPMENT_TEAM: \"\""))
        XCTAssertFalse(project.contains("spmqtxqkdoxvtrkrfnnl"))
        XCTAssertFalse(project.contains("eu-central-1"))
    }

    func testPlistsAndEntitlementsAreTokenizedTemplates() throws {
        let app = try plist("App/Info.plist")
        let widget = try plist("Widgets/Info.plist")
        let appEntitlements = try plist("App/NeoGym.entitlements")
        let widgetEntitlements = try plist("Widgets/NeoGymWidgets.entitlements")

        XCTAssertEqual(app["CFBundleDisplayName"] as? String, "$(NEOGYM_DISPLAY_NAME)")
        XCTAssertEqual(widget["CFBundleDisplayName"] as? String, "$(NEOGYM_WIDGET_DISPLAY_NAME)")
        XCTAssertEqual(app["CFBundleShortVersionString"] as? String, "$(MARKETING_VERSION)")
        XCTAssertEqual(widget["CFBundleShortVersionString"] as? String, "$(MARKETING_VERSION)")
        XCTAssertEqual(app["CFBundleVersion"] as? String, "$(CURRENT_PROJECT_VERSION)")
        XCTAssertEqual(widget["CFBundleVersion"] as? String, "$(CURRENT_PROJECT_VERSION)")
        XCTAssertEqual(app["UILaunchStoryboardName"] as? String, "LaunchScreen")
        XCTAssertEqual(app["UISupportedInterfaceOrientations"] as? [String], ["UIInterfaceOrientationPortrait"])
        XCTAssertEqual(app["ITSAppUsesNonExemptEncryption"] as? Bool, false)
        XCTAssertNotNil(app["NSHealthShareUsageDescription"])
        XCTAssertNotNil(app["NSHealthUpdateUsageDescription"])
        XCTAssertNil(widget["NSHealthShareUsageDescription"])
        XCTAssertNil(widget["NSHealthUpdateUsageDescription"])
        XCTAssertEqual(appEntitlements["com.apple.developer.healthkit"] as? Bool, true)
        XCTAssertNil(widgetEntitlements["com.apple.developer.healthkit"])

        let expectedAppGroup = ["$(NEOGYM_APP_GROUP_IDENTIFIER)"]
        let expectedKeychain = ["$(AppIdentifierPrefix)$(NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX)"]
        XCTAssertEqual(appEntitlements["com.apple.security.application-groups"] as? [String], expectedAppGroup)
        XCTAssertEqual(widgetEntitlements["com.apple.security.application-groups"] as? [String], expectedAppGroup)
        XCTAssertEqual(appEntitlements["keychain-access-groups"] as? [String], expectedKeychain)
        XCTAssertEqual(widgetEntitlements["keychain-access-groups"] as? [String], expectedKeychain)

        for key in [
            NeoGymRuntimeConfiguration.Key.nhostSubdomain,
            NeoGymRuntimeConfiguration.Key.nhostRegion,
            NeoGymRuntimeConfiguration.Key.callbackScheme,
            NeoGymRuntimeConfiguration.Key.appGroupIdentifier,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroupSuffix
        ] {
            XCTAssertEqual(app[key] as? String, widget[key] as? String, key)
        }
    }

    func testHealthKitImportsRemainReadOnly() throws {
        for path in [
            "Sources/NeoGymKit/BodyMeasurementsHealthImport.swift",
            "Sources/NeoGymKit/DailyEnergyHealthImport.swift"
        ] {
            XCTAssertTrue(try source(path).contains("requestAuthorization(toShare: [], read:"), path)
        }
    }

    func testCommittedRuntimeConfigurationHasNoProductionBackendOrStaleNamespace() throws {
        let forbidden = ["spmqtxqkdoxvtrkrfnnl", "group.io.nhost.neogym", "io.nhost.neogym.shared"]
        for directory in ["App", "Widgets", "Sources/NeoGymKit", "Configuration"] {
            let root = packageRoot.appendingPathComponent(directory)
            let enumerator = try XCTUnwrap(FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil))
            for case let file as URL in enumerator where !file.path.contains("/Generated/") {
                guard ["swift", "plist", "entitlements", "xcconfig"].contains(file.pathExtension) else { continue }
                let contents = try String(contentsOf: file, encoding: .utf8)
                for value in forbidden {
                    XCTAssertFalse(contents.contains(value), "Stale deployment literal in \(file.lastPathComponent)")
                }
            }
        }
    }

    private func source(_ relativePath: String) throws -> String {
        try String(contentsOf: packageRoot.appendingPathComponent(relativePath), encoding: .utf8)
    }

    private func plist(_ relativePath: String) throws -> [String: Any] {
        let data = try Data(contentsOf: packageRoot.appendingPathComponent(relativePath))
        return try XCTUnwrap(
            PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        )
    }

    private func xcconfig(_ relativePath: String) throws -> [String: String] {
        try source(relativePath)
            .split(separator: "\n")
            .reduce(into: [:]) { result, line in
                let pieces = line.split(separator: "=", maxSplits: 1).map(String.init)
                guard pieces.count == 2 else { return }
                result[pieces[0].trimmingCharacters(in: .whitespaces)] =
                    pieces[1].trimmingCharacters(in: .whitespaces)
            }
    }
}
