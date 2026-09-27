import NeoGymKit
import SwiftUI

enum WorkoutAreaSection: String, CaseIterable, Identifiable {
    case sessions
    case workouts
    case exercises
    case progress

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sessions: "Sessions"
        case .workouts: "Workouts"
        case .exercises: "Exercises"
        case .progress: "Progress"
        }
    }

    var systemImage: String? {
        switch self {
        case .sessions: "calendar.badge.clock"
        case .workouts: "figure.strengthtraining.traditional"
        case .exercises: "list.bullet.clipboard"
        case .progress: "chart.line.uptrend.xyaxis"
        }
    }
}

struct WorkoutsSectionNavigationView: View {
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let healthWorkoutRepository: any HealthWorkoutStoring
    let healthWorkoutImporter: (any HealthWorkoutImporting)?
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    @Binding var areaSelection: AppDestination
    let restTimer: RestTimerController
    @Binding var pendingSessionId: String?

    @State private var path: [WorkoutsRoute] = []
    @State private var reloadToken = 0
    @StateObject private var healthWorkoutSync = HealthWorkoutSyncModel()

    var body: some View {
        NavigationStack(path: $path) {
            rootContent
                .navigationDestination(for: WorkoutsRoute.self) { route in
                    routeDestination(for: route)
                }
        }
        .task { consumePendingSessionId() }
        .task(id: areaSelection) {
            if areaSelection == .workouts { await syncHealthWorkouts() }
        }
        .onChange(of: pendingSessionId) { consumePendingSessionId() }
    }

    private var rootContent: some View {
        List {
            healthWorkoutStatus
                .listRowInsets(EdgeInsets(
                    top: NeoGymTheme.spacingXS,
                    leading: NeoGymTheme.screenHorizontalPadding,
                    bottom: NeoGymTheme.spacingXS,
                    trailing: NeoGymTheme.screenHorizontalPadding
                ))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            ForEach(WorkoutAreaSection.allCases) { section in
                Button {
                    path.append(subsectionRoute(for: section))
                } label: {
                    WorkoutHubRow(section: section)
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(
                    top: NeoGymTheme.spacingXS,
                    leading: NeoGymTheme.screenHorizontalPadding,
                    bottom: NeoGymTheme.spacingXS,
                    trailing: NeoGymTheme.screenHorizontalPadding
                ))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .accessibilityLabel(section.title)
                .accessibilityHint("Opens \(section.title)")
                .accessibilityAddTraits(.isButton)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await syncHealthWorkouts(waitForCurrent: true) }
        .navigationTitle("Workouts")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Area", selection: $areaSelection) {
                    ForEach(AppDestination.allCases) { destination in
                        Text(destination.title).tag(destination)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Primary area")
            }
        }
    }

    @ViewBuilder
    private var healthWorkoutStatus: some View {
        switch healthWorkoutSync.state {
        case .loading:
            FeedbackBanner(message: "Syncing Apple Health workouts…", tone: .info)
        case let .loaded(summary):
            if summary.importedOrUpdated > 0 || summary.deleted > 0 {
                FeedbackBanner(
                    message: "Apple Health synced: \(summary.importedOrUpdated) saved, \(summary.deleted) removed.",
                    tone: .info
                )
            } else {
                FeedbackBanner(message: "Apple Health checked; no workout changes to import.", tone: .info)
            }
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

    private func subsectionRoute(for section: WorkoutAreaSection) -> WorkoutsRoute {
        switch section {
        case .sessions: .sessionsList
        case .workouts: .workoutsList
        case .exercises: .exercisesList
        case .progress: .progress
        }
    }

    @ViewBuilder
    private func routeDestination(for route: WorkoutsRoute) -> some View {
        switch route {
        case .sessionsList, .workoutsList, .exercisesList, .progress:
            subsectionListDestination(for: route)
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

    @ViewBuilder
    private func subsectionListDestination(for route: WorkoutsRoute) -> some View {
        switch route {
        case .workoutsList:
            WorkoutsListView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                reloadToken: reloadToken,
                onSessionStarted: openSession
            )
            .navigationTitle("Workouts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                RootPrimaryActionToolbar(
                    title: "New workout",
                    systemImage: "plus",
                    action: openWorkoutCreate
                )
            }
        case .exercisesList:
            ExercisesListView(
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                reloadToken: reloadToken,
                onSessionStarted: openSession
            )
            .navigationTitle("Exercises")
            .navigationBarTitleDisplayMode(.inline)
        case .progress:
            WorkoutProgressView(repository: sessionsRepository, reloadToken: reloadToken)
        case .sessionsList:
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                reloadToken: reloadToken
            )
            .navigationTitle("Sessions")
            .navigationBarTitleDisplayMode(.inline)
        case .sessionDetail, .workoutDetail, .workoutCreate, .exerciseDetail:
            EmptyView()
        }
    }

    private func openWorkoutCreate() {
        path.append(.workoutCreate)
    }

    private func openSession(_ sessionId: String) {
        guard let sessionIdToOpen = WorkoutSessionRouteMapping.sessionIdToOpen(from: sessionId) else { return }
        pendingSessionId = nil
        path = WorkoutSessionRouteMapping.pathAfterOpeningSession(
            sessionIdToOpen,
            currentPath: path,
            makeRoute: WorkoutsRoute.sessionDetail
        )
    }

    private func closeStartedSession() {
        path = WorkoutSessionRouteMapping.pathAfterClosingStartedSession(
            currentPath: path,
            isSessionDetailRoute: {
                if case .sessionDetail = $0 { return true }
                return false
            }
        )
        invalidateLists()
    }

    private func consumePendingSessionId() {
        guard let id = pendingSessionId else { return }
        openSession(id)
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}

private struct WorkoutHubRow: View {
    let section: WorkoutAreaSection

    var body: some View {
        GlassPanel(
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingMD,
                leading: NeoGymTheme.spacingLG,
                bottom: NeoGymTheme.spacingMD,
                trailing: NeoGymTheme.spacingLG
            )
        ) {
            HStack(spacing: NeoGymTheme.spacingMD) {
                Image(systemName: section.systemImage ?? "circle")
                    .font(.title3)
                    .foregroundStyle(NeoGymTheme.accent)
                    .frame(width: 32)
                Text(section.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.primaryText)
                Spacer(minLength: NeoGymTheme.spacingSM)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.mutedText)
            }
            .frame(minHeight: 44)
        }
    }
}
