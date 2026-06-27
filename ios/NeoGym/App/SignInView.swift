import NeoGymKit
import Nhost
import SwiftUI
import UIKit

struct SignInView: View {
    @StateObject private var model: SignInModel
    let onSignUp: () -> Void
    let onAuthenticated: (StoredSession) -> Void

    init(
        authService: any AuthServicing,
        onSignUp: @escaping () -> Void,
        onAuthenticated: @escaping (StoredSession) -> Void
    ) {
        _model = StateObject(wrappedValue: SignInModel(authService: authService))
        self.onSignUp = onSignUp
        self.onAuthenticated = onAuthenticated
    }

    var body: some View {
        AuthScreenLayout(
            eyebrow: "Sign in",
            title: model.sentTo == nil ? "Welcome back to NeoGym" : "Check your inbox",
            subtitle: model.sentTo == nil
                ? "Pick up your training log, body metrics, nutrition plans, and journal without a password."
                : "Your one-time passcode keeps this device connected to the same secure account.",
            systemImage: model.sentTo == nil ? "figure.strengthtraining.traditional" : "envelope.badge.shield.half.filled"
        ) {
            AuthCard(
                title: model.sentTo == nil ? "Email sign in" : "Enter your code",
                description: description
            ) {
                if model.sentTo == nil {
                    requestForm
                } else {
                    otpForm
                }
            } footer: {
                if model.sentTo == nil {
                    HStack(spacing: 4) {
                        Text("New here?")
                        Button("Create an account", action: onSignUp)
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.primary)
                    }
                } else {
                    Button("Use a different email") {
                        model.reset()
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.primary)
                }
            }
        }
    }

    private var description: String {
        if let sentTo = model.sentTo {
            return "If an account exists for \(sentTo), you'll receive a 6-digit code shortly."
        }

        return "Enter your email and we'll send you a one-time code."
    }

    private var requestForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            labeledTextField(
                label: "Email",
                placeholder: "you@example.com",
                text: $model.email,
                contentType: .emailAddress,
                keyboardType: .emailAddress
            )

            if let error = model.errorMessage {
                FeedbackBanner(message: error)
            }

            Button {
                Task { await model.requestCode() }
            } label: {
                if model.isSending {
                    ProgressViewLabel(title: "Sending code")
                } else {
                    Text("Send code")
                }
            }
            .buttonStyle(NeoGymPrimaryButtonStyle())
            .disabled(model.isSending)
        }
    }

    private var otpForm: some View {
        VStack(spacing: 16) {
            OTPCodeField(code: $model.otp, isDisabled: model.isVerifying) { _ in
                verify()
            }

            if model.isVerifying {
                ProgressViewLabel(title: "Verifying")
                    .font(.footnote)
                    .foregroundColor(NeoGymTheme.mutedText)
            }

            if let error = model.errorMessage {
                FeedbackBanner(message: error)
            }

            Button("Verify code") {
                verify()
            }
            .buttonStyle(NeoGymPrimaryButtonStyle())
            .disabled(model.isVerifying || model.otp.count != 6)
        }
        .frame(maxWidth: .infinity)
    }

    private func verify() {
        Task {
            if let session = await model.verifyCode() {
                onAuthenticated(session)
            }
        }
    }

    private func labeledTextField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType,
        keyboardType: UIKeyboardType
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline.weight(.medium))
            TextField(placeholder, text: text)
                .keyboardType(keyboardType)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .textContentType(contentType)
                .padding(13)
                .background(
                    NeoGymTheme.glassSubtleFill,
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary)
                )
        }
    }
}

private struct ProgressViewLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(title)
        }
    }
}
