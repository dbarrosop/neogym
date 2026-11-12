import NeoGymKit
import SwiftUI
import WidgetKit

/// Progress tab: Muscles · Strength · Body · Energy. The Muscles and Strength
/// view models live here so their loaded history survives section switches.
struct ProgressNavigationView: View {
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let bodyRepository: any BodyMeasurementsRepositoryProtocol
    let bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    let energyRepository: any DailyEnergyRepositoryProtocol
    let nutritionRepository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?
    /// Bumped by the shell after training mutations elsewhere.
    let trainingRevision: Int
    @Binding var section: ProgressSection
    let onSessionStarted: (String) -> Void

    @StateObject private var muscleModel: MuscleSetProgressViewModel
    @StateObject private var strengthModel: StrengthProgressViewModel
    @State private var path: [ProgressRoute] = []
    @State private var reloadToken = 0
    @State private var muscleLoadedToken: Int?
    @State private var strengthLoadedToken: Int?

    init(
        sessionsRepository: any SessionsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        bodyRepository: any BodyMeasurementsRepositoryProtocol,
        bodyHealthImporter: (any BodyMeasurementsHealthImporting)?,
        energyRepository: any DailyEnergyRepositoryProtocol,
        nutritionRepository: any NutritionFoodMealRepositoryProtocol,
        currentUserId: String?,
        trainingRevision: Int,
        section: Binding<ProgressSection>,
        onSessionStarted: @escaping (String) -> Void
    ) {
        self.sessionsRepository = sessionsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.bodyRepository = bodyRepository
        self.bodyHealthImporter = bodyHealthImporter
        self.energyRepository = energyRepository
        self.nutritionRepository = nutritionRepository
        self.currentUserId = currentUserId
        self.trainingRevision = trainingRevision
        _section = section
        self.onSessionStarted = onSessionStarted
        _muscleModel = StateObject(wrappedValue: MuscleSetProgressViewModel(repository: sessionsRepository))
        _strengthModel = StateObject(wrappedValue: StrengthProgressViewModel(repository: sessionsRepository))
    }

    var body: some View {
        NavigationStack(path: $path) {
            sectionContent
                .environment(\.areaSectionHeader, AnyView(AreaSectionPicker(label: "Progress sections", selection: $section)))
                .areaRoot(title: "Progress")
                .toolbar { primaryAction }
                .navigationDestination(for: ProgressRoute.self) { route in
                    routeDestination(for: route)
                        .screenBackground()
                }
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .muscles:
            MuscleSetProgressView(
                viewModel: muscleModel,
                reloadToken: trainingRevision,
                loadedToken: $muscleLoadedToken
            )
        case .strength:
            StrengthProgressView(
                viewModel: strengthModel,
                reloadToken: trainingRevision,
                loadedToken: $strengthLoadedToken
            )
        case .body:
            BodyMeasurementsListView(
                repository: bodyRepository,
                healthImporter: bodyHealthImporter,
                userId: currentUserId,
                reloadToken: reloadToken
            )
        case .energy:
            DailyEnergyListView(
                repository: energyRepository,
                nutritionRepository: nutritionRepository,
                reloadToken: reloadToken
            )
        }
    }

    @ToolbarContentBuilder
    private var primaryAction: some ToolbarContent {
        switch section {
        case .body:
            AreaPrimaryAction(title: "Log measurement") { path.append(.bodyMeasurementCreate) }
        case .energy:
            AreaPrimaryAction(title: "Log energy") { path.append(.energyCreate) }
        case .muscles, .strength:
            ToolbarItem(placement: .topBarTrailing) { EmptyView() }
        }
    }

    @ViewBuilder
    private func routeDestination(for route: ProgressRoute) -> some View {
        switch route {
        case let .exerciseDetail(exerciseId):
            ExerciseDetailView(
                exerciseId: exerciseId,
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: onSessionStarted
            )
        case let .bodyMeasurementDetail(measurementId):
            BodyMeasurementDetailView(
                measurementId: measurementId,
                repository: bodyRepository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .bodyMeasurementCreate:
            BodyMeasurementCreateView(
                repository: bodyRepository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.bodyMeasurementDetail(id))
                },
                onFinished: invalidateLists
            )
        case let .energyDetail(entryId):
            DailyEnergyDetailView(
                entryId: entryId,
                repository: energyRepository,
                nutritionRepository: nutritionRepository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .energyCreate:
            DailyEnergyCreateView(
                repository: energyRepository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.energyDetail(id))
                },
                onFinished: invalidateLists
            )
        }
    }

    private func openRouteAfterCurrentTransition(_ route: ProgressRoute) {
        // The create view calls `dismiss()` right after `onCreated`, which pops the
        // create route synchronously; deferring the append to the next runloop tick
        // lands the new detail above the section root (Back returns to the list).
        DispatchQueue.main.async {
            path.append(route)
        }
    }

    private func invalidateLists() {
        reloadToken += 1
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }
}

/// Loads a progress pane when it appears. The loaded token lives in the area
/// root, so returning to a pane revalidates only after a training mutation or
/// a new local day, not on every section switch.
struct ProgressRefreshModifier<Row: Sendable>: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: ProgressHistoryViewModel<Row>
    let reloadToken: Int
    @Binding var loadedToken: Int?

    func body(content: Content) -> some View {
        content
            .task(id: reloadToken) {
                if loadedToken != reloadToken || model.rows == nil {
                    loadedToken = reloadToken
                    await model.load()
                } else {
                    await model.refreshIfNewLocalDay()
                }
                // Switching sections can cancel a cached-first load before revalidation.
                if Task.isCancelled { loadedToken = nil }
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                Task { await model.refreshIfNewLocalDay() }
            }
            .refreshable { await model.load() }
    }
}
