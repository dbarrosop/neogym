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
        .toolbar { dailyIntakeDayNavigationToolbar }
        .toolbar { dailyIntakeBottomToolbar }
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
        }
    }

    private var totalsSection: some View {
        SectionShell(title: "Logged totals", subtitle: "Snapshot totals with an optional plan target") {
            VStack(alignment: .leading, spacing: 14) {
                planPicker
                MacroSummaryView(
                    totals: viewModel.payload?.loggedTotals ?? .empty,
                    title: "Logged",
                    description: viewModel.selectedPlan == nil
                        ? "Choose a plan to compare this day with its target totals."
                        : "Compared with \(viewModel.selectedPlan?.name ?? "selected plan").",
                    targetTotals: viewModel.payload?.targetTotals
                )
            }
        }
    }

    private var planPicker: some View {
        HStack(spacing: 10) {
            Picker("Plan", selection: Binding(
                get: { viewModel.day?.nutritionPlanId ?? "" },
                set: { value in
                    Task { _ = await viewModel.updatePlan(nutritionPlanId: value.isEmpty ? nil : value) }
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
