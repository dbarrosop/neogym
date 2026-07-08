import NeoGymKit
import SwiftUI

struct LogIntakeSheetRequest: Identifiable {
    enum InitialMode: Equatable {
        case food
        case meal
        case adHoc
    }

    let id = UUID().uuidString
    let initialMode: InitialMode

    static let adHocFood = LogIntakeSheetRequest(initialMode: .food)
}

struct LogIntakeSheet: View {
    private enum Mode: String, CaseIterable, Identifiable {
        case food
        case meal
        case plan
        case adHoc

        var id: String { rawValue }
        var title: String {
            switch self {
            case .food: "Food"
            case .meal: "Meal"
            case .plan: "From plan"
            case .adHoc: "Custom"
            }
        }
    }

    @ObservedObject var viewModel: DailyIntakeViewModel
    let request: LogIntakeSheetRequest
    let onMutated: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode
    @State private var foodId = ""
    @State private var mealId = ""
    @State private var planEntryId = ""
    @State private var grams = "100"
    @State private var adHocName = ""
    @State private var adHocKcal = "0"
    @State private var adHocFat = "0"
    @State private var adHocCarbs = "0"
    @State private var adHocProtein = "0"
    @State private var adHocFiber = "0"
    @State private var adHocSugar = "0"
    @State private var ingredientGrams: [String: String] = [:]
    @State private var slotTime = Date()
    @State private var hasInitializedSlotTime = false

    private var foods: [Food] { viewModel.payload?.foods ?? [] }
    private var meals: [Meal] { viewModel.payload?.meals ?? [] }
    private var planEntries: [NutritionPlanEntry] { viewModel.selectedPlan?.sortedEntries ?? [] }
    private var selectedPlanEntry: NutritionPlanEntry? {
        guard mode == .plan else { return nil }
        return planEntries.first { $0.id == planEntryId }
    }
    private var selectedFood: Food? {
        if case let .food(slot) = selectedPlanEntry { return slot.food }
        return foods.first { $0.id == foodId }
    }
    private var selectedMeal: Meal? {
        if case let .meal(slot) = selectedPlanEntry { return slot.meal }
        return meals.first { $0.id == mealId }
    }
    private var adHocMacroFields: MacroFields {
        MacroFields(
            kcalPer100g: .string(adHocKcal),
            fatPer100g: .string(adHocFat),
            carbsPer100g: .string(adHocCarbs),
            proteinPer100g: .string(adHocProtein),
            fiberPer100g: .string(adHocFiber),
            sugarPer100g: .string(adHocSugar)
        )
    }
    private var adHocNutrientInputs: [String] {
        [adHocKcal, adHocFat, adHocCarbs, adHocProtein, adHocFiber, adHocSugar]
    }
    private var adHocDraft: AdHocFoodDraftValues {
        AdHocFoodDraftValues(
            name: adHocName,
            grams: grams,
            slotTime: NutritionLogTime.inputValue(from: slotTime),
            macros: Per100gMacroStrings(
                kcalPer100g: adHocKcal,
                grams: GramMacroStrings(
                    fatPer100g: adHocFat,
                    carbsPer100g: adHocCarbs,
                    proteinPer100g: adHocProtein,
                    fiberPer100g: adHocFiber,
                    sugarPer100g: adHocSugar
                )
            )
        )
    }
    private var isLoggingFoodDraft: Bool {
        if let selectedPlanEntry { return selectedPlanEntry.kind == .food }
        return mode == .food
    }
    private var isLoggingMealDraft: Bool {
        if let selectedPlanEntry { return selectedPlanEntry.kind == .meal }
        return mode == .meal
    }
    private var mealDraft: Meal? {
        guard let selectedMeal else { return nil }
        let ingredients = selectedMeal.mealIngredients.map { ingredient in
            MealIngredient(
                id: ingredient.id,
                mealId: ingredient.mealId,
                foodId: ingredient.foodId,
                grams: .string(ingredientGrams[ingredient.id] ?? NutritionMath.formatEditableDecimal(ingredient.grams)),
                position: ingredient.position,
                food: ingredient.food
            )
        }
        return Meal(
            id: selectedMeal.id,
            name: selectedMeal.name,
            description: selectedMeal.description,
            createdAt: selectedMeal.createdAt,
            updatedAt: selectedMeal.updatedAt,
            mealIngredients: ingredients
        )
    }
    private var previewTotals: MacroTotals {
        if isLoggingFoodDraft {
            guard let selectedFood else { return .empty }
            return NutritionMath.macrosForGrams(input: selectedFood.macroFields, grams: .string(grams))
        }
        if mode == .adHoc {
            return NutritionMath.macrosForGrams(input: adHocMacroFields, grams: .string(grams))
        }
        return isLoggingMealDraft ? mealDraft?.macroTotals ?? .empty : .empty
    }

