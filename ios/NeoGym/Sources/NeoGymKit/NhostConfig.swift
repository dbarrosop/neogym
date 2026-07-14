import Foundation

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
    public static let appKeychainAccessGroupSuffix = "io.nhost.neogym"
    public static let appKeychainAccessGroupInfoPlistKey = "NeoGymAppKeychainAccessGroup"
    public static let sharedKeychainAccessGroupSuffix = "io.nhost.neogym.shared"
    public static let sharedKeychainAccessGroupInfoPlistKey = "NeoGymSharedKeychainAccessGroup"

    public static func appKeychainAccessGroup(bundle: Bundle = .main) -> String? {
        configuredAccessGroup(
            infoPlistKey: appKeychainAccessGroupInfoPlistKey,
            requiredSuffix: appKeychainAccessGroupSuffix,
            bundle: bundle
        )
    }

    public static func sharedKeychainAccessGroup(bundle: Bundle = .main) -> String? {
        configuredAccessGroup(
            infoPlistKey: sharedKeychainAccessGroupInfoPlistKey,
            requiredSuffix: sharedKeychainAccessGroupSuffix,
            bundle: bundle
        )
    }

    private static func configuredAccessGroup(
        infoPlistKey: String,
        requiredSuffix: String,
        bundle: Bundle
    ) -> String? {
        guard let configured = bundle.object(forInfoDictionaryKey: infoPlistKey) as? String else { return nil }
        let trimmed = configured.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.contains("$("),
              trimmed.hasSuffix(requiredSuffix)
        else {
            return nil
        }
        return trimmed
    }
}
