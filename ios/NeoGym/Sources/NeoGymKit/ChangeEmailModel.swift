import Combine
import Foundation
import Nhost

public struct PKCEPair: Sendable, Equatable {
    public let verifier: String
    public let challenge: String

    public init(verifier: String, challenge: String) {
        self.verifier = verifier
        self.challenge = challenge
    }
}

public enum ChangeEmailModelError: LocalizedError, Equatable, Sendable {
    case sameEmail
    case missingVerifier
    case exchangeDidNotReturnSession

    public var errorDescription: String? {
        switch self {
        case .sameEmail:
            "Enter a different email address."
        case .missingVerifier:
            "The saved verification state is missing. Request a new email-change link."
        case .exchangeDidNotReturnSession:
            "The verification succeeded, but NeoGym could not refresh your session. Sign in again to continue."
        }
    }
}

@MainActor
public final class ChangeEmailModel: ObservableObject {
    public static let nativeRedirectURL = "neogym://verify"

    @Published public var newEmail: String
    @Published public private(set) var sentTo: String?
    @Published public private(set) var isRequesting: Bool
    @Published public private(set) var isHandlingCallback: Bool
    @Published public private(set) var errorMessage: String?
    @Published public private(set) var successMessage: String?

    public let currentEmail: String?

    private let authService: any AuthServicing
    private let verifierStore: any PKCEVerifierStoring
    private let redirectTo: String
    private let generatePKCEPair: @Sendable () -> PKCEPair

    public init(
        authService: any AuthServicing,
        verifierStore: any PKCEVerifierStoring = KeychainPKCEVerifierStore(),
        currentEmail: String?,
        newEmail: String = "",
        redirectTo: String = ChangeEmailModel.nativeRedirectURL,
        generatePKCEPair: @escaping @Sendable () -> PKCEPair = {
            let pair = PKCE.generatePair()
            return PKCEPair(verifier: pair.verifier, challenge: pair.challenge)
        }
    ) {
        self.authService = authService
        self.verifierStore = verifierStore
        self.currentEmail = currentEmail
        self.newEmail = newEmail
        self.redirectTo = redirectTo
        self.generatePKCEPair = generatePKCEPair
        sentTo = nil
        isRequesting = false
        isHandlingCallback = false
    }

    public func requestEmailChange() async {
        errorMessage = nil
        successMessage = nil

        do {
            let normalizedEmail = try AuthValidation.normalizedEmail(newEmail)
            guard !Self.emailsMatch(normalizedEmail, currentEmail) else {
                throw ChangeEmailModelError.sameEmail
            }

            isRequesting = true
            defer { isRequesting = false }

            let pair = generatePKCEPair()
            try await verifierStore.saveVerifier(pair.verifier)

            do {
                try await authService.requestEmailChange(
                    newEmail: normalizedEmail,
                    redirectTo: redirectTo,
                    codeChallenge: pair.challenge
                )
            } catch {
                try? await verifierStore.clearVerifier()
                throw error
            }

            sentTo = normalizedEmail
            successMessage = "Check \(normalizedEmail) for the verification link."
        } catch {
            errorMessage = Self.message(for: error, fallback: "Couldn't request email change")
        }
    }

    @discardableResult
    public func handleCallback(url: URL) async -> StoredSession? {
        errorMessage = nil
        successMessage = nil
        isHandlingCallback = true

        let session: StoredSession?
        do {
            session = try await exchangeSession(from: url)
            successMessage = "Your email address was updated."
        } catch {
            session = nil
            errorMessage = Self.message(for: error, fallback: "Email verification failed")
        }

        try? await verifierStore.clearVerifier()
        isHandlingCallback = false
        return session
    }

    public func resetFeedback() {
        errorMessage = nil
        successMessage = nil
    }

    private func exchangeSession(from url: URL) async throws -> StoredSession {
        switch try AuthDeepLink.parse(url) {
        case let .error(_, description):
            throw CallbackError(message: description)
        case let .code(code):
            guard let verifier = try await verifierStore.loadVerifier(), !verifier.isEmpty else {
                throw ChangeEmailModelError.missingVerifier
            }

            guard let session = try await authService.exchangeToken(code: code, codeVerifier: verifier) else {
                throw ChangeEmailModelError.exchangeDidNotReturnSession
            }

            return session
        }
    }

    private static func emailsMatch(_ lhs: String, _ rhs: String?) -> Bool {
        guard let rhs = rhs?.trimmingCharacters(in: .whitespacesAndNewlines), !rhs.isEmpty else {
            return false
        }

        return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedSame
    }

    private static func message(for error: Error, fallback: String) -> String {
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }

        let description = error.localizedDescription
        return description.isEmpty ? fallback : description
    }
}

private struct CallbackError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
}
