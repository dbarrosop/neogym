import NeoGymKit
import SwiftUI

struct LabelInputView: View {
    @ObservedObject var form: WorkoutFormModel
    let suggestions: [WorkoutLabel]
    var disabled = false

    @State private var input = ""

    private var normalizedInput: String {
        WorkoutLabelNormalizer.normalize(input)
    }

    private var filteredSuggestions: [WorkoutLabel] {
        let selected = Set(form.labels.map(\.name))
        return suggestions
            .filter { !selected.contains($0.name) }
            .filter { normalizedInput.isEmpty ? true : $0.name.contains(normalizedInput) }
            .prefix(8)
            .map { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Labels")
                .font(.subheadline.weight(.semibold))
            LabelFlowLayout(spacing: 6) {
                ForEach(form.labels, id: \.stableId) { label in
                    labelChip(label)
                }
            }
            HStack(spacing: 8) {
                TextField("Add a label", text: $input)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .disabled(disabled)
                    .onSubmit { commitTyped() }
                Button("Add") { commitTyped() }
                    .disabled(disabled || normalizedInput.isEmpty || normalizedInput.count > workoutLabelMaxLength)
            }
            .padding(10)
            .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))

            if !filteredSuggestions.isEmpty || canCreateLabel {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(filteredSuggestions) { suggestion in
                        Button {
                            form.addLabel(WorkoutLabelSelection(id: suggestion.id, name: suggestion.name))
                            input = ""
                        } label: {
                            Label(suggestion.name, systemImage: "tag")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    }
                    if canCreateLabel {
                        Button {
                            commitTyped()
                        } label: {
                            Label("Create \"\(normalizedInput)\"", systemImage: "tag")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private var canCreateLabel: Bool {
        !normalizedInput.isEmpty
            && normalizedInput.count <= workoutLabelMaxLength
            && !form.labels.contains { $0.name == normalizedInput }
            && !filteredSuggestions.contains { $0.name == normalizedInput }
    }

    private func commitTyped() {
        form.commitLabel(input, suggestions: suggestions)
        input = ""
    }

    private func labelChip(_ label: WorkoutLabelSelection) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "tag.fill")
            Text(label.name)
            Button {
                form.removeLabel(name: label.name)
            } label: {
                Image(systemName: "xmark.circle.fill")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove label \(label.name)")
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .foregroundColor(.accentColor)
        .background(Color.accentColor.opacity(0.12), in: Capsule())
    }
}

private struct LabelFlowLayout<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder let content: Content

    var body: some View {
        if #available(iOS 16.0, macOS 13.0, *) {
            AnyLayout(HStackLayout(spacing: spacing)) {
                content
            }
        } else {
            HStack(spacing: spacing) {
                content
            }
        }
    }
}
