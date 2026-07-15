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
        let neoGymURLType = try XCTUnwrap(
            urlTypes.first { urlType in
                urlType["CFBundleURLName"] as? String == "io.nhost.neogym"
            }
        )
        let schemes = try XCTUnwrap(neoGymURLType["CFBundleURLSchemes"] as? [String])

        XCTAssertTrue(schemes.contains("neogym"))
    }

    func testAppAndWidgetDeclareOnlyTheSharedSessionAccessGroup() throws {
        let expectedKeychainGroup = "$(AppIdentifierPrefix)io.nhost.neogym.shared"
        let expectedAppGroup = "group.io.nhost.neogym"
        let appInfoPlist = try plist(at: "App/Info.plist")
        let widgetInfoPlist = try plist(at: "Widgets/Info.plist")

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

    func testProjectSpecAndRuntimeConstantsUseOneCoordinationIdentity() throws {
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
            "sharedKeychainAccessGroupSuffix = \"io.nhost.neogym.shared\"",
            "appGroupIdentifier = \"group.io.nhost.neogym\"",
            "lockNamespace = \"io.nhost.neogym.shared-session\"",
            "appAcquisitionTimeout: TimeInterval = 5",
            "widgetAcquisitionTimeout: TimeInterval = 0.5"
        ] {
            XCTAssertTrue(configSource.contains(expectedDeclaration))
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
            2
        )
    }

    private func plist(at relativePath: String) throws -> [String: Any] {
        let data = try Data(contentsOf: packageRoot.appendingPathComponent(relativePath))
        return try XCTUnwrap(
            PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        )
    }
}
