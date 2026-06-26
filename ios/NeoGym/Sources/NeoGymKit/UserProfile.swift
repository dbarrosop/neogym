import Foundation
import Nhost

public struct UserProfile: Equatable, Sendable {
    public let id: String
    public let displayName: String
    public let email: String?
    public let emailDisplay: String
    public let initials: String
    public let locale: String
    public let defaultRole: String
    public let memberSince: String
    public let avatarURLString: String

    public init(
        user: AuthUser,
        dateFormatter: DateFormatter = UserProfile.defaultMemberSinceFormatter()
    ) {
        id = user.id
        avatarURLString = user.avatarUrl

        let trimmedDisplayName = user.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        displayName = trimmedDisplayName.isEmpty ? "Athlete" : trimmedDisplayName

        let trimmedEmail = user.email?.trimmingCharacters(in: .whitespacesAndNewlines)
        email = trimmedEmail?.isEmpty == false ? trimmedEmail : nil
        emailDisplay = email ?? "—"

        let trimmedLocale = user.locale.trimmingCharacters(in: .whitespacesAndNewlines)
        locale = trimmedLocale.isEmpty ? "—" : trimmedLocale

        let trimmedDefaultRole = user.defaultRole.trimmingCharacters(in: .whitespacesAndNewlines)
        defaultRole = trimmedDefaultRole.isEmpty ? "—" : trimmedDefaultRole

        memberSince = dateFormatter.string(from: user.createdAt)
        initials = Self.initials(displayName: trimmedDisplayName, email: email)
    }

    public static func defaultMemberSinceFormatter(locale: Locale = .current) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter
    }

    private static func initials(displayName: String, email: String?) -> String {
        let source = displayName.isEmpty ? (email ?? "") : displayName
        let pieces = source
            .split(whereSeparator: { $0.isWhitespace })
            .compactMap { $0.first }
            .prefix(2)
            .map { String($0).uppercased() }
            .joined()

        if !pieces.isEmpty {
            return pieces
        }

        if let firstEmailCharacter = email?.first {
            return String(firstEmailCharacter).uppercased()
        }

        return "?"
    }
}
