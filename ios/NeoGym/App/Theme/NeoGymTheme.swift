import SwiftUI

enum NeoGymTheme {
    // MARK: - Legacy aliases kept during the visual-system migration

    static let cardCornerRadius: CGFloat = radiusXXL
    static let controlCornerRadius: CGFloat = radiusMD
    static let maxCardWidth: CGFloat = 430

    static var cardFill: Color { glassFill }
    static var border: Color { glassStroke }
    static var mutedText: Color { Color(.secondaryLabel) }
    static var mutedFill: Color { glassSubtleFill }

    // MARK: - Semantic palette

    static var canvasBase: Color { Color(.systemBackground) }
    static var canvasElevated: Color { Color(.secondarySystemBackground) }
    static var canvasFallback: Color { Color(.systemGroupedBackground) }

    static var primaryText: Color { Color(.label) }
    static var secondaryText: Color { Color(.secondaryLabel) }
    static var tertiaryText: Color { Color(.tertiaryLabel) }

    static var accent: Color { Color.accentColor }
    static var accentSoft: Color { Color.accentColor.opacity(0.18) }
    static var accentMuted: Color { Color.accentColor.opacity(0.10) }

    static var success: Color { Color.green }
    static var warning: Color { Color.orange }
    static var danger: Color { Color.red }
    static var info: Color { Color.blue }

    // MARK: - Glass system

    static var glassFill: Color { Color(.systemBackground).opacity(0.58) }
    static var glassStrongFill: Color { Color(.systemBackground).opacity(0.76) }
    static var glassSubtleFill: Color { Color(.secondarySystemBackground).opacity(0.42) }
    static var glassFallbackFill: Color { Color(.secondarySystemBackground).opacity(0.96) }
    static var glassStroke: Color { Color.white.opacity(0.26) }
    static var glassStrokeSecondary: Color { Color.primary.opacity(0.08) }
    static var glassHighlight: LinearGradient {
        LinearGradient(
            colors: [Color.white.opacity(0.72), Color.white.opacity(0.18), Color.clear],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var glassShadow: Color { Color.black.opacity(0.14) }
    static var glassAmbientShadow: Color { Color.accentColor.opacity(0.08) }

    // MARK: - Gradients

    static var canvasGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color(.systemBackground),
                Color(.secondarySystemBackground),
                Color(.systemBackground),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var auroraPrimary: Color { Color.purple.opacity(0.22) }
    static var auroraSecondary: Color { Color.blue.opacity(0.18) }
    static var auroraTertiary: Color { Color.cyan.opacity(0.12) }

    static var primaryActionGradient: LinearGradient {
        LinearGradient(
            colors: [Color.accentColor, Color.purple.opacity(0.92)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Spacing and shape

    static let spacingXXS: CGFloat = 4
    static let spacingXS: CGFloat = 8
    static let spacingSM: CGFloat = 12
    static let spacingMD: CGFloat = 16
    static let spacingLG: CGFloat = 20
    static let spacingXL: CGFloat = 24
    static let spacingXXL: CGFloat = 32

    static let screenHorizontalPadding: CGFloat = 20
    static let screenVerticalPadding: CGFloat = 24
    static let dockContentExtraInset: CGFloat = 52
    static let topSectionBarContentClearance: CGFloat = 82
    static let dockRootContentClearance: CGFloat = 80
    static let dockContentClearance: CGFloat = 140

    static let radiusSM: CGFloat = 12
    static let radiusMD: CGFloat = 14
    static let radiusLG: CGFloat = 18
    static let radiusXL: CGFloat = 24
    static let radiusXXL: CGFloat = 28
    static let radiusPill: CGFloat = 999

    static let hairline: CGFloat = 1

    // MARK: - Elevation

    static let elevationLowRadius: CGFloat = 12
    static let elevationMediumRadius: CGFloat = 24
    static let elevationHighRadius: CGFloat = 36
    static let elevationLowY: CGFloat = 6
    static let elevationMediumY: CGFloat = 14
    static let elevationHighY: CGFloat = 22
}
