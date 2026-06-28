import SwiftUI

/// Full-bleed visual canvas used by the root shell.
///
/// During the redesign migration many existing screens still attach `GridBackground`
/// locally. The default initializer intentionally renders only a faint transparent
/// overlay, so those temporary nested backgrounds do not compound into muddy aurora
/// layers. Root owners should pass `ownsCanvas: true` to draw the opaque base.
struct GridBackground: View {
    let ownsCanvas: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    init(ownsCanvas: Bool = false) {
        self.ownsCanvas = ownsCanvas
    }

    var body: some View {
        GeometryReader { proxy in
            let maxDimension = max(proxy.size.width, proxy.size.height)
            let overlayOpacity = (ownsCanvas ? 1.0 : 0.18) * (reduceMotion ? 0.72 : 1.0)

            ZStack {
                if ownsCanvas {
                    if reduceTransparency {
                        NeoGymTheme.canvasFallback
                    } else {
                        NeoGymTheme.canvasGradient
                    }
                } else {
                    Color.clear
                }

                if !reduceTransparency {
                    RadialGradient(
                        colors: [NeoGymTheme.auroraPrimary.opacity(overlayOpacity), .clear],
                        center: .topLeading,
                        startRadius: 16,
                        endRadius: maxDimension * 0.82
                    )
                    .blendMode(.screen)

                    RadialGradient(
                        colors: [NeoGymTheme.auroraSecondary.opacity(overlayOpacity), .clear],
                        center: .bottomTrailing,
                        startRadius: 24,
                        endRadius: maxDimension * 0.74
                    )
                    .blendMode(.screen)

                    RadialGradient(
                        colors: [NeoGymTheme.auroraTertiary.opacity(overlayOpacity), .clear],
                        center: UnitPoint(x: 0.82, y: 0.18),
                        startRadius: 10,
                        endRadius: maxDimension * 0.52
                    )
                    .blendMode(.screen)
                }

                GridPattern(spacing: ownsCanvas ? 34 : 40)
                    .stroke(
                        Color.primary.opacity(reduceTransparency ? 0.035 : 0.05 * overlayOpacity),
                        lineWidth: NeoGymTheme.hairline
                    )
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

private struct GridPattern: Shape {
    let spacing: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        var columnPosition = rect.minX
        while columnPosition <= rect.maxX {
            path.move(to: CGPoint(x: columnPosition, y: rect.minY))
            path.addLine(to: CGPoint(x: columnPosition, y: rect.maxY))
            columnPosition += spacing
        }

        var rowPosition = rect.minY
        while rowPosition <= rect.maxY {
            path.move(to: CGPoint(x: rect.minX, y: rowPosition))
            path.addLine(to: CGPoint(x: rect.maxX, y: rowPosition))
            rowPosition += spacing
        }

        return path
    }
}
