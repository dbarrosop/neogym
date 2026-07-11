import NeoGymKit
import SwiftUI

struct NutritionDaysView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let reloadToken: Int

    @StateObject private var viewModel: NutritionDaysListViewModel

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        reloadToken: Int
    ) {
        self.repository = repository
        self.reloadToken = reloadToken
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
    }

    var body: some View {
        daysList
            .onChange(of: reloadToken) { Task { await viewModel.load() } }
    }

    private var daysList: some View {
        ScrollView {
            SectionShell(title: "Daily logs", subtitle: "Browse by local date") {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Open a day to choose plan suggestions, log foods and meals, and edit historical entries.")
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)

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
                                    NavigationLink(value: NutritionRoute.day(day.logDate)) {
                                        NutritionDayRow(day: day)
                                    }
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
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }
}

struct DailyIntakeView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let onClose: () -> Void
    let onMutated: () -> Void

    @StateObject private var viewModel: DailyIntakeViewModel
    @State private var logRequest: LogIntakeSheetRequest?
    @State private var editingEntry: EditingEntrySheetItem?
    @State private var editingGroup: EditingGroupSheetItem?
    @State private var selectedPlanSectionExpanded = true
    @State private var confirmingDayDelete = false

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        date: String,
        onClose: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        self.repository = repository
        self.onClose = onClose
        self.onMutated = onMutated
        _viewModel = StateObject(wrappedValue: DailyIntakeViewModel(date: date, repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                content
                if isLoaded, viewModel.day != nil {
                    FormDeleteButton(
                        title: "Clear day log",
                        isDisabled: viewModel.isMutating,
                        action: { confirmingDayDelete = true }
                    )
                    .padding(.top, NeoGymTheme.spacingSM)
                }
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .sheet(item: $logRequest) { request in
            LogIntakeSheet(viewModel: viewModel, request: request, onMutated: onMutated)
        }
        .sheet(item: $editingEntry) { item in
            EditLogEntrySheet(viewModel: viewModel, item: item, onMutated: onMutated)
        }
        .sheet(item: $editingGroup) { item in
            EditMealGroupSheet(viewModel: viewModel, item: item, onMutated: onMutated)
        }
        .navigationTitle(IntakeGrouping.formatLocalDateLabel(viewModel.date))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { dailyIntakeDayNavigationToolbar }
        .toolbar { dailyIntakeBottomToolbar }
        .confirmationDialog("Clear this day?", isPresented: $confirmingDayDelete, titleVisibility: .visible) {
            Button("Clear day log", role: .destructive) {
                Task {
                    if await viewModel.deleteDay() {
                        onMutated()
                        onClose()
                    }
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
            selectedPlanSuggestionsSection
        }
    }

    private var totalsSection: some View {
        SectionShell(title: "Logged totals", subtitle: "Snapshot totals with an optional plan target") {
            VStack(alignment: .leading, spacing: 14) {
                MacroSummaryView(
                    totals: viewModel.payload?.loggedTotals ?? .empty,
                    title: "Logged",
                    description: viewModel.selectedPlan == nil
                        ? "Choose a plan to compare this day with its target totals."
                        : "Compared with \(viewModel.selectedPlan?.name ?? "selected plan").",
                    targetTotals: viewModel.payload?.targetTotals
                )
                CalorieBalanceView(balance: viewModel.calorieBalance)
            }
        }
    }

    private var planPicker: some View {
        HStack(spacing: 10) {
            Picker("Plan", selection: Binding(
                get: { viewModel.day?.nutritionPlanId ?? "" },
                set: { value in
                    let nextPlanId = value.isEmpty ? nil : value
                    guard nextPlanId != viewModel.day?.nutritionPlanId else { return }
                    Task {
                        if await viewModel.updatePlan(nutritionPlanId: nextPlanId) {
                            onMutated()
                        }
                    }
                }
            )) {
                Text("No plan").tag("")
                ForEach(viewModel.payload?.nutritionPlans ?? []) { plan in
                    Text(plan.name).tag(plan.id)
                }
            }
            .pickerStyle(.menu)
            .disabled(viewModel.isMutating)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
                            editGroup: { editingGroup = $0 }
                        )
                    }
                }
            }
        }
    }

    private var selectedPlanSuggestionsSection: some View {
        let slots = viewModel.selectedPlan.map { NutritionPlanGrouping.groupPlanEntriesByTimeSlot($0.sortedEntries) } ?? []
        return SectionShell(title: "Selected plan", subtitle: viewModel.selectedPlan?.name ?? "Optional template") {
            VStack(alignment: .leading, spacing: 14) {
                Button {
                    withAnimation { selectedPlanSectionExpanded.toggle() }
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "checklist")
                            .foregroundColor(.accentColor)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(viewModel.selectedPlan?.name ?? "No plan selected")
                                .font(.subheadline.weight(.semibold))
                            Text(viewModel.selectedPlan == nil ? "Choose a plan to show its time slots." : "Log one planned time slot at a time.")
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                        Spacer()
                        Image(systemName: selectedPlanSectionExpanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if selectedPlanSectionExpanded {
                    planPicker

                    if viewModel.selectedPlan == nil {
                        AppEmptyStateView(
                            title: "No plan selected",
                            message: "Select a plan above to log its time slots.",
                            systemImage: "checklist"
                        )
                    } else if slots.isEmpty {
                        AppEmptyStateView(
                            title: "No plan entries",
                            message: "This selected plan does not have meal or food entries yet.",
                            systemImage: "checklist"
                        )
                    } else {
                        ForEach(slots, id: \.key) { slot in
                            PlanSuggestionSlotCard(
                                slot: slot,
                                disabled: viewModel.isMutating,
                                logSlot: { slot in
                                    Task {
                                        if await viewModel.logSelectedPlanSlot(slot) {
                                            onMutated()
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    @ToolbarContentBuilder
    private var dailyIntakeDayNavigationToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                Task { await viewModel.moveDate(days: -1) }
            } label: {
                Label("Previous day", systemImage: "chevron.left")
            }
            .disabled(viewModel.isMutating)
            .accessibilityLabel("Previous day")
            Button {
                Task { await viewModel.moveDate(days: 1) }
            } label: {
                Label("Next day", systemImage: "chevron.right")
            }
            .disabled(viewModel.isMutating)
            .accessibilityLabel("Next day")
        }
    }

    @ToolbarContentBuilder
    private var dailyIntakeBottomToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            if isLoaded {
                Spacer()
                Button {
                    logRequest = .adHocFood
                } label: {
                    Label("Log", systemImage: "plus")
                }
                .fontWeight(.semibold)
                .disabled(viewModel.isMutating)
            }
        }
    }

    private var isLoaded: Bool {
        if case .loaded = viewModel.state { return true }
        return false
    }

}

private struct CalorieBalanceView: View {
    let balance: DailyCalorieBalance

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Calories in / out")
                    .font(.subheadline.weight(.semibold))
                Text("Intake uses logged nutrition snapshots. Output uses the matching daily energy row.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                balanceTile(
                    label: "In",
                    value: NutritionMath.formatMacro(balance.caloriesIn, unit: "kcal")
                )
                if let caloriesOut = balance.caloriesOut {
                    balanceTile(label: "Out", value: NutritionMath.formatMacro(caloriesOut, unit: "kcal"))
                } else {
                    balanceTile(label: "Out", value: "No energy logged", muted: true)
                }
                if let net = balance.net {
                    balanceTile(label: netLabel, value: NutritionMath.formatMacro(abs(net), unit: "kcal"))
                } else {
                    balanceTile(label: "Net", value: "Intake only", muted: true)
                }
            }
        }
        .padding(14)
        .nutritionGlassCard(cornerRadius: 16, tint: NeoGymTheme.glassSubtleFill)
    }

    private var netLabel: String {
        switch balance.state {
        case .deficit: "Deficit"
        case .surplus: "Surplus"
        case .balanced: "Balance"
        case .intakeOnly: "Net"
        }
    }

    private func balanceTile(label: String, value: String, muted: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundColor(muted ? NeoGymTheme.mutedText : .primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }
}
