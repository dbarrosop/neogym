import Foundation
import XCTest

final class URLSchemeRegistrationTests: XCTestCase {
    private var packageRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    func testInfoPlistRegistersNeoGymURLScheme() throws {
        let plistURL = packageRoot.appendingPathComponent("App/Info.plist")
        let plistData = try Data(contentsOf: plistURL)
        let plist = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: plistData, format: nil) as? [String: Any]
        )
        let urlTypes = try XCTUnwrap(plist["CFBundleURLTypes"] as? [[String: Any]])
        let neoGymURLType = try XCTUnwrap(
            urlTypes.first { urlType in
                urlType["CFBundleURLName"] as? String == "io.nhost.neogym"
            }
        )
        let schemes = try XCTUnwrap(neoGymURLType["CFBundleURLSchemes"] as? [String])

        XCTAssertTrue(schemes.contains("neogym"))
    }

    func testAppAndWidgetSessionsUseDistinctKeychainAccessGroups() throws {
        let infoPlist = try plist(at: "App/Info.plist")
        XCTAssertEqual(
            infoPlist["NeoGymAppKeychainAccessGroup"] as? String,
            "$(AppIdentifierPrefix)io.nhost.neogym"
        )
        XCTAssertEqual(
            infoPlist["NeoGymSharedKeychainAccessGroup"] as? String,
            "$(AppIdentifierPrefix)io.nhost.neogym.shared"
        )

        let entitlements = try plist(at: "App/NeoGym.entitlements")
        let groups = try XCTUnwrap(entitlements["keychain-access-groups"] as? [String])
        XCTAssertEqual(groups, [
            "$(AppIdentifierPrefix)io.nhost.neogym",
            "$(AppIdentifierPrefix)io.nhost.neogym.shared"
        ])

        let widgetEntitlements = try plist(at: "Widgets/NeoGymWidgets.entitlements")
        let widgetGroups = try XCTUnwrap(widgetEntitlements["keychain-access-groups"] as? [String])
        XCTAssertEqual(widgetGroups, ["$(AppIdentifierPrefix)io.nhost.neogym.shared"])
    }

    private func plist(at relativePath: String) throws -> [String: Any] {
        let data = try Data(contentsOf: packageRoot.appendingPathComponent(relativePath))
        return try XCTUnwrap(
            PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        )
    }
}
