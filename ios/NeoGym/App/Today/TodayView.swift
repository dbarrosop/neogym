import NeoGymKit
import SwiftUI
import WidgetKit

/// Cross-tab navigation the Today cards trigger.
struct TodayActions {
    let openSession: (String) -> Void
    let openTrain: (TrainSection) -> Void
    let openNutritionLog: () -> Void
    let openProgress: (ProgressSection) -> Void
    let nutritionLogged: () -> Void
}

/// Today: training, nutrition against the plan, yesterday's balance with
/// today's estimate, and the body trend. It replaces Nutrition › Overview and
/// keeps its duties: the Energy Balance widget snapshot (written only after a
/// fresh backend overview), Apple Health Body sync on open and refresh, and
/// cached-first reads that keep stale values while revalidating.
struct TodayView: View {
    let nutritionRepository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?
    let isSelected: Bool
    let revision: Int
    let actions: TodayActions

    @StateObject private var trainingModel: TodayTrainingViewModel
    @StateObject private var overviewModel: NutritionDaysListViewModel
    @StateObject private var bodySyncModel: BodyMeasurementsListViewModel
    @StateObject private var bodyChartModel: BodyMeasurementsChartViewModel
    @State private var isLoadingPipeline = false
    @State private var needsRevalidation = false
    @State private var hasStarted = false
    @State private var lastBodySync: Date?
    @State private var loggingSlotKey: String?
    @State private var slotError: String?
    @Environment(\.locale) private var locale
    @Environment(\.scenePhase) private var scenePhase

