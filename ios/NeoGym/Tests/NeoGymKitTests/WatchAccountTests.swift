import Combine
import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

private actor WatchTransport: HTTPTransport {
    var requests: [NhostRequest] = []
    var status = 200
    var displayName = "Server Name"
    var refresh = false
    var transportFailure = false
    var invalidRefresh = false
    var failSignOut = false
    private var holdSignOut = false
    private var signOutWaiter: CheckedContinuation<Void, Never>?
    private var signOutStarted: CheckedContinuation<Void, Never>?
    private var signOutIsWaiting = false

    func rejectRefresh() { invalidRefresh = true }
    func rejectSignOut() { failSignOut = true }
    func pauseSignOut() { holdSignOut = true }

    func waitForSignOut() async {
        if signOutIsWaiting { return }
        await withCheckedContinuation { signOutStarted = $0 }
    }

    func resumeSignOut() {
        holdSignOut = false
        signOutWaiter?.resume()
        signOutWaiter = nil
    }

    func set(status: Int, name: String = "Server Name", refresh: Bool = false, transportFailure: Bool = false) {
        self.status = status
        displayName = name
        self.refresh = refresh
        self.transportFailure = transportFailure
    }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        requests.append(request)
        if request.url.path.hasSuffix("/signout") {
            if holdSignOut {
                await withCheckedContinuation { continuation in
                    signOutWaiter = continuation
                    signOutIsWaiting = true
                    signOutStarted?.resume()
                    signOutStarted = nil
                }
            }
            if failSignOut { throw URLError(.notConnectedToInternet) }
            return NhostRawResponse(status: 200, body: Data())
        }
        if request.url.path.hasSuffix("/token") {
            if invalidRefresh {
                return NhostRawResponse(status: 401, body: Data(
                    #"{"status":401,"message":"Invalid refresh token","error":"invalid-refresh-token"}"#.utf8
                ))
            }
            return NhostRawResponse(status: 200, body: Data(Self.refreshedSession.utf8))
        }
        if refresh { throw URLError(.notConnectedToInternet) }
        if transportFailure { throw FetchError.transport("offline") }
        if status == 401 {
            return NhostRawResponse(status: 401, body: Data(#"{"status":401,"message":"Unauthorized"}"#.utf8))
        }
        if status != 200 {
            return NhostRawResponse(status: status, body: Data(#"{"status":500,"message":"Server error"}"#.utf8))
        }
        return NhostRawResponse(status: 200, body: Data("""
        {"id":"watch-user","displayName":"\(displayName)","email":"watch@example.test","avatarUrl":"",
        "createdAt":"2024-01-01T00:00:00Z", "defaultRole":"user", "emailVerified":true,
        "isAnonymous":false, "locale":"en", "metadata":{},
        "phoneNumberVerified":false, "roles":["user"]}
        """.utf8))
    }

    static let newToken = token(expiresIn: 3600)
    static let refreshedSession = """
        {"accessToken":"\(newToken)","accessTokenExpiresIn":3600,
        "refreshTokenId":"new-id","refreshToken":"new-refresh",
        "user":{"id":"watch-user","displayName":"Old Session","avatarUrl":"",
        "createdAt":"2024-01-01T00:00:00Z","defaultRole":"user","emailVerified":true,
        "isAnonymous":false,"locale":"en","metadata":{},"phoneNumberVerified":false,
        "roles":["user"]}}
        """

    static func token(expiresIn: Int) -> String {
        let payload = Data(#"{"exp":\#(Int(Date().timeIntervalSince1970) + expiresIn)}"#.utf8)
        let encoded = payload.base64EncodedString().replacingOccurrences(of: "=", with: "")
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
        return "e30.\(encoded).signature"
    }
}

@MainActor
final class WatchAccountTests: XCTestCase {
    func testPendingUnknownAndKnownPhoneAllowOnlyFreshMatchingRead() async throws {
        let (model, _, transport) = try await setup()
        XCTAssertEqual(model.state, .awaitingLocalContext)
        let originalToken = try XCTUnwrap(model.authStore.state.session?.accessToken)
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        XCTAssertEqual(model.currentUser?.email, "watch@example.test")
        let requests = await transport.requests
        XCTAssertEqual(requests.map(\.url.path), ["/v1/user"]) // Unexpired session does not consume its refresh token.
        XCTAssertEqual(requests.last?.headers.first { $0.key.lowercased() == "authorization" }?.value,
                       "Bearer \(originalToken)")
        await transport.set(status: 200, name: "Renamed on server")
        model.receiveContext(PhoneAccountHint.signedIn(userID: "watch-user").context)
        XCTAssertEqual(model.state, .name("Server Name")) // A hint is not a refresh trigger.
        model.refresh()
        XCTAssertEqual(model.state, .name("Server Name")) // Keep the last profile while revalidating.
        XCTAssertEqual(model.currentUser?.email, "watch@example.test")
        await waitFor(model, .name("Renamed on server"))
        model.receiveContext(["version": "2", "state": "signedOut"])
        XCTAssertEqual(model.state, .name("Renamed on server"))
    }

    func testRefreshRotatesAndUsesNewBearer() async throws {
        let (model, client, transport) = try await setup(expiresIn: -1)
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        let requests = await transport.requests
        XCTAssertTrue(requests.contains { $0.url.path.contains("/token") })
        XCTAssertEqual(requests.last?.headers.first { $0.key.lowercased() == "authorization" }?.value,
                       "Bearer \(WatchTransport.newToken)")
        let stored = try await client.getUserSession()
        XCTAssertEqual(stored?.refreshToken, "new-refresh")
    }

    func testAuthErrorsHideNameButOfflineKeepsLastProfileAndAllowsRetry() async throws {
        let (model, _, transport) = try await setup()
        var diagnostics: [WatchTransportDiagnostic] = []
        model.onReadFailure = { diagnostics.append($0) }
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.set(status: 401)
        model.refresh()
        await waitFor(model, .authError)
        XCTAssertNil(model.currentUser)
        XCTAssertEqual(diagnostics.last, .init(kind: .http, code: 401))
        await transport.set(status: 200, refresh: true)
        model.refresh()
        await waitForProfileError(model)
        XCTAssertEqual(model.state, .name("Old Session"))
        XCTAssertEqual(model.profileError, "Profile may be out of date. Retry when connected.")
        XCTAssertEqual(diagnostics.last, .init(kind: .urlSession, code: -1009))
        await transport.set(status: 200, transportFailure: true)
        model.refresh()
        await waitForProfileError(model) // Production transport wraps offline errors in FetchError.transport.
        XCTAssertEqual(diagnostics.last, .init(kind: .unknown))
        XCTAssertEqual(model.state, .name("Old Session"))
        XCTAssertEqual(model.profileError, "Profile may be out of date. Retry when connected.")
        await transport.set(status: 200, name: "Recovered")
        model.refresh()
        await waitFor(model, .name("Recovered"))
    }

    func testAuthStoreRetryReconcilesErrorToSignedOutWithoutAnIDChange() async {
        let (model, _, _) = await setup(storage: FailFirstWatchReadStorage())
        model.localContextReady(nil)
        await waitForError(model)
        // The iPhone retry path calls AuthStore.bootstrap() directly, not model.bootstrap().
        await model.authStore.bootstrap()
        XCTAssertEqual(model.state, .signedOut)
    }

    func testPhoneSignedOutOrDifferentAccountClearsLocalSession() async throws {
        for hint in [PhoneAccountHint.signedOut, .signedIn(userID: "other")] {
            let (model, client, transport) = try await setup()
            await transport.rejectSignOut()
            model.receiveContext(hint.context)
            let expected: WatchAccountState = hint == .signedOut ? .phoneSignedOut : .matchPhone
            // A definitive hint blocks the watch and clears locally despite failed remote revocation.
            for _ in 0..<1000 {
                if try await client.getUserSession() == nil { break }
                await Task.yield()
            }
            let remaining = try await client.getUserSession()
            XCTAssertNil(remaining)
            await waitFor(model, expected)
            let requests = await transport.requests
            XCTAssertTrue(requests.contains { $0.url.path.hasSuffix("/signout") })
        }
    }

    func testKnownPhoneSignOutBlocksOTPWithoutAWatchSession() async throws {
        let (model, client, _) = await setup(storage: MemorySessionStorageBackend())
        model.localContextReady(PhoneAccountHint.signedOut.context)
        XCTAssertEqual(model.state, .phoneSignedOut)
        let persisted = try session()
        try await client.sessionStore.set(persisted)
        model.authStore.applyVerifiedSession(persisted)
        await waitFor(model, .phoneSignedOut)
        for _ in 0..<1000 {
            if try await client.getUserSession() == nil { break }
            await Task.yield()
        }
        let remaining = try await client.getUserSession()
        XCTAssertNil(remaining)
    }

    func testFailedLocalClearNeverReportsSignedOut() async throws {
        for hint: PhoneAccountHint? in [nil, .signedOut] {
            let storage = FailingWatchStorage(session: try session())
            let (model, client, transport) = await setup(storage: storage)
            await transport.rejectSignOut()
            if let hint {
                model.receiveContext(hint.context)
                await waitForError(model)
            } else {
                model.localContextReady(nil)
                await waitFor(model, .name("Server Name"))
                await model.signOut()
                await waitForError(model)
            }
            let remaining = try await client.getUserSession()
            XCTAssertNotNil(remaining)
            let attempts = await storage.removeAttempts
            XCTAssertEqual(attempts, 1)
        }
    }

    func testRetryAfterFailedExplicitSignOutNeverOffersOTPBeforeRestoration() async throws {
        for hint: PhoneAccountHint? in [nil, .signedIn(userID: "watch-user")] {
            let storage = FailingWatchStorage(session: try session())
            let (model, client, transport) = await setup(storage: storage)
            if let hint { model.localContextReady(hint.context) }
            else { model.localContextReady(nil) }
            await waitFor(model, .name("Server Name"))
            await transport.rejectSignOut()
            await model.signOut()
            await waitForError(model)
            let stored = try await client.getUserSession()
            XCTAssertNotNil(stored)

            var observed: [WatchAccountState] = []
            let observation = model.$state.sink { observed.append($0) }
            await model.bootstrap()
            await waitFor(model, .name("Server Name"))
            withExtendedLifetime(observation) {
                XCTAssertEqual(observed.first.map { state in
                    if case .error = state { return true }
                    return false
                }, true)
                XCTAssertTrue(observed.contains(.loading))
                XCTAssertEqual(observed.last, .name("Server Name"))
                XCTAssertFalse(observed.contains(.signedOut))
                XCTAssertFalse(observed.contains(.matchPhone))
            }
        }
    }

    func testSignOutRemainsLoadingUntilLocalClearFinishesOrFails() async throws {
        let storage = FailingWatchStorage(session: try session())
        let (model, client, transport) = await setup(storage: storage)
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.pauseSignOut()
        await transport.rejectSignOut()
        let signOut = Task { await model.signOut() }
        await transport.waitForSignOut()
        model.refresh() // Foreground during the remote call must not claim local sign-out.
        XCTAssertEqual(model.state, .loading)
        let duringRemoteCall = try await client.getUserSession()
        XCTAssertNotNil(duringRemoteCall)
        await transport.resumeSignOut()
        await signOut.value
        await waitForError(model)
        let afterFailedClear = try await client.getUserSession()
        XCTAssertNotNil(afterFailedClear)
        let attempts = await storage.removeAttempts
        XCTAssertEqual(attempts, 1)
    }

    func testExplicitSignOutClearsLocallyAfterRemoteFailure() async throws {
        let (model, client, transport) = try await setup()
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.rejectSignOut()
        await model.signOut()
        XCTAssertEqual(model.state, .signedOut)
        let remaining = try await client.getUserSession()
        XCTAssertNil(remaining)
        let requests = await transport.requests
        XCTAssertTrue(requests.contains { $0.url.path.hasSuffix("/signout") })
    }

    func testPhoneSignedInAfterExplicitWatchSignOutPromptsForMatchingAccount() async throws {
        let (model, client, transport) = try await setup()
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.rejectSignOut()
        await model.signOut()
        XCTAssertEqual(model.state, .signedOut)
        let cleared = try await client.getUserSession()
        XCTAssertNil(cleared)

        model.receiveContext(PhoneAccountHint.signedIn(userID: "watch-user").context)
        XCTAssertEqual(model.state, .matchPhone)
        model.receiveContext(PhoneAccountHint.signedOut.context)
        XCTAssertEqual(model.state, .phoneSignedOut)
        model.receiveContext(PhoneAccountHint.signedIn(userID: "other").context)
        XCTAssertEqual(model.state, .matchPhone)
    }

    func testPhoneHintDuringExplicitSignOutWaitsForLocalClearWithoutStartingAnother() async throws {
        let (model, client, transport) = try await setup()
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.pauseSignOut()
        await transport.rejectSignOut()
        let signOut = Task { await model.signOut() }
        await transport.waitForSignOut()
        model.receiveContext(PhoneAccountHint.signedIn(userID: "other").context)
        XCTAssertEqual(model.state, .loading)
        model.receiveContext(PhoneAccountHint.signedIn(userID: "watch-user").context)
        XCTAssertEqual(model.state, .loading)
        let beforeClear = try await client.getUserSession()
        XCTAssertNotNil(beforeClear)

        await transport.resumeSignOut()
        await signOut.value
        XCTAssertEqual(model.state, .matchPhone)
        let afterClear = try await client.getUserSession()
        XCTAssertNil(afterClear)
        let requests = await transport.requests
        XCTAssertEqual(requests.filter { $0.url.path.hasSuffix("/signout") }.count, 1)
    }

    func testBlockingClearStaysNonActionableThroughHintChangesUntilLocalRemoval() async throws {
        let (model, client, transport) = try await setup()
        model.localContextReady(nil)
        await waitFor(model, .name("Server Name"))
        await transport.pauseSignOut()
        await transport.rejectSignOut()

        model.receiveContext(PhoneAccountHint.signedIn(userID: "other").context)
        XCTAssertEqual(model.state, .clearing)
        await transport.waitForSignOut()
        model.receiveContext(PhoneAccountHint.signedOut.context)
        XCTAssertEqual(model.state, .clearing)
        model.receiveContext(PhoneAccountHint.signedIn(userID: "watch-user").context)
        XCTAssertEqual(model.state, .clearing)
        model.refresh()
        XCTAssertEqual(model.state, .clearing)
        let duringRemoteCall = try await client.getUserSession()
        XCTAssertNotNil(duringRemoteCall)

        await transport.resumeSignOut()
        await waitFor(model, .matchPhone)
        let afterClear = try await client.getUserSession()
        XCTAssertNil(afterClear)
        let requests = await transport.requests
        XCTAssertEqual(requests.filter { $0.url.path.hasSuffix("/signout") }.count, 1)
    }

    func testHintAllowlistAndTerminalPhoneMapping() throws {
        let session = try session()
        XCTAssertNil(PhoneAccountHint.from(.loading))
        XCTAssertNil(PhoneAccountHint.from(.error("offline")))
        XCTAssertEqual(PhoneAccountHint.from(.signedIn(session)), .signedIn(userID: "watch-user"))
        XCTAssertEqual(PhoneAccountHint.from(.signedOut), .signedOut)
        XCTAssertEqual(Set(PhoneAccountHint.signedIn(userID: "watch-user").context.keys), ["version", "state", "userId"])
        XCTAssertNil(PhoneAccountHint.decode(["version": "1", "state": "signedIn", "userId": " "]))
        XCTAssertEqual(CurrentWatchUser(id: "x", displayName: "  ").displayName, "Athlete")
    }
}

extension WatchAccountTests {
    func testWatchProfileCacheRequiresMatchingRestoredUserAndClearsOnSignOut() async throws {
        let cache = WatchCurrentUserStore(suite: "WatchAccountTests.\(UUID().uuidString)")
        cache.save(CurrentWatchUser(id: "watch-user", displayName: "Recently fetched", email: "cached@example.test"))
        XCTAssertNil(cache.load(for: "other-user"))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try session())),
            transport: WatchTransport()
        ))
        let controlled = ControlledUser()
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: controlled, currentUserStore: cache
        )
        await model.bootstrap()
        XCTAssertEqual(model.state, .awaitingLocalContext)
        XCTAssertNil(model.currentUser) // No profile without restored session and local context.
        model.localContextReady(nil)
        XCTAssertEqual(model.state, .name("Recently fetched"))
        XCTAssertEqual(model.currentUser?.email, "cached@example.test")
        try await controlled.waitForRequest()
        model.receiveContext(PhoneAccountHint.signedOut.context)
        XCTAssertNil(model.currentUser)
        XCTAssertNil(cache.load(for: "watch-user"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Late response"))
        await waitFor(model, .phoneSignedOut)
        XCTAssertNil(model.currentUser)
        let remaining = try await client.getUserSession()
        XCTAssertNil(remaining)
    }

    func testRestoringDifferentAccountDiscardsSavedProfile() {
        let cache = WatchCurrentUserStore(suite: "WatchAccountTests.\(UUID().uuidString)")
        cache.save(CurrentWatchUser(id: "old-user", displayName: "Old profile"))
        cache.retainOnly(userID: "new-user")
        XCTAssertNil(cache.load(for: "old-user"))
    }

    func testAlreadyDeliveredDifferentAccountHintNeverShowsCachedProfile() async throws {
        let cache = WatchCurrentUserStore(suite: "WatchAccountTests.\(UUID().uuidString)")
        cache.save(CurrentWatchUser(id: "watch-user", displayName: "Private name"))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try session())),
            transport: WatchTransport()
        ))
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: ControlledUser(), currentUserStore: cache
        )
        model.localContextReady(PhoneAccountHint.signedIn(userID: "other-user").context)
        await model.bootstrap()
        await waitFor(model, .matchPhone)
        XCTAssertNil(model.currentUser)
        XCTAssertNil(cache.load(for: "watch-user"))
    }

    func testCachedProfileRevalidatesWithoutBlockingAndPersistsFreshResult() async throws {
        let cache = WatchCurrentUserStore(suite: "WatchAccountTests.\(UUID().uuidString)")
        cache.save(CurrentWatchUser(id: "watch-user", displayName: "Cached", email: "saved@example.test"))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try session())),
            transport: WatchTransport()
        ))
        let controlled = ControlledUser()
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: controlled, currentUserStore: cache
        )
        model.localContextReady(nil)
        await model.bootstrap()
        XCTAssertEqual(model.state, .name("Cached"))
        XCTAssertEqual(model.currentUser?.email, "saved@example.test")
        XCTAssertTrue(model.isReadingProfile)
        try await controlled.waitForRequest()
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Updated", email: "new@example.test"))
        await waitFor(model, .name("Updated"))
        XCTAssertEqual(cache.load(for: "watch-user")?.email, "new@example.test")
        XCTAssertFalse(model.isReadingProfile)
    }

    func testControlledUserMissingRequestFailsWithinDeadline() async {
        let controlled = ControlledUser()
        do {
            try await controlled.waitForRequest(2, timeout: .milliseconds(50))
            XCTFail("Expected a missing-request timeout")
        } catch let error as ControlledUser.RequestTimeout {
            XCTAssertEqual(error.expected, 2)
            XCTAssertEqual(error.actual, 0)
        } catch {
            XCTFail("Unexpected wait error: \(error)")
        }
    }

    func testMatchingHintDuringReadKeepsReadAlive() async throws {
        let (model, _, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        model.receiveContext(PhoneAccountHint.signedIn(userID: "watch-user").context)
        XCTAssertEqual(model.state, .name("Old Session"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Fresh"))
        await waitFor(model, .name("Fresh"))
        let count = await controlled.requestCount
        XCTAssertEqual(count, 1)
    }

    func testRepeatedLocalContextDuringReadKeepsReadAlive() async throws {
        let (model, _, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        model.localContextReady(nil)
        model.localContextReady(["version": "2", "state": "signedOut"])
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Fresh"))
        await waitFor(model, .name("Fresh"))
        let count = await controlled.requestCount
        XCTAssertEqual(count, 1)
    }

    func testForegroundRefreshAndSameTickContextReadCoalesce() async throws {
        let (model, _, controlled) = try await controlledSetup()
        let hint = PhoneAccountHint.signedIn(userID: "watch-user").context
        model.localContextReady(hint)
        try await controlled.waitForRequest()
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Old"))
        await waitFor(model, .name("Old"))
        model.refresh()
        model.localContextReady(hint)
        try await controlled.waitForRequest(2)
        XCTAssertEqual(model.state, .name("Old"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "New"))
        await waitFor(model, .name("New"))
        let count = await controlled.requestCount
        XCTAssertEqual(count, 2)
    }

    func testLaterPhoneHintSuppressesInflightName() async throws {
        let (model, _, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        model.refresh() // A direct refresh coalesces; the view cancels first on background→active.
        let requestCount = await controlled.requestCount
        XCTAssertEqual(requestCount, 1)
        model.receiveContext(PhoneAccountHint.signedOut.context)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Too late"))
        await waitFor(model, .phoneSignedOut)
        XCTAssertNotEqual(model.state, .name("Too late"))
    }

    func testPersistedOTPBeforeCallerReturnsStillReconciles() async throws {
        let storage = MemorySessionStorageBackend()
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: storage), transport: WatchTransport()
        ))
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: WrongUser()
        )
        await model.bootstrap()
        model.receiveContext(PhoneAccountHint.signedIn(userID: "other").context)
        // SDK persists the OTP result before the UI's verification call returns.
        let persisted = try session()
        try await client.sessionStore.set(persisted)
        model.acceptVerifiedSession(persisted)
        await waitFor(model, .matchPhone)
        for _ in 0..<1000 {
            if try await client.getUserSession() == nil { break }
            await Task.yield()
        }
        let remaining = try await client.getUserSession()
        XCTAssertNil(remaining)
    }

    func testInvalidRefreshNeverDisplaysSessionName() async throws {
        let (model, client, transport) = try await setup(expiresIn: -1)
        await transport.rejectRefresh()
        model.localContextReady(nil)
        await waitFor(model, .reauthenticate)
        let remaining = try await client.getUserSession()
        XCTAssertNil(remaining)
    }

    func testInvalidUserIDCannotBecomeName() async throws {
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: createClient(NhostClientOptions(
                sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try session())),
                transport: WatchTransport()
            ))), autoBootstrap: false),
            currentUser: WrongUser()
        )
        await model.bootstrap()
        model.localContextReady(nil)
        await waitFor(model, .authError)
    }

    func testServerErrorRetainsSessionFallbackWithoutConnectivityWarning() async throws {
        let (model, _, transport) = try await setup()
        await transport.set(status: 500)
        model.localContextReady(nil)
        await waitForProfileError(model)
        XCTAssertEqual(model.state, .name("Old Session"))
        XCTAssertEqual(model.currentUser?.displayName, "Old Session")
        XCTAssertEqual(model.profileError, "Profile could not be refreshed. Retry.")
        await transport.set(status: 200, name: "Recovered")
        model.refresh()
        await waitFor(model, .name("Recovered"))
        XCTAssertNil(model.profileError)
    }

    func testPublishedNameCarriesCurrentUserBeforeStoredStateChanges() async throws {
        let (model, _, controlled) = try await controlledSetup()
        struct Emission {
            let published: WatchAccountState
            let stored: WatchAccountState
            let userID: String?
        }
        var emissions: [Emission] = []
        let observation = model.$state.sink { state in
            emissions.append(Emission(published: state, stored: model.state, userID: model.currentUser?.id))
        }
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Fresh"))
        await waitFor(model, .name("Fresh"))
        model.refresh()
        withExtendedLifetime(observation) {
            let name = emissions.first { $0.published == .name("Fresh") }
            XCTAssertEqual(name?.stored, .name("Old Session")) // @Published sends in willSet.
            XCTAssertEqual(name?.userID, "watch-user") // Runtime may use the emitted state and this user.
            let staleAfterName = emissions.last { $0.published == .name("Fresh") }
            XCTAssertEqual(staleAfterName?.userID, "watch-user")
        }
        try await controlled.waitForRequest(2)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Updated"))
        await waitFor(model, .name("Updated"))
    }

    func testForegroundAfterBackgroundReadStartsFreshRequestAndIgnoresLateResponse() async throws {
        let (model, _, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        let backgroundRead = try XCTUnwrap(model.inFlightRead)

        model.cancelPendingRead()
        model.refresh()
        XCTAssertEqual(model.state, .name("Old Session"))
        try await controlled.waitForRequest(2)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Background"))
        await backgroundRead.value
        XCTAssertEqual(model.state, .name("Old Session"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Opened"))
        await waitFor(model, .name("Opened"))
        let count = await controlled.requestCount
        XCTAssertEqual(count, 2)
    }

    func testExpiringReadCannotDisplayLateNameAndRetryFetchesAgain() async throws {
        let (model, _, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        let staleRead = try XCTUnwrap(model.inFlightRead)
        var emitted: [WatchAccountState] = []
        let observation = model.$state.sink { emitted.append($0) }
        model.cancelPendingRead()
        XCTAssertEqual(model.state, .name("Old Session"))
        XCTAssertNotNil(model.profileError)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Too late"))
        await staleRead.value // The cancelled service ignores cancellation; wait for the model to handle it.
        XCTAssertEqual(model.state, .name("Old Session"))

        model.refresh()
        try await controlled.waitForRequest(2)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Fresh"))
        await waitFor(model, .name("Fresh"))
        withExtendedLifetime(observation) {
            XCTAssertFalse(emitted.contains(.name("Too late")))
        }
    }

    func testSameIDOTPAlwaysTriggersFreshReadWhileRetainingEarlierName() async throws {
        let (model, client, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Before OTP"))
        await waitFor(model, .name("Before OTP"))

        // OTP writes to SDK storage before the UI is given its verified result.
        let persisted = try session()
        try await client.sessionStore.set(persisted)
        model.acceptVerifiedSession(persisted)
        XCTAssertEqual(model.state, .name("Before OTP"))
        try await controlled.waitForRequest(2)
        XCTAssertEqual(model.state, .name("Before OTP"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "After OTP"))
        await waitFor(model, .name("After OTP"))
        let count = await controlled.requestCount
        XCTAssertEqual(count, 2)
    }

    func testOTPInvalidatesAlreadyRunningSameIDNameRead() async throws {
        let (model, client, controlled) = try await controlledSetup()
        model.localContextReady(nil)
        try await controlled.waitForRequest()
        let staleRead = try XCTUnwrap(model.inFlightRead)
        var emitted: [WatchAccountState] = []
        let observation = model.$state.sink { emitted.append($0) }
        let persisted = try session()
        try await client.sessionStore.set(persisted)
        model.acceptVerifiedSession(persisted)
        try await controlled.waitForRequest(2)
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Old response"))
        await staleRead.value
        XCTAssertEqual(model.state, .name("Old Session"))
        await controlled.release(CurrentWatchUser(id: "watch-user", displayName: "Fresh response"))
        await waitFor(model, .name("Fresh response"))
        withExtendedLifetime(observation) {
            XCTAssertFalse(emitted.contains(.name("Old response")))
        }
    }
}

private extension WatchAccountTests {
    func session(expiresIn: Int = 3600) throws -> StoredSession {
        try StoredSession(
            accessToken: WatchTransport.token(expiresIn: expiresIn), accessTokenExpiresIn: expiresIn,
            refreshTokenId: "old-id", refreshToken: "old-refresh",
            user: AuthUser(
                avatarUrl: "", createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                defaultRole: "user", displayName: "Old Session", emailVerified: true,
                id: "watch-user", isAnonymous: false, locale: "en", metadata: [:],
                phoneNumberVerified: false, roles: ["user"]
            )
        )
    }

    func setup(expiresIn: Int = 3600) async throws -> (WatchAccountModel, NhostClient, WatchTransport) {
        try await setup(storage: MemorySessionStorageBackend(session: session(expiresIn: expiresIn)))
    }

    func setup(storage: any SessionStorageBackend) async -> (WatchAccountModel, NhostClient, WatchTransport) {
        let transport = WatchTransport()
        let client = createClient(NhostClientOptions(
            subdomain: "local", region: "local",
            sessionManagement: .processLocal(storage: storage), transport: transport
        ))
        let model = WatchAccountModel(authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false), currentUser: NhostCurrentUserService(client: client))
        await model.bootstrap()
        return (model, client, transport)
    }

    func controlledSetup() async throws -> (WatchAccountModel, NhostClient, ControlledUser) {
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: try session())),
            transport: WatchTransport()
        ))
        let controlled = ControlledUser()
        let model = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: controlled
        )
        await model.bootstrap()
        return (model, client, controlled)
    }

    func waitFor(_ model: WatchAccountModel, _ desired: WatchAccountState) async {
        for _ in 0..<1000 {
            if model.state == desired { return }
            await Task.yield()
        }
        XCTFail("Expected \(desired), got \(model.state)")
    }

    func waitForProfileError(_ model: WatchAccountModel) async {
        for _ in 0..<1000 {
            if model.profileError != nil { return }
            await Task.yield()
        }
        XCTFail("Expected profile revalidation error, got \(model.state)")
    }

    func waitForError(_ model: WatchAccountModel) async {
        for _ in 0..<1000 {
            if case .error = model.state { return }
            await Task.yield()
        }
        XCTFail("Expected local-clear error, got \(model.state)")
    }
}

