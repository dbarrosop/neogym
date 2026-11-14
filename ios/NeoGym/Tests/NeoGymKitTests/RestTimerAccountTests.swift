import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
final class RestTimerAccountTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    func testSameOwnerRelaunchRestoresScheduleAndExtensions() throws {
        let defaults = makeDefaults()
        defer { defaults.removeObject(forKey: RestTimerController.persistedKey) }
        let effects = RecordingRestEffects()
        var timer: RestTimerController? = RestTimerController(ownerId: "A", defaults: defaults, effects: effects, now: { self.now })
        timer?.start(seconds: 90, label: "Exercise · set 3 next", sessionId: "session-A")
        timer?.extend()
        let expected = timer?.schedule
        timer = nil // Process teardown is not an account end.

        let restored = RestTimerController(ownerId: "A", defaults: defaults, effects: effects, now: { self.now })
        XCTAssertEqual(restored.schedule, expected)
        XCTAssertEqual(restored.remainingSeconds, 120)
        XCTAssertEqual(restored.schedule?.sessionId, "session-A")
        XCTAssertEqual(effects.schedules.last, expected)
        XCTAssertEqual(defaults.dictionary(forKey: RestTimerController.persistedKey)?["ownerId"] as? String, "A")
        restored.cancel()
    }

    func testOwnerlessAndOtherOwnerSchedulesAreRemovedAndEffectsCancelled() {
        for storedOwner in [nil, "B"] as [String?] {
            let defaults = makeDefaults()
            var stored: [String: Any] = [
                "endDate": now.addingTimeInterval(90).timeIntervalSince1970,
                "duration": 90, "label": "Private exercise", "sessionId": "private-session"
            ]
            stored["ownerId"] = storedOwner
            defaults.set(stored, forKey: RestTimerController.persistedKey)
            let effects = RecordingRestEffects()

            let timer = RestTimerController(ownerId: "A", defaults: defaults, effects: effects, now: { self.now })

            XCTAssertNil(timer.schedule)
            XCTAssertNil(defaults.object(forKey: RestTimerController.persistedKey))
            XCTAssertTrue(effects.schedules.isEmpty)
            XCTAssertEqual(effects.cancellations, 1)
        }
    }

    func testSameOwnerRefreshAndBootstrapLoadingRetainTheTimer() async throws {
        let fixture = makeFixture()
        fixture.store.applyVerifiedSession(try session("A"))
        let timer = try XCTUnwrap(fixture.scope.timer)
        timer.start(sessionId: "session-A")
        let schedule = timer.schedule
        fixture.store.applyVerifiedSession(try session("A"))
        XCTAssertTrue(fixture.scope.timer === timer)
        XCTAssertEqual(timer.schedule, schedule)

        await fixture.service.setSession(try session("A"))
        await fixture.store.bootstrap()
        XCTAssertTrue(fixture.scope.timer === timer)
        XCTAssertEqual(timer.schedule, schedule)
        fixture.scope.endSession()
    }

    func testAccountSwitchClearsDataAndDisablesOldViewCallbacks() throws {
        let fixture = makeFixture()
        fixture.store.applyVerifiedSession(try session("A"))
        let old = try XCTUnwrap(fixture.scope.timer)
        old.start(label: "Private exercise", sessionId: "session-A")
        old.noteSession(id: "session-A", name: "Private session")

        fixture.store.applyVerifiedSession(try session("B"))
        let current = try XCTUnwrap(fixture.scope.timer)
        XCTAssertEqual(current.ownerId, "B")
        XCTAssertNil(current.schedule)
        XCTAssertNil(old.schedule)
        XCTAssertTrue(old.sessionNames.isEmpty)
        XCTAssertNil(fixture.defaults.object(forKey: RestTimerController.persistedKey))
        XCTAssertNil(fixture.effects.active)
        current.start(label: "B exercise", sessionId: "session-B")
        let expected = current.schedule
        let cancellationCount = fixture.effects.cancellations

        // Simulate a mutation/refresh finishing in the old account's removed view.
        old.start(label: "A late result", sessionId: "session-A")
        old.noteSession(id: "session-A", name: "A late result")
        old.extend()
        old.refresh()
        old.cancel()
        XCTAssertEqual(fixture.effects.active, expected)
        XCTAssertEqual(fixture.effects.cancellations, cancellationCount)
        XCTAssertTrue(old.sessionNames.isEmpty)
        XCTAssertEqual(fixture.defaults.dictionary(forKey: RestTimerController.persistedKey)?["ownerId"] as? String, "B")
        fixture.scope.endSession()
    }

    func testSignOutClearsBeforeRemoteRequestEvenWhenBothClearsFail() async throws {
        let fixture = makeFixture()
        fixture.store.applyVerifiedSession(try session("A"))
        let timer = try XCTUnwrap(fixture.scope.timer)
        timer.start(label: "Private exercise", sessionId: "session-A")
        await fixture.service.setFailure(true)
        await fixture.service.inspectSignOut {
            XCTAssertNil(fixture.scope.timer)
            XCTAssertNil(timer.schedule)
            XCTAssertNil(fixture.defaults.object(forKey: RestTimerController.persistedKey))
            XCTAssertNil(fixture.effects.active)
        }

        await fixture.store.signOut()

        XCTAssertNil(fixture.scope.timer)
        XCTAssertNil(fixture.effects.active)
        guard case .error = fixture.store.state else { return XCTFail("Expected local-clear error") }
    }

    func testSDKSessionRemovalClearsTimer() async throws {
        let fixture = makeFixture()
        await fixture.service.setSession(try session("A"))
        await fixture.store.bootstrap()
        fixture.scope.timer?.start(sessionId: "session-A")

        await fixture.service.emit(nil)

        XCTAssertNil(fixture.scope.timer)
        XCTAssertNil(fixture.defaults.object(forKey: RestTimerController.persistedKey))
        XCTAssertNil(fixture.effects.active)
    }

    func testSignedOutAndErrorBootstrapsClearPersistedTimerWithoutAShell() async throws {
        for failure in [false, true] {
            let fixture = makeFixture()
            let prior = RestTimerController(ownerId: "A", defaults: fixture.defaults, effects: fixture.effects, now: { self.now })
            prior.start(label: "Private exercise", sessionId: "session-A")
            await fixture.service.setFailure(failure)

            await fixture.store.bootstrap()

            XCTAssertNil(fixture.scope.timer)
            XCTAssertNil(fixture.defaults.object(forKey: RestTimerController.persistedKey))
            XCTAssertNil(fixture.effects.active)
            // Stop only this test's orphan controller/ticker.
            prior.cancel()
        }
    }

    func testNaturalExpiryKeepsCompletionAlertButAccountEndStillCancelsIt() throws {
        let defaults = makeDefaults()
        let effects = RecordingRestEffects()
        var clock = now
        let scope = RestTimerAccountScope(defaults: defaults, effects: effects, now: { clock })
        let store = AuthStore(authService: RestAuthService(), autoBootstrap: false) { _ in scope.endSession() }
        scope.bind(to: store)
        store.applyVerifiedSession(try session("A"))
        let timer = try XCTUnwrap(scope.timer)
        timer.start(seconds: 1)
        let cancellations = effects.cancellations
        clock = clock.addingTimeInterval(1)
        timer.refresh()
        XCTAssertFalse(timer.isRunning)
        XCTAssertNil(defaults.object(forKey: RestTimerController.persistedKey))
        XCTAssertEqual(effects.finishes, 1)
        XCTAssertEqual(effects.cancellations, cancellations)
        scope.endSession()
        XCTAssertEqual(effects.cancellations, cancellations + 1)
    }

    func testUserlessSessionCanHaveAShellButCannotRestoreOrStartARest() throws {
        let fixture = makeFixture()
        fixture.store.applyVerifiedSession(try session("A"))
        fixture.scope.timer?.start(sessionId: "session-A")

        fixture.store.applyVerifiedSession(try session(nil))

        let timer = try XCTUnwrap(fixture.scope.timer)
        XCTAssertNil(timer.ownerId)
        timer.start(label: "Unscoped", sessionId: "unknown-session")
        XCTAssertNil(timer.schedule)
        XCTAssertNil(fixture.defaults.object(forKey: RestTimerController.persistedKey))
        XCTAssertNil(fixture.effects.active)
        fixture.scope.endSession()
    }

    private func makeDefaults() -> UserDefaults {
        UserDefaults(suiteName: "RestTimerAccountTests.\(UUID().uuidString)")!
    }

    private func makeFixture() -> Fixture {
        let defaults = makeDefaults()
        let effects = RecordingRestEffects()
        let scope = RestTimerAccountScope(defaults: defaults, effects: effects, now: { self.now })
        let service = RestAuthService()
        let store = AuthStore(authService: service, autoBootstrap: false) { _ in scope.endSession() }
        scope.bind(to: store)
        return Fixture(defaults: defaults, effects: effects, scope: scope, service: service, store: store)
    }

    private struct Fixture {
        let defaults: UserDefaults
        let effects: RecordingRestEffects
        let scope: RestTimerAccountScope
        let service: RestAuthService
        let store: AuthStore
    }

    private func session(_ owner: String?) throws -> StoredSession {
        try StoredSession(
            accessToken: "fixture", accessTokenExpiresIn: 900,
            refreshTokenId: "fixture", refreshToken: "fixture",
            user: owner.map {
                AuthUser(
                    avatarUrl: "", createdAt: now, defaultRole: "user", displayName: "Fixture",
                    email: "fixture@example.com", emailVerified: true, id: $0, isAnonymous: false,
                    locale: "en", metadata: [:], phoneNumberVerified: false, roles: ["user"]
                )
            },
            decodedToken: DecodedToken(claims: [:])
        )
    }
}

