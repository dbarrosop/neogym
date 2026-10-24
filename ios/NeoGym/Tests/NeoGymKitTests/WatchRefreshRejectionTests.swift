import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
final class WatchRefreshRejectionTests: XCTestCase {
    func testRefresh400DuringProfileReadAutomaticallyRecovers() async throws {
        let fixture = try await RejectionFixture.make(expired: true)
        await fixture.waitForValidatedProfile()
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 1)
        XCTAssertEqual(counts.user, 1) // The rejected refresh never reaches /user.
        let stored = try await fixture.client.sessionStore.get()
        XCTAssertEqual(stored?.refreshToken, "rotated-fixture")
        XCTAssertNotNil(try fixture.patStore.load())
    }

    func testUnrelated400MalformedResponsesAndTransientErrorsDoNotSignIn() async throws {
        for mode in [RejectionTransport.Mode.profile400, .malformedProfile, .malformedRefresh,
                     .serverError, .offline] {
            let expired = mode != .profile400 && mode != .malformedProfile
            let fixture = try await RejectionFixture.make(expired: expired, mode: mode)
            await fixture.waitUntil { fixture.model.profileError != nil && !fixture.model.isReadingProfile }
            let counts = await fixture.transport.counts()
            XCTAssertEqual(counts.pat, 0, "Unexpected recovery for \(mode)")
            XCTAssertEqual(fixture.model.state, .name("Session fallback"))
            XCTAssertNotNil(try fixture.patStore.load())
        }
    }

    func testGraphQLRefreshRejectionRetainsItsOriginAndCanRecover() async throws {
        let fixture = try await RejectionFixture.make()
        await fixture.waitForValidatedProfile()
        try await fixture.client.sessionStore.set(rejectionSession(expired: true))
        let graphQL = NhostGraphQLService(client: fixture.client)
        do {
            let _: RejectionGraphQLData = try await graphQL.execute(query: "query Probe { __typename }")
            XCTFail("Expected a rejected refresh")
        } catch {
            XCTAssertEqual((error as? GraphQLDomainError)?.transportDiagnostic,
                           .init(kind: .sessionRefresh, code: 400))
            let wrapped = WatchHealthSyncFailure(stage: .backendRead, cause: error)
            let handled = await fixture.model.recoverAfterRefreshRejection(wrapped, for: "watch-user")
            XCTAssertTrue(handled)
        }
        await fixture.waitForValidatedProfile()
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 1)
        XCTAssertEqual(counts.graphQL, 0) // No failed mutation/query is replayed by the account model.
        let _: RejectionGraphQLData = try await graphQL.execute(query: "query Probe { __typename }")
        let recoveredCounts = await fixture.transport.counts()
        XCTAssertEqual(recoveredCounts.graphQL, 1)
    }

    func testForcedRefresh400RecoversEvenWithAnUnexpiredAccessToken() async throws {
        let fixture = try await RejectionFixture.make()
        await fixture.waitForValidatedProfile()
        do {
            _ = try await fixture.client.refreshSession(marginSeconds: 0)
            XCTFail("Expected a rejected forced refresh")
        } catch {
            XCTAssertEqual(error as? WatchAuthRefreshRejection, .badRequest)
            let handled = await fixture.model.recoverAfterRefreshRejection(error, for: "watch-user")
            XCTAssertTrue(handled)
        }
        await fixture.waitForValidatedProfile()
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 1)
    }

    func testRecoveryIsOneShotUntilValidationAndManualRestoreRemainsAvailable() async throws {
        let fixture = try await RejectionFixture.make(expired: true, failPAT: true)
        await fixture.waitUntil {
            let counts = await fixture.transport.counts()
            return counts.pat == 1 && !fixture.model.isRecovering && fixture.model.state == .reauthenticate
        }
        fixture.model.refresh()
        await fixture.model.waitForCurrentRead()
        let failedCounts = await fixture.transport.counts()
        XCTAssertEqual(failedCounts.pat, 1)
        XCTAssertNotNil(try fixture.patStore.load())
        await fixture.transport.allowPAT()
        let restored = await fixture.model.recoverUsingPAT()
        XCTAssertTrue(restored)
        await fixture.waitForValidatedProfile()
        try await fixture.client.sessionStore.set(rejectionSession(expired: true))
        fixture.model.refresh()
        await fixture.waitForValidatedProfile()
        let restoredCounts = await fixture.transport.counts()
        XCTAssertEqual(restoredCounts.pat, 3) // Initial automatic, manual, then re-armed automatic.
    }

    func testConcurrentRejectionsJoinRecoveryWithoutCancellingNewProfileRead() async throws {
        let fixture = try await RejectionFixture.make()
        await fixture.waitForValidatedProfile()
        await fixture.transport.pausePAT()
        let first = Task { await fixture.model.recoverAfterRefreshRejection(
            WatchAuthRefreshRejection.badRequest, for: "watch-user"
        ) }
        await fixture.waitUntil { await fixture.transport.counts().pat == 1 }
        var secondStarted = false
        let second = Task {
            secondStarted = true
            return await fixture.model.recoverAfterRefreshRejection(
                WatchAuthRefreshRejection.badRequest, for: "watch-user"
            )
        }
        await fixture.waitUntil { secondStarted }
        await fixture.transport.resumePAT()
        let handledFirst = await first.value
        let handledSecond = await second.value
        XCTAssertTrue(handledFirst)
        XCTAssertTrue(handledSecond)
        await fixture.waitForValidatedProfile()
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 1)
        XCTAssertEqual(counts.user, 2)
    }

    func testRecoveryStillHonorsOwnerPhoneHintsAndExplicitSignOut() async throws {
        for block in ["wrong-owner", "phone-out", "other-phone", "watch-out"] {
            let fixture = try await RejectionFixture.make()
            await fixture.waitForValidatedProfile()
            if block == "phone-out" { fixture.model.receiveContext(PhoneAccountHint.signedOut.context) }
            if block == "other-phone" {
                fixture.model.receiveContext(PhoneAccountHint.signedIn(userID: "other-user").context)
            }
            if block == "watch-out" { await fixture.model.signOut() }
            let handled = await fixture.model.recoverAfterRefreshRejection(
                WatchAuthRefreshRejection.badRequest, for: block == "wrong-owner" ? "other-user" : "watch-user"
            )
            XCTAssertFalse(handled)
            let counts = await fixture.transport.counts()
            XCTAssertEqual(counts.pat, 0)
        }
    }

    func testCancelledWorkCannotStartPATRecovery() async throws {
        let fixture = try await RejectionFixture.make()
        await fixture.waitForValidatedProfile()
        let cancelled = Task {
            await fixture.model.recoverAfterRefreshRejection(WatchAuthRefreshRejection.badRequest, for: "watch-user")
        }
        cancelled.cancel()
        let handled = await cancelled.value
        XCTAssertFalse(handled)
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 0)
        XCTAssertEqual(fixture.model.state, .name("Server Name"))
    }

    func testUnrelatedHTTP400NeverBecomesRefreshRejectionAfterMapping() async throws {
        let fixture = try await RejectionFixture.make()
        await fixture.waitForValidatedProfile()
        let error = FetchError.http(.decode(status: 400, headers: [:], body: Data("Invalid payload".utf8)))
        for candidate: any Error in [error, GraphQLDomainError.map(error),
                                    WatchHealthSyncFailure(stage: .backendWrite, cause: GraphQLDomainError.map(error))] {
            let handled = await fixture.model.recoverAfterRefreshRejection(candidate, for: "watch-user")
            XCTAssertFalse(handled)
        }
        let counts = await fixture.transport.counts()
        XCTAssertEqual(counts.pat, 0)
    }

    func testTransportTagsOnlyExactRefresh400AndRecordsOneTerminalOutcome() async throws {
        let base = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        let observer = WatchAuthRefreshObserver()
        let (events, continuation) = AsyncStream<WatchAuthRefreshObservation>.makeStream()
        await observer.setHandler { _ = continuation.yield($0) }
        let transport = WatchAuthRefreshTransport(authBaseURL: base, observer: observer,
            underlying: StubTransport { _ in NhostRawResponse(status: 400, body: Data("private payload".utf8)) })
        for request in [NhostRequest(method: "GET", url: base.appendingPathComponent("token")),
                        NhostRequest(method: "POST", url: base.appendingPathComponent("user")),
                        NhostRequest(method: "POST", url: URL(string: "https://other.example.test/v1/token")!)] {
            let response = try await transport.fetch(request)
            XCTAssertEqual(response.status, 400)
        }
        do {
            _ = try await transport.fetch(NhostRequest(method: "POST", url: base.appendingPathComponent("token")))
            XCTFail("Expected the endpoint-specific rejection")
        } catch {
            XCTAssertEqual(error as? WatchAuthRefreshRejection, .badRequest)
            XCTAssertFalse(error.localizedDescription.contains("private payload"))
        }
        continuation.finish()
        var recorded: [WatchAuthRefreshObservation] = []
        for await event in events { recorded.append(event) }
        XCTAssertEqual(recorded.map(\.outcome), [.started, .rejected(400)])
        XCTAssertEqual(recorded.first?.id, recorded.last?.id)
    }

    func testRecognizedInvalidRefresh400KeepsSDKConditionalSessionRemoval() async throws {
        let fixture = try await RejectionFixture.makeClient(expired: true, mode: .invalidRefresh)
        do {
            _ = try await fixture.client.refreshSession(marginSeconds: 0)
            XCTFail("Expected the original SDK error")
        } catch {
            XCTAssertEqual((error as? FetchError)?.decodedBody(AuthErrorResponse.self)?.error, .invalidRefreshToken)
        }
        let stored = try await fixture.client.sessionStore.get()
        XCTAssertNil(stored)
    }
}

