import SwiftUI

struct KeyboardDoneToolbar<Field: Hashable>: ToolbarContent {
    @FocusState.Binding private var focusedField: Field?

    init(focusedField: FocusState<Field?>.Binding) {
        _focusedField = focusedField
    }

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("Done") {
                focusedField = nil
            }
        }
    }
}

extension View {
    func keyboardDoneToolbar<Field: Hashable>(focusedField: FocusState<Field?>.Binding) -> some View {
        toolbar {
            KeyboardDoneToolbar(focusedField: focusedField)
        }
    }

    func numericFieldFocus<Field: Hashable>(
        _ field: Field,
        focusedField: FocusState<Field?>.Binding
    ) -> some View {
        focused(focusedField, equals: field)
    }
}
