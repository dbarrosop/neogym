import XCTest
import Nhost
@testable import NeoGymKit

@MainActor
final class AuthStoreTests: XCTestCase {
    func testLocalConfigDefaults() {
        XCTAssertEqual(NhostConfig.local.subdomain, "local")
        XCTAssertEqual(NhostConfig.local.region, "local")

        let client = NhostClientFactory.makeClient(config: .local)
        XCTAssertEqual(client.serviceURLs.auth.absoluteString, "https://local.auth.local.nhost.run/v1")
        XCTAssertEqual(client.serviceURLs.graphql.absoluteString, "https://local.graphql.local.nhost.run/v1")
    }

    func testStoreStartsLoadingUntilBootstrapCompletes() async {
        let service = FakeAuthService()
        let store = AuthStore(authService: service, autoBootstrap: false)

        XCTAssertTrue(store.state.isLoading)

        await store.bootstrap()

        guard case .signedOut = store.state else {
            return XCTFail("Expected signed-out state after empty session bootstrap")
        }
    }

    func testBootstrapLoadsExistingSession() async throws {
        let session = try Self.makeSession(email: "athlete@example.com")
        let service = FakeAuthService(initialSession: session)
        let store = AuthStore(authService: service, autoBootstrap: false)

        await store.bootstrap()

        XCTAssertEqual(store.state.session?.user?.email, "athlete@example.com")
    }

    func testSessionSubscriptionUpdatesState() async throws {
        let service = FakeAuthService()
        let store = AuthStore(authService: service, autoBootstrap: false)
        await store.bootstrap()

        let session = try Self.makeSession(email: "updated@example.com")
        await service.updateSession(session)

        XCTAssertEqual(store.state.session?.user?.email, "updated@example.com")
    }

    func testSignOutClearsLocalSession() async throws {
        let session = try Self.makeSession(refreshToken: "refresh-token")
        let service = FakeAuthService(initialSession: session)
        let store = AuthStore(authService: service, autoBootstrap: false)
        await store.bootstrap()

        await store.signOut()

        guard case .signedOut = store.state else {
            return XCTFail("Expected signed-out state after sign out")
        }
        let signOutRefreshTokens = await service.signOutRefreshTokensSnapshot()
        let didClearSession = await service.didClearSessionSnapshot()
        XCTAssertEqual(signOutRefreshTokens, ["refresh-token"])
        XCTAssertTrue(didClearSession)
    }

    func testSignOutStillClearsLocalSessionWhenRemoteSignOutFails() async throws {
        let session = try Self.makeSession(refreshToken: "stale-refresh-token")
        let service = FakeAuthService(initialSession: session, signOutError: TestError.remoteSignOutFailed)
        let store = AuthStore(authService: service, autoBootstrap: false)
        await store.bootstrap()

        await store.signOut()

        guard case .signedOut = store.state else {
            return XCTFail("Expected local session to be cleared despite remote sign-out failure")
        }
        let didClearSession = await service.didClearSessionSnapshot()
        XCTAssertTrue(didClearSession)
    }

    private static func makeSession(
        email: String = "athlete@example.com",
        refreshToken: String = "refresh-token"
    ) throws -> StoredSession {
        try StoredSession(
            accessToken: "header.payload.signature",
            accessTokenExpiresIn: 900,
            refreshTokenId: "refresh-token-id",
            refreshToken: refreshToken,
            user: AuthUser(
                avatarUrl: "",
                createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                defaultRole: "user",
                displayName: "Neo Athlete",
                email: email,
                emailVerified: true,
                id: "user-id",
                isAnonymous: false,
                locale: "en",
                metadata: [:],
                phoneNumberVerified: false,
                roles: ["user"]
            ),
            decodedToken: DecodedToken(claims: [:])
        )
    }
}

private enum TestError: Error {
    case remoteSignOutFailed
    case requestFailed
    case verifyFailed
}

private actor FakeAuthService: AuthServicing {
    private var session: StoredSession?
    private var subscribers: [UUID: @Sendable (StoredSession?) async -> Void] = [:]
    private let signOutError: Error?
    private let requestError: Error?
    private let verifyError: Error?
    private var verifySession: StoredSession?
    private(set) var signInRequests: [String] = []
    private(set) var signUpRequests: [(email: String, displayName: String)] = []
    private(set) var verifyRequests: [(email: String, otp: String)] = []
    private(set) var signOutRefreshTokens: [String?] = []
    private(set) var didClearSession = false

    init(
        initialSession: StoredSession? = nil,
        signOutError: Error? = nil,
        requestError: Error? = nil,
        verifyError: Error? = nil,
        verifySession: StoredSession? = nil
    ) {
        session = initialSession
        self.signOutError = signOutError
        self.requestError = requestError
        self.verifyError = verifyError
        self.verifySession = verifySession
    }

    func getUserSession() async throws -> StoredSession? {
        session
    }

    func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription {
        let id = UUID()
        subscribers[id] = handler

        return AuthSessionSubscription { [weak self] in
            await self?.unsubscribe(id)
        }
    }

    func requestSignInOTP(email: String) async throws {
        signInRequests.append(email)
        if let requestError {
            throw requestError
        }
    }

    func requestSignUpOTP(email: String, displayName: String) async throws {
        signUpRequests.append((email: email, displayName: displayName))
        if let requestError {
            throw requestError
        }
    }

    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? {
        verifyRequests.append((email: email, otp: otp))
        if let verifyError {
            throw verifyError
        }
        if let verifySession {
            await updateSession(verifySession)
        }
        return verifySession
    }

    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}

    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { nil }

    func signOut(refreshToken: String?) async throws {
        signOutRefreshTokens.append(refreshToken)
        if let signOutError {
            throw signOutError
        }
    }

    func clearSession() async throws {
        didClearSession = true
        await updateSession(nil)
    }

    func updateSession(_ newSession: StoredSession?) async {
        session = newSession
        for subscriber in subscribers.values {
            await subscriber(newSession)
        }
    }

    func signOutRefreshTokensSnapshot() -> [String?] {
        signOutRefreshTokens
    }

    func didClearSessionSnapshot() -> Bool {
        didClearSession
    }

    func signInRequestsSnapshot() -> [String] {
        signInRequests
    }

    func signUpRequestsSnapshot() -> [(email: String, displayName: String)] {
        signUpRequests
    }

    func verifyRequestsSnapshot() -> [(email: String, otp: String)] {
        verifyRequests
    }

    private func unsubscribe(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }
}
