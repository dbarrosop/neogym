import NeoGymKit
import SwiftUI

struct NutritionDaysView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    @Binding var selectedDate: String?

    @StateObject private var viewModel: NutritionDaysListViewModel

    init(repository: any NutritionFoodMealRepositoryProtocol, selectedDate: Binding<String?>) {
        self.repository = repository
        _selectedDate = selectedDate
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
    }

    var body: some View {
        Group {
            if let selectedDate {
                DailyIntakeView(repository: repository, date: selectedDate) {
                    self.selectedDate = nil
                    Task { await viewModel.load() }
                }
            } else {
                daysList
            }
        }
    }

    private var daysList: some View {
        ScrollView {
            SectionShell(title: "Daily logs", subtitle: "Browse by local date") {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Open a day to choose plan suggestions, log foods and meals, and edit historical entries.")
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                    Button {
                        selectedDate = IntakeGrouping.formatLocalDate()
                    } label: {
                        Label("Open today", systemImage: "calendar.badge.plus")
                    }
                    .buttonStyle(.borderedProminent)

                    switch viewModel.state {
                    case .idle, .loading:
                        AppLoadingStateView(message: "Loading daily logs…")
                    case let .failed(message, _):
                        AppErrorStateView(title: "Failed to load daily logs", message: message) {
                            Task { await viewModel.load() }
                        }
                    case .loaded:
                        if viewModel.days.isEmpty {
                            AppEmptyStateView(
                                title: "No daily intake logs yet",
                                message: "Open today to start logging foods and meals.",
                                systemImage: "calendar"
                            )
                        } else {
                            VStack(spacing: 0) {
                                ForEach(viewModel.days) { day in
                                    Button {
                                        selectedDate = day.logDate
                                    } label: {
                                        NutritionDayRow(day: day)
                                    }
                                    .buttonStyle(.plain)
                                    if day.id != viewModel.days.last?.id { Divider() }
                                }
                            }
                            .nutritionGlassCard(cornerRadius: 16)
                        }
                    }
                }
            }
            .frame(maxWidth: 720)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }
}

