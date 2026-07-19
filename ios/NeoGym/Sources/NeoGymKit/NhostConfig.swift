import Foundation
import Nhost

public struct NhostConfig: Equatable, Sendable {
    public var subdomain: String
    public var region: String

    public static let local = NhostConfig(subdomain: "local", region: "local")

    public init(subdomain: String = "local", region: String = "local") {
        self.subdomain = subdomain
        self.region = region
    }
}

public enum NhostSessionConfig {
    public static let keychainService = "io.nhost.swift.session"
    public static let keychainAccountPrefix = "default"
    public static let appAcquisitionTimeout: TimeInterval = 5
    public static let widgetAcquisitionTimeout: TimeInterval = 0.5

    public static func sharedSessionManagement(
        configuration: NeoGymRuntimeConfiguration,
        acquisitionTimeout: TimeInterval
    ) throws -> SessionManagementConfiguration {
        try SessionManagementConfiguration.sharedKeychain(
            options: KeychainSessionStorageOptions(
                service: keychainService,
                accountPrefix: keychainAccountPrefix,
                accessGroup: configuration.sharedKeychainAccessGroup
            ),
            appGroupIdentifier: configuration.appGroupIdentifier,
            acquisitionTimeout: acquisitionTimeout
        )
    }
}
