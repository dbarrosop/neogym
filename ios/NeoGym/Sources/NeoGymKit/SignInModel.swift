import Combine
import Foundation
import Nhost

@MainActor
public final class SignInModel: ObservableObject {
    @Published public var email: String
    @Published public private(set) var sentTo: String?
    @Published public var otp: String
    @Published public private(set) var isSending: Bool
    @Published public private(set) var isVerifying: Bool
    @Published public private(set) var errorMessage: String?

    private let authService: any AuthServicing

    public init(
        authService: any AuthServicing,
        email: String = "",
        sentTo: String? = nil,
        otp: String = ""
    ) {
        self.authService = authService
        self.email = email
        self.sentTo = sentTo
        self.otp = otp
        isSending = false
        isVerifying = false
    }

    public func requestCode() async {
        errorMessage = nil

        do {
            let normalizedEmail = try AuthValidation.normalizedEmail(email)
            isSending = true
            defer { isSending = false }

            try await authService.requestSignInOTP(email: normalizedEmail)
            sentTo = normalizedEmail
            otp = ""
        } catch {
            errorMessage = Self.message(for: error, fallback: "Couldn't send code")
        }
    }

    public func verifyCode() async -> StoredSession? {
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
            errorMessage = Self.message(for: error, fallback: "Sign in failed")
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
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }

        let description = error.localizedDescription
        return description.isEmpty ? fallback : description
    }
}