    init(
        sessionsRepository: any TodayTrainingProviding,
        nutritionRepository: any NutritionFoodMealRepositoryProtocol,
        bodyRepository: any BodyMeasurementsRepositoryProtocol,
        bodyHealthImporter: (any BodyMeasurementsHealthImporting)?,
        currentUserId: String?,
        isSelected: Bool,
        revision: Int,
        actions: TodayActions
    ) {
        self.nutritionRepository = nutritionRepository
        self.currentUserId = currentUserId
        self.isSelected = isSelected
        self.revision = revision
        self.actions = actions
        _trainingModel = StateObject(wrappedValue: TodayTrainingViewModel(repository: sessionsRepository))
        _overviewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: nutritionRepository))
        _bodySyncModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(
            repository: bodyRepository,
            healthImporter: bodyHealthImporter,
            userId: currentUserId
        ))
        _bodyChartModel = StateObject(wrappedValue: BodyMeasurementsChartViewModel(repository: bodyRepository))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                    TodayTrainingCard(
                        state: trainingModel.state,
                        retry: { reload() },
                        openSession: actions.openSession,
                        openSessions: { actions.openTrain(.sessions) },
                        startSession: { actions.openTrain(.workouts) }
                    )
                    TodayNutritionCard(
                        summary: nutritionSummary,
                        isLoading: overviewModel.state.value == nil && overviewModel.state.errorMessage == nil,
                        errorMessage: overviewModel.state.value == nil ? overviewModel.state.errorMessage : nil,
                        loggingSlotKey: loggingSlotKey,
                        slotError: slotError,
                        openLog: actions.openNutritionLog,
                        logSlot: { slot in Task { await logPlannedSlot(slot) } }
                    )
                    TodayBalanceCard(
                        summary: overviewModel.state.value.map { TodayBalanceSummary(payload: $0, today: today) },
                        errorMessage: overviewModel.state.value == nil ? overviewModel.state.errorMessage : nil,
                        openEnergy: { actions.openProgress(.energy) }
                    )
                    TodayBodyCard(
                        summary: bodyChartModel.state.value.map { BodyTrendSummary(points: $0.points, today: today) },
                        errorMessage: bodyChartModel.state.value == nil ? bodyChartModel.state.errorMessage : nil,
                        cachedThrough: bodyChartModel.cachedThrough,
                        healthStatus: healthStatus,
                        openTrend: { actions.openProgress(.body) }
                    )
                }
                .frame(maxWidth: NeoGymTheme.contentMaxWidth)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.bottom, NeoGymTheme.spacingXL)
                .frame(maxWidth: .infinity)
            }
            .refreshable { await load() }
            .areaRoot(title: "Today")
            .navigationSubtitle(Text(dateHeading))
            .toolbar { quickLogMenu }
        }
        .onAppear {
            guard !hasStarted else { return }
            hasStarted = true
            reload()
        }
        .onChange(of: isSelected) { _, selected in
            if selected, hasStarted { reload() }
        }
        .onChange(of: revision) { reload() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, hasStarted { reload() }
        }
    }

    // MARK: - Derived values

    private var today: String { IntakeGrouping.formatLocalDate() }

    private var dateHeading: String {
        Date().formatted(.dateTime.weekday(.wide).day().month(.wide))
    }

    private var nutritionSummary: TodayNutritionSummary? {
        overviewModel.state.value.map { payload in
            TodayNutritionSummary(day: payload.daysByDate[today], locale: locale)
        }
    }

    private var healthStatus: String? {
        switch bodySyncModel.healthSyncState {
        case .loading:
            return "Syncing Apple Health…"
        case .loaded:
            return lastBodySync.map { "Synced from Apple Health at \($0.formatted(date: .omitted, time: .shortened))" }
        case let .failed(message, _):
            return "Apple Health sync failed: \(message)"
        case .idle:
            return nil
        }
    }

    @ToolbarContentBuilder
    private var quickLogMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Log food", systemImage: "fork.knife", action: actions.openNutritionLog)
                Button("Start session", systemImage: "dumbbell") { actions.openTrain(.workouts) }
                Button("Log measurement", systemImage: "scalemass") { actions.openProgress(.body) }
                Button("Log energy", systemImage: "flame") { actions.openProgress(.energy) }
            } label: {
                Label("Quick log", systemImage: "plus")
                    .labelStyle(.iconOnly)
            }
            .tint(NeoGymTheme.text)
            .accessibilityLabel("Quick log")
        }
    }

    // MARK: - Loading

    private func reload() {
        Task { await load() }
    }

    /// Unstructured so switching tabs does not cancel a Health sync mid-write.
    private func load() async {
        guard !isLoadingPipeline else {
            // A request while reads are in flight must wait for the Body sync
            // and then fetch fresh backend data.
            needsRevalidation = true
            return
        }
        isLoadingPipeline = true
        defer { isLoadingPipeline = false }

        let bodyRange = ChartHistoryRange.recentDays(14)
        async let training: Void = trainingModel.load()
        async let overview: Void = overviewModel.load()
        async let bodyChart: Void = bodyChartModel.load(
            range: bodyRange,
            cacheCandidates: ChartHistoryRange.recentCacheCandidates(14)
        )
        async let bodySync: Bool = bodySyncModel.syncHealthMeasurementsOnly()
        await training
        await overview
        await bodyChart
        let bodyChanged = await bodySync
        if case .loaded = bodySyncModel.healthSyncState { lastBodySync = Date() }
        if bodyChanged || needsRevalidation {
            needsRevalidation = false
            async let freshOverview: Void = overviewModel.load()
            async let freshBody: Void = bodyChartModel.load(range: bodyRange)
            await freshOverview
            await freshBody
        }
        writeWidgetSnapshotIfFresh()
    }

    private func writeWidgetSnapshotIfFresh() {
        guard case .loaded = overviewModel.state, overviewModel.lastLoadIncludedFreshData else { return }
        let snapshot = EnergyBalanceWidgetSnapshot(
            summary: overviewModel.energyBalanceOverviewSummary(locale: locale),
            userMarker: currentUserId,
            generatedAt: Date(),
            locale: locale
        )
        EnergyBalanceWidgetSnapshotStore.shared.save(snapshot)
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }

    /// Logs every planned entry of the slot in one mutation, as the Log tab does.
    private func logPlannedSlot(_ slot: TodayPlannedSlot) async {
        guard loggingSlotKey == nil else { return }
        loggingSlotKey = slot.key
        slotError = nil
        defer { loggingSlotKey = nil }
        let intake = DailyIntakeViewModel(date: today, repository: nutritionRepository)
        await intake.load()
        guard let plan = intake.selectedPlan,
              let planSlot = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(plan.sortedEntries)
                  .first(where: { $0.key == slot.key })
        else {
            slotError = intake.state.errorMessage ?? "This plan slot is no longer available."
            return
        }
        if await intake.logSelectedPlanSlot(planSlot) {
            actions.nutritionLogged()
            WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
            await overviewModel.load()
            writeWidgetSnapshotIfFresh()
        } else {
            slotError = intake.mutationState.errorMessage ?? "Couldn't log \(slot.label)."
        }
    }
}
