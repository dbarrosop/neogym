import NeoGymKit
import SwiftUI

/// The LABELS group of the workout and journal editors: selected labels as
/// accent-soft chips with a remove button, an inline "Add label" field, and
/// matching existing labels (or "Create …") while the field is focused.
struct LabelChipsEditor: View {
    let selected: [String]
    let available: [String]
    let maxLength: Int
    let normalize: (String) -> String
    var isDisabled = false
    let onRemove: (String) -> Void
    let onPick: (String) -> Void
    let onCommit: (String) -> Void

    @State private var input = ""
    @FocusState private var isFieldFocused: Bool

    private var normalizedInput: String {
        normalize(input)
    }

    private var suggestions: [String] {
        let chosen = Set(selected)
        return available
            .filter { !chosen.contains($0) }
            .filter { normalizedInput.isEmpty || $0.contains(normalizedInput) }
            .prefix(8)
            .map { $0 }
    }

    private var canCreate: Bool {
        !normalizedInput.isEmpty
            && normalizedInput.count <= maxLength
            && !selected.contains(normalizedInput)
            && !suggestions.contains(normalizedInput)
    }

    var body: some View {
        FormSection(header: "Labels") {
            if !selected.isEmpty {
                FlowRow(spacing: 6) {
                    ForEach(selected, id: \.self) { chip($0) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, NeoGymTheme.spacingSM)
                .padding(.top, NeoGymTheme.spacingSM)
            }
            FormRow {
                TextField("Add label", text: Binding(
                    get: { input },
                    set: { input = String($0.prefix(maxLength)) }
                ))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($isFieldFocused)
                .disabled(isDisabled)
                .onSubmit(commit)
                if !normalizedInput.isEmpty {
                    Button("Add", action: commit)
                        .fontWeight(.semibold)
                        .disabled(isDisabled)
                }
            }
            if isFieldFocused, !suggestions.isEmpty || canCreate {
                RowSeparator()
                FlowRow(spacing: 6) {
                    ForEach(suggestions, id: \.self) { name in
                        Button {
                            onPick(name)
                            input = ""
                        } label: {
                            suggestionLabel(name, systemImage: "plus")
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add label \(name)")
                    }
                    if canCreate {
                        Button(action: commit) {
                            suggestionLabel("Create “\(normalizedInput)”", systemImage: "tag")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(NeoGymTheme.spacingSM)
            }
        }
    }

    private func commit() {
        guard !normalizedInput.isEmpty else { return }
        onCommit(input)
        input = ""
        isFieldFocused = true
    }

    private func chip(_ name: String) -> some View {
        HStack(spacing: 0) {
            Text(name)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Button {
                onRemove(name)
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .frame(width: 28, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isDisabled)
            .accessibilityLabel("Remove label \(name)")
        }
        .padding(.leading, 10)
        .padding(.trailing, 2)
        .foregroundStyle(NeoGymTheme.accentText)
        .background(Capsule(style: .continuous).fill(NeoGymTheme.accentSoft))
    }

    private func suggestionLabel(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline)
            .lineLimit(1)
            .foregroundStyle(NeoGymTheme.text)
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(Capsule(style: .continuous).fill(NeoGymTheme.fill))
    }
}

/// Workout labels: chips over `WorkoutFormModel`.
struct LabelInputView: View {
    @ObservedObject var form: WorkoutFormModel
    let suggestions: [WorkoutLabel]
    var disabled = false

    var body: some View {
        LabelChipsEditor(
            selected: form.labels.map(\.name),
            available: suggestions.map(\.name),
            maxLength: workoutLabelMaxLength,
            normalize: WorkoutLabelNormalizer.normalize,
            isDisabled: disabled,
            onRemove: { form.removeLabel(name: $0) },
            onPick: { name in
                guard let label = suggestions.first(where: { $0.name == name }) else { return }
                form.addLabel(WorkoutLabelSelection(id: label.id, name: label.name))
            },
            onCommit: { form.commitLabel($0, suggestions: suggestions) }
        )
    }
}
