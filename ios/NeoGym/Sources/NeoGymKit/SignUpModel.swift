import Combine
import Foundation
import Nhost

@MainActor
public final class SignUpModel: ObservableObject {
    @Published public var displayName: String
    @Published public var email: String
    @Published public private(set) var sentTo: String?
    @Published public var otp: String
    @Published public private(set) var isSending: Bool
    @Published public private(set) var isVerifying: Bool
    @Published public private(set) var errorMessage: String?

    private let authService: any AuthServicing

    public init(
        authService: any AuthServicing,
        displayName: String = "",
        email: String = "",
        sentTo: String? = nil,
        otp: String = ""
    ) {
        self.authService = authService
        self.displayName = displayName
        self.email = email
        self.sentTo = sentTo
        self.otp = otp
        isSending = false
        isVerifying = false
    }

    public func requestCode() async {
        errorMessage = nil

        do {
            let normalizedDisplayName = try AuthValidation.normalizedDisplayName(displayName)
            let normalizedEmail = try AuthValidation.normalizedEmail(email)
            isSending = true
            defer { isSending = false }

            try await authService.requestSignUpOTP(email: normalizedEmail, displayName: normalizedDisplayName)
            sentTo = normalizedEmail
            otp = ""
        } catch {
            errorMessage = Self.message(for: error, fallback: "Sign up failed")
        }
    }

    public func verifyCode() async -> StoredSession? {
        guard !isVerifying else {
            return nil
        }

        errorMessage = nil

        guard let sentTo else {
            errorMessage = "Request a code first."
            return nil
        }

        do {
            let normalizedOTP = try AuthValidation.normalizedOTP(otp)
            isVerifying = true
            defer { isVerifying = false }

            guard let session = try await authService.verifySignInOTP(email: sentTo, otp: normalizedOTP) else {
                self.otp = ""
                errorMessage = "We couldn't verify that code. Try again."
                return nil
            }

            return session
        } catch {
            otp = ""
            let message = Self.message(for: error, fallback: "Verification failed")
            #if DEBUG
            print("NeoGym sign-up OTP verify failed: \(message)")
            #endif
            errorMessage = message
            return nil
        }
    }

    public func updateOTP(_ code: String) {
        otp = Self.normalizedOTPInput(code)
    }

    public func reset() {
        sentTo = nil
        otp = ""
        errorMessage = nil
        isSending = false
        isVerifying = false
    }

    private static func normalizedOTPInput(_ value: String) -> String {
        String(value.filter(\.isNumber).prefix(6))
    }

    private static func message(for error: Error, fallback: String) -> String {
        if let decodingMessage = decodingErrorMessage(error) {
            return decodingMessage
        }

        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }

        let description = error.localizedDescription
        return description.isEmpty ? fallback : description
    }

    private static func decodingErrorMessage(_ error: Error) -> String? {
        let path: ([CodingKey]) -> String = { keys in
            keys.map(\.stringValue).joined(separator: ".")
        }

        switch error {
        case let DecodingError.valueNotFound(type, context):
            return "DecodingError.valueNotFound type=\(type) path=\(path(context.codingPath)) debug=\(context.debugDescription)"
        case let DecodingError.keyNotFound(key, context):
            return "DecodingError.keyNotFound key=\(key.stringValue) path=\(path(context.codingPath)) debug=\(context.debugDescription)"
        case let DecodingError.typeMismatch(type, context):
            return "DecodingError.typeMismatch type=\(type) path=\(path(context.codingPath)) debug=\(context.debugDescription)"
        case let DecodingError.dataCorrupted(context):
            return "DecodingError.dataCorrupted path=\(path(context.codingPath)) debug=\(context.debugDescription)"
        default:
            return nil
        }
    }
}
