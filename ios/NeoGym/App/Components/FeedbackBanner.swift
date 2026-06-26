import SwiftUI

struct FeedbackBanner: View {
    enum Tone {
        case error
        case info

        var color: Color {
            switch self {
            case .error:
                return Color.red
            case .info:
                return Color.blue
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
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: tone.icon)
                .foregroundColor(tone.color)
            Text(message)
                .font(.footnote)
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(tone.color.opacity(0.09), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(tone.color.opacity(0.22))
        )
    }
}
