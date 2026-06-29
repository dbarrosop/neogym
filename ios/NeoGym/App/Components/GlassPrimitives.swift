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
    let cornerRadius: CGFloat
    let material: GlassMaterial
    let tint: Color
    let shadow: Bool
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassSurface(
                cornerRadius: cornerRadius,
                material: material,
                tint: tint,
                shadow: shadow
            )
    }
}

struct GlassDivider: View {
    var body: some View {
        Divider()
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

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        content
            .background {
                ZStack {
                    if reduceTransparency {
                        shape
                            .fill(NeoGymTheme.glassFallbackFill)
                            .glassElevationShadow(shadow)
                    } else {
                        shape
                            .fill(material.swiftUIMaterial)
                            .glassElevationShadow(shadow)
                    }
                    shape.fill(tint)
                }
            }
            .overlay {
                shape.strokeBorder(stroke, lineWidth: NeoGymTheme.hairline)
            }
    }
}

private extension View {
    func glassElevationShadow(_ enabled: Bool) -> some View {
        shadow(
            color: enabled ? NeoGymTheme.glassShadow : .clear,
            radius: enabled ? NeoGymTheme.elevationLowRadius : 0,
            x: 0,
            y: enabled ? NeoGymTheme.elevationLowY : 0
        )
        .shadow(
            color: enabled ? NeoGymTheme.glassAmbientShadow : .clear,
            radius: enabled ? NeoGymTheme.elevationMediumRadius : 0,
            x: 0,
            y: enabled ? NeoGymTheme.spacingXXS : 0
        )
    }
}
