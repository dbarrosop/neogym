import SwiftUI

/// Compact nutrition-only section chrome.
///
/// This is intentionally denser than `SectionShell`/`GlassPanel`: it keeps the
/// title, content spacing, padding, ultra-thin material, subtle tint, and
/// shadowless treatment together for nested nutrition groups and sheets.
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

/// Dense field container for nutrition editors.
///
/// Use this for text fields and text editors inside nutrition forms where the
/// generic glass defaults would add too much radius/elevation for compact
/// stacked inputs.
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
    /// Applies compact nutrition field chrome around already padded input content.
    func nutritionGlassField() -> some View {
        modifier(NutritionGlassField())
    }

    /// Applies nutrition card chrome with ultra-thin material and no elevation.
    ///
    /// Nutrition list rows, macro tiles, picker shells, and nested editor cards use
    /// this wrapper to stay visually lighter than generic `.glassSurface(...)`
    /// defaults while still honoring explicit tint/stroke/radius overrides.
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
