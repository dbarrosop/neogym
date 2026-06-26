import SwiftUI

struct AppLoadingStateView: View {
    var title: String = "Loading"
    var message: String?

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
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
        .padding(20)
    }
}

struct AppErrorStateView: View {
    let title: String
    let message: String
    var retryTitle: String = "Try again"
    let retry: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundColor(.red)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
            if let retry {
                Button(retryTitle, action: retry)
                    .buttonStyle(NeoGymSecondaryButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
    }
}

struct AppEmptyStateView: View {
    let title: String
    let message: String
    var systemImage: String = "tray"

    var body: some View {
        VStack(spacing: 12) {
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
        .padding(20)
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
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
            HStack {
                Button(cancelTitle, action: cancel)
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                Button(confirmTitle, action: confirm)
                    .buttonStyle(NeoGymPrimaryButtonStyle())
            }
        }
        .padding(20)
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(NeoGymTheme.border)
        )
    }
}

struct SectionShell<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.bold())
                    .tracking(-0.4)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            Divider()
            content
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(NeoGymTheme.border)
        )
        .shadow(color: Color.accentColor.opacity(0.06), radius: 24, y: 12)
    }
}
