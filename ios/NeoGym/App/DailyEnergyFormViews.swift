import NeoGymKit
import SwiftUI

struct DailyEnergyCreateView: View {
    @StateObject private var editor: DailyEnergyEditorViewModel
    @StateObject private var form: DailyEnergyFormModel
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        repository: any DailyEnergyRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: DailyEnergyEditorViewModel(entryId: nil, repository: repository))
        _form = StateObject(wrappedValue: DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: DateOnly.todayLocalISO(),
            activeKcal: "",
            restingKcal: "",
            notes: ""
        )))
        self.onCreated = onCreated
        self.onFinished = onFinished
    }

    var body: some View {
        DailyEnergyFormScreen(
            submitLabel: "Save energy",
            form: form,
            isSubmitting: editor.saveState.isLoading,
            errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New energy")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() {
        guard let values = form.valuesForSubmit() else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct DailyEnergyEditView: View {
    @StateObject private var editor: DailyEnergyEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: DailyEnergyFormModel?
    @State private var confirmDelete = false

    init(
        entryId: String,
        repository: any DailyEnergyRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(
            wrappedValue: DailyEnergyEditorViewModel(entryId: entryId, repository: repository)
        )
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                SectionShell(title: "Loading energy") {
                    AppLoadingStateView(title: "Loading energy entry")
                }
                .padding(20)
            case .loading where editor.entry == nil:
                SectionShell(title: "Loading energy") {
                    AppLoadingStateView(title: "Loading energy entry")
                }
                .padding(20)
            case let .failed(message, _) where editor.entry == nil:
                SectionShell(title: "Energy") {
                    AppErrorStateView(title: "Failed to load energy entry", message: message) {
                        Task { await loadAndPrepareForm() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    DailyEnergyFormScreen(
                        submitLabel: "Save changes",
                        form: form,
                        isSubmitting: editor.saveState.isLoading || editor.deleteState.isLoading,
                        errorMessage: form.errorMessage
                            ?? editor.saveState.errorMessage
                            ?? editor.deleteState.errorMessage,
                        onSubmit: submit,
                        onCancel: { presentationMode.wrappedValue.dismiss() },
                        deleteAction: { confirmDelete = true }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .navigationTitle("Edit energy")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await loadAndPrepareForm()
            }
        }
        .confirmationDialog("Delete this energy entry?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete energy", role: .destructive) { deleteEntry() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This entry will be removed from your energy history.")
        }
    }

    private func loadAndPrepareForm() async {
        await editor.load()
        prepareFormIfNeeded()
    }

    private func prepareFormIfNeeded() {
        guard form == nil, let initialValues = editor.initialValues else { return }
        form = DailyEnergyFormModel(initialValues: initialValues)
    }

    private func submit() {
        guard let values = form?.valuesForSubmit() else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deleteEntry() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct DailyEnergyFormScreen: View {
    private enum FocusedField: Hashable {
        case active
        case resting
    }

    let submitLabel: String
    @ObservedObject var form: DailyEnergyFormModel
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @FocusState private var focusedField: FocusedField?

    var body: some View {
        FormScrollContainer {
            FormSection {
                FormDateRow(isoDate: $form.energyOn)
                RowSeparator()
                FormNumberRow(
                    title: "Active",
                    text: $form.activeKcal,
                    unit: "kcal",
                    placeholder: "",
                    field: FocusedField.active,
                    focusedField: $focusedField
                )
                RowSeparator()
                FormNumberRow(
                    title: "Resting",
                    text: $form.restingKcal,
                    unit: "kcal",
                    placeholder: "",
                    field: FocusedField.resting,
                    focusedField: $focusedField
                )
            }
            FormSection(
                header: "Notes",
                footer: "One entry per date with at least one value. "
                    + "The NeoGym Apple Watch app imports active and resting energy from Apple Health."
            ) {
                FormTextAreaRow(placeholder: "Optional", text: $form.notes, accessibilityLabel: "Notes")
            }
            if let errorMessage {
                FeedbackBanner(message: errorMessage)
            }
            if let deleteAction {
                FormDeleteButton(
                    title: "Delete energy",
                    isDisabled: isSubmitting,
                    action: deleteAction
                )
                .padding(.top, NeoGymTheme.spacingXS)
            }
        }
        .keyboardDoneToolbar(focusedField: $focusedField)
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.hasEnergyValue,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
    }
}
