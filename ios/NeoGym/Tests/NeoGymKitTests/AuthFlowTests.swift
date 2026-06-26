import XCTest
import Nhost
@testable import NeoGymKit

@MainActor
final class ValidationTests: XCTestCase {
    func testEmailValidationTrimsAndRejectsInvalidInput() throws {
        XCTAssertEqual(try AuthValidation.normalizedEmail(" athlete@example.com \n"), "athlete@example.com")
        XCTAssertThrowsError(try AuthValidation.normalizedEmail("not-an-email")) { error in
            XCTAssertEqual(error as? ValidationError, .invalidEmail)
        }
    }

    func testDisplayNameValidationRequiresValueAndCapsLength() throws {
        XCTAssertEqual(try AuthValidation.normalizedDisplayName(" Alex Rivera "), "Alex Rivera")
        XCTAssertThrowsError(try AuthValidation.normalizedDisplayName("   ")) { error in
            XCTAssertEqual(error as? ValidationError, .displayNameRequired)
        }
        XCTAssertThrowsError(try AuthValidation.normalizedDisplayName(String(repeating: "a", count: 61))) { error in
            XCTAssertEqual(error as? ValidationError, .displayNameTooLong(maxLength: 60))
        }
    }

    func testOTPValidationRequiresSixDigits() throws {
        XCTAssertEqual(try AuthValidation.normalizedOTP("123456"), "123456")
        XCTAssertThrowsError(try AuthValidation.normalizedOTP("12345")) { error in
            XCTAssertEqual(error as? ValidationError, .invalidOTP)
        }
        XCTAssertThrowsError(try AuthValidation.normalizedOTP("12345a")) { error in
            XCTAssertEqual(error as? ValidationError, .invalidOTP)
        }
    }
}

@MainActor
final class SignInModelTests: XCTestCase {
    func testSignInRequestStoresSentToAndVerifyReturnsSession() async throws {
        let session = try makeSession(email: "athlete@example.com")
        let service = FakeAuthService(verifySession: session)
        let model = SignInModel(authService: service, email: " athlete@example.com ")

        await model.requestCode()
        XCTAssertEqual(model.sentTo, "athlete@example.com")
        XCTAssertNil(model.errorMessage)
        let signInRequests = await service.signInRequestsSnapshot()
        XCTAssertEqual(signInRequests, ["athlete@example.com"])

        model.updateOTP("123456")
        let verified = await model.verifyCode()

        XCTAssertEqual(verified?.user?.email, "athlete@example.com")
        let verifyRequests = await service.verifyRequestsSnapshot()
        XCTAssertEqual(verifyRequests.map { $0.otp }, ["123456"])
    }

    func testSignInVerifyFailureClearsOTPAndShowsError() async {
        let service = FakeAuthService(verifyError: TestError.verifyFailed)
        let model = SignInModel(authService: service, email: "athlete@example.com")

        await model.requestCode()
        model.updateOTP("123456")
        let verified = await model.verifyCode()

        XCTAssertNil(verified)
        XCTAssertEqual(model.otp, "")
        XCTAssertNotNil(model.errorMessage)
    }

    func testSignInResetClearsCodeState() async {
        let service = FakeAuthService()
        let model = SignInModel(authService: service, email: "athlete@example.com")

        await model.requestCode()
        model.updateOTP("123")
        model.reset()

        XCTAssertNil(model.sentTo)
        XCTAssertEqual(model.otp, "")
        XCTAssertNil(model.errorMessage)
    }
}

@MainActor
final class SignUpModelTests: XCTestCase {
    func testSignUpRequestIncludesDisplayNameAndVerifyReturnsSession() async throws {
        let session = try makeSession(email: "new@example.com", displayName: "Alex Rivera")
        let service = FakeAuthService(verifySession: session)
        let model = SignUpModel(
            authService: service,
            displayName: " Alex Rivera ",
            email: " new@example.com "
        )

        await model.requestCode()
        XCTAssertEqual(model.sentTo, "new@example.com")
        let requests = await service.signUpRequestsSnapshot()
        XCTAssertEqual(requests.map(\.email), ["new@example.com"])
        XCTAssertEqual(requests.map(\.displayName), ["Alex Rivera"])

        model.updateOTP("987654")
        let verified = await model.verifyCode()

        XCTAssertEqual(verified?.user?.displayName, "Alex Rivera")
    }

