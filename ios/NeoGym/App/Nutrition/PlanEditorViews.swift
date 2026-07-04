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
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

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
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals, availableFoods: editor.foods) else { return }
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
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

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
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals, availableFoods: editor.foods) else { return }
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
    let foods: [Food]
    let repository: any NutritionFoodMealRepositoryProtocol
    let reloadOptions: () async -> Void
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @State private var quickFood: QuickFoodSheetRequest?
    @State private var quickMeal: QuickMealSheetRequest?

    var body: some View {
        ScrollView {
            SectionShell(title: title, subtitle: "Daily plans") {
                VStack(alignment: .leading, spacing: 18) {
                    textFields
                    MacroSummaryView(
                        totals: form.macroTotals(availableMeals: meals, availableFoods: foods),
                        title: "Daily planned totals",
                        description: "Computed from selected meals and direct foods using current nutrition values."
                    )
                    entries
                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                    if let deleteAction {
                        FormDeleteButton(
                            title: "Delete plan",
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
                            if let stableId = request.planFoodSlotStableId {
                                form.updateFoodSlot(stableId: stableId, foodId: id)
                            }
                        }
                    }
                )
            }
            .navigationViewStyle(.stack)
        }
        .sheet(item: $quickMeal) { request in
            NavigationView {
                if let mealId = request.mealId {
                    MealEditView(
                        mealId: mealId,
                        repository: repository,
                        onSaved: { Task { await reloadOptions() } },
                        onDeleted: { Task { await reloadOptions() } }
                    )
                } else {
                    MealCreateView(
                        repository: repository,
                        onCreated: { id in
                            Task {
                                await reloadOptions()
                                form.updateSlot(stableId: request.planMealSlotStableId, mealId: id)
                            }
                        },
                        onFinished: { Task { await reloadOptions() } }
                    )
                }
            }
            .navigationViewStyle(.stack)
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

    private var entries: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Plan entries")
                    .font(.subheadline.weight(.semibold))
                Text("Mix meal templates and direct foods. Positions are saved globally within each time slot.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            let draftEntries = form.sortedDraftEntries()
            if draftEntries.isEmpty {
                Text("Add at least one meal or food entry to define this reusable daily template.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            }
            ForEach(Array(draftEntries.enumerated()), id: \.element.id) { index, entry in
                switch entry {
                case let .meal(slot):
                    NutritionPlanMealEntryEditorRow(
                        index: index,
                        totalCount: draftEntries.count,
                        slot: slot,
                        meals: meals,
                        isSubmitting: isSubmitting,
                        form: form,
                        createMeal: { quickMeal = QuickMealSheetRequest(planMealSlotStableId: slot.stableId) },
                        editMeal: { mealId in quickMeal = QuickMealSheetRequest(planMealSlotStableId: slot.stableId, mealId: mealId) }
                    )
                case let .food(slot):
                    NutritionPlanFoodEntryEditorRow(
                        index: index,
                        totalCount: draftEntries.count,
                        slot: slot,
                        foods: foods,
                        isSubmitting: isSubmitting,
                        form: form,
                        createFood: { quickFood = QuickFoodSheetRequest(planFoodSlotStableId: slot.stableId) },
                        editFood: { foodId in quickFood = QuickFoodSheetRequest(foodId: foodId, planFoodSlotStableId: slot.stableId) }
                    )
                }
            }
            HStack(spacing: 10) {
                Button {
                    form.addSlot(mealId: meals.first?.id ?? "")
                } label: {
                    Label("Add meal", systemImage: "fork.knife.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)

                Button {
                    form.addFoodSlot(foodId: foods.first?.id ?? "")
                } label: {
                    Label("Add food", systemImage: "apple.logo")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}

private struct NutritionPlanEntryChrome<Content: View>: View {
    let title: String
    let badge: String
    let badgeSystemImage: String
    let index: Int
    let totalCount: Int
    let isSubmitting: Bool
    let moveUp: () -> Void
    let moveDown: () -> Void
    let remove: () -> Void
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(badge, systemImage: badgeSystemImage)
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                Button(action: moveUp) { Image(systemName: "arrow.up") }
                    .accessibilityLabel("Move entry up")
                    .disabled(index == 0 || isSubmitting)
                Button(action: moveDown) { Image(systemName: "arrow.down") }
                    .accessibilityLabel("Move entry down")
                    .disabled(index == totalCount - 1 || isSubmitting)
                Button(role: .destructive, action: remove) { Image(systemName: "trash") }
                    .accessibilityLabel("Remove entry")
                    .disabled(isSubmitting)
            }
            content
        }
        .padding(12)
        .nutritionGlassCard(cornerRadius: 14, tint: NeoGymTheme.glassSubtleFill)
    }
}

private struct NutritionPlanMealEntryEditorRow: View {
    let index: Int
    let totalCount: Int
    let slot: NutritionPlanSlotFormValues
    let meals: [Meal]
    let isSubmitting: Bool
    @ObservedObject var form: NutritionPlanFormModel
    let createMeal: () -> Void
    let editMeal: (String) -> Void

    var body: some View {
        NutritionPlanEntryChrome(
            title: "Entry \(index + 1)",
            badge: "Meal",
            badgeSystemImage: "fork.knife.circle",
            index: index,
            totalCount: totalCount,
            isSubmitting: isSubmitting,
            moveUp: { form.moveEntry(kind: .meal, stableId: slot.stableId, direction: -1) },
            moveDown: { form.moveEntry(kind: .meal, stableId: slot.stableId, direction: 1) },
            remove: { form.removeSlot(stableId: slot.stableId) },
            content: {
                commonFields(label: "Optional; meal name is shown when empty.")
                MealPickerView(
                    meals: meals,
                    mealId: Binding(
                        get: { slot.mealId },
                        set: { form.updateSlot(stableId: slot.stableId, mealId: $0) }
                    ),
                    disabled: isSubmitting
                )
                pickerActions
            }
        )
    }

    private func commonFields(label: String) -> some View {
        PlanEntryCommonFields(
            slotTime: Binding(
                get: { slot.slotTime },
                set: { form.updateSlot(stableId: slot.stableId, slotTime: String($0.prefix(5))) }
            ),
            label: Binding(
                get: { slot.label },
                set: { form.updateSlot(stableId: slot.stableId, label: String($0.prefix(160))) }
            ),
            helperText: label
        )
    }

    private var pickerActions: some View {
        HStack(spacing: 8) {
            Button("New meal", action: createMeal)
                .buttonStyle(.bordered)
            if !slot.mealId.isEmpty {
                Button("Edit selected", action: { editMeal(slot.mealId) })
                    .buttonStyle(.bordered)
            }
        }
        .disabled(isSubmitting)
    }
}

private struct NutritionPlanFoodEntryEditorRow: View {
    let index: Int
    let totalCount: Int
    let slot: NutritionPlanFoodSlotFormValues
    let foods: [Food]
    let isSubmitting: Bool
    @ObservedObject var form: NutritionPlanFormModel
    let createFood: () -> Void
    let editFood: (String) -> Void

    private var selectedFood: Food? { foods.first { $0.id == slot.foodId } }

    var body: some View {
        NutritionPlanEntryChrome(
            title: "Entry \(index + 1)",
            badge: "Food",
            badgeSystemImage: "apple.logo",
            index: index,
            totalCount: totalCount,
            isSubmitting: isSubmitting,
            moveUp: { form.moveEntry(kind: .food, stableId: slot.stableId, direction: -1) },
            moveDown: { form.moveEntry(kind: .food, stableId: slot.stableId, direction: 1) },
            remove: { form.removeFoodSlot(stableId: slot.stableId) },
            content: {
                PlanEntryCommonFields(
                    slotTime: Binding(
                        get: { slot.slotTime },
                        set: { form.updateFoodSlot(stableId: slot.stableId, slotTime: String($0.prefix(5))) }
                    ),
                    label: Binding(
                        get: { slot.label },
                        set: { form.updateFoodSlot(stableId: slot.stableId, label: String($0.prefix(160))) }
                    ),
                    helperText: "Optional; food name is shown when empty."
                )
                FoodPickerView(
                    foods: foods,
                    foodId: Binding(
                        get: { slot.foodId },
                        set: { form.updateFoodSlot(stableId: slot.stableId, foodId: $0) }
                    ),
                    disabled: isSubmitting,
                    revealWheelOnDemand: true
                )
                NutritionGramTextField(grams: Binding(
                    get: { slot.grams },
                    set: { form.updateFoodSlot(stableId: slot.stableId, grams: String($0.prefix(12))) }
                ), title: "Planned grams")
                if let selectedFood {
                    let totals = NutritionMath.macrosForGrams(
                        input: selectedFood.macroFields,
                        grams: .string(slot.grams)
                    )
                    Text(NutritionMath.macroTotalsSummary(totals))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                pickerActions
            }
        )
    }

    private var pickerActions: some View {
        HStack(spacing: 8) {
            Button("New food", action: createFood)
                .buttonStyle(.bordered)
            if let selectedFood, !selectedFood.isPublic {
                Button("Edit selected", action: { editFood(selectedFood.id) })
                    .buttonStyle(.bordered)
            }
        }
        .disabled(isSubmitting)
    }
}

private struct PlanEntryCommonFields: View {
    @Binding var slotTime: String
    @Binding var label: String
    let helperText: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Time of day").font(.subheadline.weight(.semibold))
                TextField("12:00", text: $slotTime)
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
                TextField("e.g. Post-workout", text: $label)
                    .textInputAutocapitalization(.words)
                    .disableAutocorrection(false)
                    .padding(12)
                    .nutritionGlassField()
                Text(helperText)
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
    }
}

struct QuickMealSheetRequest: Identifiable {
    let id = UUID().uuidString
    let planMealSlotStableId: String
    var mealId: String?
}
