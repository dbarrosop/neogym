import NeoGymKit
import SwiftUI

struct FoodDetailView: View {
    @StateObject private var viewModel: FoodDetailViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        foodId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        currentUserId: String?,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: FoodDetailViewModel(foodId: foodId, repository: repository))
        self.repository = repository
        self.currentUserId = currentUserId
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 640)
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("Food")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if let food = viewModel.food, food.canEdit(currentUserId: currentUserId) {
                    NavigationLink {
                        FoodEditView(
                            foodId: food.id,
                            repository: repository,
                            currentUserId: currentUserId,
                            onSaved: {
                                onMutated()
                                Task { await viewModel.load() }
                            },
                            onDeleted: {
                                onDeleted()
                                presentationMode.wrappedValue.dismiss()
                            }
                        )
                    } label: {
                        Image(systemName: "pencil")
                    }
                    .accessibilityLabel("Edit food")
                }
            }
        }
        .task {
            if case .idle = viewModel.state { await viewModel.load() }
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading food") { AppLoadingStateView(title: "Loading food") }
        case .loading where viewModel.food == nil:
            SectionShell(title: "Loading food") { AppLoadingStateView(title: "Loading food") }
        case let .failed(message, _) where viewModel.food == nil:
            SectionShell(title: "Food") {
                AppErrorStateView(title: "Failed to load food", message: message) { Task { await viewModel.load() } }
            }
        default:
            if let food = viewModel.food {
                SectionShell(title: food.name, subtitle: "Food catalog") {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            FoodVisibilityBadge(isPublic: food.isPublic)
                            Spacer()
                        }
                        if !food.canEdit(currentUserId: currentUserId) {
                            Text(
                                "Public foods are read-only. Copy values into a private food "
                                    + "if you need a custom variant."
                            )
                            .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                        MacroPer100gGrid(food: food)
                    }
                }
            }
        }
    }
}

private struct MacroPer100gGrid: View {
    let food: Food

    var body: some View {
        let macros = NutritionMath.normalizeMacros(food.macroFields)
        VStack(alignment: .leading, spacing: 12) {
            Text("Per 100 g")
                .font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                tile("Calories", NutritionMath.formatMacro(macros.kcalPer100g, unit: "kcal"))
                tile("Fat", NutritionMath.formatMacro(macros.fatPer100g, unit: "g"))
                tile("Carbs", NutritionMath.formatMacro(macros.carbsPer100g, unit: "g"))
                tile("Protein", NutritionMath.formatMacro(macros.proteinPer100g, unit: "g"))
                tile("Fiber", NutritionMath.formatMacro(macros.fiberPer100g, unit: "g"))
                tile("Sugar", NutritionMath.formatMacro(macros.sugarPer100g, unit: "g"))
            }
        }
    }

    private func tile(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundColor(NeoGymTheme.mutedText)
            Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
    }
}

struct FoodCreateView: View {
    @StateObject private var editor: FoodEditorViewModel
    @StateObject private var form = FoodFormModel(initialValues: .empty)
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: FoodEditorViewModel(foodId: nil, repository: repository))
        self.onCreated = onCreated
        self.onFinished = onFinished
    }

    var body: some View {
        FoodFormScreen(
            title: "New food",
            submitLabel: "Create food",
            form: form,
            isSubmitting: editor.saveState.isLoading,
            errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New food")
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

struct FoodEditView: View {
    @StateObject private var editor: FoodEditorViewModel
    let currentUserId: String?
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: FoodFormModel?
    @State private var confirmDelete = false

    init(
        foodId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        currentUserId: String?,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: FoodEditorViewModel(foodId: foodId, repository: repository))
        self.currentUserId = currentUserId
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading food")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading food")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "Food") {
                    AppErrorStateView(title: "Failed to load food", message: message) { Task { await editor.load() } }
                }
                .padding(20)
            default:
                if let food = editor.food, !food.canEdit(currentUserId: currentUserId) {
                    SectionShell(title: "Read-only food") {
                        AppEmptyStateView(
                            title: "This food cannot be edited",
                            message: "Public foods are read-only.",
                            systemImage: "lock"
                        )
                    }
                    .padding(20)
                } else if let form {
                    FoodFormScreen(
                        title: "Edit food",
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
        .navigationTitle("Edit food")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = FoodFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this food?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete food", role: .destructive) { deleteFood() }
        } message: {
            Text("Food used by meal templates cannot be deleted until those references are removed.")
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

    private func deleteFood() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct FoodFormScreen: View {
    private enum NumericField: Hashable {
        case calories
        case fat
        case carbs
        case protein
        case fiber
        case sugar
    }

    let title: String
    let submitLabel: String
    @ObservedObject var form: FoodFormModel
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @FocusState private var focusedField: NumericField?

    var body: some View {
        ScrollView {
            SectionShell(title: title, subtitle: "Nutrition per 100 g") {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Food name").font(.subheadline.weight(.semibold))
                        TextField("e.g. Greek yogurt", text: Binding(
                            get: { form.name },
                            set: { form.name = String($0.prefix(160)) }
                        ))
                        .textInputAutocapitalization(.words)
                        .disableAutocorrection(false)
                        .padding(12)
                        .nutritionGlassField()
                    }

                    Text("Store nutrients using the canonical per-100g values from the package label.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        nutrientField("Calories", unit: "kcal", text: $form.kcalPer100g, field: .calories)
                        nutrientField("Fat", unit: "g", text: $form.fatPer100g, field: .fat)
                        nutrientField("Carbs", unit: "g", text: $form.carbsPer100g, field: .carbs)
                        nutrientField("Protein", unit: "g", text: $form.proteinPer100g, field: .protein)
                        nutrientField("Fiber", unit: "g", text: $form.fiberPer100g, field: .fiber)
                        nutrientField("Sugar", unit: "g", text: $form.sugarPer100g, field: .sugar)
                    }

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }

                    actions
                }
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .keyboardDoneToolbar(focusedField: $focusedField)
    }

    private func nutrientField(
        _ label: String,
        unit: String,
        text: Binding<String>,
        field: NumericField
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold))
            HStack {
                TextField("0", text: text)
                    .keyboardType(.decimalPad)
                    .numericFieldFocus(field, focusedField: $focusedField)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                Text(unit)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .padding(12)
            .nutritionGlassCard(cornerRadius: 12)
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            PrimaryActionButton(
                title: submitLabel,
                busyTitle: "Saving",
                isBusy: isSubmitting,
                isEnabled: form.canSubmit,
                action: onSubmit
            )
            Button("Cancel", action: onCancel)
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            if let deleteAction {
                Button(role: .destructive, action: deleteAction) {
                    Label("Delete food", systemImage: "trash").frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}
