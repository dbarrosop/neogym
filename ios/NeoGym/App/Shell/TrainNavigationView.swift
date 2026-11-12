import NeoGymKit
import SwiftUI

/// Train tab: Sessions · Workouts · Exercises. Opening the tab (and pulling to
/// refresh Sessions) also runs the read-only Apple Health workout import.
struct TrainNavigationView: View {
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let healthWorkoutRepository: any HealthWorkoutStoring
    let healthWorkoutImporter: (any HealthWorkoutImporting)?
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    let isSelected: Bool
    @Binding var path: [TrainRoute]
    @Binding var section: TrainSection
    let restTimer: RestTimerController
    let onTrainingMutated: () -> Void

    @State private var reloadToken = 0
    @StateObject private var healthWorkoutSync = HealthWorkoutSyncModel()

    var body: some View {
        NavigationStack(path: $path) {
            sectionContent
                .environment(\.areaSectionHeader, AnyView(header))
                .areaRoot(title: "Train")
                .toolbar { primaryAction }
                .navigationDestination(for: TrainRoute.self) { route in
                    routeDestination(for: route)
                        .screenBackground()
                }
        }
        .task(id: isSelected) {
            if isSelected { await syncHealthWorkouts() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            AreaSectionPicker(label: "Train sections", selection: $section)
            if section == .sessions {
                healthWorkoutStatus
            }
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .sessions:
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                reloadToken: reloadToken,
                onRefresh: { await syncHealthWorkouts(waitForCurrent: true) }
            )
        case .workouts:
            WorkoutsListView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                reloadToken: reloadToken,
                onSessionStarted: openSession
            )
        case .exercises:
            ExercisesListView(
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                reloadToken: reloadToken,
                onSessionStarted: openSession
            )
        }
    }

    @ToolbarContentBuilder
    private var primaryAction: some ToolbarContent {
        switch section {
        case .sessions:
            AreaPrimaryAction(title: "Start session") { section = .workouts }
        case .workouts:
            AreaPrimaryAction(title: "New workout") { path.append(.workoutCreate) }
        case .exercises:
            ToolbarItem(placement: .topBarTrailing) { EmptyView() }
        }
    }

    @ViewBuilder
    private var healthWorkoutStatus: some View {
        switch healthWorkoutSync.state {
        case .loading:
            HealthSyncStatusRow(title: "Apple Health", detail: "Syncing workouts…", isSyncing: true)
        case let .loaded(summary):
            HealthSyncStatusRow(
                title: "Apple Health",
                detail: summary.importedOrUpdated > 0 || summary.deleted > 0
                    ? "Workouts synced: \(summary.importedOrUpdated) saved, \(summary.deleted) removed"
                    : "Workouts checked · no changes"
            )
        case let .failed(message, _):
            FeedbackBanner(message: message)
        case .idle:
            EmptyView()
        }
    }

    private func syncHealthWorkouts(waitForCurrent: Bool = false) async {
        guard let currentUserId, let healthWorkoutImporter else { return }
        await healthWorkoutSync.sync(
            userId: currentUserId,
            importer: healthWorkoutImporter,
            repository: healthWorkoutRepository,
            waitForCurrent: waitForCurrent
        )
    }

    @ViewBuilder
    private func routeDestination(for route: TrainRoute) -> some View {
        switch route {
        case let .sessionDetail(sessionId):
            SessionDetailView(
                sessionId: sessionId,
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                restTimer: restTimer,
                onSessionStarted: openSession,
                onDeleted: closeStartedSession,
                onMutated: invalidateLists
            )
        case let .workoutDetail(workoutId):
            WorkoutDetailView(
                workoutId: workoutId,
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                onSessionStarted: openSession,
                onDeleted: invalidateLists
            )
        case .workoutCreate:
            WorkoutCreateView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                onFinished: invalidateLists
            )
        case let .exerciseDetail(exerciseId):
            ExerciseDetailView(
                exerciseId: exerciseId,
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: openSession
            )
        }
    }

    private func openSession(_ sessionId: String) {
        guard let sessionIdToOpen = WorkoutSessionRouteMapping.sessionIdToOpen(from: sessionId) else { return }
        path = WorkoutSessionRouteMapping.pathAfterOpeningSession(
            sessionIdToOpen,
            currentPath: path,
            makeRoute: TrainRoute.sessionDetail
        )
        invalidateLists()
    }

    private func closeStartedSession() {
        path = WorkoutSessionRouteMapping.pathAfterClosingStartedSession(
            currentPath: path,
            isSessionDetailRoute: { $0.sessionId != nil }
        )
        invalidateLists()
    }

    private func invalidateLists() {
        reloadToken += 1
        onTrainingMutated()
    }
}

/// Read-only Apple Health sync status, shown where imports run.
struct HealthSyncStatusRow: View {
    let title: String
    let detail: String
    var isSyncing = false

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Image(systemName: "heart.fill")
                .font(.body)
                .foregroundStyle(NeoGymTheme.destructive)
                .frame(width: 36, height: 36)
                .background(Circle().fill(NeoGymTheme.fill))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Spacer(minLength: 0)
            if isSyncing {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingSM)
        .frame(minHeight: 52)
        .cardSurface()
        .accessibilityElement(children: .combine)
    }
}
