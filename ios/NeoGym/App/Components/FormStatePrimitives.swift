import SwiftUI

struct InlineProgressLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(title)
        }
    }
}

struct PrimaryActionButton: View {
    let title: String
    let busyTitle: String
    let isBusy: Bool
    var isEnabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            if isBusy {
                InlineProgressLabel(title: busyTitle)
            } else {
                Text(title)
            }
        }
        .buttonStyle(NeoGymPrimaryButtonStyle())
        .disabled(isBusy || !isEnabled)
    }
}
