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
        .foregroundColor(prominent ? .white : .primary)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(badgeBackground)
    }

    @ViewBuilder
    private var badgeBackground: some View {
        if prominent {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(Capsule(style: .continuous).fill(NeoGymTheme.glassSubtleFill))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
        }
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
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassFill,
                shadow: false
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
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                if let delta {
                    Text(delta)
                        .font(.caption.monospacedDigit())
                        .foregroundColor(delta.hasPrefix("+") ? .green : .red)
                }
            }
            Text(value)
                .font(.title3.bold().monospacedDigit())
        }
        .padding(NeoGymTheme.spacingSM)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassFill,
            shadow: false
        )
    }
}
