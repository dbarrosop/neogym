import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
final class AssistedSignInModelTests: XCTestCase {
    // Deliberately in the past: handoff and account expiry checks must use the same injected clock.
    private let date = Date(timeIntervalSince1970: 1_600_000_000)

    func testPhoneIssuesOnePATForLiveRequestAndDropsSecretAfterAcknowledgement() async throws {
        let pat = FakePAT()
        var sent: [WatchAssistedSignInMessage] = []
        let model = PhoneAssistedSignInModel(pat: pat, now: { self.date }) { message, _ in sent.append(message) }
        model.observe(.signedIn(try session(id: "first")))
        let id = UUID()
        model.receive(.request(id), receivedAt: date)
        await model.connect()
        await model.connect() // A failed delivery can be resent without minting another PAT.
        let creates = await pat.creates
        XCTAssertEqual(creates, 1)
        guard case .credential(id, let credential) = sent.last else { return XCTFail("Missing PAT") }
        XCTAssertEqual(credential.userID, "first")
        XCTAssertEqual(credential.expiresAt, date.addingTimeInterval(90 * 24 * 60 * 60))
        model.receive(.result(id, succeeded: true), receivedAt: date)
        XCTAssertNil(model.pending)
        XCTAssertTrue(model.connected)
        model.receive(.result(id, succeeded: false), receivedAt: date)
        XCTAssertTrue(model.connected)
        model.observe(.signedIn(try session(id: "second")))
        XCTAssertFalse(model.connected)
    }

    func testPhoneRefusesOldRequestAndClearsPendingOnSignOut() async throws {
        let pat = FakePAT()
        let model = PhoneAssistedSignInModel(pat: pat, now: { self.date }) { _, _ in }
        model.receive(.request(UUID()), receivedAt: date.addingTimeInterval(-600))
        model.observe(.signedIn(try session(id: "first")))
        XCTAssertNil(model.pending)
        model.receive(.request(UUID()), receivedAt: date)
        XCTAssertNotNil(model.pending)
        model.observe(.signedOut)
        XCTAssertNil(model.pending)
        await model.connect()
        let creates = await pat.creates
        XCTAssertEqual(creates, 0)
    }

