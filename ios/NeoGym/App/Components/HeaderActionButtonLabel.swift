import SwiftUI

struct HeaderActionButtonLabel: View {
    var systemImage = "plus"

    var body: some View {
        Image(systemName: systemImage)
            .font(.headline.weight(.semibold))
            .foregroundColor(.primary)
            .frame(width: 44, height: 44)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusLG,
                material: .thin,
                tint: NeoGymTheme.glassSubtleFill,
                stroke: NeoGymTheme.glassStrokeSecondary,
                shadow: false
            )
    }
}
