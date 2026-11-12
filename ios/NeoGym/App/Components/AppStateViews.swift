import SwiftUI

struct AppLoadingStateView: View {
    var title: String = "Loading"
    var message: String?

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingSM) {
            ProgressView()
                .controlSize(.large)
                .tint(NeoGymTheme.accentText)
            Text(title)
                .font(.headline)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.textSecondary)
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
                .foregroundColor(NeoGymTheme.destructive)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.textSecondary)
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
                .foregroundColor(NeoGymTheme.textSecondary)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(NeoGymTheme.spacingLG)
    }
}

struct SectionShell<Content: View>: View {
    let title: String
    var subtitle: String?
    var isLoading = false
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                HStack(spacing: NeoGymTheme.spacingXS) {
                    Text(title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(NeoGymTheme.text)
                        .accessibilityAddTraits(.isHeader)
                    if isLoading {
                        ProgressView()
                            .controlSize(.small)
                            .accessibilityLabel("Loading \(title)")
                    }
                }
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
            }
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}
