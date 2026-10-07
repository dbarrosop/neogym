import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
final class AssistedSignInModelTests: XCTestCase {
    func testPhoneSuccessEndsAttemptAndUserSwitchDiscardsPendingRequest() throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date
        var messages: [WatchAssistedSignInMessage] = []
        let model = PhoneAssistedSignInModel(now: { clock }) { message, _ in messages.append(message) }
        model.observe(.signedIn(try session(id: "first")))
        let first = UUID()
        model.receive(.request(first), receivedAt: date)
        XCTAssertEqual(model.pending?.id, first)
        model.receive(.result(UUID(), succeeded: true), receivedAt: date)
        XCTAssertEqual(model.pending?.id, first)
        model.receive(.result(first, succeeded: true), receivedAt: date)
        XCTAssertNil(model.pending)
        XCTAssertTrue(model.verificationSucceeded)
        model.receive(.result(first, succeeded: false), receivedAt: date)
        XCTAssertTrue(model.verificationSucceeded)
        let second = UUID()
        model.receive(.request(second), receivedAt: date)
        XCTAssertFalse(model.verificationSucceeded)
        model.observe(.signedIn(try session(id: "second")))
        XCTAssertNil(model.pending)
        model.receive(.result(second, succeeded: true), receivedAt: date)
        XCTAssertFalse(model.verificationSucceeded)
        clock = date.addingTimeInterval(600)
        model.receive(.request(UUID()), receivedAt: date)
        XCTAssertNil(model.pending)
        XCTAssertTrue(messages.isEmpty)
    }

    func testPhoneSendsChallengeAndCodeOnlyForLiveAttempt() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date
        var messages: [WatchAssistedSignInMessage] = []
        let auth = AssistedAuth()
        let model = PhoneAssistedSignInModel(now: { clock }) { message, _ in messages.append(message) }
        model.observe(.signedIn(try session(id: "first")))
        let id = UUID()
        model.receive(.request(id), receivedAt: date)
        await model.requestCode(using: auth)
        XCTAssertEqual(messages.last, .challenge(id, email: "a@example.test", userID: "first"))
        model.sendCode("123456")
        XCTAssertEqual(messages.last, .code(id, otp: "123456"))
        clock = date.addingTimeInterval(600)
        model.sendCode("123456")
        XCTAssertNil(model.pending)
        XCTAssertEqual(messages.count, 2)
    }

    func testPhoneDeliveryFailureResetsCodeAndLateFailureCannotUndoSuccess() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let auth = AssistedAuth()
        var messages: [WatchAssistedSignInMessage] = []
        let model = PhoneAssistedSignInModel(now: { date }) { message, _ in messages.append(message) }
        model.observe(.signedIn(try session(id: "first")))
        let id = UUID()
        model.receive(.request(id), receivedAt: date)
        await model.requestCode(using: auth)
        guard let attempt = model.pending else { return XCTFail("No pending request") }
        model.sendCode("123456")
        XCTAssertTrue(model.codeSent)
        model.deliveryFailed(for: attempt)
        XCTAssertFalse(model.codeSent)
        XCTAssertNotNil(model.errorMessage)
        XCTAssertEqual(model.pending, attempt)
        model.sendCode("123456")
        XCTAssertEqual(messages.count, 3)
        XCTAssertEqual(messages.last, .code(id, otp: "123456"))
        model.receive(.result(id, succeeded: true), receivedAt: date)
        model.deliveryFailed(for: attempt)
        XCTAssertTrue(model.verificationSucceeded)
        XCTAssertNil(model.pending)
        XCTAssertNil(model.errorMessage)
    }

    func testPhoneRestorationUsesOriginalReceiptAndRejectsExpiredRequest() throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date.addingTimeInterval(600)
        let model = PhoneAssistedSignInModel(now: { clock }) { _, _ in }
        model.receive(.request(UUID()), receivedAt: date)
        model.observe(.signedIn(try session(id: "first")))
        XCTAssertNil(model.pending)
        clock = date
        let id = UUID()
        model.receive(.request(id), receivedAt: date)
        XCTAssertEqual(model.pending?.id, id)
        clock = date.addingTimeInterval(600)
        model.expireAttempt()
        XCTAssertNil(model.pending)
    }

    func testWatchRejectsWrongChallengeAndCodeWithoutLiveChallengeOrAfterExpiry() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date
        let auth = AssistedAuth()
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { clock }) { message, _ in
            messages.append(message)
        }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        XCTAssertFalse(model.receive(.challenge(UUID(), email: "a@example.test", userID: "first")))
        XCTAssertFalse(model.receive(.challenge(id, email: "a@example.test", userID: "other")))
        XCTAssertFalse(model.receive(.code(id, otp: "123456")))
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
        XCTAssertFalse(model.receive(.challenge(id, email: "a@example.test", userID: "first")))
        clock = date.addingTimeInterval(600)
        XCTAssertFalse(model.receive(.code(id, otp: "123456")))
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
        let verifies = await auth.verifyCount()
        XCTAssertEqual(verifies, 0)
    }

    func testWatchRejectsAccountSwitchBeforeAttemptExpires() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let auth = AssistedAuth()
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { date }) { message, _ in
            messages.append(message)
        }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        XCTAssertFalse(model.receive(.challenge(id, email: "a@example.test", userID: "first")))
        account.receiveContext(PhoneAccountHint.signedIn(userID: "second").context)
        XCTAssertFalse(model.receive(.code(id, otp: "123456")))
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
        let verifies = await auth.verifyCount()
        XCTAssertEqual(verifies, 0)
    }

    func testWatchAcceptsMatchingSessionEvenIfAuthPersistedBeforeVerifyReturns() async throws {
        let auth = AssistedAuth(verified: try session(id: "first"), publishVerified: true)
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account) { message, _ in messages.append(message) }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        _ = model.receive(.challenge(id, email: "a@example.test", userID: "first"))
        XCTAssertTrue(model.receive(.code(id, otp: "123456")))
        let accepted = await model.verify()
        XCTAssertTrue(accepted)
        let clears = await auth.clearCount()
        XCTAssertEqual(clears, 0)
        XCTAssertEqual(messages.last, .result(id, succeeded: true))
    }

    func testWatchDoesNotSpendCodeIfAttemptExpiresBeforeAuthStarts() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date
        let auth = AssistedAuth(verified: try session(id: "first"))
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { clock }) { message, _ in
            messages.append(message)
        }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        _ = model.receive(.challenge(id, email: "a@example.test", userID: "first"))
        XCTAssertTrue(model.receive(.code(id, otp: "123456")))
        clock = date.addingTimeInterval(600)
        let accepted = await model.verify()
        XCTAssertFalse(accepted)
        let verifies = await auth.verifyCount()
        let clears = await auth.clearCount()
        XCTAssertEqual(verifies, 0)
        XCTAssertEqual(clears, 0)
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
    }

    func testWatchClearsSessionWhenPhoneChangesDuringVerification() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let auth = AssistedAuth(verified: try session(id: "first"), pauseVerification: true)
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { date }) { message, _ in
            messages.append(message)
        }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        _ = model.receive(.challenge(id, email: "a@example.test", userID: "first"))
        XCTAssertTrue(model.receive(.code(id, otp: "123456")))
        let verification = Task { await model.verify() }
        await auth.waitForVerification()
        account.receiveContext(PhoneAccountHint.signedIn(userID: "second").context)
        await auth.resumeVerification()
        let accepted = await verification.value
        XCTAssertFalse(accepted)
        let clears = await auth.clearCount()
        XCTAssertEqual(clears, 1)
        XCTAssertNil(account.currentUser)
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
    }

    func testWatchClearsSessionWhenVerificationFinishesAfterExpiry() async throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        var clock = date
        let auth = AssistedAuth(verified: try session(id: "first"), pauseVerification: true)
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { clock }) { message, _ in
            messages.append(message)
        }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        _ = model.receive(.challenge(id, email: "a@example.test", userID: "first"))
        XCTAssertTrue(model.receive(.code(id, otp: "123456")))
        let verification = Task { await model.verify() }
        await auth.waitForVerification()
        clock = date.addingTimeInterval(600)
        await auth.resumeVerification()
        let accepted = await verification.value
        XCTAssertFalse(accepted)
        let verifies = await auth.verifyCount()
        let clears = await auth.clearCount()
        XCTAssertEqual(verifies, 1)
        XCTAssertEqual(clears, 1)
        XCTAssertNil(account.currentUser)
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
    }

    func testWatchClearsPersistedOtherAccountBeforeReportingFailure() async throws {
        let auth = AssistedAuth(verified: try session(id: "other"))
        let account = await watchAccount(auth: auth)
        var messages: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account) { message, _ in messages.append(message) }
        model.start()
        guard case .request(let id) = messages.last else { return XCTFail("No request") }
        _ = model.receive(.challenge(id, email: "a@example.test", userID: "first"))
        XCTAssertTrue(model.receive(.code(id, otp: "123456")))
        let accepted = await model.verify()
        XCTAssertFalse(accepted)
        let clears = await auth.clearCount()
        XCTAssertEqual(clears, 1)
        XCTAssertNil(account.currentUser)
        XCTAssertEqual(messages.last, .result(id, succeeded: false))
    }

    private func watchAccount(auth: AssistedAuth) async -> WatchAccountModel {
        let account = WatchAccountModel(authStore: AuthStore(authService: auth, autoBootstrap: false),
                                        currentUser: AssistedUser())
        await account.bootstrap()
        account.localContextReady(PhoneAccountHint.signedIn(userID: "first").context)
        return account
    }

    private func session(id: String) throws -> StoredSession {
        try StoredSession(
            accessToken: "header.payload.signature", accessTokenExpiresIn: 900,
            refreshTokenId: "id", refreshToken: "refresh",
            user: AuthUser(avatarUrl: "", createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                           defaultRole: "user", displayName: "Athlete", email: "a@example.test",
                           emailVerified: true, id: id, isAnonymous: false, locale: "en",
                           metadata: [:], phoneNumberVerified: false, roles: ["user"]),
            decodedToken: DecodedToken(claims: [:])
        )
    }
}

