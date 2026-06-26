import NeoGymKit
import SwiftUI

struct ChangeEmailSheet: View {
    @ObservedObject var model: ChangeEmailModel
    let currentEmailDisplay: String
    let dismiss: () -> Void

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Current email")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(NeoGymTheme.mutedText)
                    Text(currentEmailDisplay)
                        .font(.subheadline.weight(.medium))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("New email")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(NeoGymTheme.mutedText)
                    TextField("athlete@example.com", text: $model.newEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(NeoGymTheme.border)
                        )
                }

                if let message = model.errorMessage {
                    FeedbackBanner(message: message)
                }

                if let message = model.successMessage {
                    FeedbackBanner(message: message, tone: .info)
                }

                Button {
                    Task { await model.requestEmailChange() }
                } label: {
                    if model.isRequesting {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Sending link")
                        }
                    } else {
                        Text("Send verification link")
                    }
                }
                .buttonStyle(NeoGymPrimaryButtonStyle())
                .disabled(model.isRequesting || model.isHandlingCallback)

                Text(
                    "We'll send a verification link to the new address. "
                        + "Opening the link returns to NeoGym with a one-time PKCE code."
                )
                    .font(.footnote)
                    .foregroundColor(NeoGymTheme.mutedText)

                Spacer(minLength: 0)
            }
            .padding(20)
            .navigationTitle("Change email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done", action: dismiss)
                }
            }
        }
    }
}
