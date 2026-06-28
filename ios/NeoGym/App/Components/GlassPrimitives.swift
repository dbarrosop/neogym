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
        self.contentPadding = contentPadding
        self.content = content()
    }

    var body: some View {
        GroupBox {
            content
                .padding(contentPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .groupBoxStyle(.automatic)
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
                if reduceTransparency {
                    shape.fill(Color(.secondarySystemBackground))
                } else {
                    shape.fill(material.swiftUIMaterial)
                }
            }
    }
}