    init(viewModel: DailyIntakeViewModel, request: LogIntakeSheetRequest, onMutated: @escaping () -> Void) {
        self.viewModel = viewModel
        self.request = request
        self.onMutated = onMutated
        _mode = State(initialValue: {
            switch request.initialMode {
            case .food: .food
            case .meal: .meal
            case .adHoc: .adHoc
            }
        }())
    }

    var body: some View {
        NavigationView {
            Form {
                sourceSection
                timeSection
                draftSection
                macroSection
                mutationError
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isMutating ? "Logging…" : "Log") {
                        Task { await save() }
                    }
                    .disabled(viewModel.isMutating || !canSave)
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear(perform: prepareInitialDraft)
        .onChange(of: mode) { _ in prepareDraft() }
        .onChange(of: foodId) { _ in prepareFoodDraft() }
        .onChange(of: mealId) { _ in prepareMealDraft() }
        .onChange(of: planEntryId) { _ in prepareDraft() }
    }

}

private extension LogIntakeSheet {
    var navigationTitle: String {
        "Log intake"
    }

    var canSave: Bool {
        if isLoggingFoodDraft {
            return selectedFood != nil && (NutritionMath.parseMacroInput(grams) ?? 0) > 0
        }
        if isLoggingMealDraft {
            return mealDraft != nil
                && ingredientGrams.values.allSatisfy { (NutritionMath.parseMacroInput($0) ?? 0) > 0 }
        }
        if mode == .adHoc {
            return !adHocName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && (NutritionMath.parseMacroInput(grams) ?? 0) > 0
                && adHocNutrientInputs.allSatisfy { NutritionMath.parseMacroInput($0) != nil }
        }
        return false
    }

