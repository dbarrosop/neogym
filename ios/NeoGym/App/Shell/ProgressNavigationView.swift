import NeoGymKit
import SwiftUI

/// Progress tab: Overview · Muscles · Strength · Body · Energy. The Muscles and
/// Strength view models live here so their loaded history survives section
/// switches, and Overview's cards share them.
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
    let progressPhotos: (any ProgressPhotoRepositoryProtocol)?
    @Binding var selectedTab: AppTab
    @Binding var path: [ProgressRoute]
    @Binding var section: ProgressSection
    let onSessionStarted: (String) -> Void
    @Environment(\.energyWidgetUpdates) private var widgetUpdates

    @StateObject private var muscleModel: MuscleSetProgressViewModel
    @StateObject private var strengthModel: StrengthProgressViewModel
    @State private var reloadToken = 0
    // Keep only the angle choice across pushes; photo data remains route-local.
    @State private var photoGalleryAngle = ""
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
        progressPhotos: (any ProgressPhotoRepositoryProtocol)?,
        selectedTab: Binding<AppTab>,
        path: Binding<[ProgressRoute]>,
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
        self.progressPhotos = progressPhotos
        _selectedTab = selectedTab
        _path = path
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
        .environment(\.privateProgressPhotos, progressPhotos)
        .onChange(of: selectedTab) {
            if selectedTab != .progress, let route = path.last { retirePhotoForm(route) }
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .overview:
            ProgressOverviewView(
                muscleModel: muscleModel,
                strengthModel: strengthModel,
                muscleLoadedToken: $muscleLoadedToken,
                strengthLoadedToken: $strengthLoadedToken,
                trainingRevision: trainingRevision,
                reloadToken: reloadToken,
                bodyRepository: bodyRepository,
                nutritionRepository: nutritionRepository,
                onSeeAll: { section = $0 }
            )
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
                reloadToken: reloadToken,
                showsProgressPhotos: progressPhotos != nil && selectedTab == .progress && path.isEmpty
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
        case .overview, .muscles, .strength:
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
        case .progressPhotoGallery, .progressPhotoCreate, .progressPhotoDetail, .progressPhotoEdit, .progressPhotoCompare:
            PhotoRouteBoundary(route: route, path: $path, selectedTab: $selectedTab, onBackground: { retirePhotoForm(route) }) { repository, scope in
                photoDestination(route, repository: repository, scope: scope)
            }
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

    @ViewBuilder
    private func photoDestination(_ route: ProgressRoute, repository: any ProgressPhotoRepositoryProtocol,
                                  scope: ProgressPhotoRouteScope) -> some View {
        switch route {
        case .progressPhotoGallery:
            ProgressPhotoGallery(repository: repository, scope: scope, angle: $photoGalleryAngle)
        case let .progressPhotoCreate(date, angle):
            ProgressPhotoCreate(repository: repository, scope: scope, initialDate: date, highlightedAngle: angle) {
                guard selectedTab == .progress, path.last == route else { return }
                photoGalleryAngle = ""
                // From Body, the gallery, or Compare, a spent check-in returns
                // to the gallery without leaving a form in the back stack.
                path = [.progressPhotoGallery]
            }
        case let .progressPhotoDetail(id):
            ProgressPhotoRecord(repository: repository, scope: scope, id: id, title: "Progress photo") { photo in
                ProgressPhotoViewer(repository: repository, scope: scope, photo: photo) { next in
                    guard selectedTab == .progress, path.last == route else { return }
                    path = Array(path.dropLast()) + [.progressPhotoDetail(next)]
                } onDeleted: {
                    guard selectedTab == .progress, path.last == route else { return }
                    path = [.progressPhotoGallery]
                }
            }
        case let .progressPhotoEdit(id):
            ProgressPhotoRecord(repository: repository, scope: scope, id: id, title: "Edit progress photo") { photo in
                ProgressPhotoEdit(repository: repository, scope: scope, photo: photo)
            }
        case let .progressPhotoCompare(label, from):
            ProgressPhotoCompare(repository: repository, scope: scope, initialLabel: label, initialPhoto: from)
        default:
            EmptyView()
        }
    }

    private func retirePhotoForm(_ route: ProgressRoute) {
        guard path.last == route else { return }
        switch route {
        case .progressPhotoCreate, .progressPhotoEdit: path.removeLast()
        default: break
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
        widgetUpdates.reload()
    }
}

/// Loads a progress pane when it appears, plus pull to refresh.
struct ProgressRefreshModifier<Row: Sendable>: ViewModifier {
    @ObservedObject var model: ProgressHistoryViewModel<Row>
    let reloadToken: Int
    @Binding var loadedToken: Int?

    func body(content: Content) -> some View {
        content
            .modifier(ProgressLoadModifier(model: model, reloadToken: reloadToken, loadedToken: $loadedToken))
            .refreshable { await model.load() }
    }
}

/// Loads a progress view model when its pane (or Overview) appears. The
/// loaded token lives in the area root, so returning revalidates only after a
/// training mutation or a new local day, not on every section switch.
struct ProgressLoadModifier<Row: Sendable>: ViewModifier {
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
    }
}
