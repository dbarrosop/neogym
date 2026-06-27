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

            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { index in
                    OTPSlot(character: character(at: index), isActive: isFocused && code.count == index)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard !isDisabled else { return }
                isFocused = true
            }
        }
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

    var body: some View {
        Text(character)
            .font(.title2.monospacedDigit().weight(.semibold))
            .frame(width: 44, height: 52)
            .background(
                Color(.secondarySystemBackground).opacity(0.9),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isActive ? Color.accentColor : NeoGymTheme.border, lineWidth: isActive ? 2 : 1)
            )
    }
}