private struct AssistedUser: CurrentUserServicing {
    func getUser() async throws -> CurrentWatchUser {
        CurrentWatchUser(id: "first", displayName: "Athlete")
    }
}

private actor AssistedAuth: AuthServicing {
    let verified: StoredSession?
    let publishVerified: Bool
    let pauseVerification: Bool
    private var subscriber: (@Sendable (StoredSession?) async -> Void)?
    private var clears = 0
    private var verifies = 0
    private var verificationWaiters: [CheckedContinuation<Void, Never>] = []
    private var verificationRelease: CheckedContinuation<Void, Never>?
    init(verified: StoredSession? = nil, publishVerified: Bool = false, pauseVerification: Bool = false) {
        self.verified = verified
        self.publishVerified = publishVerified
        self.pauseVerification = pauseVerification
    }
    func getUserSession() async throws -> StoredSession? { nil }
    func subscribeToSessionChanges(_ handler: @escaping @Sendable (StoredSession?) async -> Void) async -> AuthSessionSubscription {
        subscriber = handler
        return AuthSessionSubscription(cancel: {})
    }
    func requestSignInOTP(email: String) async throws {}
    func requestSignUpOTP(email: String, displayName: String) async throws {}
    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? {
        verifies += 1
        if pauseVerification {
            await withCheckedContinuation { continuation in
                verificationRelease = continuation
                let waiters = verificationWaiters
                verificationWaiters.removeAll()
                waiters.forEach { $0.resume() }
            }
        }
        if publishVerified { await subscriber?(verified) }
        return verified
    }
    func waitForVerification() async {
        if verificationRelease != nil { return }
        await withCheckedContinuation { verificationWaiters.append($0) }
    }
    func resumeVerification() {
        verificationRelease?.resume()
        verificationRelease = nil
    }
    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}
    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { nil }
    func signOut(refreshToken: String?) async throws {}
    func clearSession() async throws { clears += 1 }
    func clearCount() -> Int { clears }
    func verifyCount() -> Int { verifies }
}
