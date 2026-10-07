import Foundation

/// Ephemeral WatchConnectivity messages. Never put these in application context,
/// UserDefaults, event exports, transferUserInfo, or background file transfers.
public enum WatchAssistedSignInMessage: Equatable, Sendable {
    case request(UUID)
    case challenge(UUID, email: String, userID: String)
    case code(UUID, otp: String)
    case result(UUID, succeeded: Bool)

    public var context: [String: String] {
        let id: UUID
        let kind: String
        var extra: [String: String] = [:]
        switch self {
        case .request(let value): id = value; kind = "request"
        case .challenge(let value, let email, let userID):
            id = value; kind = "challenge"
            extra = ["email": email, "userId": userID]
        case .code(let value, let otp): id = value; kind = "code"; extra = ["otp": otp]
        case .result(let value, let succeeded):
            id = value; kind = "result"; extra = ["success": succeeded ? "true" : "false"]
        }
        extra["version"] = "1"
        extra["kind"] = kind
        extra["requestId"] = id.uuidString
        return extra
    }

    public static func decode(_ context: [String: String]) -> Self? {
        guard context["version"] == "1", let kind = context["kind"],
              let id = context["requestId"].flatMap(UUID.init(uuidString:)) else { return nil }
        switch kind {
        case "request":
            guard Set(context.keys) == ["version", "kind", "requestId"] else { return nil }
            return .request(id)
        case "challenge":
            guard Set(context.keys) == ["version", "kind", "requestId", "email", "userId"],
                  let email = context["email"], let userID = context["userId"],
                  !email.isEmpty, !userID.isEmpty else { return nil }
            return .challenge(id, email: email, userID: userID)
        case "code":
            guard Set(context.keys) == ["version", "kind", "requestId", "otp"],
                  let otp = context["otp"], otp.count == 6, otp.allSatisfy(\.isNumber) else { return nil }
            return .code(id, otp: otp)
        case "result":
            guard Set(context.keys) == ["version", "kind", "requestId", "success"],
                  let success = context["success"], ["true", "false"].contains(success) else { return nil }
            return .result(id, succeeded: success == "true")
        default: return nil
        }
    }
}

/// The request ID binds both sides to one short-lived attempt; user IDs are
/// compared in memory but never written into watch diagnostics.
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

    /// A successful result is final for this request, even if a delayed rejection follows.
    public func acceptsResult(id: UUID, verificationSucceeded: Bool) -> Bool {
        self.id == id && !verificationSucceeded
    }

    /// A code needs the matching, live watch request and an accepted email challenge.
    public static func canVerifyCode(
        id: UUID, attempt: Self?, currentUserID: String?, challengeEmail: String?, now: Date = Date()
    ) -> Bool {
        guard let attempt, let currentUserID, challengeEmail != nil else { return false }
        return attempt.accepts(id: id, userID: currentUserID, now: now)
    }
}
