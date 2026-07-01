import NeoGymKit
import SwiftUI

struct LogFoodSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var foodId = ""
    @State private var grams = "100"
    @State private var slotTime = Date()
    @State private var isTimePickerVisible = false

    var body: some View {
        NavigationView {
            Form {
                Section {
                    FoodPickerView(
                        foods: viewModel.payload?.foods ?? [],
                        foodId: $foodId,
                        disabled: viewModel.isMutating,
                        revealWheelOnDemand: true
                    )
                } header: {
                    Text("Food")
                }

                Section {
                    CollapsibleTimeWheel(
                        title: "Time eaten",
                        time: $slotTime,
                        isExpanded: $isTimePickerVisible,
                        disabled: viewModel.isMutating
                    )
                } header: {
                    Text("Time eaten")
                }

                Section {
                    NutritionGramTextField(grams: $grams, title: "Grams consumed")
                } header: {
                    Text("Logged amount")
                } footer: {
                    Text(
                        "The database snapshots food nutrition when it is logged. "
                            + "Historical totals use those snapshot columns."
                    )
                }

                mutationError
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
                            let time = NutritionLogTime.inputValue(from: slotTime)
                            if await viewModel.logFood(foodId: foodId, grams: grams, slotTime: time) {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isMutating)
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear { slotTime = Date() }
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

struct LogMealSheet: View {
    @ObservedObject var viewModel: DailyIntakeViewModel
    let planSlot: NutritionPlanMealSlot?
    var fixedPosition: Int?

    @Environment(\.dismiss) private var dismiss
    @State private var mealId = ""
    @State private var slotTime = Date()
    @State private var isTimePickerVisible = false

    private var meals: [Meal] { viewModel.payload?.meals ?? [] }
    private var selectedMeal: Meal? {
        planSlot?.meal ?? meals.first { $0.id == mealId }
    }

    var body: some View {
        NavigationView {
            Form {
                if let planSlot {
                    Section {
                        plannedSuggestionContent(planSlot)
                    } header: {
                        Text("Planned suggestion")
                    }
                } else {
                    Section {
                        MealPickerView(meals: meals, mealId: $mealId, disabled: viewModel.isMutating)
                    } header: {
                        Text("Meal")
                    }
                }

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

                if let selectedMeal {
                    Section {
                        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                            Text(
                                "\(selectedMeal.mealIngredients.count) "
                                    + "ingredient\(selectedMeal.mealIngredients.count == 1 ? "" : "s")"
                            )
                            .font(.subheadline.weight(.semibold))
                            Text(NutritionMath.macroTotalsSummary(selectedMeal.macroTotals))
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                    } header: {
                        Text("Materialized entries")
                    }
                }

                mutationError
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
                                slotTime: NutritionLogTime.inputValue(from: slotTime),
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
            slotTime = Date()
        }
    }

    private func plannedSuggestionContent(_ planSlot: NutritionPlanMealSlot) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
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

