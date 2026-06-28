import NeoGymKit
import SwiftUI

struct NutritionPlanCreateView: View {
    @StateObject private var editor: NutritionPlanEditorViewModel
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: NutritionPlanFormModel?

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: NutritionPlanEditorViewModel(planId: nil, repository: repository))
        self.onCreated = onCreated
        self.onFinished = onFinished
    }

    var body: some View {
        planEditorBody(
            loadingTitle: "Loading meals",
            formTitle: "New plan",
            submitLabel: "Create plan",
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New plan")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        if case .idle = editor.state {
            await editor.load()
            if let initialValues = editor.initialValues, form == nil {
                form = NutritionPlanFormModel(initialValues: initialValues)
            }
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals) else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func planEditorBody(
        loadingTitle: String,
        formTitle: String,
        submitLabel: String,
        onSubmit: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) -> some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: loadingTitle)
            case .loading where form == nil:
                AppLoadingStateView(title: loadingTitle)
            case let .failed(message, _) where form == nil:
                SectionShell(title: formTitle) {
                    AppErrorStateView(title: "Failed to load plan form", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    NutritionPlanFormScreen(
                        title: formTitle,
                        submitLabel: submitLabel,
                        form: form,
                        meals: editor.meals,
                        isSubmitting: editor.saveState.isLoading,
                        errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
                        onSubmit: onSubmit,
                        onCancel: onCancel
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
    }
}

struct NutritionPlanEditView: View {
    @StateObject private var editor: NutritionPlanEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: NutritionPlanFormModel?
    @State private var confirmDelete = false

    init(
        planId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: NutritionPlanEditorViewModel(planId: planId, repository: repository))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading plan")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading plan")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "Plan") {
                    AppErrorStateView(title: "Failed to load plan", message: message) { Task { await editor.load() } }
                }
                .padding(20)
            default:
                if let form {
                    NutritionPlanFormScreen(
                        title: "Edit plan",
                        submitLabel: "Save changes",
                        form: form,
                        meals: editor.meals,
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
        .navigationTitle("Edit plan")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = NutritionPlanFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this plan?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete plan", role: .destructive) { deletePlan() }
        } message: {
            Text(
                "This reusable plan template will be deleted. "
                    + "Days that selected it are detached by the database; historical logs remain."
            )
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals) else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deletePlan() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct NutritionPlanFormScreen: View {
    let title: String
    let submitLabel: String
    @ObservedObject var form: NutritionPlanFormModel
    let meals: [Meal]
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    var body: some View {
        ScrollView {
            SectionShell(title: title, subtitle: "Daily plans") {
                VStack(alignment: .leading, spacing: 18) {
                    textFields
                    MacroSummaryView(
                        totals: form.macroTotals(availableMeals: meals),
                        title: "Daily planned totals",
                        description: "Computed from each selected meal's current food nutrition values."
                    )
                    slots
                    if let errorMessage {
                        Text(errorMessage).font(.caption).foregroundColor(.red)
                    }
                    actions
                }
            }
            .frame(maxWidth: 680)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
    }

    private var textFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Plan name").font(.subheadline.weight(.semibold))
                TextField("e.g. Training day", text: Binding(
                    get: { form.name },
                    set: { form.name = String($0.prefix(160)) }
                ))
                .textInputAutocapitalization(.words)
                .disableAutocorrection(false)
                .padding(12)
                .nutritionGlassField()
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Description")
                    .font(.subheadline.weight(.semibold))
                TextEditor(text: Binding(
                    get: { form.planDescription },
                    set: { form.planDescription = String($0.prefix(1_000)) }
                ))
                .frame(minHeight: 90)
                .padding(8)
                .nutritionGlassField()
                Text("Optional prep notes or when to use this one-day template.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
    }

    private var slots: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Meal slots")
                    .font(.subheadline.weight(.semibold))
                Text("Add required local times of day. Slots save sorted by time, then stable position.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            if form.slots.isEmpty {
                Text("Add at least one timed meal slot to define this reusable daily template.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            }
            ForEach(Array(form.slots.enumerated()), id: \.element.stableId) { index, slot in
                NutritionPlanSlotEditorRow(
                    index: index,
                    slot: slot,
                    meals: meals,
                    isSubmitting: isSubmitting,
                    form: form
                )
            }
            Button {
                form.addSlot()
            } label: {
                Label("Add slot", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(NeoGymSecondaryButtonStyle())
            .disabled(isSubmitting || meals.isEmpty)
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button(submitLabel, action: onSubmit)
                .buttonStyle(NeoGymPrimaryButtonStyle())
                .disabled(isSubmitting || !form.canSubmit)
                .opacity(isSubmitting || !form.canSubmit ? 0.6 : 1)
            Button("Cancel", action: onCancel)
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            if let deleteAction {
                Button(role: .destructive, action: deleteAction) {
                    Label("Delete plan", systemImage: "trash").frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}

private struct NutritionPlanSlotEditorRow: View {
    let index: Int
    let slot: NutritionPlanSlotFormValues
    let meals: [Meal]
    let isSubmitting: Bool
    @ObservedObject var form: NutritionPlanFormModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Slot \(index + 1)")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                Button { form.moveSlot(stableId: slot.stableId, direction: -1) } label: {
                    Image(systemName: "arrow.up")
                }
                .disabled(index == 0 || isSubmitting)
                Button { form.moveSlot(stableId: slot.stableId, direction: 1) } label: {
                    Image(systemName: "arrow.down")
                }
                .disabled(index == form.slots.count - 1 || isSubmitting)
                Button(role: .destructive) { form.removeSlot(stableId: slot.stableId) } label: {
                    Image(systemName: "trash")
                }
                .disabled(isSubmitting)
            }

            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Time of day").font(.subheadline.weight(.semibold))
                    TextField("12:00", text: Binding(
                        get: { slot.slotTime },
                        set: { form.updateSlot(stableId: slot.stableId, slotTime: String($0.prefix(5))) }
                    ))
                    .keyboardType(.numbersAndPunctuation)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .padding(12)
                    .nutritionGlassField()
                    Text("HH:MM")
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .frame(width: 110)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Label")
                        .font(.subheadline.weight(.semibold))
                    TextField("e.g. Post-workout", text: Binding(
                        get: { slot.label },
                        set: { form.updateSlot(stableId: slot.stableId, label: String($0.prefix(160))) }
                    ))
                    .textInputAutocapitalization(.words)
                    .disableAutocorrection(false)
                    .padding(12)
                    .nutritionGlassField()
                    Text("Optional; meal name is shown when empty.")
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }

            MealPickerView(
                meals: meals,
                mealId: Binding(
                    get: { slot.mealId },
                    set: { form.updateSlot(stableId: slot.stableId, mealId: $0) }
                ),
                disabled: isSubmitting
            )
        }
        .padding(12)
        .nutritionGlassCard(cornerRadius: 14, tint: NeoGymTheme.glassSubtleFill)
    }
}
