import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class URLSchemeRegistrationTests: XCTestCase {
    private let obsoletePrivateInfoKey = "NeoGymApp" + "KeychainAccessGroup"

    private var packageRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    func testInfoPlistRegistersNeoGymURLScheme() throws {
        let infoPlist = try plist(at: "App/Info.plist")
        let urlTypes = try XCTUnwrap(infoPlist["CFBundleURLTypes"] as? [[String: Any]])
        let configuredScheme = try XCTUnwrap(
            infoPlist[NeoGymRuntimeConfiguration.Key.callbackScheme] as? String
        )
        let registeredSchemes = urlTypes.flatMap { urlType in
            urlType["CFBundleURLSchemes"] as? [String] ?? []
        }

        XCTAssertTrue(registeredSchemes.contains(configuredScheme))
    }

    func testAppAndWidgetDeclareOnlyTheSharedSessionAccessGroup() throws {
        let appInfoPlist = try plist(at: "App/Info.plist")
        let widgetInfoPlist = try plist(at: "Widgets/Info.plist")
        let expectedKeychainGroup = try XCTUnwrap(
            appInfoPlist[NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup] as? String
        )
        let expectedAppGroup = try XCTUnwrap(
            appInfoPlist[NeoGymRuntimeConfiguration.Key.appGroupIdentifier] as? String
        )

        XCTAssertNil(appInfoPlist[obsoletePrivateInfoKey])
        XCTAssertEqual(
            appInfoPlist["NeoGymSharedKeychainAccessGroup"] as? String,
            expectedKeychainGroup
        )
        XCTAssertEqual(
            widgetInfoPlist["NeoGymSharedKeychainAccessGroup"] as? String,
            expectedKeychainGroup
        )

        let appEntitlements = try plist(at: "App/NeoGym.entitlements")
        let widgetEntitlements = try plist(at: "Widgets/NeoGymWidgets.entitlements")
        XCTAssertEqual(
            appEntitlements["keychain-access-groups"] as? [String],
            [expectedKeychainGroup]
        )
        XCTAssertEqual(
            widgetEntitlements["keychain-access-groups"] as? [String],
            [expectedKeychainGroup]
        )
        XCTAssertEqual(
            appEntitlements["com.apple.security.application-groups"] as? [String],
            [expectedAppGroup]
        )
        XCTAssertEqual(
            widgetEntitlements["com.apple.security.application-groups"] as? [String],
            [expectedAppGroup]
        )
    }

    func testProjectSpecAndRuntimeMetadataUseOneCoordinationIdentity() throws {
        let keychainOptions = KeychainSessionStorageOptions(
            service: "io.nhost.swift.session",
            accountPrefix: "default"
        )
        XCTAssertEqual(keychainOptions.service, "io.nhost.swift.session")
        XCTAssertEqual(keychainOptions.account, "default.nhostSession")

        let configSource = try String(
            contentsOf: packageRoot.appendingPathComponent("Sources/NeoGymKit/NhostConfig.swift"),
            encoding: .utf8
        )
        for expectedDeclaration in [
            "keychainService = \"io.nhost.swift.session\"",
            "keychainAccountPrefix = \"default\"",
            "appAcquisitionTimeout: TimeInterval = 5",
            "widgetAcquisitionTimeout: TimeInterval = 0.5"
        ] {
            XCTAssertTrue(configSource.contains(expectedDeclaration))
        }
        XCTAssertFalse(configSource.contains("lockNamespace"))
        XCTAssertFalse(configSource.contains("spmqtxqkdoxvtrkrfnnl"))
        XCTAssertFalse(configSource.contains("group.io.nhost.neogym"))

        let appInfoPlist = try plist(at: "App/Info.plist")
        let widgetInfoPlist = try plist(at: "Widgets/Info.plist")
        for key in [
            NeoGymRuntimeConfiguration.Key.nhostSubdomain,
            NeoGymRuntimeConfiguration.Key.nhostRegion,
            NeoGymRuntimeConfiguration.Key.callbackScheme,
            NeoGymRuntimeConfiguration.Key.appGroupIdentifier,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroupSuffix
        ] {
            XCTAssertEqual(appInfoPlist[key] as? String, widgetInfoPlist[key] as? String, key)
        }

        let projectSpec = try String(
            contentsOf: packageRoot.appendingPathComponent("project.yml"),
            encoding: .utf8
        )
        XCTAssertFalse(projectSpec.contains(obsoletePrivateInfoKey))
        XCTAssertFalse(projectSpec.contains("$(AppIdentifierPrefix)io.nhost.neogym\""))
        XCTAssertEqual(
            projectSpec.components(separatedBy: "$(AppIdentifierPrefix)io.nhost.neogym.shared").count - 1,
            4
        )
        XCTAssertEqual(
            projectSpec.components(separatedBy: "group.io.nhost.neogym").count - 1,
            4
        )
        for key in [
            NeoGymRuntimeConfiguration.Key.nhostSubdomain,
            NeoGymRuntimeConfiguration.Key.nhostRegion,
            NeoGymRuntimeConfiguration.Key.callbackScheme,
            NeoGymRuntimeConfiguration.Key.appGroupIdentifier,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroupSuffix
        ] {
            XCTAssertEqual(projectSpec.components(separatedBy: "\(key):").count - 1, 2, key)
        }
    }

    func testShippedSwiftDoesNotHardcodeCurrentDeploymentValues() throws {
        let appInfoPlist = try plist(at: "App/Info.plist")
        let configuredValues = try [
            NeoGymRuntimeConfiguration.Key.nhostSubdomain,
            NeoGymRuntimeConfiguration.Key.nhostRegion,
            NeoGymRuntimeConfiguration.Key.callbackScheme,
            NeoGymRuntimeConfiguration.Key.appGroupIdentifier,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroupSuffix
        ].map { key in
            try XCTUnwrap(appInfoPlist[key] as? String)
        }

        for directory in ["App", "Widgets", "Sources/NeoGymKit"] {
            let root = packageRoot.appendingPathComponent(directory)
            let enumerator = try XCTUnwrap(FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil))
            for case let fileURL as URL in enumerator where fileURL.pathExtension == "swift" {
                let source = try String(contentsOf: fileURL, encoding: .utf8)
                for value in configuredValues {
                    XCTAssertFalse(
                        source.contains("\"\(value)\""),
                        "Deployment value must come from runtime metadata: \(fileURL.lastPathComponent)"
                    )
                }
                XCTAssertFalse(source.contains("makeProduction"), fileURL.lastPathComponent)
                XCTAssertFalse(source.contains("NhostConfig.production"), fileURL.lastPathComponent)
            }
        }
    }

    private func plist(at relativePath: String) throws -> [String: Any] {
        let data = try Data(contentsOf: packageRoot.appendingPathComponent(relativePath))
        return try XCTUnwrap(
            PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        )
    }
}
