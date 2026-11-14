import NeoGymKit
import SwiftUI

/// Edit plan (design "iOS · Edit plan"): Name/Description rows, a totals
/// strip, then one section per time slot with a single Time control, FOOD and
/// MEAL rows with inline grams, and "Add food · Add meal". Entries in a slot
/// share its time; long-press an entry to reorder it within the slot, move it
/// to another time, or change/edit its food or meal.
struct NutritionPlanFormScreen: View {
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

    @FocusState private var focusedGramsId: String?
    /// Slots added with "Add time slot" that have no entries yet (not saved).
    @State private var pendingSlots: [PendingPlanSlot] = []
    @State private var picker: PlanEntryPickerRequest?
    @State private var timeEdit: PlanTimeEdit?
    @State private var quickFood: QuickFoodSheetRequest?
    @State private var quickMeal: QuickMealSheetRequest?
    @State private var labelEdit: PlanMealLabelEdit?
    @State private var labelText = ""

    var body: some View {
        let sections = slotSections
        FormScrollContainer {
            FormSection {
                FormLabeledTextRow(
                    label: "Name",
                    placeholder: "Training day",
                    text: Binding(get: { form.name }, set: { form.name = String($0.prefix(160)) }),
                    capitalization: .words
                )
                RowSeparator()
                FormLabeledTextRow(
                    label: "Description",
                    placeholder: "Optional",
                    text: Binding(
                        get: { form.planDescription },
                        set: { form.planDescription = String($0.prefix(1_000)) }
                    ),
                    multiline: true
                )
            }
            MacroTotalsStrip(totals: form.macroTotals(availableMeals: meals, availableFoods: foods))
            if sections.isEmpty {
                FormFooter("Add a time slot, then the foods and meals you plan to eat at that time.")
            }
            ForEach(sections) { section in
                PlanSlotSection(
                    section: section,
                    form: form,
                    meals: meals,
                    foods: foods,
                    isSubmitting: isSubmitting,
                    focusedGramsId: $focusedGramsId,
                    actions: actions(for: section)
                )
            }
            Button {
                let time = NutritionPlanFormModel.suggestedSlotTime(after: sections.map(\.time))
                pendingSlots.append(PendingPlanSlot(time: time))
            } label: {
                Label("Add time slot", systemImage: "clock.badge.plus")
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(NeoGymTheme.accentText)
            .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous).fill(NeoGymTheme.surface))
            .disabled(isSubmitting)
            if let errorMessage {
                FeedbackBanner(message: errorMessage)
            }
            if let deleteAction {
                FormDeleteButton(title: "Delete plan", isDisabled: isSubmitting, action: deleteAction)
                    .padding(.top, NeoGymTheme.spacingXS)
            }
        }
        .keyboardDoneToolbar(focusedField: $focusedGramsId)
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.canSubmit,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
        .sheet(item: $picker) { request in pickerSheet(request) }
        .sheet(item: $timeEdit) { edit in
            PlanSlotTimeSheet(title: edit.title, initialTime: edit.time) { applyTime(edit, time: $0) }
                .presentationDetents([.height(340)])
        }
        .sheet(item: $quickFood) { request in
            NavigationStack {
                QuickFoodEditorSheet(repository: repository, foodId: request.foodId) { _ in
                    Task { await reloadOptions() }
                }
            }
        }
        .sheet(item: $quickMeal) { request in
            NavigationStack {
                if let mealId = request.mealId {
                    MealEditView(
                        mealId: mealId,
                        repository: repository,
                        onSaved: { Task { await reloadOptions() } },
                        onDeleted: { Task { await reloadOptions() } }
                    )
                }
            }
        }
        .alert("Slot label", isPresented: Binding(
            get: { labelEdit != nil },
            set: { if !$0 { labelEdit = nil } }
        )) {
            TextField("Label", text: $labelText)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                if let labelEdit {
                    form.updateSlot(stableId: labelEdit.stableId, label: String(labelText.prefix(160)))
                }
            }
        } message: {
            Text("Optional. The meal's name shows when it is empty.")
        }
    }

    // MARK: - Sections

    private var slotSections: [PlanEditorSlotSection] {
        let groups = NutritionPlanGrouping.groupPlanDraftEntriesByTimeSlot(
            mealSlots: form.slots,
            foodSlots: form.foodSlots,
            availableMeals: meals,
            availableFoods: foods
        )
        let saved = groups.map { group in
            PlanEditorSlotSection(
                id: group.entries.first?.stableId ?? group.key,
                time: group.key,
                label: group.label,
                sortKey: group.sortKey,
                entries: group.entries,
                kcal: group.totals.kcal,
                pendingId: nil
            )
        }
        let savedTimes = Set(groups.map(\.key))
        let pending = pendingSlots.filter { !savedTimes.contains($0.time) }.map { slot in
            PlanEditorSlotSection(
                id: slot.id.uuidString,
                time: slot.time,
                label: IntakeGrouping.formatTimeOfDay(slot.time),
                sortKey: slot.time,
                entries: [],
                kcal: nil,
                pendingId: slot.id
            )
        }
        return (saved + pending).sorted { $0.sortKey < $1.sortKey }
    }

    private func actions(for section: PlanEditorSlotSection) -> PlanSlotActions {
        let slotTime = IntakeGrouping.timeToInputValue(section.time)
        return PlanSlotActions(
            editTime: {
                timeEdit = PlanTimeEdit(target: .slot(time: section.time, pendingId: section.pendingId), time: slotTime)
            },
            addFood: { picker = PlanEntryPickerRequest(kind: .food, slotTime: slotTime) },
            addMeal: { picker = PlanEntryPickerRequest(kind: .meal, slotTime: slotTime) },
            changeEntry: { entry in
                picker = PlanEntryPickerRequest(kind: entry.kind, slotTime: slotTime, replacingStableId: entry.stableId)
            },
            moveEntryToTime: { entry in
                timeEdit = PlanTimeEdit(target: .entry(entry), time: slotTime)
            },
            editFood: { foodId in quickFood = QuickFoodSheetRequest(foodId: foodId) },
            editMeal: { slot in
                quickMeal = QuickMealSheetRequest(planMealSlotStableId: slot.stableId, mealId: slot.mealId)
            },
            editLabel: { slot in
                labelText = slot.label
                labelEdit = PlanMealLabelEdit(stableId: slot.stableId)
            }
        )
    }

    // MARK: - Pickers

    @ViewBuilder
    private func pickerSheet(_ request: PlanEntryPickerRequest) -> some View {
        switch request.kind {
        case .food:
            NutritionSelectionSheet(
                title: request.replacingStableId == nil ? "Add food" : "Change food",
                searchPrompt: "Search foods",
                items: foods,
                name: \.name,
                caption: NutritionSelectionCaption.food,
                newItemTitle: "New food",
                onSelect: { apply(request, id: $0.id) },
                newItemForm: {
                    QuickFoodEditorSheet(repository: repository, foodId: nil) { id in
                        picker = nil
                        Task {
                            await reloadOptions()
                            apply(request, id: id)
                        }
                    }
                }
            )
        case .meal:
            NutritionSelectionSheet(
                title: request.replacingStableId == nil ? "Add meal" : "Change meal",
                searchPrompt: "Search meals",
                items: meals,
                name: \.name,
                caption: NutritionSelectionCaption.meal,
                newItemTitle: "New meal",
                onSelect: { apply(request, id: $0.id) },
                newItemForm: {
                    MealCreateView(
                        repository: repository,
                        onCreated: { id in
                            picker = nil
                            Task {
                                await reloadOptions()
                                apply(request, id: id)
                            }
                        },
                        onFinished: {}
                    )
                }
            )
        }
    }

    private func apply(_ request: PlanEntryPickerRequest, id: String) {
        switch (request.kind, request.replacingStableId) {
        case let (.food, stableId?):
            form.updateFoodSlot(stableId: stableId, foodId: id)
        case (.food, nil):
            form.addFoodSlot(foodId: id, slotTime: request.slotTime)
        case let (.meal, stableId?):
            form.updateSlot(stableId: stableId, mealId: id)
        case (.meal, nil):
            form.addSlot(mealId: id, slotTime: request.slotTime)
        }
    }

    private func applyTime(_ edit: PlanTimeEdit, time: String) {
        switch edit.target {
        case let .slot(_, pendingId?):
            pendingSlots = pendingSlots.map { $0.id == pendingId ? PendingPlanSlot(id: pendingId, time: time) : $0 }
        case let .slot(slotTime, nil):
            form.setSlotTime(from: slotTime, to: time)
        case let .entry(.meal(slot)):
            form.updateSlot(stableId: slot.stableId, slotTime: time)
        case let .entry(.food(slot)):
            form.updateFoodSlot(stableId: slot.stableId, slotTime: time)
        }
    }
}

