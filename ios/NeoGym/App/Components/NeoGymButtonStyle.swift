import SwiftUI

struct NeoGymPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundColor(Color(.systemBackground))
            .background(
                Color.primary.opacity(configuration.isPressed ? 0.78 : 0.94),
                in: RoundedRectangle(cornerRadius: NeoGymTheme.controlCornerRadius, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct NeoGymSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundColor(.primary)
            .background(
                NeoGymTheme.mutedFill,
                in: RoundedRectangle(cornerRadius: NeoGymTheme.controlCornerRadius, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: NeoGymTheme.controlCornerRadius, style: .continuous)
                    .stroke(NeoGymTheme.border)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}
