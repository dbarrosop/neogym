import NeoGymKit
import SwiftUI

struct LogIntakeSheetRequest: Identifiable {
    enum AdHocMode: Equatable {
        case food
        case meal
    }

    enum Source: Equatable {
        case adHoc(initialMode: AdHocMode)
        case planEntry(NutritionPlanEntry)
    }

    let id = UUID().uuidString
    let source: Source
    var fixedPosition: Int?

    static let adHocFood = LogIntakeSheetRequest(source: .adHoc(initialMode: .food))
    static let adHocMeal = LogIntakeSheetRequest(source: .adHoc(initialMode: .meal))
}

struct LogIntakeSheet: View {
    private enum Mode: String, CaseIterable, Identifiable {
        case food
        case meal
        case plan

        var id: String { rawValue }
        var title: String {
            switch self {
            case .food: "Food"
            case .meal: "Meal"
            case .plan: "From plan"
            }
        }
    }

    @ObservedObject var viewModel: DailyIntakeViewModel
    let request: LogIntakeSheetRequest
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode
    @State private var foodId = ""
    @State private var mealId = ""
    @State private var planEntryId = ""
    @State private var grams = "100"
    @State private var ingredientGrams: [String: String] = [:]
    @State private var slotTime = Date()
    @State private var isTimePickerVisible = false

    private var foods: [Food] { viewModel.payload?.foods ?? [] }
    private var meals: [Meal] { viewModel.payload?.meals ?? [] }
    private var planEntries: [NutritionPlanEntry] { viewModel.selectedPlan?.sortedEntries ?? [] }
    private var lockedPlanEntry: NutritionPlanEntry? {
        if case let .planEntry(entry) = request.source { return entry }
        return nil
    }
    private var selectedPlanEntry: NutritionPlanEntry? {
        if let lockedPlanEntry { return lockedPlanEntry }
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
        return isLoggingMealDraft ? mealDraft?.macroTotals ?? .empty : .empty
    }

    init(viewModel: DailyIntakeViewModel, request: LogIntakeSheetRequest) {
        self.viewModel = viewModel
        self.request = request
        switch request.source {
        case let .adHoc(initialMode):
            _mode = State(initialValue: initialMode == .meal ? .meal : .food)
        case .planEntry:
            _mode = State(initialValue: .plan)
        }
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
        .onAppear(perform: prepareDraft)
        .onChange(of: mode) { _ in prepareDraft() }
        .onChange(of: foodId) { _ in prepareFoodDraft() }
        .onChange(of: mealId) { _ in prepareMealDraft() }
        .onChange(of: planEntryId) { _ in prepareDraft() }
    }

    private var navigationTitle: String {
        switch request.source {
        case .adHoc: "Log intake"
        case .planEntry: selectedPlanEntry?.kind == .food ? "Log planned food" : "Log planned meal"
        }
    }

    private var canSave: Bool {
        if isLoggingFoodDraft {
            return selectedFood != nil && (NutritionMath.parseMacroInput(grams) ?? 0) > 0
        }
        if isLoggingMealDraft {
            return mealDraft != nil && ingredientGrams.values.allSatisfy { (NutritionMath.parseMacroInput($0) ?? 0) > 0 }
        }
        return false
    }

