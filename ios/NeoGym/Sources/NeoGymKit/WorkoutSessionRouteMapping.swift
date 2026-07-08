public enum WorkoutSessionRouteMapping {
    public static func sessionIdToOpen(from pendingSessionId: String?) -> String? {
        guard let pendingSessionId, !pendingSessionId.isEmpty else { return nil }
        return pendingSessionId
    }

    public static func pathAfterOpeningSession<Route>(
        _ sessionId: String,
        currentPath: [Route],
        makeRoute: (String) -> Route
    ) -> [Route] {
        currentPath + [makeRoute(sessionId)]
    }

    public static func pathAfterClosingStartedSession<Route>(
        currentPath: [Route],
        isSessionDetailRoute: (Route) -> Bool
    ) -> [Route] {
        guard let lastRoute = currentPath.last, isSessionDetailRoute(lastRoute) else { return currentPath }
        return Array(currentPath.dropLast())
    }
}
