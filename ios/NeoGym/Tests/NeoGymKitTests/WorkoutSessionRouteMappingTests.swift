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

    @Test("closing a started session clears the root route path")
    func closingStartedSessionClearsPath() {
        let path: [String] = WorkoutSessionRouteMapping.pathAfterClosingStartedSession()
        #expect(path.isEmpty)
    }
}