private actor FailFirstWatchReadStorage: SessionStorageBackend {
    private var failNextRead = true

    func get() throws -> StoredSession? {
        if failNextRead {
            failNextRead = false
            throw URLError(.cannotLoadFromNetwork)
        }
        return nil
    }

    func set(_ value: StoredSession) throws {}
    func remove() throws {}
}

private actor FailingWatchStorage: SessionStorageBackend {
    private var session: StoredSession?
    private(set) var removeAttempts = 0

    init(session: StoredSession) { self.session = session }

    func get() throws -> StoredSession? { session }
    func set(_ value: StoredSession) throws { session = value }
    func remove() throws {
        removeAttempts += 1
        throw URLError(.cannotWriteToFile)
    }
}

private actor ControlledUser: CurrentUserServicing {
    struct RequestTimeout: Error {
        let expected: Int
        let actual: Int
    }

    private var pending: [CheckedContinuation<CurrentWatchUser, Never>] = []
    private(set) var requestCount = 0

    func getUser() async throws -> CurrentWatchUser {
        await withCheckedContinuation { continuation in
            requestCount += 1
            pending.append(continuation)
        }
    }

    func waitForRequest(_ count: Int = 1, timeout: Duration = .seconds(5)) async throws {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while requestCount < count {
            guard clock.now < deadline else {
                throw RequestTimeout(expected: count, actual: requestCount)
            }
            try await Task.sleep(for: .milliseconds(10))
        }
    }

    func release(_ user: CurrentWatchUser) {
        pending.removeFirst().resume(returning: user)
    }
}

private struct WrongUser: CurrentUserServicing {
    func getUser() async throws -> CurrentWatchUser {
        CurrentWatchUser(id: "other", displayName: "Forbidden")
    }
}
