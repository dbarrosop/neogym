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
                        deleteAction: { confirmDelete = true },
                        deleteBlockedReason: editor.meal?.deleteBlockedReason
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
            Text("Logged meals keep their foods; they just stop linking to this template.")
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
    /// Set when plans still reference the meal, which blocks deletion.
    var deleteBlockedReason: String?

    @FocusState private var focusedIngredientId: String?
    @State private var picker: IngredientPickerRequest?
    @State private var quickFood: QuickFoodSheetRequest?

    var body: some View {
        FormScrollContainer {
            FormSection {
                FormLabeledTextRow(
                    label: "Name",
                    placeholder: "Breakfast bowl",
                    text: Binding(get: { form.name }, set: { form.name = String($0.prefix(160)) }),
                    capitalization: .words
                )
                RowSeparator()
                FormLabeledTextRow(
                    label: "Description",
                    placeholder: "Optional",
                    text: Binding(
                        get: { form.mealDescription },
                        set: { form.mealDescription = String($0.prefix(1_000)) }
                    ),
                    multiline: true
                )
            }
            MacroTotalsStrip(totals: form.macroTotals(availableFoods: foods))
            ingredients
            if let errorMessage {
                FeedbackBanner(message: errorMessage)
            }
            if let deleteAction {
                VStack(alignment: .leading, spacing: 6) {
                    FormDeleteButton(
                        title: "Delete meal",
                        isDisabled: isSubmitting || deleteBlockedReason != nil,
                        action: deleteAction
                    )
                    if let deleteBlockedReason {
                        FormFooter(deleteBlockedReason)
                    }
                }
                .padding(.top, NeoGymTheme.spacingXS)
            }
        }
        .keyboardDoneToolbar(focusedField: $focusedIngredientId)
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.canSubmit,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
        .sheet(item: $picker) { request in
            NutritionSelectionSheet(
                title: request.replacingStableId == nil ? "Add ingredient" : "Change food",
                searchPrompt: "Search foods",
                items: foods,
                name: \.name,
                caption: NutritionSelectionCaption.food,
                newItemTitle: "New food",
                onSelect: { food in apply(request, foodId: food.id) },
                newItemForm: {
                    QuickFoodEditorSheet(repository: repository, foodId: nil) { id in
                        picker = nil
                        Task {
                            await reloadOptions()
                            apply(request, foodId: id)
                        }
                    }
                }
            )
        }
        .sheet(item: $quickFood) { request in
            NavigationStack {
                QuickFoodEditorSheet(repository: repository, foodId: request.foodId) { _ in
                    Task { await reloadOptions() }
                }
            }
        }
    }

    private var ingredients: some View {
        FormSection(
            header: "Ingredients",
            footer: form.ingredients.isEmpty
                ? "Add at least one food. Totals use each food's current values."
                : "Totals use each food's current values. Long-press a row to reorder."
        ) {
            ForEach(Array(form.ingredients.enumerated()), id: \.element.stableId) { index, ingredient in
                if index > 0 { RowSeparator() }
                MealIngredientRow(
                    index: index,
                    ingredient: ingredient,
                    food: foods.first { $0.id == ingredient.foodId },
                    isSubmitting: isSubmitting,
                    form: form,
                    focusedIngredientId: $focusedIngredientId,
                    changeFood: { picker = IngredientPickerRequest(replacingStableId: ingredient.stableId) },
                    editFood: { foodId in quickFood = QuickFoodSheetRequest(foodId: foodId) }
                )
            }
            if !form.ingredients.isEmpty { RowSeparator() }
            FormActionRow(title: "Add ingredient", isDisabled: isSubmitting) {
                picker = IngredientPickerRequest(replacingStableId: nil)
            }
        }
    }

    private func apply(_ request: IngredientPickerRequest, foodId: String) {
        if let stableId = request.replacingStableId {
            form.updateIngredient(stableId: stableId, foodId: foodId)
        } else {
            form.addIngredient(foodId: foodId)
        }
    }
}

private struct IngredientPickerRequest: Identifiable {
    let id = UUID()
    /// The ingredient whose food changes; `nil` adds a new ingredient.
    let replacingStableId: String?
}

private struct MealIngredientRow: View {
    let index: Int
    let ingredient: MealIngredientFormValues
    let food: Food?
    let isSubmitting: Bool
    @ObservedObject var form: MealFormModel
    let focusedIngredientId: FocusState<String?>.Binding
    let changeFood: () -> Void
    let editFood: (String) -> Void

    private var displayName: String { food?.name ?? "Choose a food" }

    var body: some View {
        FormRow {
            FormRemoveButton(accessibilityLabel: "Remove \(displayName)", isDisabled: isSubmitting) {
                form.removeIngredient(stableId: ingredient.stableId)
            }
            Button(action: changeFood) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .foregroundStyle(food == nil ? NeoGymTheme.accentText : NeoGymTheme.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if let food {
                        Text(EntryMacroCaption.text(
                            NutritionMath.macrosForGrams(input: food.macroFields, grams: .string(ingredient.grams))
                        ))
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting)
            .accessibilityHint("Changes the food")
            FormNumberField(
                accessibilityLabel: "\(displayName) grams",
                text: Binding(
                    get: { ingredient.grams },
                    set: { form.updateIngredient(stableId: ingredient.stableId, grams: $0) }
                ),
                unit: "g",
                placeholder: "100",
                field: ingredient.stableId,
                focusedField: focusedIngredientId
            )
        }
        .contextMenu { menu }
        .accessibilityActions { menu }
    }

    @ViewBuilder
    private var menu: some View {
        Button("Change food", systemImage: "arrow.left.arrow.right", action: changeFood)
        if let food, !food.isPublic {
            Button("Edit food", systemImage: "pencil") { editFood(food.id) }
        }
        Button("Move up", systemImage: "arrow.up") {
            form.moveIngredient(stableId: ingredient.stableId, direction: -1)
        }
        .disabled(index == 0)
        Button("Move down", systemImage: "arrow.down") {
            form.moveIngredient(stableId: ingredient.stableId, direction: 1)
        }
        .disabled(index == form.ingredients.count - 1)
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
