import SwiftUI

/// Design tokens from the unified NeoGym design (root CLAUDE.md, "UI design
/// system"). Colours live in the asset catalog with Any (light) and Dark
/// variants; dark is the default appearance. Views use these tokens, never hex.
enum NeoGymTheme {
    // MARK: - Colour tokens

    static let background = Color("ThemeBackground")
    /// Cards, rows and sheets.
    static let surface = Color("ThemeSurface")
    /// Tiles inside cards.
    static let inset = Color("ThemeInset")
    /// Segmented track, secondary buttons, chips, meter tracks.
    static let fill = Color("ThemeFill")
    static let segmentedThumb = Color("ThemeSegmentedThumb")
    static let separator = Color("ThemeSeparator")

    static let text = Color("ThemeText")
    static let textSecondary = Color("ThemeTextSecondary")
    /// Captions on surfaces only.
    static let textTertiary = Color("ThemeTextTertiary")

    /// Accent fill for buttons, selection and bars; white labels pass 4.5:1.
    static let accent = Color("AccentColor")
    /// Text-coloured accent for links and icons.
    static let accentText = Color("ThemeAccentText")
    /// Selected pills and tags.
    static let accentSoft = Color("ThemeAccentSoft")
    /// Chart series 1 (blue): weight, resting energy, consumed, volume, sets.
    /// The chart pair is checked for colour-blind separation on both surfaces;
    /// colour follows the metric, never its position in a chart.
    static let chart1 = Color("ThemeChart1")
    /// Chart series 2 (orange): body fat, active energy, net, Est. 1RM.
    static let chart2 = Color("ThemeChart2")
    /// Carbs in macro meters and slot dots (macros keep their own colours).
    /// Fills only, never text.
    static let carbs = Color("ThemeCarbs")
    static let positive = Color("ThemePositive")
    /// Destructive text.
    static let destructive = Color("ThemeDestructive")
    /// Destructive fills.
    static let destructiveFill = Color("ThemeDestructiveFill")
    /// Labels and glyphs on accent or destructive fills (white passes 4.5:1).
    static let onFill = Color.white

    // MARK: - Spacing (4 / 8 / 12 / 16 / 20 / 24 / 32)

    static let spacingXXS: CGFloat = 4
    static let spacingXS: CGFloat = 8
    static let spacingSM: CGFloat = 12
    static let spacingMD: CGFloat = 16
    static let spacingLG: CGFloat = 20
    static let spacingXL: CGFloat = 24
    static let spacingXXL: CGFloat = 32

    static let screenHorizontalPadding: CGFloat = 16
    static let screenVerticalPadding: CGFloat = 16
    static let contentMaxWidth: CGFloat = 760

    // MARK: - Shape

    /// Controls (text fields, small buttons).
    static let radiusSM: CGFloat = 12
    /// Tiles and larger controls.
    static let radiusMD: CGFloat = 14
    static let radiusLG: CGFloat = 18
    /// Cards.
    static let radiusXL: CGFloat = 22
    static let radiusPill: CGFloat = 999

    static let hairline: CGFloat = 1
    static let minimumTapTarget: CGFloat = 44
}
