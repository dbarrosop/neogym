import SwiftUI

private struct NativeFormActionToolbar: ViewModifier {
    let submitLabel: String
    let isSubmitting: Bool
    let isSubmitEnabled: Bool
    let deleteLabel: String?
    let onCancel: () -> Void
    let onSubmit: () -> Void
    let onDelete: (() -> Void)?

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button("Cancel", role: .cancel, action: onCancel)
                    .disabled(isSubmitting)
                Spacer()
                if let deleteLabel, let onDelete {
                    Button(role: .destructive, action: onDelete) {
                        Label(deleteLabel, systemImage: "trash")
                    }
                    .disabled(isSubmitting)
                }
                Button(isSubmitting ? "Saving…" : submitLabel, action: onSubmit)
                    .fontWeight(.semibold)
                    .disabled(isSubmitting || !isSubmitEnabled)
            }
        }
    }
}

extension View {
    /// Temporary source-compatible alias while pushed screens migrate to typed
    /// navigation and route-local bottom actions.
    func hidesBottomTabBarWhenPushed() -> some View {
        toolbar(.hidden, for: .tabBar)
    }

    /// Native iOS 26 pushed-form action surface used by the canary rollout.
    /// It keeps the primary tab bar native and exposes cancel/save/delete through
    /// the system bottom toolbar instead of hiding the tab bar for the route.
    func nativeFormActionToolbar(
        submitLabel: String,
        isSubmitting: Bool,
        isSubmitEnabled: Bool,
        deleteLabel: String? = nil,
        onCancel: @escaping () -> Void,
        onSubmit: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) -> some View {
        modifier(NativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: isSubmitEnabled,
            deleteLabel: deleteLabel,
            onCancel: onCancel,
            onSubmit: onSubmit,
            onDelete: onDelete
        ))
    }
}
