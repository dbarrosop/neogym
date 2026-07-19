import Foundation

public enum AuthDeepLink: Equatable, Sendable {
    case code(String)
    case error(code: String?, description: String)

    public static func parse(
        _ url: URL,
        callbackScheme: String
    ) throws -> AuthDeepLink {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == callbackScheme,
              components.host == "verify",
              components.path.isEmpty
        else {
            throw AuthDeepLinkParseError.unsupportedURL
        }

        let queryItems = components.queryItems ?? []

        if let errorCode = queryItems.firstNonEmptyValue(named: "error") {
            let description = queryItems.firstNonEmptyValue(named: "errorDescription")
                ?? queryItems.firstNonEmptyValue(named: "error_description")
                ?? errorCode
            return .error(code: errorCode, description: description)
        }

        guard let code = queryItems.firstNonEmptyValue(named: "code") else {
            throw AuthDeepLinkParseError.missingCode
        }

        return .code(code)
    }
}

public enum AuthDeepLinkParseError: LocalizedError, Equatable, Sendable {
    case unsupportedURL
    case missingCode

    public var errorDescription: String? {
        switch self {
        case .unsupportedURL:
            "This link is not a supported NeoGym verification callback."
        case .missingCode:
            "The verification callback is missing its authorization code."
        }
    }
}

private extension [URLQueryItem] {
    func firstNonEmptyValue(named name: String) -> String? {
        first { $0.name == name }?
            .value?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
