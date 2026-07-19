import XCTest
import Nhost
@testable import NeoGymKit

private let testCallbackScheme = "neogym-dev"
private let testCallbackURL = "neogym-dev://verify"

final class AuthDeepLinkTests: XCTestCase {
    func testParsesHostBasedVerificationCode() throws {
        let link = try AuthDeepLink.parse(
            try XCTUnwrap(URL(string: "neogym-dev://verify?code=abc123")),
            callbackScheme: testCallbackScheme
        )

        XCTAssertEqual(link, .code("abc123"))
    }

    func testParsesErrorCallbackWithCamelCaseDescription() throws {
        let link = try AuthDeepLink.parse(
            try XCTUnwrap(URL(string: "neogym-dev://verify?error=access_denied&errorDescription=Denied%20by%20auth")),
            callbackScheme: testCallbackScheme
        )

        XCTAssertEqual(link, .error(code: "access_denied", description: "Denied by auth"))
    }

    func testParsesErrorCallbackWithSnakeCaseDescription() throws {
        let link = try AuthDeepLink.parse(
            try XCTUnwrap(URL(string: "neogym-dev://verify?error=server_error&error_description=Try%20again")),
            callbackScheme: testCallbackScheme
        )

        XCTAssertEqual(link, .error(code: "server_error", description: "Try again"))
    }

    func testRejectsMissingCode() throws {
        XCTAssertThrowsError(try AuthDeepLink.parse(
            try XCTUnwrap(URL(string: "neogym-dev://verify")),
            callbackScheme: testCallbackScheme
        )) { error in
            XCTAssertEqual(error as? AuthDeepLinkParseError, .missingCode)
        }
    }

    func testRejectsMalformedSchemeHostAndPath() throws {
        let unsupportedURLs = [
            "neogym-dev:/verify?code=abc123",
            "neogym-dev://other?code=abc123",
            "neogym-dev://verify/extra?code=abc123",
            "https://localhost:5173/verify?code=abc123"
        ]

        for rawURL in unsupportedURLs {
            XCTAssertThrowsError(try AuthDeepLink.parse(
                try XCTUnwrap(URL(string: rawURL)),
                callbackScheme: testCallbackScheme
            ), rawURL) { error in
                XCTAssertEqual(error as? AuthDeepLinkParseError, .unsupportedURL)
            }
        }
    }
}

final class PKCEVerifierStoreTests: XCTestCase {
    func testInMemoryVerifierSetGetClear() async throws {
        let store = InMemoryPKCEVerifierStore()

        let initialVerifier = try await store.loadVerifier()
        XCTAssertNil(initialVerifier)

        try await store.saveVerifier("verifier")
        let savedVerifier = try await store.loadVerifier()
        XCTAssertEqual(savedVerifier, "verifier")

        try await store.clearVerifier()
        let clearedVerifier = try await store.loadVerifier()
        XCTAssertNil(clearedVerifier)
    }
}

@MainActor
final class ChangeEmailModelTests: XCTestCase {
    func testRequestPersistsVerifierAndCallsChangeEmailWithNativeRedirect() async throws {
        let verifierStore = InMemoryPKCEVerifierStore()
        let service = EmailChangeFakeAuthService()
        let model = ChangeEmailModel(
            authService: service,
            verifierStore: verifierStore,
            currentEmail: "old@example.com",
            newEmail: " new@example.com ",
            redirectTo: testCallbackURL,
            callbackScheme: testCallbackScheme,
            generatePKCEPair: { PKCEPair(verifier: "verifier", challenge: "challenge") }
        )

        await model.requestEmailChange()

        XCTAssertEqual(model.sentTo, "new@example.com")
        XCTAssertEqual(model.successMessage, "Check new@example.com for the verification link.")
        let savedVerifier = try await verifierStore.loadVerifier()
        XCTAssertEqual(savedVerifier, "verifier")
        let requests = await service.emailChangeRequestsSnapshot()
        XCTAssertEqual(requests.map(\.newEmail), ["new@example.com"])
        XCTAssertEqual(requests.map(\.redirectTo), [testCallbackURL])
        XCTAssertEqual(requests.map(\.codeChallenge), ["challenge"])
    }

