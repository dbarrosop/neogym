import Foundation
import Nhost

public enum NhostClientFactory {
    public static func makeClient(
        config: NhostConfig = .local,
        sessionStorage: (any SessionStorageBackend)? = nil
    ) -> NhostClient {
        createClient(
            NhostClientOptions(
                subdomain: config.subdomain,
                region: config.region,
                sessionStorage: sessionStorage
            )
        )
    }

    public static func makeAuthService(
        config: NhostConfig = .local,
        sessionStorage: (any SessionStorageBackend)? = nil
    ) -> NhostAuthService {
        NhostAuthService(client: makeClient(config: config, sessionStorage: sessionStorage))
    }

    public static func makeProductionAppClient() -> NhostClient {
        makeClient(
            config: .production,
            sessionStorage: NhostSessionStorageFactory.appSharedKeychainStorage()
        )
    }

    public static func makeProductionWidgetClient() -> NhostClient {
        makeClient(
            config: .production,
            sessionStorage: NhostSessionStorageFactory.sharedKeychainStorage()
        )
    }
}

public enum NhostSessionStorageFactory {
    public static func sharedKeychainStorage(accessGroup: String? = nil) -> any SessionStorageBackend {
        #if canImport(Security)
        KeychainSessionStorageBackend(
            options: KeychainSessionStorageOptions(
                accessGroup: accessGroup ?? NhostSessionConfig.sharedKeychainAccessGroup()
            )
        )
        #else
        MemorySessionStorageBackend()
        #endif
    }

    public static func appSharedKeychainStorage(accessGroup: String? = nil) -> any SessionStorageBackend {
        #if canImport(Security)
        MirroringSessionStorageBackend(
            primary: KeychainSessionStorageBackend(),
            mirror: sharedKeychainStorage(accessGroup: accessGroup)
        )
        #else
        MemorySessionStorageBackend()
        #endif
    }
}

public struct MirroringSessionStorageBackend: SessionStorageBackend {
    private let primary: any SessionStorageBackend
    private let mirror: any SessionStorageBackend

    public init(primary: any SessionStorageBackend, mirror: any SessionStorageBackend) {
        self.primary = primary
        self.mirror = mirror
    }

    public func get() async throws -> StoredSession? {
        if let session = try await primary.get() {
            try? await mirror.set(session)
            return session
        }

        guard let mirroredSession = try? await mirror.get() else {
            return nil
        }

        try await primary.set(mirroredSession)
        return mirroredSession
    }

    public func set(_ value: StoredSession) async throws {
        try await primary.set(value)
        try? await mirror.set(value)
    }

    public func remove() async throws {
        var firstError: Error?

        do {
            try await primary.remove()
        } catch {
            firstError = error
        }

        do {
            try await mirror.remove()
        } catch {
            firstError = firstError ?? error
        }

        if let firstError {
            throw firstError
        }
    }
}
