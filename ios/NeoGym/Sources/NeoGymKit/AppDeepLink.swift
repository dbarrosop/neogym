import Foundation

/// In-app navigation links opened by the widgets (`neogym://today`) and the rest
/// timer Live Activity (`neogym://session/<id>`). Auth callbacks (`neogym://verify`)
/// are not navigation links and keep their own parser, `AuthDeepLink`.
public enum AppDeepLink: Equatable, Sendable {
    case today
    case session(String)

    public static let scheme = "neogym"
    public static let todayURL = URL(string: "neogym://today")!

    public static func sessionURL(_ sessionId: String) -> URL? {
        guard !sessionId.isEmpty, !sessionId.contains("/") else { return nil }
        var components = URLComponents()
        components.scheme = scheme
        components.host = "session"
        components.path = "/" + sessionId
        return components.url
    }

    public init?(url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == Self.scheme else { return nil }
        let segments = components.path.split(separator: "/", omittingEmptySubsequences: true)
        switch components.host {
        case "today" where segments.isEmpty:
            self = .today
        case "session" where segments.count == 1:
            self = .session(String(segments[0]))
        default:
            return nil
        }
    }
}
