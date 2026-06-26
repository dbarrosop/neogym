import SwiftUI

enum NeoGymTheme {
    static let cardCornerRadius: CGFloat = 28
    static let controlCornerRadius: CGFloat = 14
    static let maxCardWidth: CGFloat = 430

    static var cardFill: Color {
        Color(.systemBackground).opacity(0.88)
    }

    static var border: Color {
        Color.primary.opacity(0.08)
    }

    static var mutedText: Color {
        Color(.secondaryLabel)
    }

    static var mutedFill: Color {
        Color(.secondarySystemBackground).opacity(0.72)
    }
}
