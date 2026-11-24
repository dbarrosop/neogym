import SwiftUI

/// The app's design tokens for the widget extension (copied colour sets in
/// `Widgets/Assets.xcassets`, with the same Any/Dark values as `NeoGymTheme`).
enum WidgetTheme {
    static let surface = Color("ThemeSurface")
    static let fill = Color("ThemeFill")
    static let separator = Color("ThemeSeparator")
    static let text = Color("ThemeText")
    static let textSecondary = Color("ThemeTextSecondary")
    static let textTertiary = Color("ThemeTextTertiary")
    static let accentFill = Color("AccentColor")
    static let accentText = Color("ThemeAccentText")
    static let chart1 = Color("ThemeChart1")
    static let chart2 = Color("ThemeChart2")
    static let positive = Color("ThemePositive")
}