    @ViewBuilder
    private var sourceSection: some View {
        Section {
            if lockedPlanEntry == nil {
                Picker("Log source", selection: $mode) {
                    ForEach(Mode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .disabled(viewModel.isMutating)
            }

            switch mode {
            case .food:
                FoodPickerView(foods: foods, foodId: $foodId, disabled: viewModel.isMutating, revealWheelOnDemand: true)
            case .meal:
                MealPickerView(meals: meals, mealId: $mealId, disabled: viewModel.isMutating)
            case .plan:
                if let lockedPlanEntry {
                    PlanEntrySummary(entry: lockedPlanEntry)
                } else if planEntries.isEmpty {
                    Text("Select a nutrition plan for this day to log planned meal or food suggestions.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                } else {
                    Picker("Plan entry", selection: $planEntryId) {
                        ForEach(planEntries) { entry in
                            Text("\(IntakeGrouping.formatTimeOfDay(entry.slotTime)) · \(entry.displayLabel)")
                                .tag(entry.id)
                        }
                    }
                    .pickerStyle(.wheel)
                    .labelsHidden()
                    .frame(height: 150)
                    PlanEntrySummary(entry: selectedPlanEntry ?? planEntries[0])
                }
            }
        } header: {
            Text("What are you logging?")
        } footer: {
            Text("Template times are suggestions. The logged time below defaults to now and remains editable.")
        }
    }

    private var timeSection: some View {
        Section {
            CollapsibleTimeWheel(
                title: "Time eaten",
                time: $slotTime,
                isExpanded: $isTimePickerVisible,
                disabled: viewModel.isMutating
            )
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
        } else if isLoggingMealDraft, let mealDraft {
            Section {
                ForEach(mealDraft.mealIngredients) { ingredient in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ingredient.food?.name ?? "Food")
                            .font(.subheadline.weight(.semibold))
                        NutritionGramTextField(
                            grams: Binding(
                                get: { ingredientGrams[ingredient.id] ?? NutritionMath.formatEditableDecimal(ingredient.grams) },
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

    private var macroSection: some View {
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

    private func prepareDraft() {
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
        slotTime = Date()
    }

    private func prepareFoodDraft() {
        if mode == .food { grams = "100" }
    }

    private func prepareMealDraft() {
        guard let selectedMeal else { return }
        ingredientGrams = Dictionary(uniqueKeysWithValues: selectedMeal.mealIngredients.map { ingredient in
            (ingredient.id, NutritionMath.formatEditableDecimal(ingredient.grams))
        })
    }

    private func save() async {
        let time = NutritionLogTime.inputValue(from: slotTime)
        let succeeded: Bool
        switch selectedPlanEntry {
        case let .food(slot):
            succeeded = await viewModel.logPlanFood(slot, grams: grams, slotTime: time, position: request.fixedPosition)
        case let .meal(slot):
            guard let mealDraft else { return }
            succeeded = await viewModel.logMeal(
                meal: mealDraft,
                planSlot: slot,
                slotTime: time,
                position: request.fixedPosition
            )
        case nil:
            switch mode {
            case .food:
                succeeded = await viewModel.logFood(foodId: foodId, grams: grams, slotTime: time)
            case .meal:
                guard let mealDraft else { return }
                succeeded = await viewModel.logMeal(meal: mealDraft, planSlot: nil, slotTime: time)
            case .plan:
                return
            }
        }
        if succeeded { dismiss() }
    }
}

private struct PlanEntrySummary: View {
    let entry: NutritionPlanEntry

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            Label(
                entry.kind == .meal ? "Planned meal" : "Planned food",
                systemImage: entry.kind == .meal ? "fork.knife.circle" : "apple.logo"
            )
            .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Planned \(IntakeGrouping.formatTimeOfDay(entry.slotTime)) · \(entry.displayLabel)")
                .font(.subheadline.weight(.semibold))
            Text(NutritionMath.macroTotalsSummary(entry.macroTotals))
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }
}

private struct CollapsibleTimeWheel: View {
    let title: String
    @Binding var time: Date
    @Binding var isExpanded: Bool
    let disabled: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            Button {
                guard !disabled else { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(title)
                        .foregroundColor(.primary)
                    Spacer()
                    Text(Self.formattedTime(time))
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundColor(NeoGymTheme.mutedText)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(disabled)

            if isExpanded {
                DatePicker(title, selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .disabled(disabled)

                Button("Done") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded = false
                    }
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .disabled(disabled)
            }
        }
    }

    private static func formattedTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}

struct EditLogEntrySheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingEntrySheetItem
    @Environment(\.dismiss) private var dismiss

    @State private var grams: String
    @State private var position: Int
    @State private var slotTime: Date

    init(viewModel: DailyIntakeViewModel, item: EditingEntrySheetItem) {
        self.viewModel = viewModel
        self.item = item

        _grams = State(initialValue: NutritionLogAmount.editableNumber(item.entry.grams))
        _position = State(initialValue: max(1, Int(item.entry.position)))
        _slotTime = State(initialValue: NutritionLogTime.date(from: item.entry.slotTime))
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text(item.entry.snapshotFoodName)
                        .font(.subheadline.weight(.semibold))
                    NutritionGramTextField(grams: $grams, title: "Grams")
                    Stepper("Position \(position)", value: $position, in: 1 ... 999)
                } header: {
                    Text("Entry")
                }

                if item.showTime {
                    Section {
                        DatePicker("Time eaten", selection: $slotTime, displayedComponents: .hourAndMinute)
                            .datePickerStyle(.wheel)
                    } header: {
                        Text("Time eaten")
                    }
                }

                mutationError
            }
            .navigationTitle("Edit entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            let nextTime = item.showTime ? NutritionLogTime.inputValue(from: slotTime) : nil
                            if await viewModel.updateEntry(
                                id: item.entry.id,
                                grams: grams,
                                position: position,
                                slotTime: nextTime
                            ) {
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

struct EditMealGroupSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingGroupSheetItem
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var position: Int
    @State private var slotTime: Date

    init(viewModel: DailyIntakeViewModel, item: EditingGroupSheetItem) {
        self.viewModel = viewModel
        self.item = item
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
                        .datePickerStyle(.wheel)
                    Stepper("Position \(position)", value: $position, in: 1 ... 999)
                } header: {
                    Text("Logged meal")
                } footer: {
                    Text("Grouped food entries display this parent logged meal time.")
                }

                mutationError
            }
            .navigationTitle("Edit logged meal")
            .navigationBarTitleDisplayMode(.inline)
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
