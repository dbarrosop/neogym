import SwiftUI

/// The two-pan balance glyph that marks energy balance on the Lock Screen, the watch
/// app and its complication (drawn on a 24-point grid, stroked by the caller).
struct BalanceScaleIcon: Shape {
    func path(in rect: CGRect) -> Path {
        let unit = min(rect.width, rect.height) / 24
        let originX = rect.midX - 12 * unit
        let originY = rect.midY - 12 * unit
        func point(_ horizontal: CGFloat, _ vertical: CGFloat) -> CGPoint {
            CGPoint(x: originX + horizontal * unit, y: originY + vertical * unit)
        }

        var path = Path()
        for left in [2.0, 16.0] {
            // A pan: up to its hook, down the other side, then a shallow bowl back.
            path.move(to: point(left, 16))
            path.addLine(to: point(left + 3, 8))
            path.addLine(to: point(left + 6, 16))
            path.addCurve(to: point(left + 3, 17),
                          control1: point(left + 5.13, 16.65), control2: point(left + 4.08, 17))
            path.addCurve(to: point(left, 16),
                          control1: point(left + 1.92, 17), control2: point(left + 0.87, 16.65))
            path.closeSubpath()
        }
        path.move(to: point(7, 21))
        path.addLine(to: point(17, 21)) // base
        path.move(to: point(12, 3))
        path.addLine(to: point(12, 21)) // post
        path.move(to: point(3, 7))
        path.addLine(to: point(5, 7)) // beam
        path.addCurve(to: point(12, 5), control1: point(7, 7), control2: point(10, 6))
        path.addCurve(to: point(19, 7), control1: point(14, 6), control2: point(17, 7))
        path.addLine(to: point(21, 7))
        return path
    }
}

extension BalanceScaleIcon {
    /// Stroke weight matching the glyph's 2-point line on its 24-point grid.
    static func stroke(for size: CGFloat) -> StrokeStyle {
        StrokeStyle(lineWidth: max(size / 12, 1), lineCap: .round, lineJoin: .round)
    }
}
