import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class NeoGymRuntimeConfigurationTests: XCTestCase {
    func testLoadsProductionShapedConfigurationAndDerivesConsumers() throws {
        let configuration = try NeoGymRuntimeConfiguration(
            infoDictionary: Self.fixture(
                bundleIdentifier: "io.example.neogym",
                subdomain: "opaque-production-project",
                region: "opaque-production-region",
                callbackScheme: "neogym",
                appGroup: "group.io.example.neogym",
                accessGroup: "TEAMID.io.example.neogym.shared",
                accessGroupSuffix: "io.example.neogym.shared"
            )
        )

        XCTAssertEqual(configuration.nhost.subdomain, "opaque-production-project")
        XCTAssertEqual(configuration.nhost.region, "opaque-production-region")
        XCTAssertEqual(configuration.callbackScheme, "neogym")
        XCTAssertEqual(configuration.callbackURL, "neogym://verify")
        XCTAssertEqual(configuration.appGroupIdentifier, "group.io.example.neogym")
        XCTAssertEqual(configuration.sharedKeychainAccessGroup, "TEAMID.io.example.neogym.shared")
        XCTAssertEqual(configuration.sharedKeychainAccessGroupSuffix, "io.example.neogym.shared")
        XCTAssertEqual(configuration.pkceServiceIdentifier, "io.example.neogym.auth")
        XCTAssertEqual(configuration.notificationIdentifier, "io.example.neogym.rest-timer")
        XCTAssertEqual(configuration.widgetOpenURL.absoluteString, "neogym://")
    }

    func testDevelopmentShapedConfigurationStaysIsolated() throws {
        let production = try NeoGymRuntimeConfiguration(infoDictionary: Self.fixture())
        let development = try NeoGymRuntimeConfiguration(infoDictionary: Self.fixture(
            bundleIdentifier: "io.example.neogym.dev",
            subdomain: "development-project",
            region: "development-region",
            callbackScheme: "neogym-dev",
            appGroup: "group.io.example.neogym.dev",
            accessGroup: "TEAMID.io.example.neogym.dev.shared",
            accessGroupSuffix: "io.example.neogym.dev.shared"
        ))

        XCTAssertNotEqual(development.callbackScheme, production.callbackScheme)
        XCTAssertNotEqual(development.appGroupIdentifier, production.appGroupIdentifier)
        XCTAssertNotEqual(development.sharedKeychainAccessGroup, production.sharedKeychainAccessGroup)
        XCTAssertNotEqual(development.pkceServiceIdentifier, production.pkceServiceIdentifier)
        XCTAssertNotEqual(development.notificationIdentifier, production.notificationIdentifier)
        XCTAssertEqual(development.callbackURL, "neogym-dev://verify")
    }

    func testNhostValuesPassThroughWithoutNormalizationOrClassification() throws {
        let subdomain = "  opaque # value // with 'quotes' and \\slashes  "
        let region = "region;echo-not-executed`value`"
        let configuration = try NeoGymRuntimeConfiguration(infoDictionary: Self.fixture(
            subdomain: subdomain,
            region: region
        ))

        XCTAssertEqual(configuration.nhost.subdomain, subdomain)
        XCTAssertEqual(configuration.nhost.region, region)
    }

    func testRejectsEveryMissingRequiredKeyWithKeyOnlyError() {
        for key in Self.fixture().keys {
            var dictionary = Self.fixture()
            dictionary.removeValue(forKey: key)

            XCTAssertThrowsError(try NeoGymRuntimeConfiguration(infoDictionary: dictionary)) { error in
                XCTAssertEqual(
                    error as? NeoGymRuntimeConfigurationError,
                    .missingValue(key: key)
                )
                XCTAssertFalse(error.localizedDescription.contains("opaque-production-project"))
            }
        }
    }

    func testRejectsEmptyAndUnexpandedValuesWithoutExposingValues() {
        var empty = Self.fixture()
        empty[NeoGymRuntimeConfiguration.Key.nhostSubdomain] = ""
        XCTAssertThrowsError(try NeoGymRuntimeConfiguration(infoDictionary: empty)) { error in
            XCTAssertEqual(
                error as? NeoGymRuntimeConfigurationError,
                .emptyValue(key: NeoGymRuntimeConfiguration.Key.nhostSubdomain)
            )
        }

        for placeholder in ["$(NHOST_SUBDOMAIN)", "${NHOST_SUBDOMAIN}"] {
            var unexpanded = Self.fixture()
            unexpanded[NeoGymRuntimeConfiguration.Key.nhostSubdomain] = placeholder
            XCTAssertThrowsError(try NeoGymRuntimeConfiguration(infoDictionary: unexpanded)) { error in
                XCTAssertEqual(
                    error as? NeoGymRuntimeConfigurationError,
                    .unexpandedValue(key: NeoGymRuntimeConfiguration.Key.nhostSubdomain)
                )
                XCTAssertFalse(error.localizedDescription.contains(placeholder))
            }
        }
    }

    func testRejectsCrossedOrArbitrarySharedAccessGroup() {
        for accessGroup in [
            "TEAMID.io.example.neogym.dev.shared",
            "arbitraryio.example.neogym.shared"
        ] {
            var dictionary = Self.fixture()
            dictionary[NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup] = accessGroup

            XCTAssertThrowsError(try NeoGymRuntimeConfiguration(infoDictionary: dictionary)) { error in
                XCTAssertEqual(
                    error as? NeoGymRuntimeConfigurationError,
                    .inconsistentValue(key: NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup)
                )
                XCTAssertFalse(error.localizedDescription.contains(accessGroup))
            }
        }
    }

    func testAcceptsExpandedAccessGroupWhenUnsignedSimulatorPrefixIsEmpty() throws {
        let configuration = try NeoGymRuntimeConfiguration(infoDictionary: Self.fixture(
            accessGroup: "io.example.neogym.shared"
        ))

        XCTAssertEqual(
            configuration.sharedKeychainAccessGroup,
            configuration.sharedKeychainAccessGroupSuffix
        )
    }

    func testLoadsBuiltAppAndWidgetPlistsWhenProvidedByIntegrationCheck() throws {
        guard let appInfoPath = ProcessInfo.processInfo.environment["NEOGYM_BUILT_APP_INFO_PLIST"],
              let widgetInfoPath = ProcessInfo.processInfo.environment["NEOGYM_BUILT_WIDGET_INFO_PLIST"]
        else {
            throw XCTSkip("Built plist paths are supplied by the simulator integration check")
        }

        let app = try Self.configuration(at: appInfoPath)
        let widget = try Self.configuration(at: widgetInfoPath)

        XCTAssertEqual(app.nhost, widget.nhost)
        XCTAssertEqual(app.callbackScheme, widget.callbackScheme)
        XCTAssertEqual(app.appGroupIdentifier, widget.appGroupIdentifier)
        XCTAssertEqual(app.sharedKeychainAccessGroup, widget.sharedKeychainAccessGroup)
        XCTAssertEqual(app.sharedKeychainAccessGroupSuffix, widget.sharedKeychainAccessGroupSuffix)
    }

    func testConfiguredNhostFactoryUsesRuntimeValues() throws {
        let configuration = try NeoGymRuntimeConfiguration(infoDictionary: Self.fixture(
            subdomain: "fixture-project",
            region: "fixture-region"
        ))
        let appClient = NhostClientFactory.makeAppClient(
            configuration: configuration,
            sessionManagement: SessionManagementConfiguration()
        )
        let widgetClient = NhostClientFactory.makeWidgetClient(
            configuration: configuration,
            sessionManagement: SessionManagementConfiguration()
        )

        for client in [appClient, widgetClient] {
            XCTAssertEqual(
                client.serviceURLs.auth.absoluteString,
                "https://fixture-project.auth.fixture-region.nhost.run/v1"
            )
            XCTAssertEqual(
                client.serviceURLs.graphql.absoluteString,
                "https://fixture-project.graphql.fixture-region.nhost.run/v1"
            )
        }
    }

    private static func configuration(at path: String) throws -> NeoGymRuntimeConfiguration {
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        let dictionary = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        )
        return try NeoGymRuntimeConfiguration(infoDictionary: dictionary)
    }

    private static func fixture(
        bundleIdentifier: String = "io.example.neogym",
        subdomain: String = "opaque-production-project",
        region: String = "opaque-production-region",
        callbackScheme: String = "neogym",
        appGroup: String = "group.io.example.neogym",
        accessGroup: String = "TEAMID.io.example.neogym.shared",
        accessGroupSuffix: String = "io.example.neogym.shared"
    ) -> [String: Any] {
        [
            NeoGymRuntimeConfiguration.Key.bundleIdentifier: bundleIdentifier,
            NeoGymRuntimeConfiguration.Key.nhostSubdomain: subdomain,
            NeoGymRuntimeConfiguration.Key.nhostRegion: region,
            NeoGymRuntimeConfiguration.Key.callbackScheme: callbackScheme,
            NeoGymRuntimeConfiguration.Key.appGroupIdentifier: appGroup,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroup: accessGroup,
            NeoGymRuntimeConfiguration.Key.sharedKeychainAccessGroupSuffix: accessGroupSuffix
        ]
    }
}
