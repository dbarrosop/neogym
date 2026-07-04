import NeoGymKit
import SwiftUI

struct MealCreateView: View {
    @StateObject private var editor: MealEditorViewModel
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: MealFormModel?

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: MealEditorViewModel(mealId: nil, repository: repository))
        self.onCreated = onCreated
        self.onFinished = onFinished
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

    var body: some View {
        mealEditorBody(
            loadingTitle: "Loading foods",
            formTitle: "New meal",
            submitLabel: "Create meal",
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New meal")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        if case .idle = editor.state {
            await editor.load()
            if let initialValues = editor.initialValues, form == nil {
                form = MealFormModel(initialValues: initialValues)
            }
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableFoods: editor.foods) else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func mealEditorBody(
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
                    AppErrorStateView(title: "Failed to load meal form", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    MealFormScreen(
                        title: formTitle,
                        submitLabel: submitLabel,
                        form: form,
                        foods: editor.foods,
                        repository: editorRepository,
                        reloadOptions: { await editor.load() },
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

struct MealEditView: View {
    @StateObject private var editor: MealEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: MealFormModel?
    @State private var confirmDelete = false

    init(
        mealId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: MealEditorViewModel(mealId: mealId, repository: repository))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading meal")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading meal")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "Meal") {
                    AppErrorStateView(title: "Failed to load meal", message: message) { Task { await editor.load() } }
                }
                .padding(20)
            default:
                if let form {
                    MealFormScreen(
                        title: "Edit meal",
                        submitLabel: "Save changes",
                        form: form,
                        foods: editor.foods,
                        repository: editorRepository,
                        reloadOptions: { await editor.load() },
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
        .navigationTitle("Edit meal")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = MealFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this meal?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete meal", role: .destructive) { deleteMeal() }
        } message: {
            Text(
                "Meal deletion is blocked while a nutrition plan slot references it. "
                    + "Historical logged meals detach their template provenance."
            )
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableFoods: editor.foods) else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deleteMeal() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct MealFormScreen: View {
    let title: String
    let submitLabel: String
    @ObservedObject var form: MealFormModel
    let foods: [Food]
    let repository: any NutritionFoodMealRepositoryProtocol
    let reloadOptions: () async -> Void
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @FocusState private var focusedIngredientId: String?
    @State private var quickFood: QuickFoodSheetRequest?

    var body: some View {
        ScrollView {
            SectionShell(title: title, subtitle: "Meal templates") {
                VStack(alignment: .leading, spacing: 18) {
                    textFields
                    MacroSummaryView(
                        totals: form.macroTotals(availableFoods: foods),
                        title: "Live meal totals",
                        description: "Computed from current food nutrition values and ingredient grams."
                    )
                    ingredients
                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                    if let deleteAction {
                        FormDeleteButton(
                            title: "Delete meal",
                            isDisabled: isSubmitting,
                            action: deleteAction
                        )
                        .padding(.top, NeoGymTheme.spacingSM)
                    }
                }
            }
            .frame(maxWidth: 680)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.canSubmit,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
        .sheet(item: $quickFood) { request in
            NavigationView {
                QuickFoodEditorSheet(
                    repository: repository,
                    foodId: request.foodId,
                    onSaved: { id in
                        Task {
                            await reloadOptions()
                            if let stableId = request.ingredientStableId {
                                form.updateIngredient(stableId: stableId, foodId: id)
                            }
                        }
                    }
                )
            }
            .navigationViewStyle(.stack)
        }
    }

    private var textFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Meal name").font(.subheadline.weight(.semibold))
                TextField("e.g. Breakfast bowl", text: Binding(
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
                    get: { form.mealDescription },
                    set: { form.mealDescription = String($0.prefix(1_000)) }
                ))
                .frame(minHeight: 90)
                .padding(8)
                .nutritionGlassField()
                Text("Optional prep notes or serving ideas.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
    }

    private var ingredients: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Ingredients")
                    .font(.subheadline.weight(.semibold))
                Text("Pick from your private foods and public foods. Use arrows to keep a stable order.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            if form.ingredients.isEmpty {
                Text("Add at least one food to define this meal template.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            }
            ForEach(Array(form.ingredients.enumerated()), id: \.element.stableId) { index, ingredient in
                MealIngredientEditorRow(
                    index: index,
                    ingredient: ingredient,
                    foods: foods,
                    isSubmitting: isSubmitting,
                    form: form,
                    focusedIngredientId: $focusedIngredientId,
                    createFood: { quickFood = QuickFoodSheetRequest(ingredientStableId: ingredient.stableId) },
                    editFood: { foodId in quickFood = QuickFoodSheetRequest(foodId: foodId, ingredientStableId: ingredient.stableId) }
                )
            }
            Button {
                form.addIngredient()
            } label: {
                Label("Add food", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(NeoGymSecondaryButtonStyle())
            .disabled(isSubmitting)
        }
    }
}

private struct MealIngredientEditorRow: View {
    let index: Int
    let ingredient: MealIngredientFormValues
    let foods: [Food]
    let isSubmitting: Bool
    @ObservedObject var form: MealFormModel
    let focusedIngredientId: FocusState<String?>.Binding
    let createFood: () -> Void
    let editFood: (String) -> Void

    private var selectedFood: Food? { foods.first { $0.id == ingredient.foodId } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Ingredient \(index + 1)")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                Button { form.moveIngredient(stableId: ingredient.stableId, direction: -1) } label: {
                    Image(systemName: "arrow.up")
                }
                .accessibilityLabel("Move ingredient up")
                .disabled(index == 0 || isSubmitting)
                Button { form.moveIngredient(stableId: ingredient.stableId, direction: 1) } label: {
                    Image(systemName: "arrow.down")
                }
                .accessibilityLabel("Move ingredient down")
                .disabled(index == form.ingredients.count - 1 || isSubmitting)
                Button(role: .destructive) { form.removeIngredient(stableId: ingredient.stableId) } label: {
                    Image(systemName: "trash")
                }
                .accessibilityLabel("Remove ingredient")
                .disabled(isSubmitting)
            }

            FoodPickerView(
                foods: foods,
                foodId: Binding(
                    get: { ingredient.foodId },
                    set: { form.updateIngredient(stableId: ingredient.stableId, foodId: $0) }
                ),
                disabled: isSubmitting,
                revealWheelOnDemand: true
            )

            HStack(spacing: 8) {
                Button("New food", action: createFood)
                    .buttonStyle(.bordered)
                if let selectedFood, !selectedFood.isPublic {
                    Button("Edit selected", action: { editFood(selectedFood.id) })
                        .buttonStyle(.bordered)
                }
            }
            .disabled(isSubmitting)

            VStack(alignment: .leading, spacing: 6) {
                Text("Grams").font(.subheadline.weight(.semibold))
                HStack {
                    TextField("100", text: Binding(
                        get: { ingredient.grams },
                        set: { form.updateIngredient(stableId: ingredient.stableId, grams: $0) }
                    ))
                    .keyboardType(.decimalPad)
                    .numericFieldFocus(ingredient.stableId, focusedField: focusedIngredientId)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    Text("g")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .padding(12)
                .nutritionGlassField()
            }
        }
        .padding(12)
        .nutritionGlassCard(cornerRadius: 14, tint: NeoGymTheme.glassSubtleFill)
    }
}

struct QuickFoodSheetRequest: Identifiable {
    let id = UUID().uuidString
    var foodId: String?
    var ingredientStableId: String?
    var planFoodSlotStableId: String?
}

struct QuickFoodEditorSheet: View {
    @StateObject private var editor: FoodEditorViewModel
    let foodId: String?
    let onSaved: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var form: FoodFormModel?

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        foodId: String?,
        onSaved: @escaping (String) -> Void
    ) {
        _editor = StateObject(wrappedValue: FoodEditorViewModel(foodId: foodId, repository: repository))
        self.foodId = foodId
        self.onSaved = onSaved
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: foodId == nil ? "Preparing food" : "Loading food")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading food")
            case let .failed(message, _) where form == nil:
                SectionShell(title: foodId == nil ? "New food" : "Edit food") {
                    AppErrorStateView(title: "Failed to load food", message: message) { Task { await loadIfNeeded() } }
                }
                .padding(20)
            default:
                if let form {
                    FoodFormScreen(
                        title: foodId == nil ? "New food" : "Edit food",
                        submitLabel: foodId == nil ? "Create food" : "Save changes",
                        form: form,
                        isSubmitting: editor.saveState.isLoading,
                        errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
                        onSubmit: submit,
                        onCancel: { dismiss() }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .navigationTitle(foodId == nil ? "New food" : "Edit food")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        if case .idle = editor.state {
            await editor.load()
            if let initialValues = editor.initialValues, form == nil {
                form = FoodFormModel(initialValues: initialValues)
            }
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit() else { return }
        Task {
            if let foodId {
                if await editor.save(values: values) {
                    onSaved(foodId)
                    dismiss()
                }
            } else if let id = await editor.create(values: values) {
                onSaved(id)
                dismiss()
            }
        }
    }
}
