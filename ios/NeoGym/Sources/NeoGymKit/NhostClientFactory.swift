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
        MigratingSessionStorageBackend(
            primary: sharedKeychainStorage(accessGroup: accessGroup),
            legacy: KeychainSessionStorageBackend()
        )
        #else
        MemorySessionStorageBackend()
        #endif
    }
}

public struct MigratingSessionStorageBackend: SessionStorageBackend {
    private let primary: any SessionStorageBackend
    private let legacy: any SessionStorageBackend

    public init(primary: any SessionStorageBackend, legacy: any SessionStorageBackend) {
        self.primary = primary
        self.legacy = legacy
    }

    public func get() async throws -> StoredSession? {
        do {
            if let session = try await primary.get() {
                return session
            }
        } catch {
            // If the shared keychain group is not provisioned on a signed build,
            // keep the app functional from the legacy app-only keychain. The
            // widget will simply fall back to the cached aggregate snapshot.
        }

        guard let legacySession = try await legacy.get() else {
            return nil
        }

        do {
            try await primary.set(legacySession)
            try? await legacy.remove()
        } catch {
            // Best-effort migration: returning the legacy session avoids forcing a
            // sign-out solely because the shared group is unavailable.
        }
        return legacySession
    }

    public func set(_ value: StoredSession) async throws {
        do {
            try await primary.set(value)
            try? await legacy.remove()
        } catch {
            try await legacy.set(value)
        }
    }

    public func remove() async throws {
        var firstError: Error?

        do {
            try await primary.remove()
        } catch {
            firstError = error
        }

        do {
            try await legacy.remove()
        } catch {
            firstError = firstError ?? error
        }

        if let firstError {
            throw firstError
        }
    }
}
