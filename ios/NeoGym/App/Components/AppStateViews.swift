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

/// The design's empty state: the icon on an accent-soft tile, a title, a
/// message and an optional primary action. It sits directly on the page
/// background (no card) when it stands for a whole section; inside a card it
/// takes the card's surface.
struct AppEmptyStateView: View {
    let title: String
    let message: String
    var systemImage: String = "tray"
    var actionTitle: String?
    var action: (@MainActor () -> Void)?

    @ScaledMetric(relativeTo: .title2) private var tileSize: CGFloat = 64

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingSM) {
            Image(systemName: systemImage)
                .font(.title.weight(.semibold))
                .foregroundStyle(NeoGymTheme.accentText)
                .frame(width: tileSize, height: tileSize)
                .background(
                    RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous)
                        .fill(NeoGymTheme.accentSoft)
                )
                .accessibilityHidden(true)
            Text(title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.body)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .tint(NeoGymTheme.accent)
                    .font(.headline)
                    .padding(.top, NeoGymTheme.spacingXS)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingXXL)
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
