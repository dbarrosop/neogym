import SwiftUI

struct NeoGymPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundColor(.white.opacity(isEnabled ? 1 : 0.62))
            .background {
                RoundedRectangle(cornerRadius: NeoGymTheme.controlCornerRadius, style: .continuous)
                    .fill(NeoGymTheme.primaryActionGradient)
                    .opacity(isEnabled ? (configuration.isPressed ? 0.76 : 0.96) : 0.38)
            }
            .overlay {
                RoundedRectangle(cornerRadius: NeoGymTheme.controlCornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.24), lineWidth: NeoGymTheme.hairline)
            }
            .shadow(
                color: isEnabled ? Color.accentColor.opacity(configuration.isPressed ? 0.08 : 0.18) : .clear,
                radius: NeoGymTheme.elevationLowRadius,
                y: NeoGymTheme.elevationLowY
            )
            .opacity(configuration.isPressed ? 0.88 : 1)
    }
}

struct NeoGymSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundColor(NeoGymTheme.primaryText.opacity(isEnabled ? 1 : 0.5))
            .glassSurface(
                cornerRadius: NeoGymTheme.controlCornerRadius,
                material: .thin,
                tint: isEnabled ? NeoGymTheme.glassSubtleFill : NeoGymTheme.glassSubtleFill.opacity(0.48),
                shadow: false
            )
            .opacity(configuration.isPressed ? 0.74 : 1)
    }
}