private struct RejectionGraphQLData: Decodable, Sendable {}

@MainActor
private struct RejectionFixture {
    let model: WatchAccountModel
    let client: NhostClient
    let transport: RejectionTransport
    let patStore: RejectionPATStore

    static func make(expired: Bool = false, mode: RejectionTransport.Mode = .refresh400,
                     failPAT: Bool = false) async throws -> Self {
        let fixture = try await makeClient(expired: expired, mode: mode, failPAT: failPAT)
        let store = RejectionPATStore()
        try store.save(WatchPATCredential(userID: "watch-user", token: "fixture-pat",
                                         expiresAt: Date().addingTimeInterval(3_600)))
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: fixture.client), autoBootstrap: false),
            currentUser: NhostCurrentUserService(client: fixture.client),
            patService: NhostWatchPATService(client: fixture.client), patStore: store
        )
        model.localContextReady(PhoneAccountHint.signedIn(userID: "watch-user").context)
        await model.bootstrap()
        return Self(model: model, client: fixture.client, transport: fixture.transport, patStore: store)
    }

    static func makeClient(expired: Bool, mode: RejectionTransport.Mode = .refresh400,
                           failPAT: Bool = false) async throws -> (client: NhostClient, transport: RejectionTransport) {
        let transport = RejectionTransport(mode: mode, failPAT: failPAT)
        let client = createClient(NhostClientOptions(
            subdomain: "local", region: "local",
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try rejectionSession(expired: expired))),
            transport: WatchAuthRefreshTransport(authBaseURL: generateServiceURL(.auth),
                                                  observer: WatchAuthRefreshObserver(), underlying: transport)
        ))
        return (client, transport)
    }

    func waitForValidatedProfile() async {
        await waitUntil { model.state == .name("Server Name") && !model.isReadingProfile && model.profileError == nil }
    }

    func waitUntil(_ condition: @MainActor () async -> Bool) async {
        for _ in 0..<3_000 {
            if await condition() { return }
            await Task.yield()
        }
        XCTFail("Expected watch recovery condition; state=\(model.state)")
    }
}

