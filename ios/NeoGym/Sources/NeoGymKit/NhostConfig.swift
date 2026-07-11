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
    public static let sharedKeychainAccessGroupSuffix = "io.nhost.neogym.shared"
    public static let sharedKeychainAccessGroupInfoPlistKey = "NeoGymSharedKeychainAccessGroup"

    public static func sharedKeychainAccessGroup(bundle: Bundle = .main) -> String? {
        if let configured = bundle.object(forInfoDictionaryKey: sharedKeychainAccessGroupInfoPlistKey) as? String,
           isUsableAccessGroup(configured) {
            return configured
        }

        return nil
    }

    private static func isUsableAccessGroup(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && !trimmed.contains("$(") && trimmed.hasSuffix(sharedKeychainAccessGroupSuffix)
    }
}
