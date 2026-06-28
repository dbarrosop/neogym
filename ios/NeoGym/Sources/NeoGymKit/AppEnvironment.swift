import Foundation
import Nhost

public extension NhostClientFactory {
    static func makeGraphQLService(config: NhostConfig = .local) -> NhostGraphQLService {
        NhostGraphQLService(client: makeClient(config: config))
    }

    static func makeEnvironment(config: NhostConfig = .local) -> AppEnvironment {
        AppEnvironment(client: makeClient(config: config))
    }
}

public struct AppEnvironment: Sendable {
    public let client: NhostClient
    public let authService: NhostAuthService
    public let graphQLService: NhostGraphQLService

    public init(client: NhostClient) {
        self.client = client
        self.authService = NhostAuthService(client: client)
        self.graphQLService = NhostGraphQLService(client: client)
    }
}
