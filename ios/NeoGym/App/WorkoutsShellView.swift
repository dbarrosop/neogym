import NeoGymKit
import SwiftUI

enum WorkoutAreaSection: String, CaseIterable, Identifiable {
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

    @State private var path: [WorkoutsRoute] = []
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            rootContent
                .navigationDestination(for: WorkoutsRoute.self) { route in
                    routeDestination(for: route)
                }
        }
        .task { consumePendingSessionId() }
        .onChange(of: pendingSessionId) { consumePendingSessionId() }
    }

    private var rootContent: some View {
        List {
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

    private func subsectionRoute(for section: WorkoutAreaSection) -> WorkoutsRoute {
        switch section {
        case .sessions: .sessionsList
        case .workouts: .workoutsList
        case .exercises: .exercisesList
        }
    }

    @ViewBuilder
    private func routeDestination(for route: WorkoutsRoute) -> some View {
        switch route {
        case .sessionsList, .workoutsList, .exercisesList:
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
        path = WorkoutSessionRouteMapping.pathAfterClosingStartedSession()
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
