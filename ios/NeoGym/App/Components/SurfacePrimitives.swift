import SwiftUI

// Content sits on plain token surfaces: no material, gradients or shadows.
// Glass is reserved for system chrome (tab bar, toolbars, accessory, sheets).

/// Full-screen canvas for signed-out, loading and error states, and sheets.
struct ScreenScaffold<Content: View>: View {
    @ViewBuilder let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(NeoGymTheme.background.ignoresSafeArea())
    }
}

/// A card on the surface token with the card radius.
struct SurfaceCard<Content: View>: View {
    let cornerRadius: CGFloat
    let fill: Color
    let contentPadding: EdgeInsets
    @ViewBuilder let content: Content

    init(
        cornerRadius: CGFloat = NeoGymTheme.radiusXL,
        fill: Color = NeoGymTheme.surface,
        contentPadding: EdgeInsets = EdgeInsets(
            top: NeoGymTheme.spacingMD,
            leading: NeoGymTheme.spacingMD,
            bottom: NeoGymTheme.spacingMD,
            trailing: NeoGymTheme.spacingMD
        ),
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.fill = fill
        self.contentPadding = contentPadding
        self.content = content()
    }

    var body: some View {
        content
            .padding(contentPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardSurface(cornerRadius: cornerRadius, fill: fill)
    }
}

/// Compact titled group drawn on the inset token, for nesting inside cards and sheets.
struct InsetSection<Content: View>: View {
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
                    .font(.footnote.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .insetCard(cornerRadius: NeoGymTheme.radiusLG)
    }
}

extension View {
    /// Fills the view's background with a token colour in a continuous rounded shape.
    func cardSurface(
        cornerRadius: CGFloat = NeoGymTheme.radiusXL,
        fill: Color = NeoGymTheme.surface,
        stroke: Color? = nil
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return background(shape.fill(fill))
            .overlay {
                if let stroke {
                    shape.strokeBorder(stroke, lineWidth: NeoGymTheme.hairline)
                }
            }
    }

    /// Tile inside a card: the inset token with the tile radius.
    func insetCard(
        cornerRadius: CGFloat = NeoGymTheme.radiusMD,
        fill: Color = NeoGymTheme.inset,
        stroke: Color? = nil
    ) -> some View {
        cardSurface(cornerRadius: cornerRadius, fill: fill, stroke: stroke)
    }

    /// Input container for text fields and editors inside forms.
    func fieldSurface() -> some View {
        padding(NeoGymTheme.spacingSM)
            .cardSurface(cornerRadius: NeoGymTheme.radiusSM, fill: NeoGymTheme.fill)
    }
}

/// A decorative SF Symbol on an accent-soft circle, used by state and auth headers.
struct IconBadge: View {
    let systemImage: String
    var diameter: CGFloat = 56
    var symbolSize: CGFloat = 22

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: symbolSize, weight: .semibold))
            .foregroundStyle(NeoGymTheme.accentText)
            .frame(width: diameter, height: diameter)
            .background(Circle().fill(NeoGymTheme.accentSoft))
            .accessibilityHidden(true)
    }
}
