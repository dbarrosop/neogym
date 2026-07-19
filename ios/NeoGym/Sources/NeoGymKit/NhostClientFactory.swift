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

    public static func makeAppClient(
        configuration: NeoGymRuntimeConfiguration
    ) throws -> NhostClient {
        try makeAppClient(
            configuration: configuration,
            sessionManagement: NhostSessionConfig.sharedSessionManagement(
                configuration: configuration,
                acquisitionTimeout: NhostSessionConfig.appAcquisitionTimeout
            )
        )
    }

    public static func makeWidgetClient(
        configuration: NeoGymRuntimeConfiguration
    ) throws -> NhostClient {
        try makeWidgetClient(
            configuration: configuration,
            sessionManagement: NhostSessionConfig.sharedSessionManagement(
                configuration: configuration,
                acquisitionTimeout: NhostSessionConfig.widgetAcquisitionTimeout
            )
        )
    }

    static func makeAppClient(
        configuration: NeoGymRuntimeConfiguration,
        sessionManagement: SessionManagementConfiguration
    ) -> NhostClient {
        makeClient(
            config: configuration.nhost,
            sessionManagement: sessionManagement,
            graphQLCache: GraphQLCacheConfiguration(
                freshnessTTL: 5 * 60,
                staleIfErrorInterval: 7 * 24 * 60 * 60
            )
        )
    }

    static func makeWidgetClient(
        configuration: NeoGymRuntimeConfiguration,
        sessionManagement: SessionManagementConfiguration
    ) -> NhostClient {
        makeClient(
            config: configuration.nhost,
            sessionManagement: sessionManagement
        )
    }
}
