import SwiftUI

enum GlassMaterial {
    case ultraThin
    case thin
    case regular

    var swiftUIMaterial: Material {
        switch self {
        case .ultraThin:
            return .ultraThinMaterial
        case .thin:
            return .thinMaterial
        case .regular:
            return .regularMaterial
        }
    }
}

struct ScreenScaffold<Content: View>: View {
    @ViewBuilder let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            GridBackground(ownsCanvas: true)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct GlassPanel<Content: View>: View {
    var cornerRadius: CGFloat = NeoGymTheme.radiusXL
    var material: GlassMaterial = .regular
    var tint: Color = NeoGymTheme.glassFill
    var shadow: Bool = true
    var contentPadding = EdgeInsets(
        top: NeoGymTheme.spacingLG,
        leading: NeoGymTheme.spacingLG,
        bottom: NeoGymTheme.spacingLG,
        trailing: NeoGymTheme.spacingLG
    )
    @ViewBuilder let content: Content

    init(
        cornerRadius: CGFloat = NeoGymTheme.radiusXL,
        material: GlassMaterial = .regular,
        tint: Color = NeoGymTheme.glassFill,
        shadow: Bool = true,
        contentPadding: EdgeInsets = EdgeInsets(
            top: NeoGymTheme.spacingLG,
            leading: NeoGymTheme.spacingLG,
            bottom: NeoGymTheme.spacingLG,
            trailing: NeoGymTheme.spacingLG
        ),
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.material = material
        self.tint = tint
        self.shadow = shadow
        self.contentPadding = contentPadding
        self.content = content()
    }

    var body: some View {
        content
            .padding(contentPadding)
            .glassSurface(cornerRadius: cornerRadius, material: material, tint: tint, shadow: shadow)
    }
}

struct GlassDivider: View {
    var body: some View {
        Rectangle()
            .fill(NeoGymTheme.glassStrokeSecondary)
            .frame(height: NeoGymTheme.hairline)
            .overlay(
                Rectangle()
                    .fill(Color.white.opacity(0.20))
                    .frame(height: NeoGymTheme.hairline),
                alignment: .top
            )
    }
}

extension View {
    func glassSurface(
        cornerRadius: CGFloat = NeoGymTheme.radiusXL,
        material: GlassMaterial = .regular,
        tint: Color = NeoGymTheme.glassFill,
        stroke: Color = NeoGymTheme.glassStrokeSecondary,
        shadow: Bool = true
    ) -> some View {
        modifier(
            GlassSurfaceModifier(
                cornerRadius: cornerRadius,
                material: material,
                tint: tint,
                stroke: stroke,
                shadow: shadow
            )
        )
    }
}

private struct GlassSurfaceModifier: ViewModifier {
    let cornerRadius: CGFloat
    let material: GlassMaterial
    let tint: Color
    let stroke: Color
    let shadow: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        content
            .background {
                GlassSurfaceBackground(
                    cornerRadius: cornerRadius,
                    material: material,
                    tint: tint
                )
            }
            .overlay {
                shape.stroke(stroke, lineWidth: NeoGymTheme.hairline)
            }
            .overlay {
                shape
                    .stroke(NeoGymTheme.glassHighlight, lineWidth: NeoGymTheme.hairline)
                    .opacity(reduceTransparency ? 0.18 : 0.82)
            }
            .shadow(
                color: shadow ? NeoGymTheme.glassAmbientShadow : .clear,
                radius: shadow ? NeoGymTheme.elevationLowRadius * (reduceMotion ? 0.75 : 1) : 0,
                x: 0,
                y: shadow ? NeoGymTheme.elevationLowY * (reduceMotion ? 0.5 : 1) : 0
            )
            .shadow(
                color: shadow ? NeoGymTheme.glassShadow : .clear,
                radius: shadow ? NeoGymTheme.elevationMediumRadius * (reduceMotion ? 0.75 : 1) : 0,
                x: 0,
                y: shadow ? NeoGymTheme.elevationMediumY * (reduceMotion ? 0.5 : 1) : 0
            )
    }
}

private struct GlassSurfaceBackground: View {
    let cornerRadius: CGFloat
    let material: GlassMaterial
    let tint: Color

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        ZStack {
            if reduceTransparency {
                shape.fill(NeoGymTheme.glassFallbackFill)
            } else {
                shape.fill(material.swiftUIMaterial)
                shape.fill(tint)
            }
        }
    }
}
