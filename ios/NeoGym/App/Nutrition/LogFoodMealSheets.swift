import NeoGymKit
import SwiftUI

struct LogFoodSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var foodId = ""
    @State private var grams = "100"
    @State private var slotTime = IntakeGrouping.currentTimeInputValue()

    var body: some View {
        NavigationView {
            Form {
                Section("Food") {
                    FoodPickerView(foods: viewModel.payload?.foods ?? [], foodId: $foodId, disabled: viewModel.isMutating)
                }
                Section("Logged amount") {
                    TextField("Time eaten", text: $slotTime)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Grams consumed", text: $grams)
                        .keyboardType(.decimalPad)
                }
                Section {
                    Text("The database snapshots food nutrition when it is logged. Historical totals use those snapshot columns.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                if let message = viewModel.mutationState.errorMessage {
                    Section { Text(message).foregroundColor(.red) }
                }
            }
            .navigationTitle("Log food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isMutating ? "Logging…" : "Log") {
                        Task {
                            if await viewModel.logFood(foodId: foodId, grams: grams, slotTime: slotTime) {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isMutating)
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear { slotTime = IntakeGrouping.currentTimeInputValue() }
    }
}

struct LogMealSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let planSlot: NutritionPlanMealSlot?
    var fixedPosition: Int?

    @Environment(\.dismiss) private var dismiss
    @State private var mealId = ""
    @State private var slotTime = IntakeGrouping.currentTimeInputValue()

    private var meals: [Meal] { viewModel.payload?.meals ?? [] }
    private var selectedMeal: Meal? {
        planSlot?.meal ?? meals.first { $0.id == mealId }
    }

    var body: some View {
        NavigationView {
            Form {
                if let planSlot {
                    Section("Planned suggestion") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Planned \(IntakeGrouping.formatTimeOfDay(planSlot.slotTime)) · \(planSlot.displayLabel)")
                                .font(.subheadline.weight(.semibold))
                            if let meal = planSlot.meal, planSlot.label != nil {
                                Text("Template: \(meal.name)")
                                    .font(.caption)
                                    .foregroundColor(NeoGymTheme.mutedText)
                            }
                            Text("The logged time below defaults to now and is not forced to the template slot.")
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                    }
                } else {
                    Section("Meal") {
                        MealPickerView(meals: meals, mealId: $mealId, disabled: viewModel.isMutating)
                    }
                }

                Section("Logged time") {
                    TextField("Time eaten", text: $slotTime)
                        .keyboardType(.numbersAndPunctuation)
                }

                if let selectedMeal {
                    Section("Materialized entries") {
                        Text("\(selectedMeal.mealIngredients.count) ingredient\(selectedMeal.mealIngredients.count == 1 ? "" : "s")")
                        Text(NutritionMath.macroTotalsSummary(selectedMeal.macroTotals))
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                }

                if let message = viewModel.mutationState.errorMessage {
                    Section { Text(message).foregroundColor(.red) }
                }
            }
            .navigationTitle(planSlot == nil ? "Log meal" : "Log planned meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isMutating ? "Logging…" : "Log") {
                        Task {
                            guard let selectedMeal else { return }
                            if await viewModel.logMeal(
                                meal: selectedMeal,
                                planSlot: planSlot,
                                slotTime: slotTime,
                                position: fixedPosition
                            ) {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isMutating || selectedMeal == nil)
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear {
            mealId = planSlot?.mealId ?? ""
            slotTime = IntakeGrouping.currentTimeInputValue()
        }
    }
}

struct EditLogEntrySheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingEntrySheetItem
    @Environment(\.dismiss) private var dismiss

    @State private var grams: String
    @State private var position: String
    @State private var slotTime: String

    init(viewModel: DailyIntakeViewModel, item: EditingEntrySheetItem) {
        self.viewModel = viewModel
        self.item = item
        _grams = State(initialValue: Self.editableNumber(item.entry.grams))
        _position = State(initialValue: String(Int(item.entry.position)))
        _slotTime = State(initialValue: IntakeGrouping.timeToInputValue(item.entry.slotTime))
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Entry") {
                    Text(item.entry.snapshotFoodName)
                    TextField("Grams", text: $grams)
                        .keyboardType(.decimalPad)
                    TextField("Position", text: $position)
                        .keyboardType(.numberPad)
                    if item.showTime {
                        TextField("Time eaten", text: $slotTime)
                            .keyboardType(.numbersAndPunctuation)
                    }
                }
                if let message = viewModel.mutationState.errorMessage {
                    Section { Text(message).foregroundColor(.red) }
                }
            }
            .navigationTitle("Edit entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            let nextPosition = Int(position) ?? Int(item.entry.position)
                            let nextTime = item.showTime ? slotTime : nil
                            if await viewModel.updateEntry(
                                id: item.entry.id,
                                grams: grams,
                                position: nextPosition,
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

    private static func editableNumber(_ value: JSONValue?) -> String {
        let number = NutritionMath.normalizeNumeric(value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 3
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: number)) ?? String(number)
    }
}

struct EditMealGroupSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let item: EditingGroupSheetItem
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var position: String
    @State private var slotTime: String

    init(viewModel: DailyIntakeViewModel, item: EditingGroupSheetItem) {
        self.viewModel = viewModel
        self.item = item
        _name = State(initialValue: item.group.name)
        _position = State(initialValue: String(item.group.position))
        _slotTime = State(initialValue: IntakeGrouping.timeToInputValue(item.group.slotTime))
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Logged meal") {
                    TextField("Name", text: $name)
                    TextField("Time eaten", text: $slotTime)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Position", text: $position)
                        .keyboardType(.numberPad)
                }
                Section {
                    Text("Grouped food entries display this parent logged meal time.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                if let message = viewModel.mutationState.errorMessage {
                    Section { Text(message).foregroundColor(.red) }
                }
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
                                position: Int(position) ?? item.group.position,
                                slotTime: slotTime
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
}
