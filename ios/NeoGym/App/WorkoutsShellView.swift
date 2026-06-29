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
}

struct WorkoutsSectionNavigationView: View {
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    @Binding var pendingSessionId: String?

    @State private var selection: WorkoutAreaSection = .sessions
    @State private var startedSessionId: String?
    @State private var isShowingStartedSession = false

    var body: some View {
        NavigationView {
            ZStack {
                sectionPages
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .safeAreaInset(edge: .top, spacing: 0) {
                        SecondarySectionBar(selection: $selection)
                    }
                startedSessionNavigationLink
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }

    private var sectionPages: some View {
        TabView(selection: $selection) {
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                pendingSessionId: $pendingSessionId
            )
            .tag(WorkoutAreaSection.sessions)

            WorkoutsListView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                onSessionStarted: openSession
            )
            .tag(WorkoutAreaSection.workouts)

            ExercisesListView(
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: openSession
            )
            .tag(WorkoutAreaSection.exercises)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
    }

    @ViewBuilder
    private var startedSessionNavigationLink: some View {
        if let sessionId = startedSessionId {
            NavigationLink(
                destination: SessionDetailView(
                    sessionId: sessionId,
                    sessionsRepository: sessionsRepository,
                    exercisesRepository: exercisesRepository,
                    storageBaseURL: storageBaseURL,
                    onSessionStarted: openSession,
                    onDeleted: closeStartedSession,
                    onMutated: {}
                ),
                isActive: Binding(
                    get: { isShowingStartedSession },
                    set: { isActive in
                        isShowingStartedSession = isActive
                        if !isActive {
                            startedSessionId = nil
                        }
                    }
                )
            ) {
                EmptyView()
            }
            .hidden()
        }
    }

    private func openSession(_ sessionId: String) {
        pendingSessionId = nil
        startedSessionId = sessionId
        isShowingStartedSession = true
    }

    private func closeStartedSession() {
        isShowingStartedSession = false
        startedSessionId = nil
        selection = .sessions
    }
}
