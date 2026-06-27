import NeoGymKit
import Nhost
import SwiftUI
import UIKit

struct SignUpView: View {
    @StateObject private var model: SignUpModel
    let onSignIn: () -> Void
    let onAuthenticated: (StoredSession) -> Void

    init(
        authService: any AuthServicing,
        onSignIn: @escaping () -> Void,
        onAuthenticated: @escaping (StoredSession) -> Void
    ) {
        _model = StateObject(wrappedValue: SignUpModel(authService: authService))
        self.onSignIn = onSignIn
        self.onAuthenticated = onAuthenticated
    }

    var body: some View {
        AuthScreenLayout(
            eyebrow: "Create account",
            title: model.sentTo == nil ? "Start training with context" : "Confirm your email",
            subtitle: model.sentTo == nil
                ? "Build your profile, then log workouts, nutrition, body metrics, and reflections from one place."
                : "Enter the code we sent so NeoGym can finish setting up your account.",
            systemImage: model.sentTo == nil ? "sparkles" : "envelope.badge.shield.half.filled"
        ) {
            AuthCard(
                title: model.sentTo == nil ? "Create your account" : "Enter your code",
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
                        Text("Already have an account?")
                        Button("Sign in", action: onSignIn)
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.primary)
                            .frame(minHeight: 44)
                    }
                } else {
                    Button("Use a different email") {
                        model.reset()
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.primary)
                    .frame(minHeight: 44)
                }
            }
        }
    }

    private var description: String {
        if let sentTo = model.sentTo {
            return "We sent a 6-digit code to \(sentTo)."
        }

        return "We'll email you a one-time code — no password needed."
    }

    private var requestForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            labeledTextField(
                label: "Display name",
                placeholder: "Alex Rivera",
                text: $model.displayName,
                options: TextFieldOptions(
                    contentType: .name,
                    keyboardType: .default,
                    autocapitalization: .words
                )
            )

            labeledTextField(
                label: "Email",
                placeholder: "you@example.com",
                text: $model.email,
                options: TextFieldOptions(
                    contentType: .emailAddress,
                    keyboardType: .emailAddress,
                    autocapitalization: .never
                )
            )

            if let error = model.errorMessage {
                FeedbackBanner(message: error)
            }

            Button {
                Task { await model.requestCode() }
            } label: {
                if model.isSending {
                    SignUpProgressViewLabel(title: "Sending code")
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
                SignUpProgressViewLabel(title: "Verifying")
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
        options: TextFieldOptions
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline.weight(.medium))
            TextField(placeholder, text: text)
                .keyboardType(options.keyboardType)
                .textInputAutocapitalization(options.autocapitalization)
                .disableAutocorrection(true)
                .textContentType(options.contentType)
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

private struct TextFieldOptions {
    let contentType: UITextContentType
    let keyboardType: UIKeyboardType
    let autocapitalization: TextInputAutocapitalization
}

private struct SignUpProgressViewLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(title)
        }
    }
}

#Preview("Sign up") {
    ScreenScaffold {
        SignUpView(authService: NeoGymPreviewAuthService(), onSignIn: {}, onAuthenticated: { _ in })
    }
}
