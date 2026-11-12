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
            IconBadge(systemImage: "envelope.open.fill", diameter: 62, symbolSize: 24)
            .accessibilityHidden(true)

            Text("Verify a new address")
                .font(.title2.bold())
                .tracking(-0.4)
            Text("We'll send a PKCE-protected link that returns to NeoGym with the native callback URL.")
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var formPanel: some View {
        SurfaceCard(
            cornerRadius: NeoGymTheme.radiusXL,
            fill: NeoGymTheme.surface,
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
                        .foregroundColor(NeoGymTheme.textSecondary)
                    Text(currentEmailDisplay)
                        .font(.subheadline.weight(.medium))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("New email")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(NeoGymTheme.textSecondary)
                    TextField("athlete@example.com", text: $model.newEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(
                            NeoGymTheme.inset,
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(NeoGymTheme.separator)
                        )
                }

                if let message = model.errorMessage {
                    FeedbackBanner(message: message)
                }

                if let message = model.successMessage {
                    FeedbackBanner(message: message, tone: .info)
                }

                PrimaryActionButton(
                    title: "Send verification link",
                    busyTitle: "Sending link",
                    isBusy: model.isRequesting,
                    isEnabled: !model.isHandlingCallback
                ) {
                    Task { await model.requestEmailChange() }
                }

                Text(
                    "Opening the link returns to NeoGym with a one-time PKCE code. "
                        + "Your verifier stays on this device and is cleared after the callback completes."
                )
                .font(.footnote)
                .foregroundColor(NeoGymTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
