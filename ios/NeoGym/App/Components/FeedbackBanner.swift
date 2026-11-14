import SwiftUI

struct FeedbackBanner: View {
    enum Tone {
        case error
        case info

        var color: Color {
            switch self {
            case .error:
                return NeoGymTheme.destructive
            case .info:
                return NeoGymTheme.accentText
            }
        }

        var icon: String {
            switch self {
            case .error:
                return "exclamationmark.triangle.fill"
            case .info:
                return "info.circle.fill"
            }
        }
    }

    let message: String
    var tone: Tone = .error

    var body: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingSM) {
            Image(systemName: tone.icon)
                .foregroundColor(tone.color)
                .font(.subheadline.weight(.semibold))
            Text(message)
                .font(.footnote)
                .foregroundColor(NeoGymTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(NeoGymTheme.spacingSM)
        .cardSurface(
            cornerRadius: NeoGymTheme.radiusSM,
            fill: tone.color.opacity(0.08),
            stroke: tone.color.opacity(0.24)
        )
    }
}
