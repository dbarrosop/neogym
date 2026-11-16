import Combine
import NeoGymKit
import Nhost
import SwiftUI
import UIKit

/// Signed-in shell: a native `TabView` with five areas, each with its own
/// `NavigationStack`. The rest timer and the open session ride in the tab
/// view's bottom accessory on every tab.
struct AppShellView: View {
    let session: StoredSession
    let environment: AppShellEnvironment
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
    @State private var hasAppliedInitialScreen = false
    /// Cross-tab invalidation: bumped after training or nutrition mutations so
    /// Today and Progress revalidate their cached reads.
    @State private var trainingRevision = 0
    @State private var nutritionRevision = 0
    @ObservedObject var restTimer: RestTimerController
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.appDeepLinks) private var deepLinks

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
                    journalRepository: environment.repositories.journal,
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
        .environment(\.storageBaseURL, environment.storageBaseURL)
        .environment(\.energyWidgetUpdates, environment.isDemo ? .disabled : .live)
        .onAppear {
            guard !hasAppliedInitialScreen else { return }
            hasAppliedInitialScreen = true
            applyInitialScreen()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { nutritionLogDate.refreshToday() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            nutritionLogDate.refreshToday()
        }
        .onReceive(pendingDeepLinks) { link in
            guard let link else { return }
            open(link)
            deepLinks?.consume(link)
        }
    }

    /// Emits the current pending link on subscribe, so a cold launch applies it once mounted.
    private var pendingDeepLinks: AnyPublisher<AppDeepLink?, Never> {
        deepLinks?.$pending.eraseToAnyPublisher() ?? Just(nil).eraseToAnyPublisher()
    }

    /// Widgets open Today; the rest timer Live Activity opens its session.
    private func open(_ link: AppDeepLink) {
        switch link {
        case .today: selection = .today
        case let .session(id): openSession(id)
        }
    }

    private var todayTab: some View {
        TodayView(
            sessionsRepository: sessionsRepository,
            nutritionRepository: nutritionRepository,
            bodyRepository: bodyRepository,
            bodyHealthImporter: environment.bodyHealthImporter,
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
            workoutsRepository: environment.repositories.workouts,
            healthWorkoutRepository: environment.healthWorkoutRepository,
            healthWorkoutImporter: environment.workoutHealthImporter,
            sessionsRepository: sessionsRepository,
            exercisesRepository: exercisesRepository,
            storageBaseURL: environment.storageBaseURL,
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
            storageBaseURL: environment.storageBaseURL,
            bodyRepository: bodyRepository,
            bodyHealthImporter: environment.bodyHealthImporter,
            energyRepository: environment.repositories.energy,
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

    private var sessionsRepository: any SessionsRepositoryProtocol & TodayTrainingProviding { environment.repositories.sessions }
    private var exercisesRepository: any ExercisesRepositoryProtocol { environment.repositories.exercises }
    private var nutritionRepository: any NutritionFoodMealRepositoryProtocol { environment.repositories.nutrition }
    private var bodyRepository: any BodyMeasurementsRepositoryProtocol { environment.repositories.body }

    private func applyInitialScreen() {
        guard environment.isDemo else { return }
        switch environment.initialScreen {
        case .today: selection = .today
        case .sessions, .workouts, .exercises, .currentSession:
            selection = .train
            if environment.initialScreen == .workouts { trainSection = .workouts }
            if environment.initialScreen == .exercises { trainSection = .exercises }
            if environment.initialScreen == .currentSession { openSession("demo-session-\(DateOnly.todayLocalISO())") }
        case .log, .plans, .foods, .meals:
            selection = .nutrition
            if environment.initialScreen == .plans { nutritionSection = .plans }
            if environment.initialScreen == .foods { nutritionSection = .foods }
            if environment.initialScreen == .meals { nutritionSection = .meals }
        case .overview, .muscles, .strength, .body, .energy:
            selection = .progress
            if environment.initialScreen == .muscles { progressSection = .muscles }
            if environment.initialScreen == .strength { progressSection = .strength }
            if environment.initialScreen == .body { progressSection = .body }
            if environment.initialScreen == .energy { progressSection = .energy }
        case .journal, .account:
            selection = .me
            if environment.initialScreen == .account { meSection = .account }
        }
    }
}

#Preview {
    AppShellView(
        session: NeoGymPreviewFixtures.session,
        environment: .live(NhostClientFactory.makeEnvironment(), ownerId: "user-1"),
        isSigningOut: false,
        changeEmailModel: nil,
        signOut: {},
        restTimer: RestTimerController(ownerId: "preview", effects: RestTimerSystemEffects())
    )
    .environmentObject(AuthStore(authService: NeoGymPreviewAuthService(), autoBootstrap: false))
    .environmentObject(PhoneAccountConnectivity(patService: NhostWatchPATService(client: NhostClientFactory.makeClient())))
}
