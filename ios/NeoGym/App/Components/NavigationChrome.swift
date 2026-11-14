import SwiftUI

private struct NativeFormActionToolbar: ViewModifier {
    let submitLabel: String
    let isSubmitting: Bool
    let isSubmitEnabled: Bool
    let onCancel: () -> Void
    let onSubmit: () -> Void

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel", role: .cancel, action: onCancel)
                    .disabled(isSubmitting)
            }

            ToolbarItem(placement: .confirmationAction) {
                Button(isSubmitting ? "Saving…" : submitLabel, action: onSubmit)
                    .fontWeight(.semibold)
                    .disabled(isSubmitting || !isSubmitEnabled)
            }
        }
    }
}

/// Full-width destructive delete action rendered in a pushed form's scroll
/// content (Contacts-style), replacing the old top-trailing overflow menu.
struct FormDeleteButton: View {
    let title: String
    let isDisabled: Bool
    let action: () -> Void

    init(title: String, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(role: .destructive, action: action) {
            Text(title)
                .font(.body)
                .frame(maxWidth: .infinity, minHeight: 50)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(NeoGymTheme.destructive)
        .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous).fill(NeoGymTheme.surface))
        .opacity(isDisabled ? 0.5 : 1)
        .disabled(isDisabled)
        .accessibilityLabel(title)
    }
}

extension View {
    /// Native iOS 26 pushed-form action surface: Cancel in the top-leading
    /// `.cancellationAction` and Save in the top-trailing `.confirmationAction`.
    /// Destructive Delete is a `FormDeleteButton` in the form's scroll content.
    func nativeFormActionToolbar(
        submitLabel: String,
        isSubmitting: Bool,
        isSubmitEnabled: Bool,
        onCancel: @escaping () -> Void,
        onSubmit: @escaping () -> Void
    ) -> some View {
        modifier(NativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: isSubmitEnabled,
            onCancel: onCancel,
            onSubmit: onSubmit
        ))
    }
}
