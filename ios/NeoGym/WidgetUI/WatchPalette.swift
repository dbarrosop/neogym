#if os(watchOS)
import SwiftUI

/// The watch is always dark, so its app and complication use the design's dark tokens
/// directly (the iPhone widgets read the asset-catalog theme instead).
enum WatchPalette {
    static let accentText = Color(red: 0x6E / 255, green: 0x93 / 255, blue: 0xFF / 255)
    static let accentFill = Color(red: 0x34 / 255, green: 0x63 / 255, blue: 0xE0 / 255)
    static let accentSoft = Color(red: 0x1E / 255, green: 0x2A / 255, blue: 0x4D / 255)
    static let accentSoftText = Color(red: 0x8F / 255, green: 0xAD / 255, blue: 0xFF / 255)
    static let chart1 = Color(red: 0x5E / 255, green: 0x87 / 255, blue: 0xF5 / 255)
    static let chart2 = Color(red: 0xD9 / 255, green: 0x73 / 255, blue: 0x2C / 255)
    static let textSecondary = Color(red: 0xA1 / 255, green: 0xA1 / 255, blue: 0xAA / 255)
    static let textTertiary = Color(red: 0x8B / 255, green: 0x8B / 255, blue: 0x94 / 255)
    static let fill = Color(red: 0x27 / 255, green: 0x27 / 255, blue: 0x2A / 255)
    static let card = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1F / 255)
    static let separator = Color(red: 0x3F / 255, green: 0x3F / 255, blue: 0x46 / 255)
    static let destructive = Color(red: 0xF8 / 255, green: 0x71 / 255, blue: 0x71 / 255)
    static let health = Color(red: 0xE5 / 255, green: 0x48 / 255, blue: 0x4D / 255)
}
#endif
