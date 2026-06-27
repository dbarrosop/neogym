import SwiftUI

struct OTPCodeField: View {
    @Binding var code: String
    var isDisabled: Bool = false
    var onComplete: (String) -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        ZStack {
            TextField("", text: codeBinding)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($isFocused)
                .disabled(isDisabled)
                .opacity(0.02)
                .frame(width: 1, height: 1)
                .accessibilityLabel("One-time code")

            GeometryReader { proxy in
                let spacing: CGFloat = 7
                let slotWidth = min(44, max(34, (proxy.size.width - (spacing * 5)) / 6))
                let slotHeight = max(48, slotWidth * 1.18)

                HStack(spacing: spacing) {
                    ForEach(0..<6, id: \.self) { index in
                        OTPSlot(
                            character: character(at: index),
                            isActive: isFocused && code.count == index,
                            width: slotWidth,
                            height: slotHeight
                        )
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .frame(height: 54)
            .contentShape(Rectangle())
            .onTapGesture {
                guard !isDisabled else { return }
                isFocused = true
            }
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            if !isDisabled {
                isFocused = true
            }
        }
    }

    private var codeBinding: Binding<String> {
        Binding(
            get: { code },
            set: { nextValue in
                let normalized = String(nextValue.filter(\.isNumber).prefix(6))
                let previous = code
                code = normalized
                if normalized.count == 6, normalized != previous {
                    onComplete(normalized)
                }
            }
        )
    }

    private func character(at index: Int) -> String {
        guard index < code.count else { return "" }
        let stringIndex = code.index(code.startIndex, offsetBy: index)
        return String(code[stringIndex])
    }
}

private struct OTPSlot: View {
    let character: String
    let isActive: Bool
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        Text(character)
            .font(.title2.monospacedDigit().weight(.semibold))
            .minimumScaleFactor(0.8)
            .frame(width: width, height: height)
            .background(
                NeoGymTheme.glassSubtleFill,
                in: RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous)
                    .stroke(isActive ? NeoGymTheme.accent : NeoGymTheme.glassStrokeSecondary, lineWidth: isActive ? 2 : 1)
            )
            .overlay(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous)
                    .stroke(Color.white.opacity(0.22), lineWidth: NeoGymTheme.hairline)
                    .padding(1)
            }
            .shadow(color: isActive ? NeoGymTheme.accent.opacity(0.20) : .clear, radius: 10, y: 5)
    }
}
