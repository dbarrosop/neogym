import Foundation
import XCTest

/// The host target cannot compile ActivityKit/SwiftUI. Guard the platform boundary
/// in addition to the executable account-lifecycle tests with fake effects.
final class RestTimerWiringTests: XCTestCase {
    private func source(_ relativePath: String) throws -> String {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: packageRoot.appendingPathComponent(relativePath), encoding: .utf8)
    }

    func testAppOwnsAndBindsTheScopeAndClearsItOnEveryAuthClearReason() throws {
        let app = try source("App/NeoGymApp.swift")
        XCTAssertTrue(app.contains("@StateObject private var restTimers: RestTimerAccountScope"))
        XCTAssertTrue(app.contains("restTimers.bind(to: authStore)"))
        let clearHandler = #"snapshotClearHandler: \{ _ in\s*restTimers.endSession\(\)"#
        XCTAssertNotNil(app.range(of: clearHandler, options: .regularExpression))
        let root = try source("App/RootView.swift")
        XCTAssertTrue(root.contains("restTimer.ownerId == session.user?.id"))
        let shell = try source("App/Shell/AppShellView.swift")
        XCTAssertTrue(shell.contains("@ObservedObject var restTimer: RestTimerController"))
        XCTAssertFalse(shell.contains("restTimer.cancel()"), "Tab/view disappearance is not an account end")
    }

    func testNotificationAuthorizationCannotEnqueueAfterCancellation() throws {
        let effects = try source("App/Shell/RestTimerController.swift")
        let authorization = try XCTUnwrap(effects.range(of: "await center.requestAuthorization"))
        let enqueue = try XCTUnwrap(effects.range(of: "center.add(request, withCompletionHandler: nil)"))
        let afterAuthorization = String(effects[authorization.upperBound..<enqueue.lowerBound])
        XCTAssertTrue(afterAuthorization.contains("guard !Task.isCancelled"))
        XCTAssertFalse(afterAuthorization.contains("await "), "Do not suspend after the guard before enqueuing")
        XCTAssertTrue(effects.contains("notificationTask?.cancel()"))
        XCTAssertTrue(effects.contains("removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])"))
        XCTAssertTrue(effects.contains("removeDeliveredNotifications(withIdentifiers: [Self.notificationIdentifier])"))
    }

    func testLiveActivityCleanupIsOrderedBehindEarlierOperations() throws {
        let effects = try source("App/Shell/RestTimerController.swift")
        let prior = try XCTUnwrap(effects.range(of: "await previousTask?.value"))
        let end = try XCTUnwrap(effects.range(of: "await activity.end(nil, dismissalPolicy: .immediate)"))
        let create = try XCTUnwrap(effects.range(of: "Activity<RestTimerActivityAttributes>.request"))
        XCTAssertLessThan(prior.lowerBound, end.lowerBound)
        XCTAssertLessThan(end.lowerBound, create.lowerBound)
        XCTAssertTrue(effects.contains("guard revision == activityRevision"))
        XCTAssertTrue(effects.contains("mirrorActivity(nil)"))
    }
}