    @ViewBuilder
    private var sourceSection: some View {
        Section {
            Picker("Log source", selection: $mode) {
                ForEach(Mode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .disabled(viewModel.isMutating)

            switch mode {
            case .food:
                FoodPickerView(foods: foods, foodId: $foodId, disabled: viewModel.isMutating, revealWheelOnDemand: true)
            case .meal:
                MealPickerView(meals: meals, mealId: $mealId, disabled: viewModel.isMutating)
            case .plan:
                if planEntries.isEmpty {
                    Text("Select a nutrition plan for this day to log planned meal or food suggestions.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                } else {
                    Picker("Plan entry", selection: $planEntryId) {
                        ForEach(planEntries) { entry in
                            PlanEntryWheelRow(entry: entry)
                                .tag(entry.id)
                        }
                    }
                    .pickerStyle(.wheel)
                    .labelsHidden()
                    .frame(height: 88)
                    .clipped()
                }
            case .adHoc:
                Text("Enter a one-off food below. It is saved only on this day and will not appear in food pickers.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        } header: {
            Text("What are you logging?")
        } footer: {
            Text("Template times are suggestions. The logged time below defaults to now and remains editable.")
        }
    }

    var timeSection: some View {
        Section {
            DatePicker("Time eaten", selection: $slotTime, displayedComponents: .hourAndMinute)
                .datePickerStyle(.compact)
                .disabled(viewModel.isMutating)
        } header: {
            Text("Logged time")
        }
    }

    @ViewBuilder
    private var draftSection: some View {
        if isLoggingFoodDraft {
            Section {
                NutritionGramTextField(grams: $grams, title: "Grams consumed")
            } header: {
                Text("Logged amount")
            } footer: {
                Text("Plan-food logs save as standalone entries with provenance; snapshots are filled by the database.")
            }
        } else if mode == .adHoc {
            Section {
                TextField("Food name", text: Binding(
                    get: { adHocName },
                    set: { adHocName = String($0.prefix(160)) }
                ))
                .textInputAutocapitalization(.words)
                NutritionGramTextField(grams: $grams, title: "Grams consumed")
                AdHocNutrientFields(
                    kcal: $adHocKcal,
                    fat: $adHocFat,
                    carbs: $adHocCarbs,
                    protein: $adHocProtein,
                    fiber: $adHocFiber,
                    sugar: $adHocSugar
                )
            } header: {
                Text("Custom food")
            } footer: {
                Text("Enter nutrients per 100g. Custom foods are log-only snapshots and are editable later.")
            }
        } else if isLoggingMealDraft, let mealDraft {
            Section {
                ForEach(mealDraft.mealIngredients) { ingredient in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ingredient.food?.name ?? "Food")
                            .font(.subheadline.weight(.semibold))
                        NutritionGramTextField(
                            grams: Binding(
                                get: {
                                    ingredientGrams[ingredient.id]
                                        ?? NutritionMath.formatEditableDecimal(ingredient.grams)
                                },
                                set: { ingredientGrams[ingredient.id] = String($0.prefix(12)) }
                            ),
                            title: "Grams"
                        )
                    }
                }
            } header: {
                Text("Materialized entries")
            } footer: {
                Text("Meal logs create one grouped meal with editable child gram amounts and matching day IDs.")
            }
        }
    }

    var macroSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text(NutritionMath.formatMacro(previewTotals.kcal, unit: "kcal"))
                    .font(.headline.monospacedDigit())
                Text(NutritionMath.macroTotalsSummary(previewTotals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        } header: {
            Text("Macro preview")
        }
    }

    @ViewBuilder
    private var mutationError: some View {
        if let message = viewModel.mutationState.errorMessage {
            Section {
                Text(message)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.danger)
            }
        }
    }

    func prepareInitialDraft() {
        if !hasInitializedSlotTime {
            slotTime = Date()
            hasInitializedSlotTime = true
        }
        prepareDraft()
    }

    func prepareDraft() {
        if foodId.isEmpty, let first = foods.first { foodId = first.id }
        if mealId.isEmpty, let first = meals.first { mealId = first.id }
        if mode == .plan, planEntryId.isEmpty, let first = planEntries.first { planEntryId = first.id }
        switch selectedPlanEntry {
        case let .food(slot):
            grams = NutritionMath.formatEditableDecimal(slot.grams)
        case .meal:
            prepareMealDraft()
        case nil:
            if mode == .food { prepareFoodDraft() }
            if mode == .meal { prepareMealDraft() }
        }
    }

    func prepareFoodDraft() {
        if mode == .food { grams = "100" }
    }

    func prepareMealDraft() {
        guard let selectedMeal else { return }
        ingredientGrams = Dictionary(uniqueKeysWithValues: selectedMeal.mealIngredients.map { ingredient in
            (ingredient.id, NutritionMath.formatEditableDecimal(ingredient.grams))
        })
    }

    func save() async {
        let time = NutritionLogTime.inputValue(from: slotTime)
        let succeeded: Bool
        switch selectedPlanEntry {
        case let .food(slot):
            succeeded = await viewModel.logPlanFood(slot, grams: grams, slotTime: time)
        case let .meal(slot):
            guard let mealDraft else { return }
            succeeded = await viewModel.logMeal(
                meal: mealDraft,
                planSlot: slot,
                slotTime: time,
                position: nil
            )
        case nil:
            switch mode {
            case .food:
                succeeded = await viewModel.logFood(foodId: foodId, grams: grams, slotTime: time)
            case .meal:
                guard let mealDraft else { return }
                succeeded = await viewModel.logMeal(meal: mealDraft, planSlot: nil, slotTime: time)
            case .adHoc:
                succeeded = await viewModel.logAdHocFood(adHocDraft)
            case .plan:
                return
            }
        }
        if succeeded {
            onMutated()
            dismiss()
        }
    }
}

private struct AdHocNutrientFields: View {
    private enum FocusedField: Hashable {
        case kcal
        case fat
        case carbs
        case protein
        case fiber
        case sugar
    }

    @Binding var kcal: String
    @Binding var fat: String
    @Binding var carbs: String
    @Binding var protein: String
    @Binding var fiber: String
    @Binding var sugar: String

    @FocusState private var focusedField: FocusedField?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Per 100g nutrients")
                .font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                nutrientField("Calories", unit: "kcal", text: $kcal, field: .kcal)
                nutrientField("Fat", unit: "g", text: $fat, field: .fat)
                nutrientField("Carbs", unit: "g", text: $carbs, field: .carbs)
                nutrientField("Protein", unit: "g", text: $protein, field: .protein)
                nutrientField("Fiber", unit: "g", text: $fiber, field: .fiber)
                nutrientField("Sugar", unit: "g", text: $sugar, field: .sugar)
            }
        }
    }

