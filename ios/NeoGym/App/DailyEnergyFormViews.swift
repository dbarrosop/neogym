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
            title: "New energy entry",
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
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    DailyEnergyFormScreen(
                        title: "Edit energy",
                        submitLabel: "Save changes",
                        form: form,
                        isSubmitting: editor.saveState.isLoading,
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
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = DailyEnergyFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this energy entry?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete energy", role: .destructive) { deleteEntry() }
        } message: {
            Text("This entry will be removed from your energy history.")
        }
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

    let title: String
    let submitLabel: String
    @ObservedObject var form: DailyEnergyFormModel
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @FocusState private var focusedField: FocusedField?

    var body: some View {
        ScrollView {
            SectionShell(title: title) {
                VStack(alignment: .leading, spacing: 18) {
                    DatePicker(
                        "Date",
                        selection: Binding(
                            get: { DateOnly.parse(form.energyOn) ?? Date() },
                            set: { form.energyOn = DateOnly.formatLocalISO($0) }
                        ),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)

                    HStack(spacing: 12) {
                        decimalField(
                            title: "Active",
                            unit: "kcal",
                            placeholder: "650",
                            text: $form.activeKcal,
                            field: .active
                        )
                        decimalField(
                            title: "Resting",
                            unit: "kcal",
                            placeholder: "1650",
                            text: $form.restingKcal,
                            field: .resting
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.notes)
                            .frame(minHeight: 110)
                            .padding(NeoGymTheme.spacingXS)
                            .glassSurface(
                                cornerRadius: NeoGymTheme.radiusMD,
                                material: .ultraThin,
                                tint: NeoGymTheme.glassFill,
                                shadow: false
                            )
                        Text("Optional")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }

                    actions
                }
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .keyboardDoneToolbar(focusedField: $focusedField)
    }

    private func decimalField(
        title: String,
        unit: String,
        placeholder: String,
        text: Binding<String>,
        field: FocusedField
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(unit)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            TextField(placeholder, text: text)
                .keyboardType(.decimalPad)
                .numericFieldFocus(field, focusedField: $focusedField)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .padding(NeoGymTheme.spacingSM)
                .glassSurface(
                    cornerRadius: NeoGymTheme.radiusMD,
                    material: .ultraThin,
                    tint: NeoGymTheme.glassFill,
                    shadow: false
                )
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            PrimaryActionButton(
                title: submitLabel,
                busyTitle: "Saving",
                isBusy: isSubmitting,
                isEnabled: form.hasEnergyValue,
                action: onSubmit
            )
            Button("Cancel", action: onCancel)
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            if let deleteAction {
                Button(role: .destructive, action: deleteAction) {
                    Label("Delete energy", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}