private actor RejectionTransport: HTTPTransport {
    enum Mode { case refresh400, profile400, malformedProfile, malformedRefresh, serverError, offline, invalidRefresh }
    let mode: Mode
    private var failPAT: Bool
    private var paths: [String] = []
    private var holdPAT = false
    private var patWaiter: CheckedContinuation<Void, Never>?

    init(mode: Mode, failPAT: Bool) { self.mode = mode; self.failPAT = failPAT }
    func allowPAT() { failPAT = false }
    func pausePAT() { holdPAT = true }
    func resumePAT() { holdPAT = false; patWaiter?.resume(); patWaiter = nil }
    func counts() -> (pat: Int, user: Int, graphQL: Int) {
        (paths.filter { $0.hasSuffix("/signin/pat") }.count,
         paths.filter { $0.hasSuffix("/user") }.count,
         paths.filter { $0 == "/v1" }.count)
    }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        paths.append(request.url.path)
        if request.url.path.hasSuffix("/token") {
            switch mode {
            case .offline: throw URLError(.notConnectedToInternet)
            case .serverError: return NhostRawResponse(status: 503, body: Data())
            case .malformedRefresh: return NhostRawResponse(status: 200, body: Data("{}".utf8))
            case .invalidRefresh:
                return NhostRawResponse(status: 400, body: Data(
                    #"{"status":400,"error":"invalid-refresh-token","message":"fixture rejection"}"#.utf8))
            default:
                return NhostRawResponse(status: 400, body: Data(
                    #"{"status":400,"error":"invalid-request","message":"Invalid payload"}"#.utf8))
            }
        }
        if request.url.path.hasSuffix("/signin/pat") {
            if holdPAT { await withCheckedContinuation { patWaiter = $0 } }
            if failPAT { throw URLError(.notConnectedToInternet) }
            let session = try rejectionSession(expired: false, rotated: true)
            return NhostRawResponse(status: 200, body: try NhostJSON.restEncoder.encode(AuthSessionPayload(session: session.authSession)))
        }
        if request.url.path.hasSuffix("/user") {
            if mode == .profile400 { return NhostRawResponse(status: 400, body: Data()) }
            if mode == .malformedProfile { return NhostRawResponse(status: 200, body: Data("{}".utf8)) }
            return NhostRawResponse(status: 200, body: try NhostJSON.restEncoder.encode(rejectionUser(name: "Server Name")))
        }
        if request.url.path.hasSuffix("/signout") { return NhostRawResponse(status: 200, body: Data()) }
        if request.url.path == "/v1" { return NhostRawResponse(status: 200, body: Data(#"{"data":{}}"#.utf8)) }
        throw URLError(.unsupportedURL) // Never fall through to a real network transport.
    }
}

private func rejectionSession(expired: Bool, rotated: Bool = false) throws -> StoredSession {
    let claims = try JSONSerialization.data(withJSONObject: ["exp": Int(Date().timeIntervalSince1970) + (expired ? -3_600 : 3_600)])
    let payload = claims.base64EncodedString().replacingOccurrences(of: "=", with: "")
        .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
    return try StoredSession(accessToken: "e30.\(payload).signature", accessTokenExpiresIn: 3_600,
        refreshTokenId: rotated ? "rotated-id" : "original-id", refreshToken: rotated ? "rotated-fixture" : "original-fixture",
        user: rejectionUser(name: "Session fallback"))
}

private func rejectionUser(name: String) -> AuthUser {
    AuthUser(avatarUrl: "", createdAt: Date(timeIntervalSince1970: 1_700_000_000),
             defaultRole: "user", displayName: name, emailVerified: true, id: "watch-user", isAnonymous: false,
             locale: "en", metadata: [:], phoneNumberVerified: false, roles: ["user"])
}

private final class RejectionPATStore: WatchPATStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var value: WatchPATCredential?
    func load() throws -> WatchPATCredential? { lock.lock(); defer { lock.unlock() }; return value }
    func save(_ credential: WatchPATCredential) throws { lock.lock(); defer { lock.unlock() }; value = credential }
    func clear() throws { lock.lock(); defer { lock.unlock() }; value = nil }
}
