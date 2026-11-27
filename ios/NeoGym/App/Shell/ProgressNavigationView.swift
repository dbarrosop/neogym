import NeoGymKit
import SwiftUI
import UIKit

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
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var muscleModel: MuscleSetProgressViewModel
    @StateObject private var strengthModel: StrengthProgressViewModel
    @State private var reloadToken = 0
    @State private var photoGalleryAngle = ""
    @State private var photoImageCache = ProgressPhotoImageCache()
    @State private var fullScreenPhoto: PhotoPresentation?
    @State private var selectedPhoto: PhotoViewerSelection?
    // Keep only the ID for returning from a pushed editor or after backgrounding.
    @State private var detailSelection: (anchor: String, current: String)?
    @State private var muscleLoadedToken: Int?
    @State private var strengthLoadedToken: Int?

    private struct PhotoPresentation: Identifiable {
        let id = UUID()
        let route: ProgressRoute
        let selection: PhotoViewerSelection
    }

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
        .fullScreenCover(item: $fullScreenPhoto) { presentation in
            fullScreenPhotoView(presentation)
                .environment(\.privateProgressPhotos, progressPhotos)
                .environment(\.progressPhotoImageCache, photoImageCache)
                .environment(\.scenePhase, scenePhase)
        }
        .environment(\.privateProgressPhotos, progressPhotos)
        .environment(\.progressPhotoImageCache, photoImageCache)
        .onChange(of: selectedTab) {
            if selectedTab != .progress {
                retirePhotoPresentation()
                if let route = path.last { retirePhotoForm(route) }
            }
        }
        .onChange(of: path) {
            retirePhotoPresentation()
            if let detailSelection, !path.contains(.progressPhotoDetail(detailSelection.anchor)) {
                self.detailSelection = nil
            }
        }
        .onChange(of: scenePhase) {
            if scenePhase == .background { clearPhotoMemory() }
        }
        .onChange(of: progressPhotos == nil) {
            if progressPhotos == nil { clearPhotoMemory(); detailSelection = nil }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
            photoImageCache.clear()
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
            if !repository.isDemo {
                ProgressPhotoCreate(repository: repository, scope: scope, initialDate: date, highlightedAngle: angle) {
                    guard selectedTab == .progress, path.last == route else { return }
                    photoGalleryAngle = ""
                    // From Body, the gallery, or Compare, a spent check-in returns
                    // to the gallery without leaving a form in the back stack.
                    path = [.progressPhotoGallery]
                }
            }
        case let .progressPhotoDetail(id):
            let loadID = detailSelection?.anchor == id ? detailSelection?.current ?? id : id
            ProgressPhotoRecord(repository: repository, scope: scope, id: loadID, title: "Progress photo") { photo in
                ProgressPhotoViewer(repository: repository, scope: scope, photo: photo, selection: selectedPhoto) { selection in
                    guard selectedTab == .progress, path.last == route else { return }
                    fullScreenPhoto = PhotoPresentation(route: route, selection: selection)
                } onStep: { selection in
                    select(selection, from: route)
                } onDeleted: { deleted in
                    photoImageCache.remove(id: deleted)
                    guard selectedTab == .progress, path.last == route else { return }
                    path = [.progressPhotoGallery]
                }
            }
        case let .progressPhotoEdit(id):
            if !repository.isDemo {
                ProgressPhotoRecord(repository: repository, scope: scope, id: id, title: "Edit progress photo") { photo in
                    ProgressPhotoEdit(repository: repository, scope: scope, photo: photo)
                }
            }
        case let .progressPhotoCompare(label, from):
            ProgressPhotoCompare(repository: repository, scope: scope, initialLabel: label, initialPhoto: from)
        default:
            EmptyView()
        }
    }

    private func fullScreenPhotoView(_ presentation: PhotoPresentation) -> some View {
        // The mounted cover is the source of truth, not a read back from the
        // presenting stack while SwiftUI is still performing the transition.
        PhotoPrivacyBoundary(isPresented: true, fillsRoute: true, onBackground: { clearPhotoMemory() }) { repository, scope in
            ProgressPhotoFullScreen(repository: repository, scope: scope, selection: presentation.selection) { selection in
                select(selection, from: presentation.route)
                fullScreenPhoto = nil
            }
        }
        .background(Color.black.ignoresSafeArea())
        .persistentSystemOverlays(.hidden)
    }

    private func select(_ selection: PhotoViewerSelection, from route: ProgressRoute) {
        guard selectedTab == .progress, path.last == route, case let .progressPhotoDetail(id) = route else { return }
        selectedPhoto = selection
        detailSelection = (id, selection.photo.id)
    }

    private func retirePhotoPresentation() {
        fullScreenPhoto = nil
        selectedPhoto = nil
    }

    private func clearPhotoMemory() {
        retirePhotoPresentation()
        photoImageCache.clear()
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
