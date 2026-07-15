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
    func requestSignInOTP(email: String) async throws
    func requestSignUpOTP(email: String, displayName: String) async throws
    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession?
    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws
    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession?
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
        let subscription = client.sessionStore.subscribe(handler)
        return AuthSessionSubscription {
            await subscription.cancel()
        }
    }

    public func requestSignInOTP(email: String) async throws {
        _ = try await client.auth.signInOTPEmail(
            body: AuthSignInOTPEmailRequest(email: email)
        )
    }

    public func requestSignUpOTP(email: String, displayName: String) async throws {
        _ = try await client.auth.signUpOTPEmail(
            body: AuthSignUpOTPEmailRequest(
                email: email,
                options: AuthSignUpOptions(displayName: displayName)
            )
        )
    }

    public func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? {
        let response = try await client.auth.verifySignInOTPEmail(
            body: AuthSignInOTPEmailVerifyRequest(otp: otp, email: email)
        )

        if let session = response.body.session {
            return try StoredSession(session)
        }

        return nil
    }

    public func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {
        _ = try await client.auth.changeUserEmail(
            body: AuthUserEmailChangeRequest(
                newEmail: newEmail,
                options: AuthOptionsRedirectTo(redirectTo: redirectTo),
                codeChallenge: codeChallenge
            )
        )
    }

    public func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? {
        let response = try await client.auth.tokenExchange(
            body: AuthTokenExchangeRequest(code: code, codeVerifier: codeVerifier)
        )

        if let session = response.body.session {
            return try StoredSession(session)
        }

        return try await client.getUserSession()
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
