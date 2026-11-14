import NeoGymKit
import Nhost
import SwiftUI
import UIKit

/// Signed-in shell: a native `TabView` with five areas, each with its own
/// `NavigationStack`. The rest timer and the open session ride in the tab
/// view's bottom accessory on every tab.
struct AppShellView: View {
    let session: StoredSession
    let environment: AppEnvironment
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var selection: AppTab = .today
    @State private var trainPath: [TrainRoute] = []
    @State private var nutritionPath: [NutritionRoute] = []
    @State private var progressPath: [ProgressRoute] = []
    @State private var trainSection: TrainSection = .sessions
    @State private var nutritionSection: NutritionSection = .log
    @State private var nutritionLogDate = NutritionLogDateSelection()
    @State private var progressSection: ProgressSection = .overview
    @State private var meSection: MeSection = .journal
    /// Cross-tab invalidation: bumped after training or nutrition mutations so
    /// Today and Progress revalidate their cached reads.
    @State private var trainingRevision = 0
    @State private var nutritionRevision = 0
    @StateObject private var restTimer = RestTimerController()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView(selection: $selection) {
            Tab(AppTab.today.title, systemImage: AppTab.today.systemImage, value: AppTab.today) {
                todayTab
            }
            Tab(AppTab.train.title, systemImage: AppTab.train.systemImage, value: AppTab.train) {
                trainTab
            }
            Tab(AppTab.nutrition.title, systemImage: AppTab.nutrition.systemImage, value: AppTab.nutrition) {
                NutritionNavigationView(
                    repository: nutritionRepository,
                    currentUserId: userId,
                    path: $nutritionPath,
                    section: $nutritionSection,
                    logDate: $nutritionLogDate,
                    nutritionRevision: nutritionRevision,
                    onNutritionMutated: { nutritionRevision += 1 }
                )
            }
            Tab(AppTab.progress.title, systemImage: AppTab.progress.systemImage, value: AppTab.progress) {
                progressTab
            }
            Tab(AppTab.me.title, systemImage: AppTab.me.systemImage, value: AppTab.me) {
                MeNavigationView(
                    session: session,
                    journalRepository: JournalRepository(graphQL: environment.graphQLService),
                    isSigningOut: isSigningOut,
                    changeEmailModel: changeEmailModel,
                    signOut: signOut,
                    section: $meSection
                )
            }
        }
        .tabViewBottomAccessory(isEnabled: showsAccessory) {
            RestTimerAccessory(timer: restTimer, openSessionId: openSessionId, onOpenSession: openSession)
        }
        .environment(\.storageBaseURL, environment.client.serviceURLs.storage)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { nutritionLogDate.refreshToday() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            nutritionLogDate.refreshToday()
        }
    }

    private var todayTab: some View {
        TodayView(
            sessionsRepository: sessionsRepository,
            nutritionRepository: nutritionRepository,
            bodyRepository: bodyRepository,
            bodyHealthImporter: Self.makeBodyHealthImporter(),
            currentUserId: userId,
            isSelected: selection == .today,
            revision: trainingRevision + nutritionRevision,
            actions: TodayActions(
                openSession: openSession,
                openTrain: { section in
                    trainSection = section
                    trainPath = []
                    selection = .train
                },
                openNutritionLog: {
                    nutritionLogDate.showToday()
                    nutritionSection = .log
                    nutritionPath = []
                    selection = .nutrition
                },
                openProgress: { section in
                    progressSection = section
                    progressPath = []
                    selection = .progress
                },
                nutritionLogged: { nutritionRevision += 1 }
            )
        )
    }

    private var trainTab: some View {
        TrainNavigationView(
            workoutsRepository: WorkoutsRepository(graphQL: environment.graphQLService),
            healthWorkoutRepository: HealthWorkoutRepository(client: environment.client, ownerUserId: userId ?? ""),
            healthWorkoutImporter: Self.makeWorkoutHealthImporter(),
            sessionsRepository: sessionsRepository,
            exercisesRepository: exercisesRepository,
            storageBaseURL: environment.client.serviceURLs.storage,
            currentUserId: userId,
            isSelected: selection == .train,
            path: $trainPath,
            section: $trainSection,
            restTimer: restTimer,
            onTrainingMutated: { trainingRevision += 1 }
        )
    }

    private var progressTab: some View {
        ProgressNavigationView(
            sessionsRepository: sessionsRepository,
            exercisesRepository: exercisesRepository,
            storageBaseURL: environment.client.serviceURLs.storage,
            bodyRepository: bodyRepository,
            bodyHealthImporter: Self.makeBodyHealthImporter(),
            energyRepository: DailyEnergyRepository(graphQL: environment.graphQLService),
            nutritionRepository: nutritionRepository,
            currentUserId: userId,
            trainingRevision: trainingRevision,
            path: $progressPath,
            section: $progressSection,
            onSessionStarted: openSession
        )
    }

    // MARK: - Live session

    /// The innermost session pushed in the Train stack counts as open.
    private var openSessionId: String? {
        trainPath.last(where: { $0.sessionId != nil })?.sessionId
    }

    private var showsAccessory: Bool {
        restTimer.isRunning || openSessionId != nil
    }

    /// Selects Train and shows the session: pops back to it when it is already
    /// in the stack, otherwise pushes it. Used by deep links, Today and the accessory.
    private func openSession(_ sessionId: String) {
        guard let id = WorkoutSessionRouteMapping.sessionIdToOpen(from: sessionId) else { return }
        selection = .train
        if let index = trainPath.lastIndex(of: .sessionDetail(id)) {
            trainPath = Array(trainPath.prefix(through: index))
        } else {
            trainPath = WorkoutSessionRouteMapping.pathAfterOpeningSession(
                id,
                currentPath: trainPath,
                makeRoute: TrainRoute.sessionDetail
            )
        }
        trainingRevision += 1
    }

    // MARK: - Dependencies

    private var userId: String? { session.user?.id }

    private var sessionsRepository: SessionsRepository {
        SessionsRepository(graphQL: environment.graphQLService)
    }

    private var exercisesRepository: ExercisesRepository {
        ExercisesRepository(graphQL: environment.graphQLService)
    }

    private var nutritionRepository: NutritionFoodMealRepository {
        NutritionFoodMealRepository(graphQL: environment.graphQLService)
    }

    private var bodyRepository: BodyMeasurementsRepository {
        BodyMeasurementsRepository(graphQL: environment.graphQLService)
    }

    private static func makeBodyHealthImporter() -> (any BodyMeasurementsHealthImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitBodyMeasurementImporter()
        #else
        nil
        #endif
    }

    private static func makeWorkoutHealthImporter() -> (any HealthWorkoutImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitWorkoutImporter()
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
    .environmentObject(AuthStore(authService: NeoGymPreviewAuthService(), autoBootstrap: false))
    .environmentObject(PhoneAccountConnectivity(patService: NhostWatchPATService(client: NhostClientFactory.makeClient())))
}
