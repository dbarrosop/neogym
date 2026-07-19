import Foundation
import Nhost

public extension NhostClientFactory {
    static func makeGraphQLService(
        config: NhostConfig = .local,
        sessionManagement: SessionManagementConfiguration = SessionManagementConfiguration()
    ) -> NhostGraphQLService {
        NhostGraphQLService(client: makeClient(config: config, sessionManagement: sessionManagement))
    }

    static func makeEnvironment(
        config: NhostConfig = .local,
        sessionManagement: SessionManagementConfiguration = SessionManagementConfiguration()
    ) -> AppEnvironment {
        AppEnvironment(client: makeClient(config: config, sessionManagement: sessionManagement))
    }

    static func makeEnvironment(
        configuration: NeoGymRuntimeConfiguration
    ) throws -> AppEnvironment {
        try AppEnvironment(client: makeAppClient(configuration: configuration))
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