    func testWatchAcceptsOnlyMatchingPATAndRecoversWithoutPhoneNetwork() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        var sent: [WatchAssistedSignInMessage] = []
        let sender = WatchAssistedSignInModel(account: account, now: { self.date }) { message, _ in sent.append(message) }
        sender.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing watch request") }
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        let otherID = UUID()
        XCTAssertFalse(sender.receive(.credential(otherID, credential)))
        XCTAssertEqual(sent.last, .result(otherID, succeeded: false))
        XCTAssertFalse(sender.receive(.credential(id, WatchPATCredential(userID: "other", token: credential.token,
                                                                          expiresAt: credential.expiresAt))))
        XCTAssertEqual(sent.last, .result(id, succeeded: false))
        XCTAssertTrue(sender.receive(.credential(id, credential)))
        let connected = await sender.connect()
        XCTAssertTrue(connected)
        XCTAssertEqual(try store.load(), credential)
        XCTAssertEqual(sent.last, .result(id, succeeded: true))
        // SDK session can be gone after a failed refresh: the PAT can mint a new one.
        let recovered = await account.recoverUsingPAT()
        XCTAssertTrue(recovered)
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 2)
    }

    func testWatchAccountRejectsPATAtInjectedExpiry() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        let expired = WatchPATCredential(userID: "first", token: UUID().uuidString, expiresAt: date)
        let accepted = await account.acceptPAT(expired)
        XCTAssertFalse(accepted)
        XCTAssertNil(try store.load())

        try store.save(expired)
        let recovered = await account.recoverUsingPAT()
        XCTAssertFalse(recovered)
        XCTAssertNil(try store.load())
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testWatchRecoveryRejectsDifferentPhoneAndSignOutErasesPAT() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        try store.save(WatchPATCredential(userID: "first", token: UUID().uuidString,
                                          expiresAt: date.addingTimeInterval(3600)))
        account.receiveContext(PhoneAccountHint.signedIn(userID: "other").context)
        XCTAssertNil(try store.load())
        let recovered = await account.recoverUsingPAT()
        XCTAssertFalse(recovered)
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
        account.receiveContext(PhoneAccountHint.signedIn(userID: "first").context)
        try store.save(WatchPATCredential(userID: "first", token: UUID().uuidString,
                                          expiresAt: date.addingTimeInterval(3600)))
        await account.signOut()
        XCTAssertNil(try store.load())
        let retried = await account.recoverUsingPAT()
        XCTAssertFalse(retried)
    }

    func testCancellingWatchHandoffRejectsLateCredential() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { self.date }) { message, _ in sent.append(message) }
        model.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing request") }
        model.cancel()
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        XCTAssertFalse(model.receive(.credential(id, credential)))
        XCTAssertEqual(sent.last, .result(id, succeeded: false))
        let connected = await model.connect()
        XCTAssertFalse(connected)
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testFreshPhoneHandoffCanReconnectAfterWatchOnlySignOut() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        await account.signOut()
        XCTAssertEqual(account.state, .matchPhone)
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        let accepted = await account.acceptPAT(credential)
        XCTAssertTrue(accepted)
        XCTAssertEqual(try store.load(), credential)
    }

    func testWatchRejectsWrongUserReturnedByPATAndErasesCredential() async throws {
        let pat = FakePAT(verified: try session(id: "other"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        let accepted = await account.acceptPAT(credential)
        XCTAssertFalse(accepted)
        XCTAssertNil(try store.load())
        XCTAssertNil(account.currentUser)
    }

    func testSignedOutPhoneHintErasesSavedPATWithoutAWatchSession() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let store = MemoryPATStore()
        let account = await makeAccount(pat: pat, store: store)
        try store.save(WatchPATCredential(userID: "first", token: UUID().uuidString,
                                          expiresAt: date.addingTimeInterval(3600)))
        account.receiveContext(PhoneAccountHint.signedOut.context)
        XCTAssertNil(try store.load())
        let recovered = await account.recoverUsingPAT()
        XCTAssertFalse(recovered)
    }

    func testExpiredHandoffAndBlockedPhoneAccountReplyWithoutSigningIn() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        var clock = date
        let account = await makeAccount(pat: pat, store: MemoryPATStore(), now: { clock })
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { clock }) { message, _ in sent.append(message) }
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        model.start()
        guard case .request(let expiredID) = sent.last else { return XCTFail("Missing request") }
        clock.addTimeInterval(600)
        XCTAssertFalse(model.receive(.credential(expiredID, credential)))
        XCTAssertEqual(sent.last, .result(expiredID, succeeded: false))

        model.start()
        guard case .request(let blockedID) = sent.last else { return XCTFail("Missing request") }
        account.receiveContext(PhoneAccountHint.signedOut.context)
        XCTAssertFalse(model.receive(.credential(blockedID, credential)))
        XCTAssertEqual(sent.last, .result(blockedID, succeeded: false))
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testExpiredCredentialRepliesWithoutSigningIn() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let account = await makeAccount(pat: pat, store: MemoryPATStore())
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { self.date }) { message, _ in sent.append(message) }
        model.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing request") }
        let expired = WatchPATCredential(userID: "first", token: UUID().uuidString, expiresAt: date)
        XCTAssertFalse(model.receive(.credential(id, expired)))
        XCTAssertEqual(sent.last, .result(id, succeeded: false))
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testConnectPrecheckRepliesAndClearsConnectingStatusAfterAccountSwitch() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        let account = await makeAccount(pat: pat, store: MemoryPATStore())
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { self.date }) { message, _ in sent.append(message) }
        model.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing request") }
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        XCTAssertTrue(model.receive(.credential(id, credential)))
        account.receiveContext(PhoneAccountHint.signedIn(userID: "second").context)
        let connected = await model.connect()
        XCTAssertFalse(connected)
        XCTAssertEqual(sent.last, .result(id, succeeded: false))
        XCTAssertEqual(model.status, "Could not connect. Keep both apps open and try again.")
        XCTAssertFalse(model.isConnecting)
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testConnectPrecheckRepliesWhenAttemptExpiresAfterReceipt() async throws {
        let pat = FakePAT(verified: try session(id: "first"))
        var clock = date
        let account = await makeAccount(pat: pat, store: MemoryPATStore(), now: { clock })
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { clock }) { message, _ in sent.append(message) }
        model.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing request") }
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        XCTAssertTrue(model.receive(.credential(id, credential)))
        clock.addTimeInterval(600)
        let connected = await model.connect()
        XCTAssertFalse(connected)
        XCTAssertEqual(sent.last, .result(id, succeeded: false))
        XCTAssertEqual(model.status, "Could not connect. Keep both apps open and try again.")
        let signIns = await pat.signIns
        XCTAssertEqual(signIns, 0)
    }

    func testDuplicateDuringInFlightPATSignInDoesNotContradictFinalSuccess() async throws {
        let gate = FakeSignInGate()
        let pat = FakePAT(verified: try session(id: "first"), signInGate: gate)
        let account = await makeAccount(pat: pat, store: MemoryPATStore())
        var sent: [WatchAssistedSignInMessage] = []
        let model = WatchAssistedSignInModel(account: account, now: { self.date }) { message, _ in sent.append(message) }
        model.start()
        guard case .request(let id) = sent.last else { return XCTFail("Missing request") }
        let credential = WatchPATCredential(userID: "first", token: UUID().uuidString,
                                            expiresAt: date.addingTimeInterval(3600))
        XCTAssertTrue(model.receive(.credential(id, credential)))
        let connecting = Task { await model.connect() }
        await gate.waitUntilStarted()
        XCTAssertFalse(model.receive(.credential(id, credential)))
        XCTAssertEqual(sent, [.request(id)])
        let unrelatedID = UUID()
        XCTAssertFalse(model.receive(.credential(unrelatedID, credential)))
        XCTAssertEqual(sent.last, .result(unrelatedID, succeeded: false))
        await gate.finish()
        let connected = await connecting.value
        XCTAssertTrue(connected)
        XCTAssertEqual(sent.last, .result(id, succeeded: true))
    }

    private func makeAccount(pat: FakePAT, store: MemoryPATStore) async -> WatchAccountModel {
        await makeAccount(pat: pat, store: store, now: { self.date })
    }

    private func makeAccount(pat: FakePAT, store: MemoryPATStore,
                             now: @escaping @MainActor () -> Date) async -> WatchAccountModel {
        let account = WatchAccountModel(authStore: AuthStore(authService: FakeAuth(), autoBootstrap: false),
                                        currentUser: FakeUser(), patService: pat, patStore: store, now: now)
        account.localContextReady(PhoneAccountHint.signedIn(userID: "first").context)
        await account.bootstrap()
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

private final class MemoryPATStore: WatchPATStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var saved: WatchPATCredential?
    func load() throws -> WatchPATCredential? { lock.lock(); defer { lock.unlock() }; return saved }
    func save(_ credential: WatchPATCredential) throws { lock.lock(); defer { lock.unlock() }; saved = credential }
    func clear() throws { lock.lock(); defer { lock.unlock() }; saved = nil }
}

