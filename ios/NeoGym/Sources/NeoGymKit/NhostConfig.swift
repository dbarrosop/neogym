import Foundation
import Nhost

public struct NhostConfig: Equatable, Sendable {
    public var subdomain: String
    public var region: String

    public static let local = NhostConfig(subdomain: "local", region: "local")
    public static let production = NhostConfig(subdomain: "spmqtxqkdoxvtrkrfnnl", region: "eu-central-1")

    public init(subdomain: String = "local", region: String = "local") {
        self.subdomain = subdomain
        self.region = region
    }
}

public enum NhostSessionConfig {
    public static let keychainService = "io.nhost.swift.session"
    public static let keychainAccountPrefix = "default"
    public static let sharedKeychainAccessGroupSuffix = "io.nhost.neogym.shared"
    public static let sharedKeychainAccessGroupInfoPlistKey = "NeoGymSharedKeychainAccessGroup"
    public static let appGroupIdentifier = "group.io.nhost.dbarroso.neogym"
    public static let appAcquisitionTimeout: TimeInterval = 5
    public static let widgetAcquisitionTimeout: TimeInterval = 0.5

    public static func sharedKeychainAccessGroup(bundle: Bundle = .main) -> String? {
        guard let configured = bundle.object(
            forInfoDictionaryKey: sharedKeychainAccessGroupInfoPlistKey
        ) as? String else {
            return nil
        }

        let trimmed = configured.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.contains("$("),
              !trimmed.contains("${"),
              trimmed.hasSuffix(sharedKeychainAccessGroupSuffix)
        else {
            return nil
        }
        return trimmed
    }

    public static func sharedSessionManagement(
        acquisitionTimeout: TimeInterval,
        bundle: Bundle = .main
    ) throws -> SessionManagementConfiguration {
        try SessionManagementConfiguration.sharedKeychain(
            options: KeychainSessionStorageOptions(
                service: keychainService,
                accountPrefix: keychainAccountPrefix,
                accessGroup: sharedKeychainAccessGroup(bundle: bundle)
            ),
            appGroupIdentifier: appGroupIdentifier,
            acquisitionTimeout: acquisitionTimeout
        )
    }
}

/// The MCP endpoint users point Claude, Cursor or other MCP clients at,
/// matching the web app's `VITE_MCP_URL` for each backend.
public enum AgentAccess {
    public static let productionMCPURL = "https://tcruocjehgxmkwzpnshv-3000.svc.eu-central-1.nhost.run"
    public static let localMCPURL = "http://localhost:3000"

    public static func mcpURL(for config: NhostConfig) -> String {
        config == .production ? productionMCPURL : localMCPURL
    }
}
