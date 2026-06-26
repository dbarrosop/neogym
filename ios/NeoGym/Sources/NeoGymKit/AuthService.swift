import Foundation
import Nhost

public struct AuthSessionSubscription: Sendable {
    private let cancelHandler: @Sendable () async -> Void

    public init(cancel: @escaping @Sendable () async -> Void) {
        cancelHandler = cancel
    }

    public func cancel() async {
        await cancelHandler()
    }
}

public protocol AuthServicing: Sendable {
    func getUserSession() async throws -> StoredSession?
    func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription
    func signOut(refreshToken: String?) async throws
    func clearSession() async throws
}

public struct NhostAuthService: AuthServicing {
    public let client: NhostClient

    public init(client: NhostClient) {
        self.client = client
    }

    public func getUserSession() async throws -> StoredSession? {
        try await client.getUserSession()
    }

    public func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription {
        let subscription = await client.sessionStore.subscribe(handler)
        return AuthSessionSubscription {
            await subscription.cancel()
        }
    }

    public func signOut(refreshToken: String?) async throws {
        _ = try await client.auth.signOut(
            body: AuthSignOutRequest(refreshToken: refreshToken)
        )
    }

    public func clearSession() async throws {
        try await client.clearSession()
    }
}