private actor FakePAT: WatchPATServicing {
    private let verified: StoredSession?
    private let signInGate: FakeSignInGate?
    private(set) var creates = 0
    private(set) var signIns = 0
    init(verified: StoredSession? = nil, signInGate: FakeSignInGate? = nil) {
        self.verified = verified
        self.signInGate = signInGate
    }
    func create(expiresAt: Date) async throws -> String { creates += 1; return UUID().uuidString }
    func signIn(token: String) async throws -> StoredSession? {
        signIns += 1
        if let signInGate { await signInGate.wait() }
        return verified
    }
}

private actor FakeSignInGate {
    private var started = false
    private var startedWaiter: CheckedContinuation<Void, Never>?
    private var signInWaiter: CheckedContinuation<Void, Never>?

    func waitUntilStarted() async {
        if started { return }
        await withCheckedContinuation { startedWaiter = $0 }
    }

    func wait() async {
        started = true
        startedWaiter?.resume()
        startedWaiter = nil
        await withCheckedContinuation { signInWaiter = $0 }
    }

    func finish() {
        signInWaiter?.resume()
        signInWaiter = nil
    }
}

private struct FakeUser: CurrentUserServicing {
    func getUser() async throws -> CurrentWatchUser { CurrentWatchUser(id: "first", displayName: "Athlete") }
}

private actor FakeAuth: AuthServicing {
    func getUserSession() async throws -> StoredSession? { nil }
    func subscribeToSessionChanges(_ handler: @escaping @Sendable (StoredSession?) async -> Void) async -> AuthSessionSubscription {
        AuthSessionSubscription(cancel: {})
    }
    func requestSignInOTP(email: String) async throws {}
    func requestSignUpOTP(email: String, displayName: String) async throws {}
    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? { nil }
    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}
    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { nil }
    func signOut(refreshToken: String?) async throws {}
    func clearSession() async throws {}
}
