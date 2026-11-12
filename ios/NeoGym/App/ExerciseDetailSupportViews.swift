import SwiftUI

struct BadgeText: View {
    let text: String
    var systemImage: String?
    var prominent = false

    init(_ text: String, systemImage: String? = nil, prominent: Bool = false) {
        self.text = text
        self.systemImage = systemImage
        self.prominent = prominent
    }

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(prominent ? Color.white : NeoGymTheme.text)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(badgeBackground)
    }

    @ViewBuilder
    private var badgeBackground: some View {
        Capsule(style: .continuous)
            .fill(prominent ? NeoGymTheme.accent : NeoGymTheme.fill)
    }
}

struct ExerciseFlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 96), spacing: spacing)],
            alignment: .leading,
            spacing: spacing
        ) {
            content
        }
    }
}

extension View {
    func historyRowStyle() -> some View {
        padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                fill: NeoGymTheme.surface
            )
    }
}

struct ProgressMetricCard: View {
    let title: String
    let value: String
    let delta: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.textSecondary)
                Spacer()
                if let delta {
                    Text(delta)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(delta.hasPrefix("+") ? NeoGymTheme.positive : NeoGymTheme.destructive)
                }
            }
            Text(value)
                .font(.title3.bold().monospacedDigit())
        }
        .padding(NeoGymTheme.spacingSM)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            fill: NeoGymTheme.surface
        )
    }
}
