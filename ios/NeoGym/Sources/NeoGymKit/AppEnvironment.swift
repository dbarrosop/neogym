import Foundation
import Nhost

public extension NhostClientFactory {
    static func makeGraphQLService(
        config: NhostConfig = .local,
        sessionStorage: (any SessionStorageBackend)? = nil
    ) -> NhostGraphQLService {
        NhostGraphQLService(client: makeClient(config: config, sessionStorage: sessionStorage))
    }

    static func makeEnvironment(
        config: NhostConfig = .local,
        sessionStorage: (any SessionStorageBackend)? = nil
    ) -> AppEnvironment {
        AppEnvironment(client: makeClient(config: config, sessionStorage: sessionStorage))
    }

    static func makeProductionEnvironment() -> AppEnvironment {
        AppEnvironment(client: makeProductionAppClient())
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