struct DailyIntakeView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let onClose: () -> Void

    @StateObject private var viewModel: DailyIntakeViewModel
    @State private var showLogFood = false
    @State private var showLogMeal = false
    @State private var editingEntry: EditingEntrySheetItem?
    @State private var editingGroup: EditingGroupSheetItem?
    @State private var confirmingDayDelete = false

    init(repository: any NutritionFoodMealRepositoryProtocol, date: String, onClose: @escaping () -> Void) {
        self.repository = repository
        self.onClose = onClose
        _viewModel = StateObject(wrappedValue: DailyIntakeViewModel(date: date, repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .sheet(isPresented: $showLogFood) {
            LogFoodSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showLogMeal) {
            LogMealSheet(viewModel: viewModel, planSlot: nil)
        }
        .sheet(item: $editingEntry) { item in
            EditLogEntrySheet(viewModel: viewModel, item: item)
        }
        .sheet(item: $editingGroup) { item in
            EditMealGroupSheet(viewModel: viewModel, item: item)
        }
        .confirmationDialog("Clear this day?", isPresented: $confirmingDayDelete, titleVisibility: .visible) {
            Button("Clear day log", role: .destructive) {
                Task {
                    if await viewModel.deleteDay() { onClose() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Logged meal groups and entries cascade and cannot be recovered.")
        }
    }

    private var header: some View {
        SectionShell(title: IntakeGrouping.formatLocalDateLabel(viewModel.date), subtitle: "Daily log") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Totals use logged snapshot nutrition, so later food or template edits do not rewrite this day.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                HStack(spacing: 8) {
                    Button {
                        onClose()
                    } label: {
                        Label("Days", systemImage: "chevron.left")
                    }
                    .buttonStyle(.bordered)
                    Button {
                        Task { await viewModel.moveDate(days: -1) }
                    } label: {
                        Label("Previous", systemImage: "chevron.left.circle")
                    }
                    .buttonStyle(.bordered)
                    Button {
                        Task { await viewModel.moveDate(days: 1) }
                    } label: {
                        Label("Next", systemImage: "chevron.right.circle")
                    }
                    .buttonStyle(.bordered)
                }
                if let message = viewModel.mutationState.errorMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            SectionShell(title: "Loading", subtitle: nil) {
                AppLoadingStateView(message: "Opening daily intake…")
            }
        case let .failed(message, _):
            SectionShell(title: "Daily log", subtitle: nil) {
                AppErrorStateView(title: "Failed to load day", message: message) {
                    Task { await viewModel.load() }
                }
            }
        case .loaded:
            totalsSection
            intakeSection
            planSection
            if viewModel.day != nil {
                Button(role: .destructive) {
                    confirmingDayDelete = true
                } label: {
                    Label("Clear day log", systemImage: "trash")
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    private var totalsSection: some View {
        MacroSummaryView(
            totals: viewModel.payload?.loggedTotals ?? .empty,
            title: "Logged totals",
            description: viewModel.selectedPlan == nil ? "No target plan selected." : "Compared with selected plan suggestions.",
            targetTotals: viewModel.payload?.targetTotals
        )
    }

    private var intakeSection: some View {
        SectionShell(title: "Intake", subtitle: "Foods and logged meal groups") {
            VStack(alignment: .leading, spacing: 14) {
                if viewModel.intakeSlots.isEmpty {
                    AppEmptyStateView(
                        title: "No food logged",
                        message: "Log a standalone food or materialize a meal template into editable entries.",
                        systemImage: "fork.knife"
                    )
                } else {
                    ForEach(viewModel.intakeSlots, id: \.key) { slot in
                        TimeSlotCard(
                            slot: slot,
                            day: viewModel.day,
                            editEntry: { editingEntry = $0 },
                            editGroup: { editingGroup = $0 },
                            deleteEntry: { entryId in Task { _ = await viewModel.deleteEntry(id: entryId) } },
                            deleteGroup: { groupId in Task { _ = await viewModel.deleteMealGroup(id: groupId) } }
                        )
                    }
                }

                HStack(spacing: 10) {
                    Button {
                        showLogMeal = true
                    } label: {
                        Label("Log meal", systemImage: "plus")
                    }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.isMutating)
                    Button {
                        showLogFood = true
                    } label: {
                        Label("Log food", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.isMutating)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    private var planSection: some View {
        SectionShell(title: "Plan suggestions", subtitle: "Suggestions only, not a schedule") {
            VStack(alignment: .leading, spacing: 14) {
                Picker("Selected nutrition plan", selection: Binding(
                    get: { viewModel.day?.nutritionPlanId ?? "" },
                    set: { value in Task { _ = await viewModel.updatePlan(nutritionPlanId: value.isEmpty ? nil : value) } }
                )) {
                    Text("No plan selected").tag("")
                    ForEach(viewModel.payload?.nutritionPlans ?? []) { plan in
                        Text(plan.name).tag(plan.id)
                    }
                }
                .pickerStyle(.menu)
                Button("Clear plan") {
                    Task { _ = await viewModel.updatePlan(nutritionPlanId: nil) }
                }
                .buttonStyle(.bordered)
                .disabled(viewModel.day?.nutritionPlanId == nil || viewModel.isMutating)

                if let plan = viewModel.selectedPlan {
                    if plan.sortedSlots.isEmpty {
                        AppEmptyStateView(
                            title: "No slots",
                            message: "This selected plan does not have meal slots yet.",
                            systemImage: "list.bullet.rectangle"
                        )
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(plan.sortedSlots.enumerated()), id: \.element.id) { index, slot in
                                PlanSuggestionRow(slot: slot, nextPosition: viewModel.nextGroupPosition + index, viewModel: viewModel)
                                if slot.id != plan.sortedSlots.last?.id { Divider() }
                            }
                        }
                        .nutritionGlassCard(cornerRadius: 16)
                    }
                } else {
                    Text("Pick a plan to show timed meal suggestions, or log meals and foods ad hoc.")
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                        .nutritionGlassCard(cornerRadius: 14, tint: NeoGymTheme.glassSubtleFill)
                }
            }
        }
    }
}

private struct TimeSlotCard: View {
    let slot: IntakeTimeSlot
    let day: NutritionDay?
    let editEntry: (EditingEntrySheetItem) -> Void
    let editGroup: (EditingGroupSheetItem) -> Void
    let deleteEntry: (String) -> Void
    let deleteGroup: (String) -> Void

    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation { expanded.toggle() }
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "clock")
                        .foregroundColor(.accentColor)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(slot.label)
                            .font(.subheadline.weight(.semibold))
                        Text(NutritionMath.macroTotalsSummary(slot.totals))
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                        Text("\(slot.entries.count) entries · \(slot.mealGroups.count) meal groups")
                            .font(.caption2)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .padding(12)
            }
            .buttonStyle(.plain)

            if expanded {
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    if !slot.mealGroups.isEmpty {
                        Text("Logged meal groups")
                            .font(.caption.weight(.bold))
                            .foregroundColor(NeoGymTheme.mutedText)
                        ForEach(slot.mealGroups, id: \.id) { group in
                            MealGroupRow(
                                group: group,
                                original: day?.nutritionLogMeals.first { $0.id == group.id },
                                edit: editGroup,
                                delete: deleteGroup
                            )
                        }
                    }

                    if slot.entries.isEmpty {
                        Text("This time slot has no food entries.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    } else {
                        Text("Food entries")
                            .font(.caption.weight(.bold))
                            .foregroundColor(NeoGymTheme.mutedText)
                        ForEach(slot.entries, id: \.entry.id) { slotEntry in
                            EntryRow(
                                slotEntry: slotEntry,
                                edit: editEntry,
                                delete: deleteEntry
                            )
                        }
                    }
                }
                .padding(12)
            }
        }
        .nutritionGlassCard(cornerRadius: 16)
    }
}

private struct MealGroupRow: View {
    let group: IntakeSlotMealGroup
    let original: NutritionLogMeal?
    let edit: (EditingGroupSheetItem) -> Void
    let delete: (String) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "fork.knife.circle")
                .foregroundColor(NeoGymTheme.mutedText)
            VStack(alignment: .leading, spacing: 3) {
                Text(group.name)
                    .font(.subheadline.weight(.semibold))
                Text("\(group.entryCount) entr\(group.entryCount == 1 ? "y" : "ies")")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            Button("Edit") {
                edit(EditingGroupSheetItem(group: original ?? NutritionLogMeal(
                    id: group.id,
                    mealId: group.mealId,
                    nutritionPlanMealId: group.nutritionPlanMealId,
                    name: group.name,
                    slotTime: group.slotTime,
                    position: Int(group.position)
                )))
            }
            .font(.caption)
            Button(role: .destructive) {
                delete(group.id)
            } label: {
                Image(systemName: "trash")
            }
            .accessibilityLabel("Delete meal group")
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
    }
}

private struct EntryRow: View {
    let slotEntry: IntakeSlotEntry
    let edit: (EditingEntrySheetItem) -> Void
    let delete: (String) -> Void

    var body: some View {
        let entry = slotEntry.entry
        let totals = NutritionMath.loggedEntryMacroTotals(entry.loggedSnapshot)
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: slotEntry.kind == .meal ? "fork.knife" : "apple.logo")
                .foregroundColor(NeoGymTheme.mutedText)
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.snapshotFoodName)
                    .font(.subheadline.weight(.semibold))
                Text(NutritionMath.macroTotalsSummary(totals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("\(NutritionMath.formatMacro(entry.grams, unit: "g"))"
                    + (slotEntry.mealName.map { " · From \($0)" } ?? ""))
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            Button("Edit") {
                edit(EditingEntrySheetItem(entry: entry, showTime: slotEntry.kind == .standalone))
            }
            .font(.caption)
            Button(role: .destructive) {
                delete(entry.id)
            } label: {
                Image(systemName: "trash")
            }
            .accessibilityLabel("Delete food entry")
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }
}

private struct PlanSuggestionRow: View {
    let slot: NutritionPlanMealSlot
    let nextPosition: Int
    @ObservedObject var viewModel: DailyIntakeViewModel
    @State private var showLog = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "clock")
                .foregroundColor(.accentColor)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                Text(IntakeGrouping.formatTimeOfDay(slot.slotTime))
                    .font(.caption.weight(.bold))
                    .foregroundColor(NeoGymTheme.mutedText)
                Text(slot.displayLabel)
                    .font(.subheadline.weight(.semibold))
                if let meal = slot.meal {
                    Text(slot.label == nil ? NutritionMath.macroTotalsSummary(meal.macroTotals) : "Template: \(meal.name) · \(NutritionMath.macroTotalsSummary(meal.macroTotals))")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(2)
                }
            }
            Spacer()
            Button("Log") { showLog = true }
                .buttonStyle(.borderedProminent)
                .disabled(slot.meal == nil || viewModel.isMutating)
        }
        .padding(12)
        .sheet(isPresented: $showLog) {
            LogMealSheet(viewModel: viewModel, planSlot: slot, fixedPosition: nextPosition)
        }
    }
}

struct EditingEntrySheetItem: Identifiable {
    let entry: IntakeEntry
    let showTime: Bool
    var id: String { entry.id }
}

struct EditingGroupSheetItem: Identifiable {
    let group: NutritionLogMeal
    var id: String { group.id }
}