// MARK: - Slot section

struct PlanEditorSlotSection: Identifiable {
    let id: String
    /// Normalized "HH:MM", or the no-time key for entries without a time.
    let time: String
    let label: String
    let sortKey: String
    let entries: [NutritionPlanDraftEntry]
    let kcal: Double?
    let pendingId: UUID?
}

private struct PendingPlanSlot: Identifiable {
    var id = UUID()
    let time: String
}

struct PlanSlotActions {
    let editTime: () -> Void
    let addFood: () -> Void
    let addMeal: () -> Void
    let changeEntry: (NutritionPlanDraftEntry) -> Void
    let moveEntryToTime: (NutritionPlanDraftEntry) -> Void
    let editFood: (String) -> Void
    let editMeal: (NutritionPlanSlotFormValues) -> Void
    let editLabel: (NutritionPlanSlotFormValues) -> Void
}

private struct PlanSlotSection: View {
    let section: PlanEditorSlotSection
    @ObservedObject var form: NutritionPlanFormModel
    let meals: [Meal]
    let foods: [Food]
    let isSubmitting: Bool
    let focusedGramsId: FocusState<String?>.Binding
    let actions: PlanSlotActions

    private var hasTime: Bool { !IntakeGrouping.timeToInputValue(section.time).isEmpty }

