import Foundation

public enum ValidationError: LocalizedError, Equatable, Sendable {
    case invalidEmail
    case displayNameRequired
    case displayNameTooLong(maxLength: Int)
    case invalidOTP

    public var errorDescription: String? {
        switch self {
        case .invalidEmail:
            "Enter a valid email address"
        case .displayNameRequired:
            "Display name is required"
        case let .displayNameTooLong(maxLength):
            "Display name must be at most \(maxLength) characters"
        case .invalidOTP:
            "Enter the 6-digit code"
        }
    }
}

public enum AuthValidation: Sendable {
    public static let displayNameMaxLength = 60

    public static func normalizedEmail(_ email: String) throws -> String {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$"#
        let predicate = NSPredicate(format: "SELF MATCHES[c] %@", pattern)

        guard predicate.evaluate(with: trimmed) else {
            throw ValidationError.invalidEmail
        }

        return trimmed
    }

    public static func normalizedDisplayName(_ displayName: String) throws -> String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmed.isEmpty else {
            throw ValidationError.displayNameRequired
        }

        guard trimmed.count <= displayNameMaxLength else {
            throw ValidationError.displayNameTooLong(maxLength: displayNameMaxLength)
        }

        return trimmed
    }

    public static func normalizedOTP(_ otp: String) throws -> String {
        let digits = otp.trimmingCharacters(in: .whitespacesAndNewlines)

        guard digits.count == 6, digits.allSatisfy(\.isNumber) else {
            throw ValidationError.invalidOTP
        }

        return digits
    }
}
