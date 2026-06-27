import SwiftUI

struct NutritionGlassSection<Content: View>: View {
    let title: String?
    @ViewBuilder let content: Content

    init(_ title: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            if let title {
                Text(title)
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusLG,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }
}

struct NutritionGlassField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(NeoGymTheme.spacingSM)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassFill,
                shadow: false
            )
    }
}

extension View {
    func nutritionGlassField() -> some View {
        modifier(NutritionGlassField())
    }

    func nutritionGlassCard(
        cornerRadius: CGFloat = NeoGymTheme.radiusLG,
        tint: Color = NeoGymTheme.glassSubtleFill,
        stroke: Color = NeoGymTheme.glassStrokeSecondary
    ) -> some View {
        glassSurface(
            cornerRadius: cornerRadius,
            material: .ultraThin,
            tint: tint,
            stroke: stroke,
            shadow: false
        )
    }
}