    func testSignUpValidationFailureDoesNotSendRequest() async {
        let service = FakeAuthService()
        let model = SignUpModel(authService: service, displayName: "", email: "bad")

        await model.requestCode()

        XCTAssertNotNil(model.errorMessage)
        let requests = await service.signUpRequestsSnapshot()
        XCTAssertEqual(requests.count, 0)
    }
}

final class UserProfileTests: XCTestCase {
    func testProfileMapsDisplayNameInitialsAndDate() throws {
        let formatter = UserProfile.defaultMemberSinceFormatter(locale: Locale(identifier: "en_US_POSIX"))
        let profile = UserProfile(
            user: makeUser(
                email: "athlete@example.com",
                displayName: "Neo Athlete",
                createdAt: Date(timeIntervalSince1970: 1_700_000_000)
            ),
            dateFormatter: formatter
        )

        XCTAssertEqual(profile.displayName, "Neo Athlete")
        XCTAssertEqual(profile.emailDisplay, "athlete@example.com")
        XCTAssertEqual(profile.initials, "NA")
        XCTAssertEqual(profile.locale, "en")
        XCTAssertEqual(profile.defaultRole, "user")
        XCTAssertEqual(profile.memberSince, "November 14, 2023")
    }

    func testProfileFallsBackForEmptyValues() {
        let profile = UserProfile(
            user: makeUser(email: nil, defaultRole: "", displayName: "", locale: "")
        )

        XCTAssertEqual(profile.displayName, "Athlete")
        XCTAssertEqual(profile.emailDisplay, "—")
        XCTAssertEqual(profile.initials, "?")
        XCTAssertEqual(profile.locale, "—")
        XCTAssertEqual(profile.defaultRole, "—")
    }

    func testProfileInitialsFallBackToEmail() {
        let profile = UserProfile(user: makeUser(email: "alex@example.com", displayName: ""))

        XCTAssertEqual(profile.displayName, "Athlete")
        XCTAssertEqual(profile.initials, "A")
    }
}

private enum TestError: Error {
    case verifyFailed
}

private actor FakeAuthService: AuthServicing {
    private var session: StoredSession?
    private var subscribers: [UUID: @Sendable (StoredSession?) async -> Void] = [:]
    private let requestError: Error?
    private let verifyError: Error?
    private let verifySession: StoredSession?
    private(set) var signInRequests: [String] = []
    private(set) var signUpRequests: [(email: String, displayName: String)] = []
    private(set) var verifyRequests: [(email: String, otp: String)] = []
    private(set) var didClearSession = false

    init(
        initialSession: StoredSession? = nil,
        requestError: Error? = nil,
        verifyError: Error? = nil,
        verifySession: StoredSession? = nil
    ) {
        session = initialSession
        self.requestError = requestError
        self.verifyError = verifyError
        self.verifySession = verifySession
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

    func requestSignInOTP(email: String) async throws {
        signInRequests.append(email)
        if let requestError { throw requestError }
    }

    func requestSignUpOTP(email: String, displayName: String) async throws {
        signUpRequests.append((email: email, displayName: displayName))
        if let requestError { throw requestError }
    }

    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? {
        verifyRequests.append((email: email, otp: otp))
        if let verifyError { throw verifyError }
        if let verifySession {
            await updateSession(verifySession)
        }
        return verifySession
    }

    func signOut(refreshToken: String?) async throws {}

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

    func signInRequestsSnapshot() -> [String] { signInRequests }

    func signUpRequestsSnapshot() -> [(email: String, displayName: String)] { signUpRequests }

    func verifyRequestsSnapshot() -> [(email: String, otp: String)] { verifyRequests }

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