    var body: some View {
        FormSection(
            header: section.label,
            headerDetail: section.kcal.map { "\(MetricFormat.whole($0)) kcal" }
        ) {
            FormRow {
                Text("Time")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: actions.editTime) {
                    Text(hasTime ? section.label : "Set time")
                        .monospacedDigit()
                        .foregroundStyle(hasTime ? NeoGymTheme.text : NeoGymTheme.accentText)
                        .padding(.horizontal, NeoGymTheme.spacingSM)
                        .frame(minHeight: 34)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(NeoGymTheme.fill))
                }
                .buttonStyle(.plain)
                .disabled(isSubmitting)
                .accessibilityLabel(hasTime ? "Time, \(section.label)" : "Set time")
                .accessibilityHint("Changes the time of every entry in this slot")
            }
            ForEach(section.entries) { entry in
                RowSeparator()
                PlanEntryRow(
                    entry: entry,
                    form: form,
                    meal: entry.mealId.flatMap { id in meals.first { $0.id == id } },
                    food: entry.foodId.flatMap { id in foods.first { $0.id == id } },
                    isSubmitting: isSubmitting,
                    focusedGramsId: focusedGramsId,
                    actions: actions
                )
            }
            RowSeparator()
            FormRow {
                Button("Add food", action: actions.addFood)
                Button("Add meal", action: actions.addMeal)
                Spacer(minLength: 0)
            }
            .buttonStyle(.plain)
            .foregroundStyle(NeoGymTheme.accentText)
            .disabled(isSubmitting)
        }
    }
}

private extension NutritionPlanDraftEntry {
    var mealId: String? {
        if case let .meal(slot) = self { return slot.mealId }
        return nil
    }

    var foodId: String? {
        if case let .food(slot) = self { return slot.foodId }
        return nil
    }
}

// MARK: - Entry row

private struct PlanEntryRow: View {
    let entry: NutritionPlanDraftEntry
    @ObservedObject var form: NutritionPlanFormModel
    let meal: Meal?
    let food: Food?
    let isSubmitting: Bool
    let focusedGramsId: FocusState<String?>.Binding
    let actions: PlanSlotActions

    private var isMeal: Bool { entry.kind == .meal }
    /// The selected food or meal is not in the loaded options (or unset).
    private var isMissing: Bool { isMeal ? meal == nil : food == nil }

    private var title: String {
        switch entry {
        case let .meal(slot):
            let label = slot.label.trimmingCharacters(in: .whitespacesAndNewlines)
            return label.isEmpty ? (meal?.name ?? "Choose a meal") : label
        case .food:
            return food?.name ?? "Choose a food"
        }
    }

    private var caption: String? {
        switch entry {
        case let .meal(slot):
            guard let meal else { return nil }
            let totals = EntryMacroCaption.text(meal.macroTotals)
            let label = slot.label.trimmingCharacters(in: .whitespacesAndNewlines)
            // A custom label replaces the title, so name the meal underneath.
            return label.isEmpty || label == meal.name ? totals : "\(meal.name) · \(totals)"
        case let .food(slot):
            guard let food else { return nil }
            return EntryMacroCaption.text(
                NutritionMath.macrosForGrams(input: food.macroFields, grams: .string(slot.grams))
            )
        }
    }

