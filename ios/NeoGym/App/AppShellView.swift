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
    let runtimeConfiguration: NeoGymRuntimeConfiguration
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var selection: AppDestination = .workouts
    @State private var pendingSessionId: String?
    @StateObject private var restTimer: RestTimerController

    init(
        session: StoredSession,
        environment: AppEnvironment,
        runtimeConfiguration: NeoGymRuntimeConfiguration,
        isSigningOut: Bool,
        changeEmailModel: ChangeEmailModel?,
        signOut: @escaping () -> Void
    ) {
        self.session = session
        self.environment = environment
        self.runtimeConfiguration = runtimeConfiguration
        self.isSigningOut = isSigningOut
        self.changeEmailModel = changeEmailModel
        self.signOut = signOut
        _restTimer = StateObject(wrappedValue: RestTimerController(
            notificationIdentifier: runtimeConfiguration.notificationIdentifier
        ))
    }

    var body: some View {
        ZStack {
            areaView(.workouts) {
                WorkoutsSectionNavigationView(
                    workoutsRepository: WorkoutsRepository(graphQL: environment.graphQLService),
                    sessionsRepository: SessionsRepository(graphQL: environment.graphQLService),
                    exercisesRepository: ExercisesRepository(graphQL: environment.graphQLService),
                    storageBaseURL: environment.client.serviceURLs.storage,
                    currentUserId: session.user?.id,
                    areaSelection: $selection,
                    restTimer: restTimer,
                    pendingSessionId: $pendingSessionId
                )
            }

            areaView(.nutrition) {
                NutritionNavigationView(
                    repository: NutritionFoodMealRepository(graphQL: environment.graphQLService),
                    bodyRepository: BodyMeasurementsRepository(graphQL: environment.graphQLService),
                    bodyHealthImporter: Self.makeBodyHealthImporter(),
                    energyRepository: DailyEnergyRepository(graphQL: environment.graphQLService),
                    energyHealthImporter: Self.makeEnergyHealthImporter(),
                    currentUserId: session.user?.id,
                    widgetSnapshotStore: EnergyBalanceWidgetSnapshotStore(
                        suiteName: runtimeConfiguration.appGroupIdentifier
                    ),
                    areaSelection: $selection
                )
            }

            areaView(.me) {
                MeNavigationView(
                    session: session,
                    journalRepository: JournalRepository(graphQL: environment.graphQLService),
                    isSigningOut: isSigningOut,
                    changeEmailModel: changeEmailModel,
                    signOut: signOut,
                    areaSelection: $selection
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func areaView(_ destination: AppDestination, @ViewBuilder content: () -> some View) -> some View {
        let isActive = selection == destination
        content()
            .opacity(isActive ? 1 : 0)
            .accessibilityHidden(!isActive)
            .allowsHitTesting(isActive)
    }

    private static func makeBodyHealthImporter() -> (any BodyMeasurementsHealthImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitBodyMeasurementImporter()
        #else
        nil
        #endif
    }

    private static func makeEnergyHealthImporter() -> (any DailyEnergyHealthImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitDailyEnergyImporter()
        #else
        nil
        #endif
    }
}

#Preview {
    AppShellView(
        session: NeoGymPreviewFixtures.session,
        environment: NhostClientFactory.makeEnvironment(),
        runtimeConfiguration: NeoGymPreviewFixtures.runtimeConfiguration,
        isSigningOut: false,
        changeEmailModel: nil,
        signOut: {}
    )
}