    private func nutrientField(
        _ label: String,
        unit: String,
        text: Binding<String>,
        field: FocusedField
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
            HStack(spacing: 4) {
                TextField("0", text: text)
                    .keyboardType(.decimalPad)
                    .numericFieldFocus(field, focusedField: $focusedField)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .multilineTextAlignment(.trailing)
                Text(unit)
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
    }
}

private struct PlanEntryWheelRow: View {
    let entry: NutritionPlanEntry

    var body: some View {
        HStack(spacing: 4) {
            Text("\(IntakeGrouping.formatTimeOfDay(entry.slotTime)) · \(entry.displayLabel)")
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Text("· \(entry.kind == .meal ? "Meal" : "Food") · \(detail)")
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
    }

    private var detail: String {
        switch entry {
        case let .meal(slot):
            guard let meal = slot.meal else { return "Meal template unavailable" }
            return NutritionMath.macroTotalsSummary(meal.macroTotals)
        case let .food(slot):
            return "\(slot.food?.name ?? "Food") · \(NutritionMath.formatMacro(slot.grams, unit: "g")) · "
                + NutritionMath.macroTotalsSummary(slot.macroTotals)
        }
    }
}

struct EditLogEntrySheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingEntrySheetItem
    let onMutated: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var grams: String
    @State private var position: Int
    @State private var slotTime: Date
    @State private var kcal: String
    @State private var fat: String
    @State private var carbs: String
    @State private var protein: String
    @State private var fiber: String
    @State private var sugar: String
    @State private var isConfirmingDelete = false

