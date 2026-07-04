import NeoGymKit
import SwiftUI

enum WorkoutAreaSection: String, CaseIterable, Identifiable, SecondaryTabSection {
    case sessions
    case workouts
    case exercises

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sessions: "Sessions"
        case .workouts: "Workouts"
        case .exercises: "Exercises"
        }
    }

    var systemImage: String? {
        switch self {
        case .sessions: "calendar.badge.clock"
        case .workouts: "figure.strengthtraining.traditional"
        case .exercises: "list.bullet.clipboard"
        }
    }
}

struct WorkoutsSectionNavigationView: View {
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    @Binding var areaSelection: AppDestination
    let restTimer: RestTimerController
    @Binding var pendingSessionId: String?

    @State private var selection: WorkoutAreaSection = .sessions
    @State private var path: [WorkoutsRoute] = []
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            rootContent
                .navigationDestination(for: WorkoutsRoute.self) { route in
                    routeDestination(for: route)
                }
        }
    }

    private var rootContent: some View {
        SecondarySectionContentHost(selection: $selection) { section in
            sectionPage(for: section)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(selection.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top) {
            if path.isEmpty {
                AppAreaSwitcher(selection: $areaSelection)
            }
        }
        .toolbar {
            rootSectionToolbar
            rootActionToolbar
        }
    }

    @ToolbarContentBuilder
    private var rootSectionToolbar: some ToolbarContent {
        if path.isEmpty {
            ToolbarItem(placement: .principal) {
                SectionTitleMenu(selection: $selection)
            }
        }
    }

    @ToolbarContentBuilder
    private var rootActionToolbar: some ToolbarContent {
        if path.isEmpty, selection == .workouts {
            RootPrimaryActionToolbar(
                title: "New workout",
                systemImage: "plus",
                action: openWorkoutCreate
            )
        }
    }

    @ViewBuilder
    private func sectionPage(for section: WorkoutAreaSection) -> some View {
        switch section {
        case .sessions:
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                pendingSessionId: $pendingSessionId,
                reloadToken: reloadToken,
                onSessionOpened: openSession
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

    @ViewBuilder
    private func routeDestination(for route: WorkoutsRoute) -> some View {
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
        path = WorkoutSessionRouteMapping.pathAfterClosingStartedSession()
        selection = .sessions
        invalidateLists()
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}