    func testSameEmailGuardDoesNotPersistOrRequest() async throws {
        let verifierStore = InMemoryPKCEVerifierStore()
        let service = EmailChangeFakeAuthService()
        let model = ChangeEmailModel(
            authService: service,
            verifierStore: verifierStore,
            currentEmail: "Athlete@Example.com",
            newEmail: " athlete@example.com ",
            redirectTo: testCallbackURL,
            callbackScheme: testCallbackScheme,
            generatePKCEPair: { PKCEPair(verifier: "verifier", challenge: "challenge") }
        )

        await model.requestEmailChange()

        XCTAssertEqual(model.errorMessage, ChangeEmailModelError.sameEmail.errorDescription)
        let savedVerifier = try await verifierStore.loadVerifier()
        XCTAssertNil(savedVerifier)
        let requests = await service.emailChangeRequestsSnapshot()
        XCTAssertEqual(requests.count, 0)
    }

    func testVerifierClearedOnCallbackSuccessAndAuthStoreUpdatesFromSessionSubscription() async throws {
        let session = try makeSession(email: "updated@example.com")
        let verifierStore = InMemoryPKCEVerifierStore(verifier: "saved-verifier")
        let service = EmailChangeFakeAuthService(exchangeSession: session)
        let authStore = AuthStore(authService: service, autoBootstrap: false)
        await authStore.bootstrap()
        let model = ChangeEmailModel(
            authService: service,
            verifierStore: verifierStore,
            currentEmail: "old@example.com",
            redirectTo: testCallbackURL,
            callbackScheme: testCallbackScheme
        )

        let exchangedSession = await model.handleCallback(
            url: try XCTUnwrap(URL(string: "neogym-dev://verify?code=auth-code"))
        )

        XCTAssertEqual(exchangedSession?.user?.email, "updated@example.com")
        XCTAssertEqual(authStore.state.session?.user?.email, "updated@example.com")
        let savedVerifier = try await verifierStore.loadVerifier()
        XCTAssertNil(savedVerifier)
        XCTAssertEqual(model.successMessage, "Your email address was updated.")
        let requests = await service.exchangeRequestsSnapshot()
        XCTAssertEqual(requests.map(\.code), ["auth-code"])
        XCTAssertEqual(requests.map(\.codeVerifier), ["saved-verifier"])
    }

    func testVerifierClearedOnCallbackFailure() async throws {
        let verifierStore = InMemoryPKCEVerifierStore(verifier: "saved-verifier")
        let service = EmailChangeFakeAuthService(exchangeError: TestError.exchangeFailed)
        let model = ChangeEmailModel(
            authService: service,
            verifierStore: verifierStore,
            currentEmail: "old@example.com",
            redirectTo: testCallbackURL,
            callbackScheme: testCallbackScheme
        )

        let session = await model.handleCallback(
            url: try XCTUnwrap(URL(string: "neogym-dev://verify?code=bad-code"))
        )

        XCTAssertNil(session)
        let savedVerifier = try await verifierStore.loadVerifier()
        XCTAssertNil(savedVerifier)
        XCTAssertNotNil(model.errorMessage)
    }

    func testCallbackErrorAndMissingVerifierSurfaceErrorsAndClearVerifier() async throws {
        let verifierStore = InMemoryPKCEVerifierStore(verifier: "saved-verifier")
        let service = EmailChangeFakeAuthService()
        let model = ChangeEmailModel(
            authService: service,
            verifierStore: verifierStore,
            currentEmail: "old@example.com",
            redirectTo: testCallbackURL,
            callbackScheme: testCallbackScheme
        )

        let errorSession = await model.handleCallback(
            url: try XCTUnwrap(URL(string: "neogym-dev://verify?error=access_denied&error_description=Denied"))
        )
        XCTAssertNil(errorSession)
        XCTAssertEqual(model.errorMessage, "Denied")
        let savedVerifier = try await verifierStore.loadVerifier()
        XCTAssertNil(savedVerifier)

        let missingVerifierSession = await model.handleCallback(
            url: try XCTUnwrap(URL(string: "neogym-dev://verify?code=auth-code"))
        )
        XCTAssertNil(missingVerifierSession)
        XCTAssertEqual(model.errorMessage, ChangeEmailModelError.missingVerifier.errorDescription)
    }
}

