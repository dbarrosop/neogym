import Testing
@testable import NeoGymKit

@Suite("Workout session route mapping")
struct WorkoutSessionRouteMappingTests {
    @Test("pending session ids map to an open-session route request")
    func pendingSessionMapsToOpenRoute() {
        #expect(WorkoutSessionRouteMapping.sessionIdToOpen(from: "session-1") == "session-1")
        #expect(WorkoutSessionRouteMapping.sessionIdToOpen(from: nil) == nil)
        #expect(WorkoutSessionRouteMapping.sessionIdToOpen(from: "") == nil)
    }

    @Test("opening a session appends without replacing the existing root path")
    func openingSessionAppendsToCurrentPath() {
        let path = WorkoutSessionRouteMapping.pathAfterOpeningSession(
            "session-2",
            currentPath: ["workout:1"],
            makeRoute: { "session:\($0)" }
        )

        #expect(path == ["workout:1", "session:session-2"])
    }

    @Test("closing a started session pops only the session detail route")
    func closingStartedSessionKeepsOriginatingRoute() {
        let fromSessionsList = WorkoutSessionRouteMapping.pathAfterClosingStartedSession(
            currentPath: ["sessions-list", "session:session-1"],
            isSessionDetailRoute: { $0.hasPrefix("session:") }
        )
        let fromWorkoutDetail = WorkoutSessionRouteMapping.pathAfterClosingStartedSession(
            currentPath: ["workouts-list", "workout:workout-1", "session:session-2"],
            isSessionDetailRoute: { $0.hasPrefix("session:") }
        )

        #expect(fromSessionsList == ["sessions-list"])
        #expect(fromWorkoutDetail == ["workouts-list", "workout:workout-1"])
    }

    @Test("closing a started session leaves paths without a session detail unchanged")
    func closingStartedSessionIgnoresNonSessionRoute() {
        let path = WorkoutSessionRouteMapping.pathAfterClosingStartedSession(
            currentPath: ["workouts-list", "workout:workout-1"],
            isSessionDetailRoute: { $0.hasPrefix("session:") }
        )

        #expect(path == ["workouts-list", "workout:workout-1"])
    }
}
