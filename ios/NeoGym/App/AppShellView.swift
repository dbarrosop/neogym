import NeoGymKit
import Nhost
import SwiftUI

enum AppDestination: String, CaseIterable, Identifiable {
    case workouts
    case nutrition
    case me

    var id: String { rawValue }

    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .nutrition: "Nutrition"
        case .me: "Me"
        }
    }

    var icon: String {
        switch self {
        case .workouts: "figure.strengthtraining.traditional"
        case .nutrition: "fork.knife"
        case .me: "person.crop.circle"
        }
    }

    var label: Label<Text, Image> {
        Label(title, systemImage: icon)
    }
}

struct AppShellView: View {
    let session: StoredSession
    let environment: AppEnvironment
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var selection: AppDestination = .workouts
    @State private var pendingSessionId: String?

    var body: some View {
        TabView(selection: $selection) {
            WorkoutsSectionNavigationView(
                workoutsRepository: WorkoutsRepository(graphQL: environment.graphQLService),
                sessionsRepository: SessionsRepository(graphQL: environment.graphQLService),
                exercisesRepository: ExercisesRepository(graphQL: environment.graphQLService),
                storageBaseURL: environment.client.serviceURLs.storage,
                currentUserId: session.user?.id,
                pendingSessionId: $pendingSessionId
            )
            .tabItem { AppDestination.workouts.label }
            .tag(AppDestination.workouts)

            NutritionNavigationView(
                repository: NutritionFoodMealRepository(graphQL: environment.graphQLService),
                currentUserId: session.user?.id
            )
            .tabItem { AppDestination.nutrition.label }
            .tag(AppDestination.nutrition)

            MeNavigationView(
                session: session,
                bodyRepository: BodyMeasurementsRepository(graphQL: environment.graphQLService),
                bodyHealthImporter: Self.makeBodyHealthImporter(),
                journalRepository: JournalRepository(graphQL: environment.graphQLService),
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
            .tabItem { AppDestination.me.label }
            .tag(AppDestination.me)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea(.container, edges: .bottom)
    }

    private static func makeBodyHealthImporter() -> (any BodyMeasurementsHealthImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitBodyMeasurementImporter()
        #else
        nil
        #endif
    }
}

#Preview {
    AppShellView(
        session: NeoGymPreviewFixtures.session,
        environment: NhostClientFactory.makeEnvironment(),
        isSigningOut: false,
        changeEmailModel: nil,
        signOut: {}
    )
}
