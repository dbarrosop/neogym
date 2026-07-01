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
        daysList
            .background(dayNavigationLink)
    }

    @ViewBuilder
    private var dayNavigationLink: some View {
        if let selectedDate {
            NavigationLink(
                destination: DailyIntakeView(repository: repository, date: selectedDate) {
                    self.selectedDate = nil
                    Task { await viewModel.load() }
                },
                isActive: Binding(
                    get: { self.selectedDate != nil },
                    set: { isActive in
                        if !isActive {
                            self.selectedDate = nil
                            Task { await viewModel.load() }
                        }
                    }
                )
            ) {
                EmptyView()
            }
            .hidden()
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
    @State private var logRequest: LogIntakeSheetRequest?
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
        .sheet(item: $logRequest) { request in
            LogIntakeSheet(viewModel: viewModel, request: request)
        }
        .sheet(item: $editingEntry) { item in
            EditLogEntrySheet(viewModel: viewModel, item: item)
        }
        .sheet(item: $editingGroup) { item in
            EditMealGroupSheet(viewModel: viewModel, item: item)
        }
        .navigationTitle(IntakeGrouping.formatLocalDateLabel(viewModel.date))
        .navigationBarTitleDisplayMode(.inline)
        .hidesBottomTabBarWhenPushed()
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
            description: viewModel.selectedPlan == nil
                ? "No target plan selected."
                : "Compared with selected plan suggestions.",
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
                        logRequest = .adHocMeal
                    } label: {
                        Label("Log meal", systemImage: "plus")
                    }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.isMutating)
                    Button {
                        logRequest = .adHocFood
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
                    set: { value in
                        Task { _ = await viewModel.updatePlan(nutritionPlanId: value.isEmpty ? nil : value) }
                    }
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
                    if plan.sortedEntries.isEmpty {
                        AppEmptyStateView(
                            title: "No entries",
                            message: "This selected plan does not have meal or food entries yet.",
                            systemImage: "list.bullet.rectangle"
                        )
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(plan.sortedEntries.enumerated()), id: \.element.id) { index, entry in
                                let fixedPosition = entry.kind == .meal
                                    ? viewModel.nextGroupPosition + index
                                    : viewModel.nextEntryPosition + index
                                PlanSuggestionRow(
                                    entry: entry,
                                    nextPosition: fixedPosition,
                                    openLogger: {
                                        logRequest = LogIntakeSheetRequest(
                                            source: .planEntry(entry),
                                            fixedPosition: fixedPosition
                                        )
                                    }
                                )
                                if entry.id != plan.sortedEntries.last?.id { Divider() }
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
