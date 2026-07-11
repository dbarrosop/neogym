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

    func testDefinitiveSignedOutBootstrapRequestsSnapshotClear() async {
        let service = FakeAuthService()
        var clearReasons: [AuthSnapshotClearReason] = []
        let store = AuthStore(authService: service, autoBootstrap: false) { reason in
            clearReasons.append(reason)
        }

        await store.bootstrap()

        XCTAssertEqual(clearReasons, [.signedOutBootstrap])
    }

    func testBootstrapAuthErrorRequestsSnapshotClear() async {
        let service = FakeAuthService(bootstrapError: TestError.requestFailed)
        var clearReasons: [AuthSnapshotClearReason] = []
        let store = AuthStore(authService: service, autoBootstrap: false) { reason in
            clearReasons.append(reason)
        }

        await store.bootstrap()

        XCTAssertEqual(clearReasons, [.authError])
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
        var clearReasons: [AuthSnapshotClearReason] = []
        let store = AuthStore(authService: service, autoBootstrap: false) { reason in
            clearReasons.append(reason)
        }
        await store.bootstrap()

        await store.signOut()

        guard case .signedOut = store.state else {
            return XCTFail("Expected local session to be cleared despite remote sign-out failure")
        }
        let didClearSession = await service.didClearSessionSnapshot()
        XCTAssertTrue(didClearSession)
        XCTAssertEqual(clearReasons, [.signOut])
    }

    func testUserSwitchRequestsSnapshotClearBeforeNewUserState() async throws {
        let firstSession = try Self.makeSession(email: "first@example.com", userId: "user-1")
        let secondSession = try Self.makeSession(email: "second@example.com", userId: "user-2")
        let service = FakeAuthService(initialSession: firstSession)
        var clearReasons: [AuthSnapshotClearReason] = []
        let store = AuthStore(authService: service, autoBootstrap: false) { reason in
            clearReasons.append(reason)
        }
        await store.bootstrap()

        await service.updateSession(secondSession)

        XCTAssertEqual(store.state.session?.user?.id, "user-2")
        XCTAssertEqual(clearReasons, [.userSwitch(previousUserMarker: "user-1", nextUserMarker: "user-2")])
    }

    func testSameUserSessionRefreshDoesNotRequestSnapshotClear() async throws {
        let firstSession = try Self.makeSession(email: "first@example.com", userId: "user-1")
        let refreshedSession = try Self.makeSession(email: "renamed@example.com", userId: "user-1")
        let service = FakeAuthService(initialSession: firstSession)
        var clearReasons: [AuthSnapshotClearReason] = []
        let store = AuthStore(authService: service, autoBootstrap: false) { reason in
            clearReasons.append(reason)
        }
        await store.bootstrap()

        await service.updateSession(refreshedSession)

        XCTAssertEqual(store.state.session?.user?.email, "renamed@example.com")
        XCTAssertTrue(clearReasons.isEmpty)
    }

    func testMirroringSessionStorageKeepsPrimaryAppSessionAndMirrorsForWidget() async throws {
        let session = try Self.makeSession(email: "primary@example.com")
        let primary = FakeSessionStorageBackend(initialSession: session)
        let mirror = FakeSessionStorageBackend()
        let storage = MirroringSessionStorageBackend(primary: primary, mirror: mirror)

        let loaded = try await storage.get()

        let primaryEmail = await primary.sessionSnapshot()?.user?.email
        let mirrorEmail = await mirror.sessionSnapshot()?.user?.email

        XCTAssertEqual(loaded?.user?.email, "primary@example.com")
        XCTAssertEqual(primaryEmail, "primary@example.com")
        XCTAssertEqual(mirrorEmail, "primary@example.com")
    }

    func testMirroringSessionStorageKeepsAppSessionWhenMirrorSetFails() async throws {
        let session = try Self.makeSession(email: "safe@example.com")
        let primary = FakeSessionStorageBackend()
        let mirror = FakeSessionStorageBackend(setError: TestError.requestFailed)
        let storage = MirroringSessionStorageBackend(primary: primary, mirror: mirror)

        try await storage.set(session)
        let primaryEmail = await primary.sessionSnapshot()?.user?.email
        let mirrorSession = await mirror.sessionSnapshot()

        XCTAssertEqual(primaryEmail, "safe@example.com")
        XCTAssertNil(mirrorSession)
    }

    func testMirroringSessionStorageCanRestorePrimaryFromMirror() async throws {
        let session = try Self.makeSession(email: "mirror@example.com")
        let primary = FakeSessionStorageBackend()
        let mirror = FakeSessionStorageBackend(initialSession: session)
        let storage = MirroringSessionStorageBackend(primary: primary, mirror: mirror)

        let loaded = try await storage.get()
        let primaryEmail = await primary.sessionSnapshot()?.user?.email

        XCTAssertEqual(loaded?.user?.email, "mirror@example.com")
        XCTAssertEqual(primaryEmail, "mirror@example.com")
    }

    private static func makeSession(
        email: String = "athlete@example.com",
        refreshToken: String = "refresh-token",
        userId: String = "user-id"
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
                id: userId,
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

private actor FakeSessionStorageBackend: SessionStorageBackend {
    private var session: StoredSession?
    private let getError: Error?
    private let setError: Error?
    private let removeError: Error?

    init(
        initialSession: StoredSession? = nil,
        getError: Error? = nil,
        setError: Error? = nil,
        removeError: Error? = nil
    ) {
        session = initialSession
        self.getError = getError
        self.setError = setError
        self.removeError = removeError
    }

    func get() async throws -> StoredSession? {
        if let getError {
            throw getError
        }
        return session
    }

    func set(_ value: StoredSession) async throws {
        if let setError {
            throw setError
        }
        session = value
    }

    func remove() async throws {
        if let removeError {
            throw removeError
        }
        session = nil
    }

    func sessionSnapshot() -> StoredSession? {
        session
    }
}

private actor FakeAuthService: AuthServicing {
    private var session: StoredSession?
    private var subscribers: [UUID: @Sendable (StoredSession?) async -> Void] = [:]
    private let signOutError: Error?
    private let requestError: Error?
    private let verifyError: Error?
    private let bootstrapError: Error?
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
        verifySession: StoredSession? = nil,
        bootstrapError: Error? = nil
    ) {
        session = initialSession
        self.signOutError = signOutError
        self.requestError = requestError
        self.verifyError = verifyError
        self.verifySession = verifySession
        self.bootstrapError = bootstrapError
    }

    func getUserSession() async throws -> StoredSession? {
        if let bootstrapError {
            throw bootstrapError
        }
        return session
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
