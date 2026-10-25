import Foundation

/// Live WatchConnectivity messages only. The PAT never enters application
/// context, queued transfers, UserDefaults, diagnostics, or the widget.
public enum WatchAssistedSignInMessage: Equatable, Sendable {
    case request(UUID)
    case credential(UUID, WatchPATCredential)
    case result(UUID, succeeded: Bool)

    public var context: [String: String] {
        var context: [String: String] = ["version": "2"]
        switch self {
        case .request(let id):
            context["kind"] = "request"
            context["requestId"] = id.uuidString
        case .credential(let id, let credential):
            context["kind"] = "credential"
            context["requestId"] = id.uuidString
            context["userId"] = credential.userID
            context["pat"] = credential.token
            context["expiresAt"] = String(Int(credential.expiresAt.timeIntervalSince1970))
        case .result(let id, let succeeded):
            context["kind"] = "result"
            context["requestId"] = id.uuidString
            context["success"] = succeeded ? "true" : "false"
        }
        return context
    }

    public static func decode(_ context: [String: String]) -> Self? {
        guard context["version"] == "2", let kind = context["kind"],
              let id = context["requestId"].flatMap(UUID.init(uuidString:)) else { return nil }
        switch kind {
        case "request":
            guard Set(context.keys) == ["version", "kind", "requestId"] else { return nil }
            return .request(id)
        case "credential":
            guard Set(context.keys) == ["version", "kind", "requestId", "userId", "pat", "expiresAt"],
                  let userID = context["userId"], !userID.isEmpty,
                  let token = context["pat"], UUID(uuidString: token) != nil,
                  let rawExpiry = context["expiresAt"], let seconds = Int(rawExpiry),
                  String(seconds) == rawExpiry else { return nil }
            return .credential(id, WatchPATCredential(userID: userID, token: token,
                                                      expiresAt: Date(timeIntervalSince1970: TimeInterval(seconds))))
        case "result":
            guard Set(context.keys) == ["version", "kind", "requestId", "success"],
                  let success = context["success"], ["true", "false"].contains(success) else { return nil }
            return .result(id, succeeded: success == "true")
        default: return nil
        }
    }
}

/// Nonce and ten-minute window bind delivery to a request originating on the watch.
public struct WatchAssistedSignInAttempt: Equatable, Sendable {
    public let id: UUID
    public let userID: String
    public let startedAt: Date

    public init(id: UUID, userID: String, startedAt: Date = Date()) {
        self.id = id
        self.userID = userID
        self.startedAt = startedAt
    }

    public func accepts(id: UUID, userID: String, now: Date = Date()) -> Bool {
        self.id == id && self.userID == userID && now >= startedAt
            && now.timeIntervalSince(startedAt) < 10 * 60
    }
}
