import SwiftUI

struct AppLoadingStateView: View {
    var title: String = "Loading"
    var message: String?

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingSM) {
            ProgressView()
                .controlSize(.large)
                .tint(NeoGymTheme.accent)
            Text(title)
                .font(.headline)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(NeoGymTheme.spacingLG)
    }
}

struct AppErrorStateView: View {
    let title: String
    let message: String
    var retryTitle: String = "Try again"
    let retry: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
            Label(title, systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundColor(NeoGymTheme.danger)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
            if let retry {
                Button(retryTitle, action: retry)
                    .buttonStyle(NeoGymSecondaryButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingLG)
    }
}

struct AppEmptyStateView: View {
    let title: String
    let message: String
    var systemImage: String = "tray"

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingSM) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .semibold))
                .foregroundColor(NeoGymTheme.mutedText)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(NeoGymTheme.spacingLG)
    }
}

struct ConfirmationPanel: View {
    let title: String
    let message: String
    var confirmTitle: String = "Confirm"
    var cancelTitle: String = "Cancel"
    let confirm: () -> Void
    let cancel: () -> Void

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                HStack(spacing: NeoGymTheme.spacingSM) {
                    Button(cancelTitle, action: cancel)
                        .buttonStyle(NeoGymSecondaryButtonStyle())
                    Button(confirmTitle, action: confirm)
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            Text(title)
                .font(.headline)
        }
    }
}

struct SectionShell<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: Content

    var body: some View {
        GroupBox {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                Text(title)
                    .font(.title2.bold())
                    .tracking(-0.4)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
        }
        .groupBoxStyle(.automatic)
    }
}
