import Foundation

public struct NhostConfig: Equatable, Sendable {
    public var subdomain: String
    public var region: String

    public static let local = NhostConfig(subdomain: "local", region: "local")

    public init(subdomain: String = "local", region: String = "local") {
        self.subdomain = subdomain
        self.region = region
    }
}