private enum TestError: Error {
    case exchangeFailed
}

private struct EmailChangeRequest: Equatable {
    let newEmail: String
    let redirectTo: String
    let codeChallenge: String
}

private struct ExchangeRequest: Equatable {
    let code: String
    let codeVerifier: String
}

private actor EmailChangeFakeAuthService: AuthServicing {
    private var session: StoredSession?
    private var subscribers: [UUID: @Sendable (StoredSession?) async -> Void] = [:]
    private let exchangeSession: StoredSession?
    private let exchangeError: Error?
    private(set) var emailChangeRequests: [EmailChangeRequest] = []
    private(set) var exchangeRequests: [ExchangeRequest] = []

    init(
        initialSession: StoredSession? = nil,
        exchangeSession: StoredSession? = nil,
        exchangeError: Error? = nil
    ) {
        session = initialSession
        self.exchangeSession = exchangeSession
        self.exchangeError = exchangeError
    }

    func getUserSession() async throws -> StoredSession? { session }

    func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription {
        let id = UUID()
        subscribers[id] = handler
        return AuthSessionSubscription { [weak self] in
            await self?.unsubscribe(id)
        }
    }

    func requestSignInOTP(email: String) async throws {}

    func requestSignUpOTP(email: String, displayName: String) async throws {}

    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? { nil }

    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {
        emailChangeRequests.append(
            EmailChangeRequest(newEmail: newEmail, redirectTo: redirectTo, codeChallenge: codeChallenge)
        )
    }

    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? {
        exchangeRequests.append(ExchangeRequest(code: code, codeVerifier: codeVerifier))
        if let exchangeError { throw exchangeError }
        if let exchangeSession {
            await updateSession(exchangeSession)
        }
        return exchangeSession
    }

    func signOut(refreshToken: String?) async throws {}

    func clearSession() async throws {
        await updateSession(nil)
    }

    func updateSession(_ newSession: StoredSession?) async {
        session = newSession
        for subscriber in subscribers.values {
            await subscriber(newSession)
        }
    }

    func emailChangeRequestsSnapshot() -> [EmailChangeRequest] {
        emailChangeRequests
    }

    func exchangeRequestsSnapshot() -> [ExchangeRequest] {
        exchangeRequests
    }

    private func unsubscribe(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }
}

private func makeSession(
    email: String = "athlete@example.com",
    displayName: String = "Neo Athlete",
    refreshToken: String = "refresh-token"
) throws -> StoredSession {
    try StoredSession(
        accessToken: "header.payload.signature",
        accessTokenExpiresIn: 900,
        refreshTokenId: "refresh-token-id",
        refreshToken: refreshToken,
        user: makeUser(email: email, displayName: displayName),
        decodedToken: DecodedToken(claims: [:])
    )
}

private func makeUser(
    email: String? = "athlete@example.com",
    defaultRole: String = "user",
    displayName: String = "Neo Athlete",
    locale: String = "en",
    createdAt: Date = Date(timeIntervalSince1970: 1_700_000_000)
) -> AuthUser {
    AuthUser(
        avatarUrl: "",
        createdAt: createdAt,
        defaultRole: defaultRole,
        displayName: displayName,
        email: email,
        emailVerified: true,
        id: "user-id",
        isAnonymous: false,
        locale: locale,
        metadata: [:],
        phoneNumberVerified: false,
        roles: ["user"]
    )
}
