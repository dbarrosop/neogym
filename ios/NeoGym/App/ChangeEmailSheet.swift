import NeoGymKit
import SwiftUI

struct ChangeEmailSheet: View {
    @ObservedObject var model: ChangeEmailModel
    let currentEmailDisplay: String
    let dismiss: () -> Void

    var body: some View {
        NavigationView {
            ScreenScaffold {
                ScrollView {
                    VStack(alignment: .leading, spacing: NeoGymTheme.spacingXL) {
                        sheetHero
                        formPanel
                    }
                    .frame(maxWidth: 620, alignment: .leading)
                    .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                    .padding(.vertical, NeoGymTheme.spacingXL)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Change email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done", action: dismiss)
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private var sheetHero: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            ZStack {
                Circle()
                    .fill(NeoGymTheme.accentSoft)
                    .frame(width: 76, height: 76)
                    .blur(radius: 14)
                    .offset(x: 10, y: 8)
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 62, height: 62)
                    .overlay(Circle().stroke(NeoGymTheme.glassStrokeSecondary))
                Image(systemName: "envelope.open.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(NeoGymTheme.accent)
            }
            .accessibilityHidden(true)

            Text("Verify a new address")
                .font(.title2.bold())
                .tracking(-0.4)
            Text("We'll send a PKCE-protected link that returns to NeoGym with the native callback URL.")
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var formPanel: some View {
        GlassPanel(
            cornerRadius: NeoGymTheme.radiusXXL,
            material: .regular,
            tint: NeoGymTheme.glassStrongFill,
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingXL,
                leading: NeoGymTheme.spacingXL,
                bottom: NeoGymTheme.spacingXL,
                trailing: NeoGymTheme.spacingXL
            )
        ) {
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
                        .background(NeoGymTheme.glassSubtleFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(NeoGymTheme.glassStrokeSecondary)
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
                    "Opening the link returns to NeoGym with a one-time PKCE code. "
                        + "Your verifier stays on this device and is cleared after the callback completes."
                )
                .font(.footnote)
                .foregroundColor(NeoGymTheme.mutedText)
                .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
