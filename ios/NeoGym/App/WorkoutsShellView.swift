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

    var icon: String {
        switch self {
        case .sessions: "timer"
        case .workouts: "figure.strengthtraining.traditional"
        case .exercises: "dumbbell"
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

    var body: some View {
        NavigationView {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .top) {
                    SecondarySectionBar(selection: $selection)
                }
                .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .sessions:
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                pendingSessionId: $pendingSessionId
            )
        case .workouts:
            WorkoutsListView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                onSessionStarted: openSession
            )
        case .exercises:
            ExercisesListView(
                repository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: openSession
            )
        }
    }

    private func openSession(_ sessionId: String) {
        pendingSessionId = sessionId
        selection = .sessions
    }
}