@MainActor
private final class RecordingRestEffects: RestTimerEffects {
    var active: RestTimerSchedule?
    var schedules: [RestTimerSchedule] = []
    var cancellations = 0
    var finishes = 0

    func schedule(_ schedule: RestTimerSchedule) {
        active = schedule
        schedules.append(schedule)
    }

    func cancel() {
        active = nil
        cancellations += 1
    }

    func finish() {
        active = nil
        finishes += 1
    }
}

private actor RestAuthService: AuthServicing {
    private var session: StoredSession?
    private var handler: (@Sendable (StoredSession?) async -> Void)?
    private var failure = false
    private var onSignOut: (@MainActor @Sendable () -> Void)?
    private enum Failure: Error { case expected }

    func setSession(_ session: StoredSession?) { self.session = session }
    func setFailure(_ failure: Bool) { self.failure = failure }
    func inspectSignOut(_ handler: @escaping @MainActor @Sendable () -> Void) { onSignOut = handler }
    func getUserSession() async throws -> StoredSession? {
        if failure { throw Failure.expected }
        return session
    }
    func subscribeToSessionChanges(_ handler: @escaping @Sendable (StoredSession?) async -> Void) async -> AuthSessionSubscription {
        self.handler = handler
        return AuthSessionSubscription {}
    }
    func emit(_ session: StoredSession?) async { await handler?(session) }
    func signOut(refreshToken: String?) async throws {
        await onSignOut?()
        if failure { throw Failure.expected }
    }
    func clearSession() async throws {
        if failure { throw Failure.expected }
        await emit(nil)
    }
    func requestSignInOTP(email: String) async throws {}
    func requestSignUpOTP(email: String, displayName: String) async throws {}
    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? { nil }
    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}
    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { nil }
}