    var body: some View {
        FormRow {
            FormRemoveButton(accessibilityLabel: "Remove \(title)", isDisabled: isSubmitting, action: remove)
            Button { actions.changeEntry(entry) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        EntryKindTag(isMeal: isMeal)
                        Text(title)
                            .foregroundStyle(isMissing ? NeoGymTheme.accentText : NeoGymTheme.text)
                            .lineLimit(1)
                    }
                    if let caption {
                        Text(caption)
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting)
            .accessibilityHint(isMeal ? "Changes the meal" : "Changes the food")
            trailing
        }
        .contextMenu { menu }
        .accessibilityActions { menu }
    }

    @ViewBuilder
    private var trailing: some View {
        switch entry {
        case .meal:
            Text("whole meal")
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
        case let .food(slot):
            FormNumberField(
                accessibilityLabel: "\(title) grams",
                text: Binding(
                    get: { slot.grams },
                    set: { form.updateFoodSlot(stableId: slot.stableId, grams: String($0.prefix(12))) }
                ),
                unit: "g",
                placeholder: "100",
                field: slot.stableId,
                focusedField: focusedGramsId
            )
        }
    }

    @ViewBuilder
    private var menu: some View {
        Button(isMeal ? "Change meal" : "Change food", systemImage: "arrow.left.arrow.right") {
            actions.changeEntry(entry)
        }
        switch entry {
        case let .meal(slot):
            if meal != nil {
                Button("Edit meal", systemImage: "pencil") { actions.editMeal(slot) }
            }
            Button("Edit label", systemImage: "text.cursor") { actions.editLabel(slot) }
        case .food:
            if let food, !food.isPublic {
                Button("Edit food", systemImage: "pencil") { actions.editFood(food.id) }
            }
        }
        Button("Move to another time", systemImage: "clock") { actions.moveEntryToTime(entry) }
        Button("Move up", systemImage: "arrow.up") {
            form.moveEntry(kind: entry.kind, stableId: entry.stableId, direction: -1)
        }
        .disabled(!form.canMoveEntryWithinSlot(kind: entry.kind, stableId: entry.stableId, direction: -1))
        Button("Move down", systemImage: "arrow.down") {
            form.moveEntry(kind: entry.kind, stableId: entry.stableId, direction: 1)
        }
        .disabled(!form.canMoveEntryWithinSlot(kind: entry.kind, stableId: entry.stableId, direction: 1))
    }

    private func remove() {
        switch entry {
        case let .meal(slot): form.removeSlot(stableId: slot.stableId)
        case let .food(slot): form.removeFoodSlot(stableId: slot.stableId)
        }
    }
}

// MARK: - Requests and time sheet

private struct PlanEntryPickerRequest: Identifiable {
    let id = UUID()
    let kind: NutritionPlanEntryKind
    /// The slot's "HH:MM", or empty for the no-time slot.
    let slotTime: String
    /// The entry whose food or meal changes; `nil` adds an entry.
    var replacingStableId: String?
}

private struct PlanTimeEdit: Identifiable {
    enum Target {
        case slot(time: String, pendingId: UUID?)
        case entry(NutritionPlanDraftEntry)
    }

    let id = UUID()
    let target: Target
    let time: String

    var title: String {
        if case .entry = target { return "Move to time" }
        return "Slot time"
    }
}

private struct PlanMealLabelEdit {
    let stableId: String
}

/// Wheel time picker with Cancel/Done; applying once avoids regrouping slots
/// on every wheel tick.
private struct PlanSlotTimeSheet: View {
    let title: String
    let onDone: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var date: Date

    init(title: String, initialTime: String, onDone: @escaping (String) -> Void) {
        self.title = title
        self.onDone = onDone
        _date = State(initialValue: Self.date(from: initialTime))
    }

    var body: some View {
        NavigationStack {
            DatePicker(title, selection: $date, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .frame(maxWidth: .infinity)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", role: .cancel) { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            onDone(Self.inputValue(from: date))
                            dismiss()
                        }
                        .fontWeight(.semibold)
                    }
                }
        }
    }

    private static func date(from time: String) -> Date {
        let parts = IntakeGrouping.timeToInputValue(time).split(separator: ":").compactMap { Int($0) }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        guard parts.count == 2 else {
            return calendar.date(bySettingHour: 12, minute: 0, second: 0, of: start) ?? start
        }
        return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: start) ?? start
    }

    private static func inputValue(from date: Date) -> String {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }
}
