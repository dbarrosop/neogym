import Foundation
import Nhost

public enum NhostClientFactory {
    public static func makeClient(config: NhostConfig = .local) -> NhostClient {
        createClient(
            NhostClientOptions(
                subdomain: config.subdomain,
                region: config.region
            )
        )
    }

    public static func makeAuthService(config: NhostConfig = .local) -> NhostAuthService {
        NhostAuthService(client: makeClient(config: config))
    }

}