    init(viewModel: DailyIntakeViewModel, item: EditingEntrySheetItem, onMutated: @escaping () -> Void) {
        self.viewModel = viewModel
        self.item = item
        self.onMutated = onMutated

        _name = State(initialValue: item.entry.snapshotFoodName)
        _grams = State(initialValue: NutritionLogAmount.editableNumber(item.entry.grams))
        _position = State(initialValue: max(1, Int(item.entry.position)))
        _slotTime = State(initialValue: NutritionLogTime.date(from: item.entry.slotTime))
        _kcal = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotKcalPer100g))
        _fat = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotFatPer100g))
        _carbs = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotCarbsPer100g))
        _protein = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotProteinPer100g))
        _fiber = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotFiberPer100g))
        _sugar = State(initialValue: NutritionLogAmount.editableNumber(item.entry.snapshotSugarPer100g))
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    if item.entry.isAdHoc {
                        TextField("Food name", text: Binding(
                            get: { name },
                            set: { name = String($0.prefix(160)) }
                        ))
                        .textInputAutocapitalization(.words)
                    } else {
                        Text(item.entry.snapshotFoodName)
                            .font(.subheadline.weight(.semibold))
                    }
                    NutritionGramTextField(grams: $grams, title: "Grams")
                    Stepper("Position \(position)", value: $position, in: 1 ... 999)
                } header: {
                    Text("Entry")
                }

                if item.entry.isAdHoc {
                    Section {
                        AdHocNutrientFields(
                            kcal: $kcal,
                            fat: $fat,
                            carbs: $carbs,
                            protein: $protein,
                            fiber: $fiber,
                            sugar: $sugar
                        )
                    } header: {
                        Text("Custom nutrients")
                    } footer: {
                        Text(
                            "Ad-hoc snapshot nutrients are editable because this entry is not backed by a catalog food."
                        )
                    }
                }

                if item.showTime {
                    Section {
                        DatePicker("Time eaten", selection: $slotTime, displayedComponents: .hourAndMinute)
                            .datePickerStyle(.compact)
                    } header: {
                        Text("Time eaten")
                    }
                }

                mutationError

                Section {
                    Button("Delete entry", role: .destructive) { isConfirmingDelete = true }
                        .disabled(viewModel.isMutating)
                }
            }
            .navigationTitle("Edit entry")
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                "Delete this entry?",
                isPresented: $isConfirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete entry", role: .destructive) {
                    Task {
                        if await viewModel.deleteEntry(id: item.entry.id) {
                            onMutated()
                            dismiss()
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This logged entry cannot be recovered.")
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            let nextTime = item.showTime ? NutritionLogTime.inputValue(from: slotTime) : nil
                            let didSave: Bool
                            if item.entry.isAdHoc {
                                didSave = await viewModel.updateAdHocEntry(
                                    id: item.entry.id,
                                    draft: adHocDraft(nextTime: nextTime),
                                    position: position,
                                    includeSlotTime: item.showTime
                                )
                            } else {
                                didSave = await viewModel.updateEntry(
                                    id: item.entry.id,
                                    grams: grams,
                                    position: position,
                                    slotTime: nextTime
                                )
                            }
                            if didSave {
                                onMutated()
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isMutating)
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func adHocDraft(nextTime: String?) -> AdHocFoodDraftValues {
        AdHocFoodDraftValues(
            name: name,
            grams: grams,
            slotTime: nextTime ?? NutritionLogTime.inputValue(from: slotTime),
            macros: Per100gMacroStrings(
                kcalPer100g: kcal,
                grams: GramMacroStrings(
                    fatPer100g: fat,
                    carbsPer100g: carbs,
                    proteinPer100g: protein,
                    fiberPer100g: fiber,
                    sugarPer100g: sugar
                )
            )
        )
    }

    @ViewBuilder
    private var mutationError: some View {
        if let message = viewModel.mutationState.errorMessage {
            Section {
                Text(message)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.danger)
            }
        }
    }
}

struct EditMealGroupSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingGroupSheetItem
    let onMutated: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var position: Int
    @State private var slotTime: Date
    @State private var isConfirmingDelete = false

    init(viewModel: DailyIntakeViewModel, item: EditingGroupSheetItem, onMutated: @escaping () -> Void) {
        self.viewModel = viewModel
        self.item = item
        self.onMutated = onMutated
        _name = State(initialValue: item.group.name)
        _position = State(initialValue: max(1, item.group.position))
        _slotTime = State(initialValue: NutritionLogTime.date(from: item.group.slotTime))
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Name", text: $name)
                    DatePicker("Time eaten", selection: $slotTime, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.compact)
                    Stepper("Position \(position)", value: $position, in: 1 ... 999)
                } header: {
                    Text("Logged meal")
                } footer: {
                    Text("Grouped food entries display this parent logged meal time.")
                }

                mutationError

                Section {
                    Button("Delete logged meal", role: .destructive) { isConfirmingDelete = true }
                        .disabled(viewModel.isMutating)
                }
            }
            .navigationTitle("Edit logged meal")
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                "Delete this logged meal?",
                isPresented: $isConfirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete logged meal", role: .destructive) {
                    Task {
                        if await viewModel.deleteMealGroup(id: item.group.id) {
                            onMutated()
                            dismiss()
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Grouped food entries cascade and cannot be recovered.")
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await viewModel.updateMealGroup(
                                id: item.group.id,
                                name: name,
                                position: position,
                                slotTime: NutritionLogTime.inputValue(from: slotTime)
                            ) {
                                onMutated()
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isMutating)
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    @ViewBuilder
    private var mutationError: some View {
        if let message = viewModel.mutationState.errorMessage {
            Section {
                Text(message)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.danger)
            }
        }
    }
}
