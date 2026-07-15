import Foundation
import Nhost

public enum NhostClientFactory {
    public static func makeClient(
        config: NhostConfig = .local,
        sessionManagement: SessionManagementConfiguration = SessionManagementConfiguration(),
        graphQLCache: GraphQLCacheConfiguration? = nil
    ) -> NhostClient {
        createClient(
            NhostClientOptions(
                subdomain: config.subdomain,
                region: config.region,
                sessionManagement: sessionManagement,
                graphqlCache: graphQLCache
            )
        )
    }

    public static func makeAuthService(
        config: NhostConfig = .local,
        sessionManagement: SessionManagementConfiguration = SessionManagementConfiguration()
    ) -> NhostAuthService {
        NhostAuthService(client: makeClient(config: config, sessionManagement: sessionManagement))
    }

    public static func makeProductionAppClient() -> NhostClient {
        let sessionManagement: SessionManagementConfiguration
        do {
            sessionManagement = try NhostSessionConfig.sharedSessionManagement(
                acquisitionTimeout: NhostSessionConfig.appAcquisitionTimeout
            )
        } catch {
            fatalError(
                "NeoGym shared session configuration is invalid. "
                    + "Check the signed Keychain and App Group entitlements: \(error)"
            )
        }

        return makeClient(
            config: .production,
            sessionManagement: sessionManagement,
            graphQLCache: GraphQLCacheConfiguration(
                freshnessTTL: 5 * 60,
                staleIfErrorInterval: 7 * 24 * 60 * 60
            )
        )
    }

    public static func makeProductionWidgetClient() throws -> NhostClient {
        try makeClient(
            config: .production,
            sessionManagement: NhostSessionConfig.sharedSessionManagement(
                acquisitionTimeout: NhostSessionConfig.widgetAcquisitionTimeout
            )
        )
    }
}
